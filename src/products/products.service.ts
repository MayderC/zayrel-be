import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  CreateProductDto,
  EditProductDto,
  CreateVariantDto,
  EditVariantDto,
  CreateListingDto,
  EditListingDto,
} from './dtos';
import {
  Product,
  ProductDocument,
  Variant,
  VariantDocument,
  ProductListing,
  ProductListingDocument,
  Color,
  ColorDocument,
  Size,
  SizeDocument,
  Category,
  CategoryDocument,
} from '../database/schemas';

@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    @InjectModel(Variant.name) private variantModel: Model<VariantDocument>,
    @InjectModel(ProductListing.name)
    private productListingModel: Model<ProductListingDocument>,
    @InjectModel(Color.name) private colorModel: Model<ColorDocument>,
    @InjectModel(Size.name) private sizeModel: Model<SizeDocument>,
    @InjectModel(Category.name) private categoryModel: Model<CategoryDocument>,
  ) { }

  // Method to create a product
  async createProduct(productDto: CreateProductDto) {
    const product = new this.productModel(productDto);
    return await product.save();
  }

  // Method to edit a product
  async editProduct(productId: string, productDto: EditProductDto) {
    return await this.productModel.findByIdAndUpdate(productId, productDto, {
      new: true,
    });
  }

  // Method to delete a product
  async deleteProduct(productId: string) {
    return await this.productModel.findByIdAndDelete(productId);
  }

  // Method to list all products
  async listProducts() {
    return await this.productModel.find()
      .populate('images')
      .populate('sizeMeasurements.size')
      .populate({
        path: 'variants',
        populate: [
          { path: 'color' },
          { path: 'size' }
        ]
      })
      .exec();
  }

  // Method to find a product by ID (with variants)
  async findProductById(productId: string) {
    console.log('[findProductById] Looking for product:', productId);
    const product = await this.productModel.findById(productId)
      .populate('images')
      .populate('sizeMeasurements.size')
      .exec();

    if (!product) {
      console.log('[findProductById] Product not found');
      return null;
    }

    console.log('[findProductById] Product found:', product._id);

    // Get all variants for this product with populated size and color
    const variants = await this.variantModel
      .find({ product: product._id })
      .populate('size')
      .populate('color')
      .exec();

    console.log('[findProductById] Variants found:', variants.length, variants.map(v => v._id));

    // Return product with variants
    return {
      ...product.toObject(),
      variants,
    };
  }

  // Method to find a product by Slug (with variants)
  async findProductBySlug(slug: string) {
    const product = await this.productModel
      .findOne({ slug })
      .populate('images')
      .populate('sizeMeasurements.size')
      .exec();

    if (!product) {
      return null;
    }

    // Get all variants for this product with populated size and color
    const variants = await this.variantModel
      .find({ product: product._id })
      .populate('size')
      .populate('color')
      .exec();

    // Return product with variants
    return {
      ...product.toObject(),
      variants,
    };
  }

  // Method to create a variant
  async createVariant(variantDto: CreateVariantDto) {
    const { productId, color, size, ...rest } = variantDto;

    // Convert string IDs to ObjectId
    const { Types } = require('mongoose');

    const variant = new this.variantModel({
      ...rest,
      product: new Types.ObjectId(productId),
      color: new Types.ObjectId(color),
      size: new Types.ObjectId(size),
    });
    return await variant.save();
  }

  // Method to edit a variant
  async editVariant(variantId: string, variantDto: EditVariantDto) {
    return await this.variantModel.findByIdAndUpdate(variantId, variantDto, {
      new: true,
    });
  }

  // Method to delete a variant
  async deleteVariant(variantId: string) {
    return await this.variantModel.findByIdAndDelete(variantId);
  }

  // Method to list all variants
  async listVariants() {
    return await this.variantModel
      .find()
      .populate('product')
      .populate('color')
      .populate('size')
      .exec();
  }

  // Method to create a product listing
  async createListing(listingDto: CreateListingDto) {
    const listing = new this.productListingModel(listingDto);
    return await listing.save();
  }

  // Method to edit a product listing
  async editListing(listingId: string, listingDto: EditListingDto) {
    return await this.productListingModel.findByIdAndUpdate(listingId, listingDto, {
      new: true,
    });
  }

  // Method to delete a product listing
  async deleteListing(listingId: string) {
    return await this.productListingModel.findByIdAndDelete(listingId);
  }

  // Method to list all product listings
  async listListings(filters: any = {}) {
    const all = await this.productListingModel.find(filters).exec();
    console.log('Raw Listings Found:', all.length, all);

    const populated = await this.productListingModel
      .find(filters)
      .populate({
        path: 'variant',
        populate: [{ path: 'product' }, { path: 'color' }, { path: 'size' }],
      })
      .populate('category')
      .exec();

    console.log('Populated Listings:', populated.length, JSON.stringify(populated, null, 2));
    return populated;
  }

  // Method to search product listings
  async searchListings(query: string) {
    if (!query || query.length < 2) {
      return [];
    }

    // Create case-insensitive regex for flexible search
    const searchRegex = new RegExp(query, 'i');

    // First, find all active listings
    const listings = await this.productListingModel
      .find({ isActive: true })
      .populate({
        path: 'variant',
        populate: [{ path: 'product' }, { path: 'color' }, { path: 'size' }],
      })
      .populate('category')
      .limit(15)
      .exec();

    // Filter in memory to search nested fields
    const filtered = listings.filter((listing: any) => {
      const productName = listing.variant?.product?.name || '';
      const productDesc = listing.variant?.product?.description || '';
      const categoryName = listing.category?.name || '';

      return (
        searchRegex.test(productName) ||
        searchRegex.test(productDesc) ||
        searchRegex.test(categoryName)
      );
    });

    return filtered;
  }
  // --- COLORS ---
  async createColor(colorDto: any) {
    const color = new this.colorModel(colorDto);
    return await color.save();
  }

  async listColors() {
    return await this.colorModel.find().exec();
  }

  // --- SIZES ---
  async createSize(sizeDto: any) {
    const size = new this.sizeModel(sizeDto);
    return await size.save();
  }

  async listSizes() {
    return await this.sizeModel.find().exec();
  }

  // --- CATEGORIES ---
  async createCategory(categoryDto: any) {
    if (!categoryDto.slug) {
      // Simple slugify fallback
      categoryDto.slug = categoryDto.name.toLowerCase().replace(/ /g, '-');
    }
    const category = new this.categoryModel(categoryDto);
    return await category.save();
  }

  async listCategories() {
    return await this.categoryModel.find().populate('parentCategory').exec();
  }

  // --- UNIQUE PRODUCT (from inventory) ---
  async createUniqueProduct(dto: any) {
    const { Types } = require('mongoose');

    // 1. Buscar variante origen con color y size
    const sourceVariant = await this.variantModel
      .findById(dto.sourceVariantId)
      .populate('color')
      .populate('size')
      .exec();

    if (!sourceVariant) {
      throw new Error('VARIANT_NOT_FOUND');
    }

    if (sourceVariant.stock <= 0) {
      throw new Error('INSUFFICIENT_STOCK');
    }

    if (!sourceVariant.color || !sourceVariant.size) {
      throw new Error('VARIANT_CORRUPTED');
    }

    // 2. Verificar slug único
    const existingSlug = await this.productModel.findOne({ slug: dto.slug });
    if (existingSlug) {
      throw new Error('SLUG_EXISTS');
    }

    // 3. Validar precio
    if (!dto.price || dto.price <= 0) {
      throw new Error('INVALID_PRICE');
    }

    // 4. Crear producto
    const newProduct = new this.productModel({
      name: dto.name,
      slug: dto.slug,
      description: dto.description || '',
      price: dto.price,
      images: dto.images || [],
    });
    await newProduct.save();

    // 5. Crear variante del nuevo producto (mismo color/size, stock = 1)
    const newVariant = new this.variantModel({
      product: new Types.ObjectId(newProduct._id),
      color: new Types.ObjectId((sourceVariant.color as any)._id),
      size: new Types.ObjectId((sourceVariant.size as any)._id),
      stock: 1,
      isAvailable: true,
    });
    await newVariant.save();

    // 6. Restar stock del origen (DESPUÉS de todo lo demás para seguridad)
    await this.variantModel.findByIdAndUpdate(dto.sourceVariantId, {
      $inc: { stock: -1 }
    });

    // Populate variant for response
    const populatedVariant = await this.variantModel
      .findById(newVariant._id)
      .populate('color')
      .populate('size')
      .exec();

    return {
      product: newProduct,
      variant: populatedVariant,
      sourceVariantNewStock: sourceVariant.stock - 1
    };
  }
}
