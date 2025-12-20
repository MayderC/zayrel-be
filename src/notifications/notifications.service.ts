import { Injectable } from '@nestjs/common';

/**
 * Notification Service
 * 
 * Pattern: Observer/Event-based notifications
 * Channels: Email, WhatsApp (if phone number available)
 * 
 * To activate: Integrate with your email/SMS provider (e.g., SendGrid, Twilio, WhatsApp Business API)
 * and uncomment the calls in OrdersService.updatePaymentProof()
 */
@Injectable()
export class NotificationsService {

    /**
     * Notify customer that their payment proof was approved
     * @param order - The order object with customer info
     */
    async notifyPaymentApproved(order: any): Promise<void> {
        const customerEmail = order.guestInfo?.email || order.user?.email;
        const customerPhone = order.guestInfo?.contact || order.shippingAddress?.phone;

        if (customerEmail) {
            await this.sendEmail(customerEmail, 'Pago Aprobado',
                `¡Tu pago para el pedido #${order._id.toString().slice(-6)} ha sido verificado!`);
        }

        if (customerPhone) {
            await this.sendWhatsApp(customerPhone,
                `✅ ¡Pago confirmado! Tu pedido #${order._id.toString().slice(-6)} está en proceso.`);
        }
    }

    /**
     * Notify customer that their payment proof was rejected
     * @param order - The order object with customer info
     * @param reason - Optional rejection reason
     */
    async notifyPaymentRejected(order: any, reason?: string): Promise<void> {
        const customerEmail = order.guestInfo?.email || order.user?.email;
        const customerPhone = order.guestInfo?.contact || order.shippingAddress?.phone;

        const message = reason
            ? `Tu comprobante para el pedido #${order._id.toString().slice(-6)} fue rechazado: ${reason}. Por favor sube uno nuevo.`
            : `Tu comprobante para el pedido #${order._id.toString().slice(-6)} fue rechazado. Por favor sube uno nuevo.`;

        if (customerEmail) {
            await this.sendEmail(customerEmail, 'Comprobante Rechazado', message);
        }

        if (customerPhone) {
            await this.sendWhatsApp(customerPhone, `❌ ${message}`);
        }
    }

    /**
     * Send email notification
     * TODO: Integrate with email provider (SendGrid, Nodemailer, etc.)
     */
    private async sendEmail(to: string, subject: string, body: string): Promise<void> {
        console.log(`[EMAIL] To: ${to} | Subject: ${subject} | Body: ${body}`);
        // TODO: Implement actual email sending
    }

    /**
     * Send WhatsApp notification
     * TODO: Integrate with WhatsApp Business API or Twilio
     */
    private async sendWhatsApp(phone: string, message: string): Promise<void> {
        console.log(`[WHATSAPP] To: ${phone} | Message: ${message}`);
        // TODO: Implement actual WhatsApp sending
    }
}
