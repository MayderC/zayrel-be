import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ImagesController } from './images.controller';
import { ImagesService } from './images.service';
import { Image, ImageSchema, Product, ProductSchema } from '../database/schemas';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Image.name, schema: ImageSchema },
            { name: Product.name, schema: ProductSchema },
        ]),
    ],
    controllers: [ImagesController],
    providers: [ImagesService],
    exports: [ImagesService],
})
export class ImagesModule { }
