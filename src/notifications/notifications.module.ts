import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { MailModule } from '../mail/mail.module';

/**
 * Notifications Module
 * 
 * Handles all customer-facing notifications for order and payment events.
 * Uses MailService for email delivery.
 */
@Module({
    imports: [MailModule],
    providers: [NotificationsService],
    exports: [NotificationsService],
})
export class NotificationsModule { }
