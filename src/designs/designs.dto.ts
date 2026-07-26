import { IsString, IsNotEmpty, IsOptional, IsNumber, IsArray, IsMongoId } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateDesignDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @Type(() => Number)
    @IsNumber()
    price: number;

    @IsString()
    @IsNotEmpty()
    sizeCategory: string; // 'Logo', 'Regular', 'Full'

    @IsOptional()
    @IsString()
    category?: string;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    tags?: string[];

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    widthCm?: number;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    heightCm?: number;
}

export class UpdateDesignDto {
    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsNumber()
    price?: number;

    @IsOptional()
    @IsString()
    sizeCategory?: string;

    @IsOptional()
    @IsString()
    category?: string;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    tags?: string[];

    @IsOptional()
    @IsArray()
    @IsMongoId({ each: true })
    relatedDesignIds?: string[];

    @IsOptional()
    @IsNumber()
    widthCm?: number;

    @IsOptional()
    @IsNumber()
    heightCm?: number;
}

export class UpdateRelatedDesignsDto {
    @IsArray()
    @IsMongoId({ each: true })
    relatedDesignIds: string[];
}
