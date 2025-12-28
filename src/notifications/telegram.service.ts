import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as FormData from 'form-data';
import {
    STATUS_TO_TOPIC_ENV,
    STATUS_EMOJIS,
    STATUS_LABELS,
    WORKFLOW_NEXT_STEPS,
    PAYMENT_REVIEW_BUTTONS,
    getWhatsAppApprovedMessage,
    getWhatsAppRejectedMessage,
    getWhatsAppStatusMessage,
    buildPaymentProofMessage,
    buildStatusChangeMessage,
} from './telegram-templates';

/**
 * Telegram Service
 * 
 * Sends payment proof notifications to admin Telegram group with approve/reject buttons.
 * Handles callback queries from button presses.
 * 
 * Templates and message content are defined in telegram-templates.ts
 */
@Injectable()
export class TelegramService {
    private readonly logger = new Logger(TelegramService.name);
    private readonly botToken: string;
    private readonly groupChatId: string;
    private readonly adminUserId: string;
    private readonly topicRevision: string;
    private readonly baseUrl: string;

    constructor(private readonly configService: ConfigService) {
        this.botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN') || '';
        this.groupChatId = this.configService.get<string>('TELEGRAM_ORDERS_GROUP_ID') || '';
        this.adminUserId = this.configService.get<string>('TELEGRAM_ADMIN_USER_ID') || '';
        this.topicRevision = this.configService.get<string>('TELEGRAM_TOPIC_REVISION') || '';
        this.baseUrl = `https://api.telegram.org/bot${this.botToken}`;

        if (!this.botToken || !this.groupChatId) {
            this.logger.warn('⚠️ Telegram credentials not configured. Notifications will be disabled.');
        }
    }

    /**
     * Send payment proof to admin for review with approve/reject buttons
     */
    async sendPaymentProofForReview(order: any): Promise<void> {
        if (!this.botToken || !this.groupChatId) {
            this.logger.debug('Telegram not configured, skipping notification');
            return;
        }

        try {
            const orderId = order._id.toString();
            const shortId = orderId.slice(-6).toUpperCase();

            // Get customer info
            const customerName = order.user?.firstname
                ? `${order.user.firstname} ${order.user.lastname || ''}`
                : order.guestInfo?.name || 'Cliente';

            const customerEmail = order.user?.email || order.guestInfo?.email || 'N/A';
            const customerPhone = order.guestInfo?.contact || order.shippingAddress?.phone || '';
            const total = `$${(order.total || 0).toFixed(2)}`;
            const paymentMethod = order.paymentProof?.method || order.paymentMethod || 'Transferencia';
            const reference = order.paymentProof?.reference || '';

            // Generate WhatsApp templates
            const whatsappApproved = getWhatsAppApprovedMessage({ customerName, shortOrderId: shortId });
            const whatsappRejected = getWhatsAppRejectedMessage({ customerName, shortOrderId: shortId });

            // Build message using template
            const message = buildPaymentProofMessage({
                shortOrderId: shortId,
                customerName,
                customerEmail,
                customerPhone,
                total,
                paymentMethod,
                reference,
                whatsappApproved,
                whatsappRejected,
            });

            // Get buttons from template
            const buttons = PAYMENT_REVIEW_BUTTONS.initial(orderId);

            // Send photo with buttons
            const imageUrl = order.paymentProof?.url;
            if (imageUrl) {
                this.logger.log(`📷 Sending payment proof with buttons for order #${shortId}`);
                await this.sendPhotoWithButtons(imageUrl, message, buttons);
            } else {
                this.logger.warn(`⚠️ No payment proof URL found for order ${shortId}`);
                await this.sendMessageWithButtons(message, buttons);
            }

            this.logger.log(`📱 Payment proof notification sent for order #${shortId}`);

        } catch (error) {
            this.logger.error(`Failed to send Telegram notification: ${error.message}`);
        }
    }

