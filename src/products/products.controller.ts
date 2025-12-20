import { Controller, Post, Put, Delete, Get, Body, Param, UseGuards, Query } from '@nestjs/common';
import { ProductsService } from './products.service';
import {
  CreateProductDto,
  EditProductDto,
  CreateVariantDto,
  EditVariantDto,
  CreateListingDto,
  EditListingDto,
  CreateColorDto,
  CreateSizeDto,
  CreateCategoryDto,
  CreateUniqueProductDto,
} from './dtos';
import { BadRequestException, ConflictException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles.enum';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) { }

  // Endpoints for products
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @Post()
  createProduct(@Body() productDto: CreateProductDto) {
    return this.productsService.createProduct(productDto);
  }

  // Endpoint para crear producto único desde inventario
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @Post('unique')
  async createUniqueProduct(@Body() dto: CreateUniqueProductDto) {
    try {
      return await this.productsService.createUniqueProduct(dto);
    } catch (error: any) {
      switch (error.message) {
        case 'VARIANT_NOT_FOUND':
          throw new NotFoundException('Variante origen no encontrada');
        case 'INSUFFICIENT_STOCK':
          throw new BadRequestException('Stock insuficiente en variante origen');
        case 'SLUG_EXISTS':
          throw new ConflictException('El slug ya está en uso');
        case 'INVALID_PRICE':
          throw new BadRequestException('El precio debe ser mayor a 0');
        case 'VARIANT_CORRUPTED':
          throw new InternalServerErrorException('Variante origen corrupta');
        default:
          throw new InternalServerErrorException(error.message);
      }
    }
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @Put(':id')
  editProduct(@Param('id') productId: string, @Body() productDto: EditProductDto) {
    return this.productsService.editProduct(productId, productDto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @Delete(':id')
  deleteProduct(@Param('id') productId: string) {
    return this.productsService.deleteProduct(productId);
  }

  @Get()
  listProducts() {
    return this.productsService.listProducts();
  }



  // Endpoints for variants
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @Post('variants')
  createVariant(@Body() variantDto: CreateVariantDto) {
    return this.productsService.createVariant(variantDto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @Put('variants/:id')
  editVariant(@Param('id') variantId: string, @Body() variantDto: EditVariantDto) {
    return this.productsService.editVariant(variantId, variantDto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @Delete('variants/:id')
  deleteVariant(@Param('id') variantId: string) {
    return this.productsService.deleteVariant(variantId);
  }

  @Get('variants')
  listVariants() {
    return this.productsService.listVariants();
  }

  // Endpoints for product listings
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @Post('listings')
  createListing(@Body() listingDto: CreateListingDto) {
    return this.productsService.createListing(listingDto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @Put('listings/:id')
  editListing(@Param('id') listingId: string, @Body() listingDto: EditListingDto) {
    return this.productsService.editListing(listingId, listingDto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @Delete('listings/:id')
  deleteListing(@Param('id') listingId: string) {
    return this.productsService.deleteListing(listingId);
  }

  @Get('listings')
  listListings(@Query() query: any) {
    const filters: any = { isActive: true }; // Always return only active listings

    if (query.featured === 'true') filters.featured = true;
    if (query.isNewArrival === 'true') filters.isNewArrival = true;
    if (query.isBestSeller === 'true') filters.isBestSeller = true;
    if (query.category) filters.category = query.category;

    return this.productsService.listListings(filters);
  }

  // --- DEPENDENCIES (Colors, Sizes, Categories) ---

  // COLORS
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @Post('colors')
  createColor(@Body() dto: CreateColorDto) {
    return this.productsService.createColor(dto);
  }

  @Get('colors')
  listColors() {
    return this.productsService.listColors();
  }

  // SIZES
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @Post('sizes')
  createSize(@Body() dto: CreateSizeDto) {
    return this.productsService.createSize(dto);
  }

  @Get('sizes')
  listSizes() {
    return this.productsService.listSizes();
  }

  // CATEGORIES
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @Post('categories')
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.productsService.createCategory(dto);
  }

  @Get('categories')
  listCategories() {
    return this.productsService.listCategories();
  }

  // Search endpoint (must be before dynamic :idOrSlug route)
  @Get('search')
  searchListings(@Query('q') query: string) {
    return this.productsService.searchListings(query);
  }

  // Dynamic route must be LAST to avoid capturing other routes
  @Get(':idOrSlug')
  async getProduct(@Param('idOrSlug') idOrSlug: string) {
    // Check if it's a valid ObjectId, otherwise treat as slug
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(idOrSlug);
    if (isObjectId) {
      return this.productsService.findProductById(idOrSlug);
    }
    return this.productsService.findProductBySlug(idOrSlug);
  }
}
