import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { LibraryDesign, LibraryDesignDocument } from '../database/schemas';
import { CreateDesignDto, UpdateDesignDto } from './designs.dto';
import { ImagesService } from '../images/images.service';

@Injectable()
export class DesignsService {
    constructor(
        @InjectModel(LibraryDesign.name) private designModel: Model<LibraryDesignDocument>,
        private imagesService: ImagesService,
    ) { }

    async create(dto: CreateDesignDto, file: any, userId: string): Promise<LibraryDesignDocument> {
        // Upload to Cloudinary using the generic method in ImagesService
        const folder = 'library/designs';
        const imageRecord = await this.imagesService.uploadImage(file, folder, 'design', userId);

        // Create the Design record
        return await this.designModel.create({
            ...dto,
            url: imageRecord.url,
            publicId: imageRecord.filename,
            width: imageRecord.width,
            height: imageRecord.height,
            format: imageRecord.type, // imageRecord fields match what we need
        });
    }

    async findAll(params: { tag?: string; search?: string } = {}): Promise<LibraryDesignDocument[]> {
        const query: any = {};
        if (params.tag) {
            query.tags = params.tag;
        }
        if (params.search) {
            query.$or = [
                { name: { $regex: params.search, $options: 'i' } },
                { tags: { $regex: params.search, $options: 'i' } }
            ];
        }
        return await this.designModel.find(query).sort({ createdAt: -1 }).exec();
    }

    async findOne(id: string): Promise<LibraryDesignDocument> {
        const design = await this.designModel.findById(id).exec();
        if (!design) throw new NotFoundException('Diseño no encontrado');
        return design;
    }

    async update(id: string, dto: UpdateDesignDto): Promise<LibraryDesignDocument> {
        const design = await this.designModel.findByIdAndUpdate(id, dto, { new: true }).exec();
        if (!design) throw new NotFoundException('Diseño no encontrado');
        return design;
    }

    async findAllTags(): Promise<string[]> {
        return await this.designModel.distinct('tags').exec();
    }

    async remove(id: string): Promise<void> {
        await this.findOne(id);
        await this.designModel.findByIdAndDelete(id).exec();
    }
}
