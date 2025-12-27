
import { Injectable, NotFoundException, BadRequestException, ConflictException, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Order, OrderDocument } from '../database/schemas';
import { PaymentGateway, PaymentResponse } from './strategies/payment-gateway.interface';
import { OnvopayStrategy } from './strategies/onvopay.strategy';
import { PaypalStrategy } from './strategies/paypal.strategy';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { OrdersService } from '../orders/orders.service';

@Injectable()
export class PaymentService {
    private readonly logger = new Logger(PaymentService.name);
    private strategies: Record<string, PaymentGateway>;

    constructor(
        // @InjectModel(Order.name) private orderModel: Model<OrderDocument>, // Or use OrdersService
        @Inject(forwardRef(() => OrdersService)) private ordersService: OrdersService, // Use forwardRef to avoid circular dependency
        private onvopayStrategy: OnvopayStrategy,
        private paypalStrategy: PaypalStrategy,
    ) {
        this.strategies = {
            onvopay: this.onvopayStrategy,
            paypal: this.paypalStrategy,
        };
    }

    async initiatePayment(userId: string, dto: InitiatePaymentDto): Promise<PaymentResponse> {
        const { orderId, method } = dto;
        const order = await this.ordersService.findOne(orderId);

        if (!order) {
            throw new NotFoundException('Order not found');
        }

        // 1. Basic Idempotency: Check if order is already paid
        const status = (order as any).status; // findOne returns a plain object or document? OrdersService.findOne returns object with items.
        if (status === 'pagada' || status === 'en_produccion' || status === 'enviada' || status === 'completada') {
            throw new ConflictException('Order is already paid');
        }

        const gateway = this.strategies[method];
        if (!gateway && method !== 'manual') {
            throw new BadRequestException(`Payment method ${method} not supported`);
        }

        // Manual/SINPE payment: redirect to my-orders where user can upload proof
        if (method === 'manual') {
            return {
                success: true,
                redirectUrl: `/store/my-orders`
            };
        }

        // 2. Advanced Idempotency (Optional per plan: Check for duplicate paid orders with same hash)
        // For now, we skip heavy hash calculation on DB for simplicity unless strictly required to block duplicate distinct orders.
        // The plan mentioned checking for "identical" payment attempts.

        // 3. Extract customer and order data
        const orderData = order as any;
        this.logger.debug(`Order data - user: ${JSON.stringify(orderData.user)}, guestInfo: ${JSON.stringify(orderData.guestInfo)}, shippingAddress: ${JSON.stringify(orderData.shippingAddress)}`);

        // Get user data - user has firstname/lastname, not name
        let userEmail = '';
        let userName = '';
        let userPhone = orderData.shippingAddress?.phone || '';

        if (orderData.user) {
            userEmail = orderData.user.email || '';
            userName = [orderData.user.firstname, orderData.user.lastname].filter(Boolean).join(' ');
        } else if (orderData.guestInfo) {
            userEmail = orderData.guestInfo.email || '';
            userName = orderData.guestInfo.name || '';
            userPhone = userPhone || orderData.guestInfo.contact || '';
        }

        const total = orderData.total || 0;
        const items = orderData.items || [];

        this.logger.debug(`Extracted - email: ${userEmail}, name: ${userName}, phone: ${userPhone}`);

        // Calculate subtotal (sum of item prices * quantities)
        let subtotal = 0;
        for (const item of items) {
            subtotal += (item.unitPrice || 0) * (item.quantity || 1);
        }

        // Shipping logic: Free if total > 40000, else 2500
        const SHIPPING_THRESHOLD = 40000;
        const SHIPPING_COST = 2500;
        const shippingCost = subtotal >= SHIPPING_THRESHOLD ? 0 : SHIPPING_COST;

        // Build order items with product info for line items
        const orderItems = items.map((item: any) => ({
            name: item.variantId?.product?.name || 'Producto',
            size: item.variantId?.size?.name || '',
            color: item.variantId?.color?.name || '',
            quantity: item.quantity || 1,
            unitPrice: item.unitPrice || 0,
        }));

        // 4. Initiate Gateway Payment with CRC currency and order details
        const result = await gateway.initiatePayment(
            subtotal,
            'CRC',
            orderId,
            userEmail,
            userName,
            userPhone,
            shippingCost,
            orderItems
        );

        // Note: Order will be marked as 'pagada' when:
        // - Webhook confirms payment, OR
        // - User lands on success page after redirect from Onvopay

        return result;
    }

