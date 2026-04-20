import { IsArray, IsMongoId, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateQuoteDto {
    @IsMongoId()
    variantId: string;

    @IsNumber()
    @Min(1)
    @Type(() => Number)
    quantity: number;

    @IsString()
    designState: string;

    @IsArray()
    @IsString({ each: true })
    designImageUrls: string[];

    @IsOptional()
    @IsString()
    garmentId?: string;

    @IsOptional()
    @IsString()
    shirtColor?: string;

    @IsOptional()
    @IsString()
    clientNotes?: string;

    @IsOptional()
    @IsString()
    guestName?: string;

    @IsOptional()
    @IsString()
    guestEmail?: string;

    @IsOptional()
    @IsString()
    guestPhone?: string;

    @IsOptional()
    @IsString()
    guestTelegram?: string;

    @IsOptional()
    @IsString()
    preferredContactMethod?: string;

    @IsOptional()
    @IsNumber()
    estimatedPrice?: number;
}

export class PriceQuoteDto {
    @IsNumber()
    @Min(0)
    @Type(() => Number)
    quotedPrice: number;

    @IsOptional()
    @IsString()
    priceNotes?: string;
}

export class RejectQuoteDto {
    @IsOptional()
    @IsString()
    rejectionReason?: string;
}
