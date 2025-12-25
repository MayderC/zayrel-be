import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
    UseGuards,
} from '@nestjs/common';
import { CouponService } from './coupon.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles.enum';
import { CreateCouponDto, UpdateCouponDto, CouponResponseDto } from './dto';

@Controller('coupons')
export class CouponController {
    constructor(private readonly couponService: CouponService) { }

    /**
     * Create coupon (Admin only)
     */
    @Post()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.Admin)
    async create(@Body() dto: CreateCouponDto): Promise<CouponResponseDto> {
        return this.couponService.create(dto);
    }

    /**
     * Get all coupons (Admin only)
     */
    @Get()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.Admin)
    async findAll(): Promise<CouponResponseDto[]> {
        return this.couponService.findAll();
    }

    /**
     * Get single coupon (Admin only)
     */
    @Get(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.Admin)
    async findOne(@Param('id') id: string): Promise<CouponResponseDto> {
        return this.couponService.findOne(id);
    }

    /**
     * Update coupon (Admin only)
     */
    @Patch(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.Admin)
    async update(
        @Param('id') id: string,
        @Body() dto: UpdateCouponDto,
    ): Promise<CouponResponseDto> {
        return this.couponService.update(id, dto);
    }

    /**
     * Delete coupon (Admin only)
     */
    @Delete(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.Admin)
    async remove(@Param('id') id: string): Promise<{ message: string }> {
        return this.couponService.remove(id);
    }

    /**
     * Validate coupon (Public - for checking before applying)
     */
    @Post('validate')
    async validate(
        @Body() body: { code: string; subtotal: number },
    ): Promise<{ valid: boolean; discount: number; message?: string }> {
        return this.couponService.validate(body.code, body.subtotal);
    }
}
