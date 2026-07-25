import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

/**
 * Guard to protect Telegram webhook endpoint
 * 
 * Validates the X-Telegram-Bot-Api-Secret-Token header against the configured secret.
 * This prevents unauthorized actors from sending fake Telegram updates.
 * 
 * @see https://core.telegram.org/bots/api#setwebhook
 */
@Injectable()
export class TelegramWebhookGuard implements CanActivate {
    private readonly logger = new Logger(TelegramWebhookGuard.name);
    private readonly secretToken: string;

    constructor(private readonly configService: ConfigService) {
        this.secretToken = this.configService.get<string>('TELEGRAM_WEBHOOK_SECRET') || '';

        if (!this.secretToken) {
            this.logger.error('⚠️ TELEGRAM_WEBHOOK_SECRET not configured - all webhook requests will be rejected');
        }
    }

    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest<Request>();
        const headerToken = request.headers['x-telegram-bot-api-secret-token'] as string;

        if (!headerToken) {
            this.logger.warn('Telegram webhook called without secret token header');
            throw new UnauthorizedException('Missing secret token');
        }

        if (headerToken !== this.secretToken) {
            this.logger.warn('Telegram webhook called with invalid secret token');
            throw new UnauthorizedException('Invalid secret token');
        }

        return true;
    }
}
