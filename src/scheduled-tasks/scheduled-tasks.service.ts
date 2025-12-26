import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Cart, CartDocument, User, UserDocument, Coupon, CouponDocument, Variant, VariantDocument } from '../database/schemas';
import { MailService } from '../mail/mail.service';

interface CartItemForEmail {
    name: string;
    price: number;
    quantity: number;
    total: number;
    image: string | null;
    size: string;
    color: string;
}

/**
 * Scheduled Tasks Service
 * 
 * Handles automated tasks like:
 * - Abandoned cart reminders
 * - Coupon expiration notifications
 */
@Injectable()
export class ScheduledTasksService {
    private readonly logger = new Logger(ScheduledTasksService.name);

    constructor(
        @InjectModel(Cart.name) private cartModel: Model<CartDocument>,
        @InjectModel(User.name) private userModel: Model<UserDocument>,
        @InjectModel(Coupon.name) private couponModel: Model<CouponDocument>,
        @InjectModel(Variant.name) private variantModel: Model<VariantDocument>,
        private readonly mailService: MailService,
    ) { }

    /**
     * Check for abandoned carts every day at 10 AM
     * Sends reminder emails to users who haven't updated their cart in 3 days
     */
    @Cron(CronExpression.EVERY_DAY_AT_10AM)
    async handleAbandonedCarts() {
        this.logger.log('🔄 Running abandoned cart check...');

        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

        try {
            // Find carts that:
            // 1. Have items
            // 2. Haven't been updated in 3+ days
            // 3. Haven't been notified yet (reminderSentAt is null)
            const abandonedCarts = await this.cartModel.find({
                items: { $exists: true, $not: { $size: 0 } },
                lastUpdated: { $lt: threeDaysAgo },
                reminderSentAt: null,
            }).limit(50); // Process 50 at a time

            this.logger.log(`Found ${abandonedCarts.length} abandoned carts`);

            for (const cart of abandonedCarts) {
                await this.processAbandonedCart(cart);
            }

            this.logger.log('✅ Abandoned cart check completed');
        } catch (error) {
            this.logger.error('Error processing abandoned carts:', error);
        }
    }

    /**
     * Process a single abandoned cart
     */
    private async processAbandonedCart(cart: CartDocument) {
        try {
            // Get user info
            const user = await this.userModel.findById(cart.userId);
            if (!user || !user.email) {
                this.logger.warn(`No valid user found for cart ${cart._id}`);
                return;
            }

            // Get cart items with details
            const cartItems = await this.getCartItemsForEmail(cart);
            if (cartItems.length === 0) {
                return;
            }

            // Calculate cart total
            const total = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

            // Create or get abandoned cart coupon (5% off)
            const couponCode = await this.getOrCreateAbandonedCartCoupon();

            // Send abandoned cart email
            await this.mailService.sendWithTemplate(
                user.email,
                '🛒 ¡Olvidaste algo en tu carrito!',
                'abandoned-cart',
                {
                    customerName: user.firstname || 'Cliente',
                    items: cartItems,
                    total,
                    couponCode,
                    couponDiscount: '5%',
                    storeUrl: process.env.FRONTEND_URL || 'https://zayrelstudio.com/store',
                }
            );

            // Mark cart as notified using the existing reminderSentAt field
            cart.reminderSentAt = new Date();
            await cart.save();

            this.logger.log(`📧 Abandoned cart email sent to ${user.email}`);
        } catch (error) {
            this.logger.error(`Error processing abandoned cart ${cart._id}:`, error);
        }
    }

    /**
     * Get cart items with product details for email
     */
    private async getCartItemsForEmail(cart: CartDocument): Promise<CartItemForEmail[]> {
        const items: CartItemForEmail[] = [];

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
                    items.push({
                        name: product.name,
                        price: product.price,
                        quantity: item.quantity,
                        total: product.price * item.quantity,
                        image: product.images?.[0]?.url || null,
                        size: size?.name || '',
                        color: color?.name || '',
                    });
                }
            }
        }

        return items;
    }

    /**
     * Get or create a coupon for abandoned cart emails
     */
    private async getOrCreateAbandonedCartCoupon(): Promise<string> {
        const couponCode = 'VUELVE5';

        // Check if coupon exists
        let coupon = await this.couponModel.findOne({ code: couponCode });

        if (!coupon) {
            // Create the coupon
            coupon = await this.couponModel.create({
                code: couponCode,
                type: 'percentage',
                value: 5,
                isActive: true,
                description: 'Cupón de carrito abandonado - 5% de descuento',
                maxUses: null, // Unlimited
                expiresAt: null, // Never expires
            });
            this.logger.log('Created abandoned cart coupon: VUELVE5');
        }

        return couponCode;
    }
}
