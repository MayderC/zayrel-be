import { Injectable, Logger } from '@nestjs/common';
import { MailService } from '../mail/mail.service';

/**
 * Notification Service
 * 
 * Pattern: Observer/Event-based notifications
 * Channels: Email (via MailService), WhatsApp (future)
 * 
 * This service handles all customer-facing notifications for order and payment events.
 */
@Injectable()
export class NotificationsService {
    private readonly logger = new Logger(NotificationsService.name);

    constructor(private readonly mailService: MailService) { }

    /**
     * Notify customer when order is created
     * @param order - The order object with all details
     */
    async notifyOrderCreated(order: any): Promise<void> {
        try {
            await this.mailService.sendOrderConfirmation(order);
            this.logger.log(`📧 Order confirmation sent for order ${order._id}`);
        } catch (error) {
            this.logger.error(`Failed to send order confirmation: ${error.message}`);
            // Don't throw - notification failure shouldn't block order creation
        }

        // WhatsApp notification (optional)
        const customerPhone = order.guestInfo?.contact || order.shippingAddress?.phone;
        if (customerPhone) {
            await this.sendWhatsApp(customerPhone,
                `🛍️ ¡Orden recibida! Tu pedido #${order._id.toString().slice(-6)} ha sido creado. Te notificaremos cuando confirmemos tu pago.`);
        }
    }

    /**
     * Notify customer that their payment proof was approved
     * @param order - The order object with customer info
     */
    async notifyPaymentApproved(order: any): Promise<void> {
        try {
            await this.mailService.sendPaymentApproved(order);
            this.logger.log(`📧 Payment approved email sent for order ${order._id}`);
        } catch (error) {
            this.logger.error(`Failed to send payment approved email: ${error.message}`);
        }

        const customerPhone = order.guestInfo?.contact || order.shippingAddress?.phone;
        if (customerPhone) {
            await this.sendWhatsApp(customerPhone,
                `✅ ¡Pago confirmado! Tu pedido #${order._id.toString().slice(-6)} está en producción.`);
        }
    }

    /**
     * Notify customer that their payment proof was rejected
     * @param order - The order object with customer info
     * @param reason - Optional rejection reason
     */
    async notifyPaymentRejected(order: any, reason?: string): Promise<void> {
        try {
            await this.mailService.sendPaymentRejected(order, reason);
            this.logger.log(`📧 Payment rejected email sent for order ${order._id}`);
        } catch (error) {
            this.logger.error(`Failed to send payment rejected email: ${error.message}`);
        }

        const customerPhone = order.guestInfo?.contact || order.shippingAddress?.phone;
        const message = reason
            ? `❌ Tu comprobante para el pedido #${order._id.toString().slice(-6)} fue rechazado: ${reason}. Por favor sube uno nuevo.`
            : `❌ Tu comprobante para el pedido #${order._id.toString().slice(-6)} fue rechazado. Por favor sube uno nuevo.`;

        if (customerPhone) {
            await this.sendWhatsApp(customerPhone, message);
        }
    }

    /**
     * Send WhatsApp notification
     * TODO: Integrate with WhatsApp Business API or Twilio
     */
    private async sendWhatsApp(phone: string, message: string): Promise<void> {
        // Log for now - implement actual WhatsApp API later
        this.logger.debug(`[WHATSAPP] To: ${phone} | Message: ${message}`);
        // TODO: Implement actual WhatsApp sending
    }

    /**
     * Notify customer that their payment proof was received and is being reviewed
     * @param order - The order object with payment proof
     */
    async notifyPaymentProofReceived(order: any): Promise<void> {
        this.logger.log(`[DEBUG] notifyPaymentProofReceived called for order ${order._id}`);
        this.logger.log(`[DEBUG] order.user: ${JSON.stringify(order.user)}`);
        this.logger.log(`[DEBUG] order.guestInfo: ${JSON.stringify(order.guestInfo)}`);

        try {
            await this.mailService.sendPaymentProofReceived(order);
            this.logger.log(`📧 Payment proof received email sent for order ${order._id}`);
        } catch (error) {
            this.logger.error(`Failed to send payment proof received email: ${error.message}`);
        }

        const customerPhone = order.guestInfo?.contact || order.shippingAddress?.phone;
        if (customerPhone) {
            await this.sendWhatsApp(customerPhone,
                `📋 Recibimos tu comprobante para el pedido #${order._id.toString().slice(-6)}. Lo estamos verificando.`);
        }
    }

    /**
     * Notify customer that order is in production
     */
    async notifyOrderInProduction(order: any): Promise<void> {
        try {
            await this.mailService.sendOrderInProduction(order);
            this.logger.log(`📧 Order in production email sent for order ${order._id}`);
        } catch (error) {
            this.logger.error(`Failed to send order in production email: ${error.message}`);
        }

        const customerPhone = order.guestInfo?.contact || order.shippingAddress?.phone;
        if (customerPhone) {
            await this.sendWhatsApp(customerPhone,
                `🛠️ Tu pedido #${order._id.toString().slice(-6)} está en producción. Te avisaremos cuando sea enviado.`);
        }
    }

    /**
     * Notify customer that order has been shipped
     */
    async notifyOrderShipped(order: any): Promise<void> {
        try {
            await this.mailService.sendOrderShipped(order);
            this.logger.log(`📧 Order shipped email sent for order ${order._id}`);
        } catch (error) {
            this.logger.error(`Failed to send order shipped email: ${error.message}`);
        }

        const tracking = order.trackingNumber ? `Guía: ${order.trackingNumber}` : '';
        const customerPhone = order.guestInfo?.contact || order.shippingAddress?.phone;
        if (customerPhone) {
            await this.sendWhatsApp(customerPhone,
                `🚀 ¡Pedido enviado! Tu orden #${order._id.toString().slice(-6)} va en camino. ${tracking}`);
        }
    }

    /**
     * Notify customer that order is completed
     */
    async notifyOrderCompleted(order: any): Promise<void> {
        try {
            await this.mailService.sendOrderCompleted(order);
            this.logger.log(`📧 Order completed email sent for order ${order._id}`);
        } catch (error) {
            this.logger.error(`Failed to send order completed email: ${error.message}`);
        }
        // No WhatsApp for completion? Maybe yes "Gracias"
        const customerPhone = order.guestInfo?.contact || order.shippingAddress?.phone;
        if (customerPhone) {
            await this.sendWhatsApp(customerPhone,
                `📦 ¡Pedido entregado! Gracias por tu compra en ZayrelStudio.`);
        }
    }
}
