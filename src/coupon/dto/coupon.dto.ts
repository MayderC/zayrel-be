import { IsString, IsNumber, IsOptional, IsEnum, IsBoolean, IsDate, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCouponDto {
    @IsString()
    code: string;

    @IsEnum(['percentage', 'fixed'])
    type: 'percentage' | 'fixed';

    @IsNumber()
    @Min(0)
    value: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    minPurchase?: number;

    @IsOptional()
    @IsNumber()
    @Min(1)
    maxUses?: number;

    @IsOptional()
    @Type(() => Date)
    @IsDate()
    expiresAt?: Date;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}

export class UpdateCouponDto {
    @IsOptional()
    @IsEnum(['percentage', 'fixed'])
    type?: 'percentage' | 'fixed';

    @IsOptional()
    @IsNumber()
    @Min(0)
    value?: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    minPurchase?: number;

    @IsOptional()
    @IsNumber()
    @Min(1)
    maxUses?: number;

    @IsOptional()
    @Type(() => Date)
    @IsDate()
    expiresAt?: Date;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}

export class CouponResponseDto {
    _id: string;
    code: string;
    type: 'percentage' | 'fixed';
    value: number;
    minPurchase: number | null;
    maxUses: number | null;
    currentUses: number;
    expiresAt: Date | null;
    isActive: boolean;
    createdAt: Date;
}
