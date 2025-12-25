import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
    UseGuards,
    Request,
} from '@nestjs/common';
import { CartService } from './cart.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AddItemDto, UpdateQuantityDto, ApplyCouponDto, CartResponseDto } from './dto';

interface AuthenticatedRequest extends Request {
    user: { _id: string };
}

@Controller('cart')
@UseGuards(JwtAuthGuard) // All cart routes require authentication
export class CartController {
    constructor(private readonly cartService: CartService) { }

    /**
     * Get current user's cart
     */
    @Get()
    async getCart(@Request() req: AuthenticatedRequest): Promise<CartResponseDto> {
        return this.cartService.getCart(req.user._id);
    }

    /**
     * Add item to cart
     */
    @Post('items')
    async addItem(
        @Request() req: AuthenticatedRequest,
        @Body() dto: AddItemDto,
    ): Promise<CartResponseDto> {
        return this.cartService.addItem(req.user._id, dto);
    }

    /**
     * Update item quantity
     */
    @Patch('items/:variantId')
    async updateQuantity(
        @Request() req: AuthenticatedRequest,
        @Param('variantId') variantId: string,
        @Body() dto: UpdateQuantityDto,
    ): Promise<CartResponseDto> {
        return this.cartService.updateItemQuantity(req.user._id, variantId, dto);
    }

    /**
     * Remove item from cart
     */
    @Delete('items/:variantId')
    async removeItem(
        @Request() req: AuthenticatedRequest,
        @Param('variantId') variantId: string,
    ): Promise<CartResponseDto> {
        return this.cartService.removeItem(req.user._id, variantId);
    }

    /**
     * Clear entire cart
     */
    @Delete()
    async clearCart(@Request() req: AuthenticatedRequest): Promise<{ message: string }> {
        return this.cartService.clearCart(req.user._id);
    }

    /**
     * Apply coupon to cart
     */
    @Post('coupon')
    async applyCoupon(
        @Request() req: AuthenticatedRequest,
        @Body() dto: ApplyCouponDto,
    ): Promise<CartResponseDto> {
        return this.cartService.applyCoupon(req.user._id, dto.code);
    }

    /**
     * Remove coupon from cart
     */
    @Delete('coupon')
    async removeCoupon(@Request() req: AuthenticatedRequest): Promise<CartResponseDto> {
        return this.cartService.removeCoupon(req.user._id);
    }

    /**
     * Merge localStorage cart into backend (on login)
     */
    @Post('merge')
    async mergeCart(
        @Request() req: AuthenticatedRequest,
        @Body() body: { items: { variantId: string; quantity: number }[] },
    ): Promise<CartResponseDto> {
        return this.cartService.mergeCart(req.user._id, body.items);
    }
}
