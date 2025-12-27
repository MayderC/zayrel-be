import { Module, forwardRef } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { TelegramService } from './telegram.service';
import { TelegramController } from './telegram.controller';
import { MailModule } from '../mail/mail.module';
import { OrdersModule } from '../orders/orders.module';

/**
 * Notifications Module
 * 
 * Handles all customer-facing notifications for order and payment events.
 * Uses MailService for email delivery and TelegramService for admin notifications.
 */
@Module({
    imports: [
        MailModule,
        forwardRef(() => OrdersModule),
    ],
    controllers: [TelegramController],
    providers: [NotificationsService, TelegramService],
    exports: [NotificationsService, TelegramService],
})
export class NotificationsModule { }
