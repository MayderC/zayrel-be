import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { EmailProvider, SendMailOptions } from './email-provider.interface';

/**
 * Resend Email Provider
 * Uses Resend API for transactional emails
 */
@Injectable()
export class ResendProvider implements EmailProvider {
    readonly name = 'resend';
    private readonly logger = new Logger(ResendProvider.name);
    private readonly resend: Resend;
    private readonly defaultFrom: string;

    constructor(private readonly configService: ConfigService) {
        const apiKey = this.configService.get<string>('RESEND_API_KEY');

        if (!apiKey) {
            this.logger.warn('⚠️ RESEND_API_KEY not set - emails will fail');
        }

        this.resend = new Resend(apiKey);
        this.defaultFrom = this.configService.get<string>('MAIL_FROM') || 'onboarding@resend.dev';
    }

    async sendMail(options: SendMailOptions): Promise<void> {
        this.logger.debug(`Sending email via Resend to ${options.to}`);

        const { error } = await this.resend.emails.send({
            from: options.from || this.defaultFrom,
            to: options.to,
            subject: options.subject,
            html: options.html,
            text: options.text,
        });

        if (error) {
            this.logger.error(`❌ Resend error: ${error.message}`);
            throw new Error(`Resend email failed: ${error.message}`);
        }

        this.logger.log(`✅ Email sent via Resend to ${options.to}`);
    }
}
