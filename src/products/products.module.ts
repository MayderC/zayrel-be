import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Product, ProductSchema } from '../database/schemas';
import { Variant, VariantSchema } from '../database/schemas';
import { ProductListing, ProductListingSchema } from '../database/schemas';
import { Color, ColorSchema } from '../database/schemas';
import { Size, SizeSchema } from '../database/schemas';
import { Category, CategorySchema } from '../database/schemas';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Product.name, schema: ProductSchema },
      { name: Variant.name, schema: VariantSchema },
      { name: ProductListing.name, schema: ProductListingSchema },
      { name: Color.name, schema: ColorSchema },
      { name: Size.name, schema: SizeSchema },
      { name: Category.name, schema: CategorySchema },
    ]),
  ],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule { }
