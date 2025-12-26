
export interface PaymentResponse {
    success: boolean;
    redirectUrl?: string; // For redirect-based flows (e.g. PayPal, generic Onvopay)
    transactionId?: string;
    metadata?: any;
}

export interface OrderItemData {
    name: string;
    size: string;
    color: string;
    quantity: number;
    unitPrice: number;
}

export interface PaymentGateway {
    initiatePayment(amount: number, currency: string, orderId: string, email: string, customerName?: string, customerPhone?: string, shippingCost?: number, orderItems?: OrderItemData[]): Promise<PaymentResponse>;
    verifyWebhook(payload: any, signature: string): Promise<boolean>;
}
