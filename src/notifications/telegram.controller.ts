import { Controller, Post, Body, Logger, Inject, forwardRef, UseGuards } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { OrdersService } from '../orders/orders.service';
import { TelegramWebhookGuard } from '../auth/telegram-webhook.guard';

/**
 * Telegram Webhook Controller
 * 
 * Receives callback queries from Telegram when admin presses approve/reject buttons.
 * Endpoint: POST /telegram/webhook
 * 
 * Protected by TelegramWebhookGuard which validates the secret token from Telegram.
 */
@Controller('telegram')
export class TelegramController {
    private readonly logger = new Logger(TelegramController.name);

    constructor(
        private readonly telegramService: TelegramService,
        @Inject(forwardRef(() => OrdersService)) private readonly ordersService: OrdersService,
    ) { }

    /**
     * Webhook endpoint for Telegram Bot API
     * Telegram sends updates here when buttons are pressed
     * 
     * @security Protected by TelegramWebhookGuard (validates X-Telegram-Bot-Api-Secret-Token header)
     */
    @Post('webhook')
    @UseGuards(TelegramWebhookGuard)
    async handleWebhook(@Body() update: any) {
        this.logger.debug(`Received Telegram update: ${JSON.stringify(update)}`);

        // Handle callback queries (button presses)
        if (update.callback_query) {
            const result = await this.telegramService.handleCallbackQuery(update.callback_query);

            if (result.success && result.action && result.orderId) {
                try {
                    if (result.action === 'approved') {
                        // Update payment proof status to verified
                        await this.ordersService.updatePaymentProof(result.orderId, {
                            status: 'verified'
                        });
                        this.logger.log(`✅ Order ${result.orderId} payment approved via Telegram`);
                    } else if (result.action === 'rejected') {
                        // Update payment proof status to rejected
                        await this.ordersService.updatePaymentProof(result.orderId, {
                            status: 'rejected',
                            reason: 'Rechazado por admin desde Telegram'
                        });
                        this.logger.log(`❌ Order ${result.orderId} payment rejected via Telegram`);
                    } else if (result.action === 'move_to_produccion') {
                        await this.ordersService.updateStatus(result.orderId, 'en_produccion');
                        this.logger.log(`🛠️ Order ${result.orderId} moved to production via Telegram`);
                    } else if (result.action === 'move_to_enviada') {
                        await this.ordersService.updateStatus(result.orderId, 'enviada');
                        this.logger.log(`🚀 Order ${result.orderId} marked as shipped via Telegram`);
                    } else if (result.action === 'move_to_completada') {
                        await this.ordersService.updateStatus(result.orderId, 'completada');
                        this.logger.log(`📦 Order ${result.orderId} marked as completed via Telegram`);
                    }
                } catch (error) {
                    this.logger.error(`Failed to update order: ${error.message}`);
                }
            }
        }

        // Telegram expects a 200 response
        return { ok: true };
    }
}
