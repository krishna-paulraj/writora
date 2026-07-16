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
          `rabbit connect failed: ${err instanceof Error ? err.message : String(err)}`,
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
          `rebind ${reg.queue} failed: ${err instanceof Error ? err.message : String(err)}`,
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
        `enqueue ${queue} failed: ${err instanceof Error ? err.message : String(err)} — running inline`,
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
      // Payloads arrive as JSON (deserialized to `unknown`), so wrap the typed
      // handler at the boundary rather than assigning Handler<T> to
      // Handler<unknown> — the latter is unsound under strictFunctionTypes.
      handler: (payload: unknown) => handler(payload as T),
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
            `consumer ${reg.queue} failed: ${err instanceof Error ? err.message : String(err)}`,
          );
          // Re-queue once with a tiny delay; on a second failure move the
          // payload to a durable dead-letter queue so it is never silently
          // lost. (No broker DLX is configured, so we self-publish instead of
          // relying on x-dead-letter-exchange — which would require recreating
          // the existing queues.)
          if (msg.fields.redelivered) {
            await this.deadLetter(channel, reg.queue, msg);
          } else {
            setTimeout(() => channel.nack(msg, false, true), 1000);
          }
        }
      })();
    });
    this.logger.log(`consuming ${reg.queue}`);
  }

  /**
   * Move a message that has already failed twice to a durable dead-letter queue
   * (`<queue>.dead`) so its payload survives instead of being nack-and-dropped,
   * then ack the original once it is safely copied. If the copy itself fails we
   * log the full payload before dropping so it can still be recovered.
   */
  private async deadLetter(
    channel: amqp.Channel,
    queue: string,
    msg: amqp.ConsumeMessage,
  ): Promise<void> {
    const deadQueue = `${queue}.dead`;
    // amqplib types message properties as any — narrow before reuse.
    const originalContentType: unknown = msg.properties.contentType;
    try {
      await channel.assertQueue(deadQueue, { durable: true });
      channel.sendToQueue(deadQueue, msg.content, {
        persistent: true,
        contentType:
          typeof originalContentType === 'string'
            ? originalContentType
            : 'application/json',
        headers: {
          ...(msg.properties.headers ?? {}),
          'x-death-origin': queue,
          'x-death-reason': 'retries-exhausted',
          'x-death-at': new Date().toISOString(),
        },
      });
      channel.ack(msg);
      this.logger.warn(
        `dead-lettered message from ${queue} to ${deadQueue} after repeated failure`,
      );
    } catch (err) {
      // Could not persist to the dead-letter queue — drop it, but log the full
      // payload at error level so it is at least durably recorded.
      this.logger.error(
        `failed to dead-letter ${queue} message (${
          err instanceof Error ? err.message : String(err)
        }) — dropping after logging payload: ${msg.content.toString()}`,
      );
      channel.nack(msg, false, false);
    }
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
        `inline ${queue} failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
