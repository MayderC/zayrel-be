import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import {
  User,
  UserSchema,
  Color,
  ColorSchema,
  Size,
  SizeSchema,
  Variant,
  VariantSchema,
  Product,
  ProductSchema,
  Category,
  CategorySchema,
  ProductListing,
  ProductListingSchema,
  Order,
  OrderSchema,
  OrderItem,
  OrderItemSchema,
  OrderItemDesign,
  OrderItemDesignSchema,
  Design,
  DesignSchema,
  Image,
  ImageSchema,
  StockLog,
  StockLogSchema,
} from './schemas';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('MONGODB_URI') || 'mongodb://localhost:27017/zayrel_db',
        dbName: config.get<string>('MONGODB_DB_NAME') || 'zayrel_db',
      }),
    }),
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Color.name, schema: ColorSchema },
      { name: Size.name, schema: SizeSchema },
      { name: Variant.name, schema: VariantSchema },
      { name: Product.name, schema: ProductSchema },
      { name: Category.name, schema: CategorySchema },
      { name: ProductListing.name, schema: ProductListingSchema },
      { name: Order.name, schema: OrderSchema },
      { name: OrderItem.name, schema: OrderItemSchema },
      { name: OrderItemDesign.name, schema: OrderItemDesignSchema },
      { name: Design.name, schema: DesignSchema },
      { name: Image.name, schema: ImageSchema },
      { name: StockLog.name, schema: StockLogSchema },
    ]),
  ],
  exports: [MongooseModule],
})
export class DatabaseModule {}
