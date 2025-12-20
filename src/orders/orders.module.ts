import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { Order, OrderSchema, OrderItem, OrderItemSchema, Variant, VariantSchema, Product, ProductSchema } from '../database/schemas';
import { NotificationsModule } from '../notifications/notifications.module';
import { StorageModule } from '../storage/storage.module';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Order.name, schema: OrderSchema },
            { name: OrderItem.name, schema: OrderItemSchema },
            { name: Variant.name, schema: VariantSchema },
            { name: Product.name, schema: ProductSchema },
        ]),
        NotificationsModule,
        StorageModule,
    ],
    controllers: [OrdersController],
    providers: [OrdersService],
    exports: [OrdersService],
})
export class OrdersModule { }
