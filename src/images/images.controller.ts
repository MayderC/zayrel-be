import {
    Controller,
    Post,
    Get,
    Delete,
    Patch,
    Param,
    Body,
    UseGuards,
    UseInterceptors,
    UploadedFile,
    Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles.enum';
import { ImagesService } from './images.service';

interface UploadedFileType {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
}

@Controller('products/:productId/images')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.Admin)
export class ImagesController {
    constructor(private readonly imagesService: ImagesService) { }

    /**
     * GET /products/:productId/images
     * Get all images for a product
     */
    @Get()
    async getImages(@Param('productId') productId: string) {
        return this.imagesService.getProductImages(productId);
    }

    /**
     * POST /products/:productId/images
     * Upload a new image for a product
     */
    @Post()
    @UseInterceptors(FileInterceptor('image'))
    async uploadImage(
        @Param('productId') productId: string,
        @UploadedFile() file: UploadedFileType,
        @Req() req: any,
    ) {
        const userId = req.user?.userId || req.user?.sub;
        return this.imagesService.uploadProductImage(productId, file, userId);
    }

    /**
     * DELETE /products/:productId/images/:imageId
     * Delete an image from product
     */
    @Delete(':imageId')
    async deleteImage(
        @Param('productId') productId: string,
        @Param('imageId') imageId: string,
    ) {
        await this.imagesService.deleteProductImage(productId, imageId);
        return { success: true };
    }

    /**
     * PATCH /products/:productId/images/:imageId/main
     * Set an image as the main product image
     */
    @Patch(':imageId/main')
    async setMainImage(
        @Param('productId') productId: string,
        @Param('imageId') imageId: string,
    ) {
        await this.imagesService.setMainImage(productId, imageId);
        return { success: true };
    }

    /**
     * PATCH /products/:productId/images/reorder
     * Reorder product images
     */
    @Patch('reorder')
    async reorderImages(
        @Param('productId') productId: string,
        @Body('imageIds') imageIds: string[],
    ) {
        await this.imagesService.reorderImages(productId, imageIds);
        return { success: true };
    }
}
