import { Controller, Post, Put, Delete, Get, Body, Param } from '@nestjs/common';
import { ProductsService } from './products.service';
import {
  CreateProductDto,
  EditProductDto,
  CreateVariantDto,
  EditVariantDto,
  CreateListingDto,
  EditListingDto,
} from './dtos';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  // Endpoints for products
  @Post()
  createProduct(@Body() productDto: CreateProductDto) {
    return this.productsService.createProduct(productDto);
  }

  @Put(':id')
  editProduct(@Param('id') productId: string, @Body() productDto: EditProductDto) {
    return this.productsService.editProduct(productId, productDto);
  }

  @Delete(':id')
  deleteProduct(@Param('id') productId: string) {
    return this.productsService.deleteProduct(productId);
  }

  @Get()
  listProducts() {
    return this.productsService.listProducts();
  }

  // Endpoints for variants
  @Post('variants')
  createVariant(@Body() variantDto: CreateVariantDto) {
    return this.productsService.createVariant(variantDto);
  }

  @Put('variants/:id')
  editVariant(@Param('id') variantId: string, @Body() variantDto: EditVariantDto) {
    return this.productsService.editVariant(variantId, variantDto);
  }

  @Delete('variants/:id')
  deleteVariant(@Param('id') variantId: string) {
    return this.productsService.deleteVariant(variantId);
  }

  @Get('variants')
  listVariants() {
    return this.productsService.listVariants();
  }

  // Endpoints for product listings
  @Post('listings')
  createListing(@Body() listingDto: CreateListingDto) {
    return this.productsService.createListing(listingDto);
  }

  @Put('listings/:id')
  editListing(@Param('id') listingId: string, @Body() listingDto: EditListingDto) {
    return this.productsService.editListing(listingId, listingDto);
  }

  @Delete('listings/:id')
  deleteListing(@Param('id') listingId: string) {
    return this.productsService.deleteListing(listingId);
  }

  @Get('listings')
  listListings() {
    return this.productsService.listListings();
  }
}
