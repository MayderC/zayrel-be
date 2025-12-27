import { Injectable, Logger } from '@nestjs/common';
import { MailService } from '../mail/mail.service';
import { TelegramService } from './telegram.service';

/**
 * Notification Service
 * 
 * Pattern: Event-based notifications with configurable channels
 * Destinations: customer (email), admin (telegram)
 * 
 * Usage: this.notify('payment.approved', order)
 */

// Channel configuration per event
type NotificationChannels = {
    customer: ('email' | 'whatsapp')[];
    admin: ('telegram')[];
};

const EVENT_CONFIG: Record<string, NotificationChannels> = {
    'order.created': { customer: ['email'], admin: [] },
    'payment.proofReceived': { customer: ['email'], admin: ['telegram'] },
    'payment.approved': { customer: ['email'], admin: ['telegram'] },
    'payment.rejected': { customer: ['email'], admin: ['telegram'] },
    'order.inProduction': { customer: ['email'], admin: ['telegram'] },
    'order.shipped': { customer: ['email'], admin: ['telegram'] },
    'order.completed': { customer: ['email'], admin: [] },
};

@Injectable()
export class NotificationsService {
    private readonly logger = new Logger(NotificationsService.name);

    constructor(
        private readonly mailService: MailService,
        private readonly telegramService: TelegramService,
    ) { }

    /**
     * Central notification method - dispatches to appropriate channels
     */
    async notify(event: string, order: any, extra?: any): Promise<void> {
        const config = EVENT_CONFIG[event];
        if (!config) {
            this.logger.warn(`Unknown notification event: ${event}`);
            return;
        }

        this.logger.log(`📣 Notifying [${event}] for order ${order._id}`);

        // Customer notifications
        for (const channel of config.customer) {
            try {
                if (channel === 'email') {
                    await this.sendEmailForEvent(event, order, extra);
                } else if (channel === 'whatsapp') {
                    await this.sendWhatsAppForEvent(event, order, extra);
                }
            } catch (error) {
                this.logger.error(`Customer ${channel} failed for ${event}: ${error.message}`);
            }
        }

        // Admin notifications
        for (const channel of config.admin) {
            try {
                if (channel === 'telegram') {
                    await this.sendTelegramForEvent(event, order, extra);
                }
            } catch (error) {
                this.logger.error(`Admin ${channel} failed for ${event}: ${error.message}`);
            }
        }
    }

    private async sendEmailForEvent(event: string, order: any, extra?: any): Promise<void> {
        switch (event) {
            case 'order.created':
                await this.mailService.sendOrderConfirmation(order);
                break;
            case 'payment.proofReceived':
                await this.mailService.sendPaymentProofReceived(order);
                break;
            case 'payment.approved':
                await this.mailService.sendPaymentApproved(order);
                break;
            case 'payment.rejected':
                await this.mailService.sendPaymentRejected(order, extra?.reason);
                break;
            case 'order.inProduction':
                await this.mailService.sendOrderInProduction(order);
                break;
            case 'order.shipped':
                await this.mailService.sendOrderShipped(order);
                break;
            case 'order.completed':
                await this.mailService.sendOrderCompleted(order);
                break;
        }
        this.logger.log(`📧 [${event}] email sent for order ${order._id}`);
    }

    private async sendTelegramForEvent(event: string, order: any, extra?: any): Promise<void> {
        switch (event) {
            case 'payment.proofReceived':
                await this.telegramService.sendPaymentProofForReview(order);
                break;
            case 'payment.approved':
                await this.telegramService.notifyStatusChange(order, 'pagada');
                break;
            case 'payment.rejected':
                await this.telegramService.notifyStatusChange(order, 'rechazada', extra?.reason);
                break;
            case 'order.inProduction':
                await this.telegramService.notifyStatusChange(order, 'en_produccion');
                break;
            case 'order.shipped':
                await this.telegramService.notifyStatusChange(order, 'enviada');
                break;
        }
        this.logger.log(`📱 [${event}] telegram sent for order ${order._id}`);
    }

