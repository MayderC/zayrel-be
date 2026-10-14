import {
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  IsEmail,
  IsDateString,
  ValidateIf,
  ValidateNested,
  IsEnum,
  IsIn,
  IsArray,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class GuestInfoDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  contact?: string;

  @IsOptional()
  @ValidateIf((_object, value) => value !== '')
  @IsEmail()
  email?: string;
}

export class ShippingAddressDto {
  @IsOptional()
  @IsString()
  street?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  zipRegion?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  phone?: string;
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

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  shippingCost?: number;

  @IsOptional()
  @IsIn(['esperando_pago', 'pagada'])
  status?: 'esperando_pago' | 'pagada';

  @IsOptional()
  @IsDateString()
  purchaseDate?: string;

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
  @IsEnum(['transfer', 'sinpe', 'onvopay', 'paypal', 'other'])
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
