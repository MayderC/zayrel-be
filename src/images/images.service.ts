import { Injectable, BadRequestException } from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Image, ImageDocument, Product, ProductDocument } from '../database/schemas';

// Configure Cloudinary on module load
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

interface UploadedFile {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
}

@Injectable()
export class ImagesService {
    constructor(
        @InjectModel(Image.name) private imageModel: Model<ImageDocument>,
        @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    ) { }

    /**
     * Upload image to Cloudinary and create DB record
     */
    async uploadProductImage(
        productId: string,
        file: UploadedFile,
        uploadedBy: string,
    ): Promise<ImageDocument> {
        // Validate product exists
        const product = await this.productModel.findById(productId);
        if (!product) {
            throw new BadRequestException('Product not found');
        }

        // Check image limit (max 5)
        if (product.images && product.images.length >= 5) {
            throw new BadRequestException('Maximum 5 images per product');
        }

        // Upload to Cloudinary
        const uploadResult = await this.uploadToCloudinary(file, `products/${productId}`);

        // Create image record in DB
        const image = await this.imageModel.create({
            url: uploadResult.secure_url,
            filename: uploadResult.public_id,
            type: 'product',
            width: uploadResult.width,
            height: uploadResult.height,
            uploadedBy: new Types.ObjectId(uploadedBy),
        });

        // Add image to product
        await this.productModel.findByIdAndUpdate(productId, {
            $push: { images: image._id },
        });

        return image;
    }

    /**
     * Set an image as the main product image (move to index 0)
     */
    async setMainImage(productId: string, imageId: string): Promise<void> {
        const product = await this.productModel.findById(productId);
        if (!product) {
            throw new BadRequestException('Product not found');
        }

        const imageObjectId = new Types.ObjectId(imageId);
        const currentImages = product.images || [];

        // Check if image belongs to product
        const imageIndex = currentImages.findIndex(
            (id) => id.toString() === imageId,
        );
        if (imageIndex === -1) {
            throw new BadRequestException('Image not found in product');
        }

        // Move to front
        const newOrder = [
            imageObjectId,
            ...currentImages.filter((id) => id.toString() !== imageId),
        ];

        await this.productModel.findByIdAndUpdate(productId, {
            images: newOrder,
        });
    }

    /**
     * Reorder product images
     */
    async reorderImages(productId: string, imageIds: string[]): Promise<void> {
        const product = await this.productModel.findById(productId);
        if (!product) {
            throw new BadRequestException('Product not found');
        }

        // Validate all IDs belong to product
        const currentIds = (product.images || []).map((id) => id.toString());
        const allValid = imageIds.every((id) => currentIds.includes(id));
        if (!allValid || imageIds.length !== currentIds.length) {
            throw new BadRequestException('Invalid image IDs');
        }

        await this.productModel.findByIdAndUpdate(productId, {
            images: imageIds.map((id) => new Types.ObjectId(id)),
        });
    }

    /**
     * Delete image from Cloudinary and DB
     */
    async deleteProductImage(productId: string, imageId: string): Promise<void> {
        const image = await this.imageModel.findById(imageId);
        if (!image) {
            throw new BadRequestException('Image not found');
        }

        // Delete from Cloudinary
        try {
            await cloudinary.uploader.destroy(image.filename);
        } catch (error) {
            console.error('Cloudinary delete error:', error);
        }

        // Remove from product
        await this.productModel.findByIdAndUpdate(productId, {
            $pull: { images: new Types.ObjectId(imageId) },
        });

        // Delete from DB
        await this.imageModel.findByIdAndDelete(imageId);
    }

    /**
     * Get all images for a product
     */
    async getProductImages(productId: string): Promise<ImageDocument[]> {
        const product = await this.productModel
            .findById(productId)
            .populate('images');

        return (product?.images as unknown as ImageDocument[]) || [];
    }

    /**
     * Upload file buffer to Cloudinary
     */
    private uploadToCloudinary(
        file: UploadedFile,
        folder: string,
    ): Promise<UploadApiResponse> {
        return new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    folder,
                    resource_type: 'image',
                    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
                    max_bytes: 5 * 1024 * 1024, // 5MB
                },
                (error, result) => {
                    if (error) reject(error);
                    else resolve(result!);
                },
            );
            uploadStream.end(file.buffer);
        });
    }
}
