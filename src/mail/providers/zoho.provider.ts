import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { EmailProvider, SendMailOptions } from './email-provider.interface';

/**
 * Zoho SMTP Email Provider
 * Uses @nestjs-modules/mailer with Nodemailer under the hood
 */
@Injectable()
export class ZohoProvider implements EmailProvider {
    readonly name = 'zoho';
    private readonly logger = new Logger(ZohoProvider.name);

    constructor(private readonly mailerService: MailerService) { }

    async sendMail(options: SendMailOptions): Promise<void> {
        this.logger.debug(`Sending email via Zoho SMTP to ${options.to}`);

        await this.mailerService.sendMail({
            to: options.to,
            subject: options.subject,
            html: options.html,
            from: options.from,
            text: options.text,
        });

        this.logger.log(`✅ Email sent via Zoho to ${options.to}`);
    }
}