    /**
     * Handle PayPal webhook events specifically
     * PayPal sends orderId in resource.purchase_units[0].reference_id
     */
    private async handlePayPalWebhook(payload: any) {
        try {
            const eventType = payload.event_type;
            const resource = payload.resource;

            this.logger.log(`PayPal Event Type: ${eventType}`);

            // Extract orderId from purchase_units reference_id
            const orderId = resource?.purchase_units?.[0]?.reference_id;
            const paypalOrderId = resource?.id;

            if (!orderId) {
                this.logger.warn('PayPal webhook received without orderId in purchase_units.reference_id');
                return { received: true, processed: false, reason: 'No orderId found' };
            }

            this.logger.log(`PayPal webhook for Order: ${orderId}, PayPal Order ID: ${paypalOrderId}`);

            // Handle different PayPal events
            if (eventType === 'CHECKOUT.ORDER.APPROVED') {
                // Order was approved by buyer - we should capture the payment
                this.logger.log(`Order ${orderId} approved. Status: ${resource.status}`);

                // If auto-capture is enabled, the payment will be captured automatically
                // For now, mark order as awaiting capture confirmation
                return { received: true, processed: true, status: 'approved', orderId };
            }

            if (eventType === 'PAYMENT.CAPTURE.COMPLETED') {
                // Payment was captured successfully - mark order as paid
                const captureId = resource?.id;
                const amount = resource?.amount?.value;
                const currency = resource?.amount?.currency_code;

                await this.ordersService.updateStatus(orderId, 'pagada');

                // Store PayPal capture info
                await this.ordersService.updatePaymentProof(orderId, {
                    type: 'paypal',
                    reference: captureId || paypalOrderId,
                    status: 'verified',
                });

                this.logger.log(`Order ${orderId} marked as PAID via PayPal. Capture ID: ${captureId}, Amount: ${amount} ${currency}`);
                return { received: true, processed: true, status: 'paid', orderId, captureId };
            }

            if (eventType === 'PAYMENT.CAPTURE.DENIED') {
                // Payment was denied
                const reason = resource?.status_details?.reason || 'Payment capture denied';

                await this.ordersService.updatePaymentProof(orderId, {
                    type: 'paypal',
                    reference: paypalOrderId,
                    status: 'rejected',
                    reason: reason,
                });

                this.logger.warn(`Payment denied for order ${orderId}: ${reason}`);
                return { received: true, processed: true, status: 'denied', orderId, reason };
            }

            // Unknown event type
            this.logger.log(`Unhandled PayPal event type: ${eventType}`);
            return { received: true, processed: false, eventType };

        } catch (error) {
            this.logger.error(`Error processing PayPal webhook: ${error.message}`);
            return { received: true, error: error.message };
        }
    }

    async handleWebhook(gateway: string, payload: any, signature: string) {
        const strategy = this.strategies[gateway];
        if (!strategy) {
            this.logger.error(`Webhook received for unknown gateway: ${gateway}`);
            return { received: false };
        }

        const isValid = await strategy.verifyWebhook(payload, signature);
        if (!isValid) {
            this.logger.warn(`Invalid signature for ${gateway} webhook`);
            return { received: false };
        }

        this.logger.log(`=== ${gateway.toUpperCase()} WEBHOOK RECEIVED ===`);
        this.logger.log(`Gateway: ${gateway}`);
        this.logger.log(`Full Payload: ${JSON.stringify(payload, null, 2)}`);

        // Handle PayPal webhooks specifically
        if (gateway === 'paypal') {
            return this.handlePayPalWebhook(payload);
        }

        // Process Onvopay webhook events
        // Common event types: payment_intent.succeeded, payment_intent.failed
        try {
            const eventType = payload.type || payload.event;
            const data = payload.data || payload;

            // Extract orderId from metadata
            const orderId = data?.metadata?.orderId || data?.object?.metadata?.orderId;

            if (!orderId) {
                this.logger.warn('Webhook received without orderId in metadata');
                return { received: true, processed: false };
            }

            // Check for success: multiple event types and status checks
            // Onvopay sends checkout-session.succeeded with paymentStatus: 'paid'
            const isSuccess = eventType === 'checkout-session.succeeded' ||
                eventType === 'payment-intent.succeeded' ||
                eventType === 'payment_intent.succeeded' ||
                data.status === 'succeeded' ||
                data.paymentStatus === 'paid';

            if (isSuccess) {
                // Extract Onvopay payment ID for reference (can be session id or paymentIntentId)
                const onvopayId = data?.paymentIntentId || data?.id || data?.object?.id || '';

                // Update order status and store payment reference
                await this.ordersService.updateStatus(orderId, 'pagada');

                // Store Onvopay ID in paymentProof for future reference
                if (onvopayId) {
                    await this.ordersService.updatePaymentProof(orderId, {
                        type: 'onvopay',
                        reference: onvopayId,
                        status: 'verified',
                    });
                    this.logger.log(`Order ${orderId} marked as paid via ${gateway} webhook. Onvopay ID: ${onvopayId}`);
                } else {
                    this.logger.log(`Order ${orderId} marked as paid via ${gateway} webhook (no Onvopay ID found)`);
                }

                return { received: true, processed: true, onvopayId };
            }

            // Check for failure: payment-intent.failed OR payment_intent.failed OR failed/requires_payment_method status
            const isFailed = eventType === 'payment-intent.failed' ||
                eventType === 'payment_intent.failed' ||
                data.status === 'failed' ||
                data.status === 'requires_payment_method';

            if (isFailed) {
                const errorMessage = data?.error?.message || 'Payment failed';
                const onvopayId = data?.id || '';

                // Save failed attempt to order
                await this.ordersService.updatePaymentProof(orderId, {
                    type: 'onvopay',
                    reference: onvopayId,
                    status: 'rejected',
                    reason: errorMessage,
                });

                this.logger.warn(`Payment failed for order ${orderId}: ${errorMessage}`);
                return { received: true, processed: true, status: 'failed', error: errorMessage };
            }

            // Check for SINPE deferred (payment waiting for manual approval)
            const isDeferred = eventType === 'payment-intent.deferred';

            if (isDeferred) {
                const onvopayId = data?.paymentIntentId || data?.id || '';
                this.logger.log(`Order ${orderId} has SINPE payment pending. Onvopay ID: ${onvopayId}`);

                // Keep order in 'esperando_pago' status but store the reference
                await this.ordersService.updatePaymentProof(orderId, {
                    type: 'onvopay',
                    reference: onvopayId,
                    status: 'pending',
                    reason: 'SINPE pendiente de aprobación',
                });

                return { received: true, processed: true, status: 'deferred' };
            }

            return { received: true, processed: false, event: eventType };

        } catch (error) {
            this.logger.error(`Error processing webhook: ${error.message}`);
            return { received: true, error: error.message };
        }
    }
}
