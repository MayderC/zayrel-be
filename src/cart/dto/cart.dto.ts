import { IsString, IsNumber, IsOptional, Min } from 'class-validator';

export class AddItemDto {
    @IsString()
    variantId: string;

    @IsNumber()
    @Min(1)
    quantity: number;
}

export class UpdateQuantityDto {
    @IsNumber()
    @Min(1)
    quantity: number;
}

export class ApplyCouponDto {
    @IsString()
    code: string;
}

export class CartItemResponseDto {
    variantId: string;
    productId: string;
    name: string;
    price: number;
    image?: string;
    quantity: number;
    size: string;
    color: string;
    maxStock: number;
}

export class CartResponseDto {
    items: CartItemResponseDto[];
    couponCode: string | null;
    subtotal: number;
    discount: number;
    total: number;
}
