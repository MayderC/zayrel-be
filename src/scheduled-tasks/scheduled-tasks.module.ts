import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { ScheduledTasksService } from './scheduled-tasks.service';
import { Cart, CartSchema, User, UserSchema, Coupon, CouponSchema, Variant, VariantSchema } from '../database/schemas';
import { MailModule } from '../mail/mail.module';

/**
 * Scheduled Tasks Module
 * 
 * Handles cron jobs and scheduled tasks like:
 * - Abandoned cart email reminders
 * - Periodic cleanup tasks
 */
@Module({
    imports: [
        ScheduleModule.forRoot(),
        MongooseModule.forFeature([
            { name: Cart.name, schema: CartSchema },
            { name: User.name, schema: UserSchema },
            { name: Coupon.name, schema: CouponSchema },
            { name: Variant.name, schema: VariantSchema },
        ]),
        MailModule,
    ],
    providers: [ScheduledTasksService],
    exports: [ScheduledTasksService],
})
export class ScheduledTasksModule { }
