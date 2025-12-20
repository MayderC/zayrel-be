import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

/**
 * Notifications Module (STUB)
 * 
 * Export NotificationsService for use in other modules (e.g., OrdersModule)
 * 
 * To activate:
 * 1. Uncomment the methods in notifications.service.ts
 * 2. Import this module in app.module.ts
 * 3. Inject NotificationsService in OrdersService
 */
@Module({
    providers: [NotificationsService],
    exports: [NotificationsService],
})
export class NotificationsModule { }
