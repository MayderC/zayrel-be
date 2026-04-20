import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DesignsController } from './designs.controller';
import { DesignsService } from './designs.service';
import { LibraryDesign, LibraryDesignSchema } from '../database/schemas';
import { ImagesModule } from '../images/images.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: LibraryDesign.name, schema: LibraryDesignSchema }]),
    ImagesModule,
  ],
  controllers: [DesignsController],
  providers: [DesignsService],
  exports: [DesignsService],
})
export class DesignsModule {}
