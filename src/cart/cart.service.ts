import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cart, CartDocument, Coupon, CouponDocument, Variant, VariantDocument, Product, ProductDocument, Color, ColorDocument, Size, SizeDocument } from '../database/schemas';
import { AddItemDto, UpdateQuantityDto, CartResponseDto, CartItemResponseDto } from './dto';

@Injectable()
export class CartService {
    constructor(
        @InjectModel(Cart.name) private cartModel: Model<CartDocument>,
        @InjectModel(Coupon.name) private couponModel: Model<CouponDocument>,
        @InjectModel(Variant.name) private variantModel: Model<VariantDocument>,
    ) { }

    /**
     * Get or create cart for user
     */
    async getOrCreateCart(userId: string): Promise<CartDocument> {
        let cart = await this.cartModel.findOne({ userId: new Types.ObjectId(userId) });

        if (!cart) {
            cart = await this.cartModel.create({
                userId: new Types.ObjectId(userId),
                items: [],
                couponCode: null,
                lastUpdated: new Date(),
            });
        }

        return cart;
    }

    /**
     * Get cart with populated items and calculated totals
     */
    async getCart(userId: string): Promise<CartResponseDto> {
        const cart = await this.getOrCreateCart(userId);

        // Populate variant details for each item
        const itemsWithDetails: CartItemResponseDto[] = [];

        for (const item of cart.items) {
            const variant = await this.variantModel.findById(item.variantId)
                .populate('product')
                .populate('color')
                .populate('size');

            if (variant) {
                const product = variant.product as any;
                const color = variant.color as any;
                const size = variant.size as any;

                if (product) {
                    itemsWithDetails.push({
                        variantId: (variant._id as Types.ObjectId).toString(),
                        productId: product._id.toString(),
                        name: product.name,
                        price: product.price,
                        image: product.images?.[0]?.url || null,
                        quantity: item.quantity,
                        size: size?.name || 'N/A',
                        color: color?.name || 'N/A',
                        maxStock: variant.stock,
                    });
                }
            }
        }

        // Calculate totals
        const subtotal = itemsWithDetails.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        let discount = 0;

        // Apply coupon if exists
        if (cart.couponCode) {
            const coupon = await this.couponModel.findOne({
                code: cart.couponCode.toUpperCase(),
                isActive: true
            });

            if (coupon) {
                if (coupon.type === 'percentage') {
                    discount = Math.round(subtotal * (coupon.value / 100));
                } else {
                    discount = Math.min(coupon.value, subtotal);
                }
            }
        }

        return {
            items: itemsWithDetails,
            couponCode: cart.couponCode,
            subtotal,
            discount,
            total: subtotal - discount,
        };
    }

    /**
     * Add item to cart
     */
    async addItem(userId: string, dto: AddItemDto): Promise<CartResponseDto> {
        const cart = await this.getOrCreateCart(userId);

        // Validate variant exists and has stock
        const variant = await this.variantModel.findById(dto.variantId);
        if (!variant) {
            throw new NotFoundException('Variante no encontrada');
        }

        // Check if item already in cart
        const existingItemIndex = cart.items.findIndex(
            item => item.variantId.toString() === dto.variantId
        );

        if (existingItemIndex >= 0) {
            // Update quantity
            const newQty = cart.items[existingItemIndex].quantity + dto.quantity;
            if (newQty > variant.stock) {
                throw new BadRequestException(`Solo hay ${variant.stock} unidades disponibles`);
            }
            cart.items[existingItemIndex].quantity = newQty;
        } else {
            // Add new item
            if (dto.quantity > variant.stock) {
                throw new BadRequestException(`Solo hay ${variant.stock} unidades disponibles`);
            }
            cart.items.push({
                variantId: new Types.ObjectId(dto.variantId),
                quantity: dto.quantity,
                addedAt: new Date(),
            });
        }

        cart.lastUpdated = new Date();
        await cart.save();

        return this.getCart(userId);
    }

    /**
     * Update item quantity
     */
    async updateItemQuantity(userId: string, variantId: string, dto: UpdateQuantityDto): Promise<CartResponseDto> {
        const cart = await this.getOrCreateCart(userId);

        const itemIndex = cart.items.findIndex(
            item => item.variantId.toString() === variantId
        );

        if (itemIndex < 0) {
            throw new NotFoundException('Item no encontrado en el carrito');
        }

        // Validate stock
        const variant = await this.variantModel.findById(variantId);
        if (!variant) {
            throw new NotFoundException('Variante no encontrada');
        }

        if (dto.quantity > variant.stock) {
            throw new BadRequestException(`Solo hay ${variant.stock} unidades disponibles`);
        }

        cart.items[itemIndex].quantity = dto.quantity;
        cart.lastUpdated = new Date();
        await cart.save();

        return this.getCart(userId);
    }

    /**
     * Remove item from cart
     */
    async removeItem(userId: string, variantId: string): Promise<CartResponseDto> {
        const cart = await this.getOrCreateCart(userId);

        cart.items = cart.items.filter(
            item => item.variantId.toString() !== variantId
        );

        cart.lastUpdated = new Date();
        await cart.save();

        return this.getCart(userId);
    }

    /**
     * Clear entire cart
     */
    async clearCart(userId: string): Promise<{ message: string }> {
        const cart = await this.getOrCreateCart(userId);
        cart.items = [];
        cart.couponCode = null;
        cart.lastUpdated = new Date();
        await cart.save();

        return { message: 'Carrito vaciado' };
    }

    /**
     * Apply coupon to cart
     */
    async applyCoupon(userId: string, code: string): Promise<CartResponseDto> {
        const coupon = await this.couponModel.findOne({
            code: code.toUpperCase(),
            isActive: true
        });

        if (!coupon) {
            throw new BadRequestException('Cupón no válido');
        }

        // Check expiration
        if (coupon.expiresAt && new Date() > coupon.expiresAt) {
            throw new BadRequestException('El cupón ha expirado');
        }

        // Check max uses
        if (coupon.maxUses && coupon.currentUses >= coupon.maxUses) {
            throw new BadRequestException('El cupón ha alcanzado su límite de uso');
        }

        // Check minimum purchase
        const cart = await this.getOrCreateCart(userId);
        const currentCart = await this.getCart(userId);

        if (coupon.minPurchase && currentCart.subtotal < coupon.minPurchase) {
            throw new BadRequestException(`Compra mínima de ₡${coupon.minPurchase.toLocaleString()} requerida`);
        }

        cart.couponCode = coupon.code;
        cart.lastUpdated = new Date();
        await cart.save();

        return this.getCart(userId);
    }

    /**
     * Remove coupon from cart
     */
    async removeCoupon(userId: string): Promise<CartResponseDto> {
        const cart = await this.getOrCreateCart(userId);
        cart.couponCode = null;
        cart.lastUpdated = new Date();
        await cart.save();

        return this.getCart(userId);
    }

    /**
     * Merge localStorage cart into backend cart (on login)
     */
    async mergeCart(userId: string, localItems: { variantId: string; quantity: number }[]): Promise<CartResponseDto> {
        for (const item of localItems) {
            try {
                await this.addItem(userId, { variantId: item.variantId, quantity: item.quantity });
            } catch (error) {
                // Skip invalid items silently
                console.log(`[Cart] Could not merge item ${item.variantId}:`, error.message);
            }
        }

        return this.getCart(userId);
    }
}
