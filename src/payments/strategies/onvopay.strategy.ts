
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentGateway, PaymentResponse } from './payment-gateway.interface';

@Injectable()
export class OnvopayStrategy implements PaymentGateway {
    private readonly logger = new Logger(OnvopayStrategy.name);
    private readonly baseUrl: string;
    private readonly secretKey: string;

    constructor(private configService: ConfigService) {
        this.baseUrl = this.configService.get<string>('ONVOPAY_BASE_URL', 'https://api.onvopay.com/v1');
        this.secretKey = this.configService.get<string>('ONVOPAY_SECRET_KEY', '');
    }

    async initiatePayment(
        amount: number,
        currency: string,
        orderId: string,
        email: string,
        customerName?: string,
        customerPhone?: string,
        shippingCost?: number,
        orderItems?: { name: string; size: string; color: string; quantity: number; unitPrice: number }[]
    ): Promise<PaymentResponse> {
        this.logger.log(`Initiating Onvopay payment for Order ${orderId}, Amount: ${amount} ${currency}, Shipping: ${shippingCost}, Items: ${orderItems?.length || 0}`);

        if (!this.secretKey) {
            this.logger.error('ONVOPAY_SECRET_KEY not configured');
            return { success: false };
        }

        try {
            const frontendUrl = this.configService.get('FRONTEND_URL', 'http://localhost:3000');

            // Build line items: Individual Products + Shipping
            const lineItems: any[] = [];

            // Add individual products
            if (orderItems && orderItems.length > 0) {
                for (const item of orderItems) {
                    const sizeColor = [item.size, item.color].filter(Boolean).join(' / ');
                    const description = sizeColor ? `${item.name} (${sizeColor})` : item.name;

                    lineItems.push({
                        quantity: item.quantity,
                        unitAmount: Math.round(item.unitPrice * 100), // Amount in centavos/céntimos
                        currency: currency || 'CRC',
                        description: description,
                    });
                }
            } else {
                // Fallback: single line item with total
                lineItems.push({
                    quantity: 1,
                    unitAmount: Math.round(amount * 100),
                    currency: currency || 'CRC',
                    description: `Orden #${orderId.slice(-6).toUpperCase()}`,
                });
            }

            // Add shipping as separate line item (always show, ₡0 when free)
            if (shippingCost !== undefined) {
                lineItems.push({
                    quantity: 1,
                    unitAmount: Math.round(shippingCost * 100),
                    currency: currency || 'CRC',
                    description: shippingCost === 0 ? 'Envío GRATIS' : 'Envío',
                });
            }

            // Create Checkout Session with one-time-link
            const response = await fetch(`${this.baseUrl}/checkout/sessions/one-time-link`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.secretKey}`,
                },
                body: JSON.stringify({
                    customerEmail: email || undefined,
                    customerName: customerName || undefined,
                    // Format phone: add +506 if not present, skip if empty
                    customerPhone: customerPhone ? (customerPhone.startsWith('+') ? customerPhone : `+506${customerPhone.replace(/\D/g, '')}`) : undefined,
                    redirectUrl: `${frontendUrl}/store/checkout/success?orderId=${orderId}`,
                    cancelUrl: `${frontendUrl}/store/checkout/cancel?orderId=${orderId}`,
                    lineItems: lineItems,
                    // Limit to card payments only (hide SINPE option in Onvopay)
                    paymentMethodTypes: ['card'],
                    metadata: {
                        orderId: orderId,
                        customerEmail: email,
                    },
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                this.logger.error(`Onvopay error: ${JSON.stringify(data)}`);
                return { success: false, metadata: data };
            }

            this.logger.log(`Onvopay Checkout Session created: ${data.id}, URL: ${data.url}`);

            return {
                success: true,
                redirectUrl: data.url,
                transactionId: data.id,
                metadata: data,
            };

        } catch (error) {
            this.logger.error(`Onvopay API error: ${error.message}`);
            return { success: false, metadata: { error: error.message } };
        }
    }

    async verifyWebhook(payload: any, signature: string): Promise<boolean> {
        this.logger.log('Verifying Onvopay webhook signature');

        if (!payload) {
            return false;
        }

        // Get the webhook secret from config
        const webhookSecret = this.configService.get<string>('ONVOPAY_WEBHOOK_SECRET');

        // If no secret is configured, allow all (for development)
        if (!webhookSecret) {
            this.logger.warn('ONVOPAY_WEBHOOK_SECRET not configured - accepting all webhooks (development mode)');
            return true;
        }

        // Onvopay sends the secret directly in X-Webhook-Secret header
        // Compare the received signature with the configured secret
        if (signature === webhookSecret) {
            this.logger.log('Webhook signature verified successfully');
            return true;
        }

        this.logger.warn('Webhook signature mismatch');
        return false;
    }
}
