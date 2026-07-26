import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { LibraryDesign, LibraryDesignDocument } from '../database/schemas';
import { CreateDesignDto, UpdateDesignDto } from './designs.dto';
import { ImagesService } from '../images/images.service';

interface DesignQuery {
    tags?: string;
    category?: string;
    $or?: Array<Record<string, unknown>>;
}

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

    async findAll(params: { tag?: string; search?: string; category?: string } = {}): Promise<LibraryDesignDocument[]> {
        const query: DesignQuery = {};
        if (params.tag) {
            query.tags = params.tag;
        }
        if (params.category) {
            query.category = params.category;
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

    async findAllCategories(): Promise<string[]> {
        const categories = await this.designModel.distinct('category').exec();
        return categories.filter(Boolean);
    }

    async updateRelated(id: string, relatedDesignIds: string[]): Promise<LibraryDesignDocument> {
        if (relatedDesignIds.some(rid => rid === id)) {
            throw new BadRequestException('Un diseño no puede estar relacionado consigo mismo');
        }

        const design = await this.designModel.findById(id).exec();
        if (!design) throw new NotFoundException('Diseño no encontrado');

        const objectIds = relatedDesignIds.map(rid => new Types.ObjectId(rid));
        design.relatedDesignIds = objectIds;
        return await design.save();
    }

    async findRelated(id: string, depth: number = 3): Promise<{ design: LibraryDesignDocument; level: number }[]> {
        const visited = new Set<string>();
        const result: { design: LibraryDesignDocument; level: number }[] = [];

        visited.add(id);

        let currentIds = [id];

        for (let d = 0; d < Math.min(depth, 3); d++) {
            const designs = await this.designModel
                .find({ _id: { $in: currentIds.map(i => new Types.ObjectId(i)) } })
                .select('relatedDesignIds')
                .exec();

            const nextLevelIds: string[] = [];
            for (const design of designs) {
                for (const relatedId of (design.relatedDesignIds || [])) {
                    const idStr = relatedId.toString();
                    if (!visited.has(idStr)) {
                        nextLevelIds.push(idStr);
                        visited.add(idStr);
                    }
                }
            }

            if (nextLevelIds.length === 0) break;

            const relatedDesigns = await this.designModel
                .find({ _id: { $in: nextLevelIds.map(i => new Types.ObjectId(i)) } })
                .exec();

            for (const rd of relatedDesigns) {
                result.push({ design: rd, level: d + 1 });
            }

            currentIds = nextLevelIds;
        }

        return result;
    }

    async remove(id: string): Promise<void> {
        await this.findOne(id);
        await this.designModel.findByIdAndDelete(id).exec();
    }
}
