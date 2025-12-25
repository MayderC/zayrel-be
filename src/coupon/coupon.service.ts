import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Coupon, CouponDocument } from '../database/schemas';
import { CreateCouponDto, UpdateCouponDto, CouponResponseDto } from './dto';

@Injectable()
export class CouponService {
    constructor(
        @InjectModel(Coupon.name) private couponModel: Model<CouponDocument>,
    ) { }

    /**
     * Create a new coupon
     */
    async create(dto: CreateCouponDto): Promise<CouponResponseDto> {
        // Check if code already exists
        const existing = await this.couponModel.findOne({ code: dto.code.toUpperCase() });
        if (existing) {
            throw new ConflictException('Ya existe un cupón con este código');
        }

        const coupon = await this.couponModel.create({
            ...dto,
            code: dto.code.toUpperCase(),
            currentUses: 0,
            isActive: dto.isActive ?? true,
        });

        return this.toResponse(coupon);
    }

    /**
     * Get all coupons (admin)
     */
    async findAll(): Promise<CouponResponseDto[]> {
        const coupons = await this.couponModel.find().sort({ createdAt: -1 });
        return coupons.map(c => this.toResponse(c));
    }

    /**
     * Get single coupon by ID
     */
    async findOne(id: string): Promise<CouponResponseDto> {
        const coupon = await this.couponModel.findById(id);
        if (!coupon) {
            throw new NotFoundException('Cupón no encontrado');
        }
        return this.toResponse(coupon);
    }

    /**
     * Update coupon
     */
    async update(id: string, dto: UpdateCouponDto): Promise<CouponResponseDto> {
        const coupon = await this.couponModel.findByIdAndUpdate(id, dto, { new: true });
        if (!coupon) {
            throw new NotFoundException('Cupón no encontrado');
        }
        return this.toResponse(coupon);
    }

    /**
     * Delete coupon
     */
    async remove(id: string): Promise<{ message: string }> {
        const result = await this.couponModel.findByIdAndDelete(id);
        if (!result) {
            throw new NotFoundException('Cupón no encontrado');
        }
        return { message: 'Cupón eliminado' };
    }

    /**
     * Validate coupon (public endpoint for checking)
     */
    async validate(code: string, subtotal: number): Promise<{ valid: boolean; discount: number; message?: string }> {
        const coupon = await this.couponModel.findOne({
            code: code.toUpperCase(),
            isActive: true
        });

        if (!coupon) {
            return { valid: false, discount: 0, message: 'Cupón no válido' };
        }

        if (coupon.expiresAt && new Date() > coupon.expiresAt) {
            return { valid: false, discount: 0, message: 'El cupón ha expirado' };
        }

        if (coupon.maxUses && coupon.currentUses >= coupon.maxUses) {
            return { valid: false, discount: 0, message: 'El cupón ha alcanzado su límite de uso' };
        }

        if (coupon.minPurchase && subtotal < coupon.minPurchase) {
            return {
                valid: false,
                discount: 0,
                message: `Compra mínima de ₡${coupon.minPurchase.toLocaleString()} requerida`
            };
        }

        let discount = 0;
        if (coupon.type === 'percentage') {
            discount = Math.round(subtotal * (coupon.value / 100));
        } else {
            discount = Math.min(coupon.value, subtotal);
        }

        return { valid: true, discount };
    }

    /**
     * Increment usage count (called when order is placed)
     */
    async incrementUsage(code: string): Promise<void> {
        await this.couponModel.findOneAndUpdate(
            { code: code.toUpperCase() },
            { $inc: { currentUses: 1 } }
        );
    }

    /**
     * Create abandoned cart coupon
     */
    async createAbandonedCartCoupon(): Promise<string> {
        const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
        const code = `CARRITO5-${randomSuffix}`;

        await this.couponModel.create({
            code,
            type: 'percentage',
            value: 5,
            maxUses: 1,
            isActive: true,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        });

        return code;
    }

    private toResponse(coupon: CouponDocument): CouponResponseDto {
        return {
            _id: (coupon._id as Types.ObjectId).toString(),
            code: coupon.code,
            type: coupon.type,
            value: coupon.value,
            minPurchase: coupon.minPurchase,
            maxUses: coupon.maxUses,
            currentUses: coupon.currentUses,
            expiresAt: coupon.expiresAt,
            isActive: coupon.isActive,
            createdAt: (coupon as any).createdAt,
        };
    }
}