    private async sendWhatsAppForEvent(event: string, order: any, extra?: any): Promise<void> {
        const phone = order.guestInfo?.contact || order.shippingAddress?.phone;
        if (!phone) return;

        const shortId = order._id.toString().slice(-6);
        const messages: Record<string, string> = {
            'order.created': `🛍️ ¡Orden recibida! Tu pedido #${shortId} ha sido creado.`,
            'payment.proofReceived': `📋 Recibimos tu comprobante para el pedido #${shortId}.`,
            'payment.approved': `✅ ¡Pago confirmado! Tu pedido #${shortId} está en proceso.`,
            'payment.rejected': `❌ Comprobante rechazado para pedido #${shortId}.`,
            'order.shipped': `🚀 ¡Pedido enviado! Tu orden #${shortId} va en camino.`,
            'order.completed': `📦 ¡Pedido entregado! Gracias por tu compra.`,
        };

        if (messages[event]) {
            await this.sendWhatsApp(phone, messages[event]);
        }
    }

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
        // Email to customer
        try {
            await this.mailService.sendPaymentApproved(order);
            this.logger.log(`📧 Payment approved email sent for order ${order._id}`);
        } catch (error) {
            this.logger.error(`Failed to send payment approved email: ${error.message}`);
        }

        // Telegram to admin (topic "Pagadas")
        try {
            await this.telegramService.notifyStatusChange(order, 'pagada');
        } catch (error) {
            this.logger.error(`Failed to send Telegram status change: ${error.message}`);
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
        // Email to customer
        try {
            await this.mailService.sendPaymentRejected(order, reason);
            this.logger.log(`📧 Payment rejected email sent for order ${order._id}`);
        } catch (error) {
            this.logger.error(`Failed to send payment rejected email: ${error.message}`);
        }

        // Telegram to admin
        try {
            await this.telegramService.notifyStatusChange(order, 'rechazada', reason);
        } catch (error) {
            this.logger.error(`Failed to send Telegram status change: ${error.message}`);
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

        // Send email to customer
        try {
            await this.mailService.sendPaymentProofReceived(order);
            this.logger.log(`📧 Payment proof received email sent for order ${order._id}`);
        } catch (error) {
            this.logger.error(`Failed to send payment proof received email: ${error.message}`);
        }

        // Send Telegram notification to admin for approval
        try {
            await this.telegramService.sendPaymentProofForReview(order);
            this.logger.log(`📱 Payment proof sent to Telegram for review - order ${order._id}`);
        } catch (error) {
            this.logger.error(`Failed to send Telegram notification: ${error.message}`);
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
        // Email to customer
        try {
            await this.mailService.sendOrderInProduction(order);
            this.logger.log(`📧 Order in production email sent for order ${order._id}`);
        } catch (error) {
            this.logger.error(`Failed to send order in production email: ${error.message}`);
        }

        // Telegram to admin
        try {
            await this.telegramService.notifyStatusChange(order, 'en_produccion');
        } catch (error) {
            this.logger.error(`Failed to send Telegram status change: ${error.message}`);
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
        // Email to customer
        try {
            await this.mailService.sendOrderShipped(order);
            this.logger.log(`📧 Order shipped email sent for order ${order._id}`);
        } catch (error) {
            this.logger.error(`Failed to send order shipped email: ${error.message}`);
        }

        // Telegram to admin
        try {
            await this.telegramService.notifyStatusChange(order, 'enviada');
        } catch (error) {
            this.logger.error(`Failed to send Telegram status change: ${error.message}`);
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
        // Email to customer
        try {
            await this.mailService.sendOrderCompleted(order);
            this.logger.log(`📧 Order completed email sent for order ${order._id}`);
        } catch (error) {
            this.logger.error(`Failed to send order completed email: ${error.message}`);
        }

        // Telegram to admin
        try {
            await this.telegramService.notifyStatusChange(order, 'completada');
        } catch (error) {
            this.logger.error(`Failed to send Telegram status change: ${error.message}`);
        }

        const customerPhone = order.guestInfo?.contact || order.shippingAddress?.phone;
        if (customerPhone) {
            await this.sendWhatsApp(customerPhone,
                `📦 ¡Pedido entregado! Gracias por tu compra en ZayrelStudio.`);
        }
    }
}