    /**
     * Notify status change - sends message to corresponding topic WITH workflow buttons
     */
    async notifyStatusChange(order: any, newStatus: string, extra?: string): Promise<void> {
        if (!this.botToken || !this.groupChatId) {
            this.logger.debug('Telegram not configured, skipping notification');
            return;
        }

        const topicEnv = STATUS_TO_TOPIC_ENV[newStatus];
        if (!topicEnv) {
            this.logger.debug(`No topic configured for status: ${newStatus}`);
            return;
        }

        const topicId = this.configService.get<string>(topicEnv);
        if (!topicId) {
            this.logger.debug(`Topic ${topicEnv} not configured in .env`);
            return;
        }

        try {
            const orderId = order._id.toString();
            const shortId = orderId.slice(-6).toUpperCase();

            const customerName = order.user?.firstname
                ? `${order.user.firstname} ${order.user.lastname || ''}`
                : order.guestInfo?.name || 'Cliente';

            const customerEmail = order.user?.email || order.guestInfo?.email || 'N/A';
            const customerPhone = order.guestInfo?.contact || order.shippingAddress?.phone || '';
            const total = `$${(order.total || 0).toFixed(2)}`;

            // Format date
            const now = new Date();
            const dateStr = now.toLocaleDateString('es-CR', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });

            // Items summary
            const itemCount = order.items?.length || 0;
            const itemsText = itemCount > 0 ? `${itemCount} producto${itemCount > 1 ? 's' : ''}` : '';

            // Get WhatsApp template for this status
            const whatsappTemplate = getWhatsAppStatusMessage(newStatus, {
                customerName,
                shortOrderId: shortId,
                trackingNumber: order.trackingNumber,
            });

            // Build message using template
            const message = buildStatusChangeMessage({
                shortOrderId: shortId,
                statusEmoji: STATUS_EMOJIS[newStatus] || '📋',
                statusLabel: STATUS_LABELS[newStatus] || newStatus,
                dateStr,
                customerName,
                customerEmail,
                customerPhone,
                total,
                itemsText,
                trackingNumber: order.trackingNumber,
                extraNote: extra,
                whatsappTemplate,
            });

            // Check if there's a next step button for this status
            const nextStep = WORKFLOW_NEXT_STEPS[newStatus];
            if (nextStep) {
                await axios.post(`${this.baseUrl}/sendMessage`, {
                    chat_id: this.groupChatId,
                    text: message,
                    parse_mode: 'HTML',
                    message_thread_id: topicId,
                    reply_markup: {
                        inline_keyboard: [[
                            { text: nextStep.text, callback_data: `${nextStep.action}:${orderId}` }
                        ]]
                    }
                });
            } else {
                await this.sendMessage(message, topicId);
            }

            this.logger.log(`📱 Status change notification sent: ${newStatus} for order #${shortId}`);

        } catch (error) {
            this.logger.error(`Failed to send status change notification: ${error.message}`);
        }
    }

    /**
     * Handle callback query from Telegram button press
     */
    async handleCallbackQuery(callbackQuery: any): Promise<{ success: boolean; action?: string; orderId?: string }> {
        const { id: queryId, from, data, message } = callbackQuery;

        // Security: Verify admin user ID
        if (this.adminUserId && from.id.toString() !== this.adminUserId) {
            await this.answerCallback(queryId, '🚫 No autorizado');
            this.logger.warn(`Unauthorized callback attempt from user ${from.id}`);
            return { success: false };
        }

        const [action, orderId] = data.split(':');

        // Handle confirmation steps using template buttons
        if (action === 'approve_step1') {
            await this.editMessageButtons(message.chat.id, message.message_id, PAYMENT_REVIEW_BUTTONS.confirmApprove(orderId));
            await this.answerCallback(queryId, '¿Confirmar aprobación?');
            return { success: true };
        }

        if (action === 'reject_step1') {
            await this.editMessageButtons(message.chat.id, message.message_id, PAYMENT_REVIEW_BUTTONS.confirmReject(orderId));
            await this.answerCallback(queryId, '¿Confirmar rechazo?');
            return { success: true };
        }

        if (action === 'cancel') {
            await this.editMessageButtons(message.chat.id, message.message_id, PAYMENT_REVIEW_BUTTONS.initial(orderId));
            await this.answerCallback(queryId, 'Cancelado');
            return { success: true };
        }

        if (action === 'approve_confirm') {
            await this.deleteMessage(message.chat.id, message.message_id);
            await this.answerCallback(queryId, '✅ Pago aprobado - mensaje eliminado');
            return { success: true, action: 'approved', orderId };
        }

        if (action === 'reject_confirm') {
            await this.deleteMessage(message.chat.id, message.message_id);
            await this.answerCallback(queryId, '❌ Pago rechazado - mensaje eliminado');
            return { success: true, action: 'rejected', orderId };
        }

        // Workflow actions - move order to next status
        if (action === 'move_produccion') {
            await this.deleteMessage(message.chat.id, message.message_id);
            await this.answerCallback(queryId, '🛠️ Moviendo a Producción...');
            return { success: true, action: 'move_to_produccion', orderId };
        }

        if (action === 'move_enviada') {
            await this.deleteMessage(message.chat.id, message.message_id);
            await this.answerCallback(queryId, '🚀 Marcando como Enviada...');
            return { success: true, action: 'move_to_enviada', orderId };
        }

        if (action === 'move_completada') {
            await this.deleteMessage(message.chat.id, message.message_id);
            await this.answerCallback(queryId, '📦 Marcando como Completada...');
            return { success: true, action: 'move_to_completada', orderId };
        }

        return { success: false };
    }

    // ============================================
    // LOW-LEVEL TELEGRAM API METHODS
    // ============================================

    /**
     * Send photo to group - handles both URLs and base64 images
     */
    private async sendPhoto(photoSource: string, caption: string): Promise<void> {
        try {
            if (photoSource.startsWith('data:image')) {
                const base64Data = photoSource.replace(/^data:image\/\w+;base64,/, '');
                const imageBuffer = Buffer.from(base64Data, 'base64');

                const form = new FormData();
                form.append('chat_id', this.groupChatId);
                form.append('caption', caption);
                if (this.topicRevision) {
                    form.append('message_thread_id', this.topicRevision);
                }
                form.append('photo', imageBuffer, { filename: 'comprobante.jpg', contentType: 'image/jpeg' });

                await axios.post(`${this.baseUrl}/sendPhoto`, form, {
                    headers: form.getHeaders()
                });
                this.logger.log('📷 Base64 image uploaded to Telegram');
            } else {
                await axios.post(`${this.baseUrl}/sendPhoto`, {
                    chat_id: this.groupChatId,
                    photo: photoSource,
                    caption,
                    message_thread_id: this.topicRevision || undefined
                });
            }
        } catch (error) {
            this.logger.error(`Failed to send photo: ${error.message}`);
        }
    }

    /**
     * Send photo with inline keyboard buttons
     */
    private async sendPhotoWithButtons(photoSource: string, caption: string, buttons: any[][]): Promise<void> {
        try {
            const replyMarkup = { inline_keyboard: buttons };

            if (photoSource.startsWith('data:image')) {
                const base64Data = photoSource.replace(/^data:image\/\w+;base64,/, '');
                const imageBuffer = Buffer.from(base64Data, 'base64');

                const form = new FormData();
                form.append('chat_id', this.groupChatId);
                form.append('caption', caption);
                form.append('parse_mode', 'HTML');
                form.append('reply_markup', JSON.stringify(replyMarkup));
                if (this.topicRevision) {
                    form.append('message_thread_id', this.topicRevision);
                }
                form.append('photo', imageBuffer, { filename: 'comprobante.jpg', contentType: 'image/jpeg' });

                await axios.post(`${this.baseUrl}/sendPhoto`, form, {
                    headers: form.getHeaders()
                });
            } else {
                await axios.post(`${this.baseUrl}/sendPhoto`, {
                    chat_id: this.groupChatId,
                    photo: photoSource,
                    caption,
                    parse_mode: 'HTML',
                    message_thread_id: this.topicRevision || undefined,
                    reply_markup: replyMarkup
                });
            }
            this.logger.log('📷 Photo with buttons sent to Telegram');
        } catch (error) {
            this.logger.error(`Failed to send photo with buttons: ${error.message}`);
        }
    }

    /**
     * Send message with inline keyboard buttons
     */
    private async sendMessageWithButtons(text: string, buttons: any[][]): Promise<void> {
        await axios.post(`${this.baseUrl}/sendMessage`, {
            chat_id: this.groupChatId,
            text,
            parse_mode: 'HTML',
            message_thread_id: this.topicRevision || undefined,
            reply_markup: {
                inline_keyboard: buttons
            }
        });
    }

    /**
     * Edit message buttons
     */
    private async editMessageButtons(chatId: number, messageId: number, buttons: any[][]): Promise<void> {
        await axios.post(`${this.baseUrl}/editMessageReplyMarkup`, {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: {
                inline_keyboard: buttons
            }
        });
    }

    /**
     * Edit message text
     */
    private async editMessageText(chatId: number, messageId: number, text: string): Promise<void> {
        await axios.post(`${this.baseUrl}/editMessageText`, {
            chat_id: chatId,
            message_id: messageId,
            text,
            parse_mode: 'HTML'
        });
    }

    /**
     * Delete a message from chat
     */
    private async deleteMessage(chatId: number, messageId: number): Promise<void> {
        try {
            await axios.post(`${this.baseUrl}/deleteMessage`, {
                chat_id: chatId,
                message_id: messageId
            });
        } catch (error) {
            this.logger.error(`Failed to delete message: ${error.message}`);
        }
    }

    /**
     * Answer callback query (shows toast in Telegram)
     */
    private async answerCallback(queryId: string, text: string): Promise<void> {
        await axios.post(`${this.baseUrl}/answerCallbackQuery`, {
            callback_query_id: queryId,
            text
        });
    }

    /**
     * Send simple message to group
     */
    async sendMessage(text: string, topicId?: string): Promise<void> {
        if (!this.botToken || !this.groupChatId) return;

        try {
            await axios.post(`${this.baseUrl}/sendMessage`, {
                chat_id: this.groupChatId,
                text,
                parse_mode: 'HTML',
                message_thread_id: topicId || undefined
            });
        } catch (error) {
            this.logger.error(`Failed to send message: ${error.message}`);
        }
    }
}
