import { IsMongoId, IsNumber, IsOptional, IsString, ValidateNested, IsEnum, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

export class GuestInfoDto {
    @IsString()
    name: string;

    @IsOptional()
    @IsString()
    contact?: string;

    @IsOptional()
    @IsOptional()
    @IsString()
    email?: string;
}

export class ShippingAddressDto {
    @IsString()
    street: string;

    @IsString()
    city: string;

    @IsString()
    state: string;

    @IsString()
    zipRegion: string;

    @IsString()
    country: string;

    @IsString()
    phone: string;
}

export class CreateOrderItemDto {
    @IsMongoId()
    variantId: string;

    @IsNumber()
    quantity: number;

    @IsOptional()
    @IsNumber()
    unitPrice?: number;
}

export class CreateOrderDto {
    @IsOptional()
    @IsMongoId()
    user?: string;

    @IsOptional()
    @ValidateNested()
    @Type(() => GuestInfoDto)
    guestInfo?: GuestInfoDto;

    @IsOptional()
    @ValidateNested()
    @Type(() => ShippingAddressDto)
    shippingAddress?: ShippingAddressDto;

    @IsEnum(['online', 'manual_sale'])
    @IsOptional()
    orderType?: string = 'online';

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateOrderItemDto)
    items: CreateOrderItemDto[];
}

export class UpdatePaymentProofDto {
    @IsOptional()
    @IsString()
    url?: string;

    @IsOptional()
    @IsEnum(['transfer', 'sinpe', 'other'])
    type?: string;

    @IsOptional()
    @IsString()
    reference?: string;

    @IsEnum(['pending', 'verified', 'rejected'])
    @IsOptional()
    status?: string = 'pending';

    @IsOptional()
    @IsString()
    reason?: string;
}

export class UpdateOrderTrackingDto {
    @IsString()
    trackingNumber: string;

    @IsString()
    shippingProvider: string;
}
