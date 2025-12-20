import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { Order, OrderSchema, OrderItem, OrderItemSchema, Variant, VariantSchema, Product, ProductSchema } from '../database/schemas';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Order.name, schema: OrderSchema },
            { name: OrderItem.name, schema: OrderItemSchema },
            { name: Variant.name, schema: VariantSchema },
            { name: Product.name, schema: ProductSchema },
        ]),
    ],
    controllers: [OrdersController],
    providers: [OrdersService],
    exports: [OrdersService],
})
export class OrdersModule { }
