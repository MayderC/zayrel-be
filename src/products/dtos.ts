import { IsString, IsNumber, IsOptional, IsBoolean, IsArray, IsMongoId, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

// DTO for size measurements (widthCm/heightCm per size)
export class SizeMeasurementDto {
  @IsMongoId()
  size: string;

  @IsNumber()
  widthCm: number;

  @IsNumber()
  heightCm: number;
}

export class CreateProductDto {
  @IsString()
  name: string;

  @IsString()
  slug: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  price: number;

  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  images?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SizeMeasurementDto)
  sizeMeasurements?: SizeMeasurementDto[];
}

export class EditProductDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  price?: number;

  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  images?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SizeMeasurementDto)
  sizeMeasurements?: SizeMeasurementDto[];
}

export class CreateVariantDto {
  @IsMongoId()
  productId: string;

  @IsMongoId()
  color: string;

  @IsMongoId()
  size: string;

  @IsNumber()
  stock: number;

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsNumber()
  costPrice?: number;

  @IsOptional()
  @IsNumber()
  lowStockThreshold?: number;

  @IsOptional()
  @IsString()
  location?: string;
}

export class EditVariantDto {
  @IsOptional()
  @IsMongoId()
  color?: string;

  @IsOptional()
  @IsMongoId()
  size?: string;

  @IsOptional()
  @IsNumber()
  stock?: number;

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsNumber()
  costPrice?: number;

  @IsOptional()
  @IsNumber()
  lowStockThreshold?: number;

  @IsOptional()
  @IsString()
  location?: string;
}

export class CreateListingDto {
  @IsMongoId()
  variant: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsNumber()
  displayOrder?: number;

  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @IsMongoId()
  category?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsNumber()
  salePrice?: number;

  @IsOptional()
  @IsBoolean()
  isNewArrival?: boolean;

  @IsOptional()
  @IsBoolean()
  isBestSeller?: boolean;
}

export class EditListingDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsNumber()
  displayOrder?: number;

  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @IsMongoId()
  category?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsNumber()
  salePrice?: number;

  @IsOptional()
  @IsBoolean()
  isNewArrival?: boolean;

  @IsOptional()
  @IsBoolean()
  isBestSeller?: boolean;
}

export class CreateColorDto {
  @IsString()
  name: string;

  @IsString()
  hex: string;
}

export class CreateSizeDto {
  @IsString()
  name: string;
}

export class CreateCategoryDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsMongoId()
  parentCategory?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsString()
  color?: string;
}

// DTO para crear producto único desde inventario
export class CreateUniqueProductDto {
  @IsMongoId()
  sourceVariantId: string;  // Variante de donde se consume stock

  @IsString()
  name: string;

  @IsString()
  slug: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  price: number;

  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  images?: string[];
}
