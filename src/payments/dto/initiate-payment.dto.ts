
import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';

export class InitiatePaymentDto {
    @IsString()
    @IsNotEmpty()
    orderId: string;

    @IsEnum(['onvopay', 'paypal', 'manual'])
    @IsNotEmpty()
    method: 'onvopay' | 'paypal' | 'manual';

    @IsString()
    @IsOptional()
    successUrl?: string;

    @IsString()
    @IsOptional()
    cancelUrl?: string;
}
