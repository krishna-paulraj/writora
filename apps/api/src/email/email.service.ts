import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { render } from '@react-email/render';
import { Resend } from 'resend';
import type { ReactElement } from 'react';
import { VerifyEmail } from './templates/verify-email';
import { PasswordReset } from './templates/password-reset';
import { SubscribeConfirm } from './templates/subscribe-confirm';
import { NewPost } from './templates/new-post';

interface SendOpts {
  to: string;
  subject: string;
  react: ReactElement;
  replyTo?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend | null;
  private readonly from: string;
  private readonly defaultReplyTo: string | undefined;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    this.from =
      this.configService.get<string>('EMAIL_FROM') ||
      'Writora <onboarding@resend.dev>';
    this.defaultReplyTo = this.configService.get<string>('EMAIL_REPLY_TO');
    this.resend = apiKey ? new Resend(apiKey) : null;
    if (!this.resend) {
      this.logger.warn(
        'RESEND_API_KEY not set — emails will be logged instead of sent',
      );
    }
  }

  private async send(opts: SendOpts): Promise<void> {
    const html = await render(opts.react);
    const text = await render(opts.react, { plainText: true });

    if (!this.resend) {
      this.logger.log(
        `[email skipped — no RESEND_API_KEY]\nTo: ${opts.to}\nSubject: ${opts.subject}\n${text.slice(0, 400)}…`,
      );
      return;
    }

    try {
      const { error } = await this.resend.emails.send({
        from: this.from,
        to: opts.to,
        replyTo: opts.replyTo ?? this.defaultReplyTo,
        subject: opts.subject,
        html,
        text,
      });
      if (error) {
        this.logger.error(
          `Resend error sending to ${opts.to}: ${error.name} ${error.message}`,
        );
      }
    } catch (err) {
      this.logger.error(
        `Failed to send email to ${opts.to}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  sendVerifyEmail(to: string, name: string, verifyUrl: string) {
    return this.send({
      to,
      subject: 'Verify your Writora email',
      react: VerifyEmail({ name, verifyUrl }),
    });
  }

  sendPasswordReset(to: string, name: string, resetUrl: string) {
    return this.send({
      to,
      subject: 'Reset your Writora password',
      react: PasswordReset({ name, resetUrl }),
    });
  }

  sendSubscribeConfirm(to: string, authorName: string, confirmUrl: string) {
    return this.send({
      to,
      subject: `Confirm your subscription to ${authorName}`,
      react: SubscribeConfirm({ authorName, confirmUrl }),
    });
  }

  sendNewPost(opts: {
    to: string;
    authorName: string;
    title: string;
    description: string;
    imageUrl?: string | null;
    postUrl: string;
    unsubscribeUrl: string;
  }) {
    return this.send({
      to: opts.to,
      subject: opts.title,
      react: NewPost({
        authorName: opts.authorName,
        title: opts.title,
        description: opts.description,
        imageUrl: opts.imageUrl,
        postUrl: opts.postUrl,
        unsubscribeUrl: opts.unsubscribeUrl,
      }),
    });
  }
}
