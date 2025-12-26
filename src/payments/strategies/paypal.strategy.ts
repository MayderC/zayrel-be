
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { PaymentGateway, PaymentResponse } from './payment-gateway.interface';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class PaypalStrategy implements PaymentGateway {
    private readonly logger = new Logger(PaypalStrategy.name);
    private readonly baseUrl: string;

    constructor(
        private readonly configService: ConfigService,
        private readonly httpService: HttpService,
    ) {
        this.baseUrl = this.configService.get<string>('PAYPAL_MODE') === 'live'
            ? 'https://api-m.paypal.com'
            : 'https://api-m.sandbox.paypal.com';
    }

    private async getAccessToken(): Promise<string> {
        const clientId = this.configService.get<string>('PAYPAL_CLIENT_ID');
        const clientSecret = this.configService.get<string>('PAYPAL_CLIENT_SECRET');

        if (!clientId || !clientSecret) {
            this.logger.warn('PayPal credentials not found. Using Mock mode for development.');
            return 'MOCK_TOKEN';
        }

        const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

        try {
            const { data } = await firstValueFrom(
                this.httpService.post(
                    `${this.baseUrl}/v1/oauth2/token`,
                    'grant_type=client_credentials',
                    {
                        headers: {
                            Authorization: `Basic ${auth}`,
                            'Content-Type': 'application/x-www-form-urlencoded',
                        },
                    },
                ),
            );
            return data.access_token;
        } catch (error) {
            this.logger.error('Failed to get PayPal access token', error.response?.data || error.message);
            throw new Error('PayPal authentication failed');
        }
    }

    async initiatePayment(
        amount: number,
        currency: string,
        orderId: string,
        email: string,
        customerName?: string,
        customerPhone?: string,
        shippingCost?: number,
        orderItems?: any[]
    ): Promise<PaymentResponse> {
        const token = await this.getAccessToken();

        // Fallback to Mock if no creds (so dev doesn't break)
        if (token === 'MOCK_TOKEN') {
            const storeUrl = this.configService.get('STORE_URL') || 'http://localhost:3000';
            this.logger.log(`[MOCK] Initiating PayPal payment for Order ${orderId}, Amount: ${amount}`);
            return {
                success: true,
                redirectUrl: `${storeUrl}/checkout/success?orderId=${orderId}&payment_status=approved_mock`,
                transactionId: `PAYPAL_MOCK_${Date.now()}`
            };
        }

        const storeUrl = this.configService.get('STORE_URL') || 'https://zayrelstudio.com';

        // PayPal does NOT support CRC (Costa Rican Colones)
        // Convert to USD if currency is CRC
        let finalCurrency = currency;
        let finalAmount = amount;
        let finalShippingCost = shippingCost || 0;

        if (currency === 'CRC') {
            // Exchange rate: CRC to USD (configurable, default ~510)
            const exchangeRate = this.configService.get<number>('CRC_TO_USD_RATE') || 510;
            finalCurrency = 'USD';
            finalAmount = amount / exchangeRate;
            finalShippingCost = (shippingCost || 0) / exchangeRate;
            this.logger.log(`Converting CRC to USD: ${amount} CRC -> ${finalAmount.toFixed(2)} USD (rate: ${exchangeRate})`);
        }

        // Construct payload
        const payload = {
            intent: 'CAPTURE',
            purchase_units: [{
                reference_id: orderId,
                amount: {
                    currency_code: finalCurrency,
                    value: finalAmount.toFixed(2),
                    breakdown: {
                        item_total: {
                            currency_code: finalCurrency,
                            value: (finalAmount - finalShippingCost).toFixed(2)
                        },
                        shipping: {
                            currency_code: finalCurrency,
                            value: finalShippingCost.toFixed(2)
                        }
                    }
                },
                description: `Order #${orderId} at ZayrelStudio`,
            }],
            application_context: {
                brand_name: 'ZayrelStudio',
                landing_page: 'NO_PREFERENCE',
                user_action: 'PAY_NOW',
                return_url: `${storeUrl}/checkout/success?orderId=${orderId}`, // Frontend success page
                cancel_url: `${storeUrl}/checkout?orderId=${orderId}&payment=cancelled`
            }
        };

        try {
            const { data } = await firstValueFrom(
                this.httpService.post(
                    `${this.baseUrl}/v2/checkout/orders`,
                    payload,
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                            'Content-Type': 'application/json',
                        },
                    },
                ),
            );

            const approveLink = data.links.find((link: any) => link.rel === 'approve');
            if (!approveLink) throw new Error('No approval link returned from PayPal');

            return {
                success: true,
                redirectUrl: approveLink.href,
                transactionId: data.id, // PayPal Order ID
            };

        } catch (error) {
            this.logger.error('Failed to create PayPal order', error.response?.data || error.message);
            // Log full error for debugging
            if (error.response?.data) {
                this.logger.error(JSON.stringify(error.response.data, null, 2));
            }
            throw new Error('Could not initiate PayPal payment');
        }
    }

    async verifyWebhook(payload: any, signature: string): Promise<boolean> {
        // TODO: Implement real signature verification using PayPal certs
        // For now, we trust the webhook if we can successfully capture/verify the order status via API
        // OR simply return true for MVP if we rely on IPN/Webhook secret matches (which PayPal uses headers for).

        // PayPal Webhook signature verification is complex (headers: transmission-id, time, cert-url, auth-algo, signature).
        // It requires downloading the cert and verifying.

        this.logger.log('PayPal Webhook received - skipping signature verification for now (Not Implemented)');
        return true;
    }
}
