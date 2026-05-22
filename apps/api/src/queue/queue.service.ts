import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';

type Handler<T> = (payload: T) => Promise<void>;

interface RegisteredHandler {
  queue: string;
  prefetch: number;
  handler: Handler<unknown>;
}

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private readonly url: string | undefined;
  private connection: amqp.ChannelModel | null = null;
  private publishChannel: amqp.Channel | null = null;
  private readonly consumers: RegisteredHandler[] = [];
  private readonly consumerChannels: amqp.Channel[] = [];
  private connecting: Promise<void> | null = null;
  private shuttingDown = false;

  constructor(config: ConfigService) {
    this.url = config.get<string>('RABBITMQ_URL');
    if (!this.url) {
      this.logger.log(
        'RabbitMQ disabled (RABBITMQ_URL not set) — falling back to inline execution',
      );
    }
  }

  async onModuleInit() {
    if (!this.url) return;
    await this.ensureConnected();
  }

  async onModuleDestroy() {
    this.shuttingDown = true;
    try {
      for (const ch of this.consumerChannels) {
        await ch.close().catch(() => {});
      }
      if (this.publishChannel)
        await this.publishChannel.close().catch(() => {});
      if (this.connection) await this.connection.close().catch(() => {});
    } catch {
      // ignore
    }
  }

  private async ensureConnected(): Promise<void> {
    if (!this.url) return;
    if (this.connection && this.publishChannel) return;
    if (this.connecting) return this.connecting;

    this.connecting = (async () => {
      try {
        this.connection = await amqp.connect(this.url!);
        this.connection.on('error', (err) =>
          this.logger.warn(`rabbit connection error: ${err.message}`),
        );
        this.connection.on('close', () => {
          this.logger.warn('rabbit connection closed');
          this.connection = null;
          this.publishChannel = null;
          if (!this.shuttingDown) {
            // Reconnect with backoff; rebind any consumers we knew about
            setTimeout(() => {
              this.ensureConnected()
                .then(() => this.rebindConsumers())
                .catch(() => {});
            }, 2000);
          }
        });
        this.publishChannel = await this.connection.createChannel();
        this.logger.log('rabbit connected');
      } catch (err) {
        this.logger.error(
          `rabbit connect failed: ${err instanceof Error ? err.message : err}`,
        );
        this.connection = null;
        this.publishChannel = null;
        throw err;
      } finally {
        this.connecting = null;
      }
    })();

    return this.connecting;
  }

  private async rebindConsumers(): Promise<void> {
    for (const reg of this.consumers) {
      try {
        await this.startConsumer(reg);
      } catch (err) {
        this.logger.warn(
          `rebind ${reg.queue} failed: ${err instanceof Error ? err.message : err}`,
        );
      }
    }
  }

  /**
   * Publish a JSON payload to a durable queue. If RabbitMQ is unavailable,
   * invokes the local handler (if any is registered) inline so dev still works.
   */
  async enqueue<T>(queue: string, payload: T): Promise<void> {
    if (!this.url) {
      await this.runInline(queue, payload);
      return;
    }
    try {
      await this.ensureConnected();
      if (!this.publishChannel) throw new Error('No publish channel');
      await this.publishChannel.assertQueue(queue, { durable: true });
      const ok = this.publishChannel.sendToQueue(
        queue,
        Buffer.from(JSON.stringify(payload)),
        { persistent: true, contentType: 'application/json' },
      );
      if (!ok) {
        // Buffer is full; fall back to inline execution
        await this.runInline(queue, payload);
      }
    } catch (err) {
      this.logger.warn(
        `enqueue ${queue} failed: ${err instanceof Error ? err.message : err} — running inline`,
      );
      await this.runInline(queue, payload);
    }
  }

  /**
   * Register a consumer for a queue. The handler must be idempotent — messages
   * can be redelivered after a crash. Throws cause re-queue with delay.
   */
  async consume<T>(
    queue: string,
    handler: Handler<T>,
    opts: { prefetch?: number } = {},
  ): Promise<void> {
    const registration: RegisteredHandler = {
      queue,
      prefetch: opts.prefetch ?? 1,
      handler: handler,
    };
    this.consumers.push(registration);
    if (this.url) {
      await this.startConsumer(registration);
    }
  }

  private async startConsumer(reg: RegisteredHandler): Promise<void> {
    await this.ensureConnected();
    if (!this.connection) return;
    const channel = await this.connection.createChannel();
    await channel.prefetch(reg.prefetch);
    await channel.assertQueue(reg.queue, { durable: true });
    this.consumerChannels.push(channel);
    await channel.consume(reg.queue, (msg) => {
      if (!msg) return;
      void (async () => {
        try {
          const payload = JSON.parse(msg.content.toString()) as unknown;
          await reg.handler(payload);
          channel.ack(msg);
          return;
        } catch (err) {
          this.logger.error(
            `consumer ${reg.queue} failed: ${err instanceof Error ? err.message : err}`,
          );
          // Re-queue once with a tiny delay; if it fails again, drop to dead-letter.
          // Without DLX configured, redelivered=true messages get nack-and-drop here.
          if (msg.fields.redelivered) {
            channel.nack(msg, false, false);
          } else {
            setTimeout(() => channel.nack(msg, false, true), 1000);
          }
        }
      })();
    });
    this.logger.log(`consuming ${reg.queue}`);
  }

  private async runInline<T>(queue: string, payload: T): Promise<void> {
    const reg = this.consumers.find((c) => c.queue === queue);
    if (!reg) {
      this.logger.warn(`no handler registered for ${queue} — message dropped`);
      return;
    }
    try {
      await reg.handler(payload);
    } catch (err) {
      this.logger.error(
        `inline ${queue} failed: ${err instanceof Error ? err.message : err}`,
      );
    }
  }
}
