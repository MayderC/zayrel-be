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
  ) {}

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
    return await this.productModel.find().populate('images').exec();
  }

  // Method to create a variant
  async createVariant(variantDto: CreateVariantDto) {
    const variant = new this.variantModel(variantDto);
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
  async listListings() {
    return await this.productListingModel
      .find()
      .populate({
        path: 'variant',
        populate: [{ path: 'product' }, { path: 'color' }, { path: 'size' }],
      })
      .populate('category')
      .exec();
  }
}
