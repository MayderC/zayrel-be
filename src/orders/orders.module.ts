import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrderAccessGuard } from '../auth/order-access.guard';
import { Order, OrderSchema, OrderItem, OrderItemSchema, Variant, VariantSchema, Product, ProductSchema, User, UserSchema } from '../database/schemas';
import { NotificationsModule } from '../notifications/notifications.module';
import { StorageModule } from '../storage/storage.module';
import { DashboardModule } from '../dashboard/dashboard.module';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Order.name, schema: OrderSchema },
            { name: OrderItem.name, schema: OrderItemSchema },
            { name: Variant.name, schema: VariantSchema },
            { name: Product.name, schema: ProductSchema },
            { name: User.name, schema: UserSchema },
        ]),
        forwardRef(() => NotificationsModule),
        StorageModule,
        forwardRef(() => DashboardModule),
    ],
    controllers: [OrdersController],
    providers: [OrdersService, OrderAccessGuard],
    exports: [OrdersService, OrderAccessGuard],
})
export class OrdersModule { }

