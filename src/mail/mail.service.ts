import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EMAIL_PROVIDER, EMAIL_FALLBACK_PROVIDER, EmailProvider, SendMailOptions } from './providers';
import { EmailTemplateService } from './email-template.service';

@Injectable()
export class MailService {
    private readonly logger = new Logger(MailService.name);
    private readonly isTestMode: boolean;
    private readonly testRecipient: string | undefined;

    // Centralized brand/site configuration
    private readonly brandName: string;
    private readonly siteUrl: string;
    private readonly storeUrl: string;
    private readonly instagramUrl: string;

    constructor(
        @Inject(EMAIL_PROVIDER) private readonly primaryProvider: EmailProvider,
        @Optional() @Inject(EMAIL_FALLBACK_PROVIDER) private readonly fallbackProvider: EmailProvider | null,
        private readonly configService: ConfigService,
        private readonly templateService: EmailTemplateService,
    ) {
        this.isTestMode = this.configService.get('NODE_ENV') === 'development';
        this.testRecipient = this.configService.get('MAIL_TEST_RECIPIENT');

        // Brand configuration from env or defaults
        this.brandName = this.configService.get('BRAND_NAME') || 'ZayrelStudio';
        this.siteUrl = this.configService.get('SITE_URL') || 'https://www.zayrelstudio.com';
        this.storeUrl = this.configService.get('STORE_URL') || this.siteUrl;
        this.instagramUrl = this.configService.get('INSTAGRAM_URL') || 'https://www.instagram.com/zayrelstudio';

        this.logger.log(`📧 Primary provider: ${this.primaryProvider.name}`);
        if (this.fallbackProvider) {
            this.logger.log(`📧 Fallback provider: ${this.fallbackProvider.name}`);
        }
    }

    /**
     * Common template variables used across all emails
     */
    private getCommonTemplateVars() {
        return {
            brandName: this.brandName,
            siteUrl: this.siteUrl,
            storeUrl: this.storeUrl,
            instagramUrl: this.instagramUrl,
            year: new Date().getFullYear(),
        };
    }

    /**
     * Get current provider info for debugging
     */
    getProviderInfo() {
        return {
            provider: this.primaryProvider.name,
            fallbackProvider: this.fallbackProvider?.name || null,
            isTestMode: this.isTestMode,
            testRecipient: this.testRecipient,
            availableTemplates: this.templateService.getAvailableTemplates(),
        };
    }

    /**
     * Core method to send emails with test mode and fallback support
     */
    private async sendMail(options: SendMailOptions): Promise<void> {
        const originalRecipient = options.to;
        let finalRecipient = options.to;
        let subject = options.subject;

        // In test mode, redirect all emails to the test recipient
        if (this.isTestMode && this.testRecipient) {
            finalRecipient = this.testRecipient;
            subject = `[TEST - Para: ${originalRecipient}] ${options.subject}`;
            this.logger.warn(`📧 TEST MODE: Redirecting email from ${originalRecipient} to ${this.testRecipient}`);
        }

        const mailOptions: SendMailOptions = {
            ...options,
            to: finalRecipient,
            subject: subject,
        };

        // Try primary provider
        try {
            await this.primaryProvider.sendMail(mailOptions);
            this.logger.log(`✅ Email sent via ${this.primaryProvider.name} to ${finalRecipient}`);
            return;
        } catch (primaryError) {
            this.logger.error(`❌ Primary provider (${this.primaryProvider.name}) failed: ${primaryError.message}`);

            // Try fallback if available
            if (this.fallbackProvider) {
                this.logger.warn(`🔄 Trying fallback provider: ${this.fallbackProvider.name}`);
                try {
                    await this.fallbackProvider.sendMail(mailOptions);
                    this.logger.log(`✅ Email sent via fallback (${this.fallbackProvider.name}) to ${finalRecipient}`);
                    return;
                } catch (fallbackError) {
                    this.logger.error(`❌ Fallback provider (${this.fallbackProvider.name}) also failed: ${fallbackError.message}`);
                    throw new Error(`All email providers failed. Primary: ${primaryError.message}, Fallback: ${fallbackError.message}`);
                }
            }

            throw primaryError;
        }
    }

    /**
     * Send welcome email to new users
     * @param user User info (email, name)
     * @param magicLinkUrl Optional magic link URL for one-click login
     */
    async sendUserWelcome(user: { email: string; name: string }, magicLinkUrl?: string): Promise<void> {
        const html = this.templateService.render('welcome', {
            ...this.getCommonTemplateVars(),
            name: user.name,
            email: user.email,
            magicLinkUrl: magicLinkUrl || this.storeUrl, // Fallback to store URL if no magic link
        });

        await this.sendMail({
            to: user.email,
            subject: `¡Bienvenido a ${this.brandName}! 🎉`,
            html,
        });
    }

    /**
     * Send password reset email
     */
    async sendPasswordReset(user: { email: string; name: string }, resetUrl: string): Promise<void> {
        const html = this.templateService.render('password-reset', {
            ...this.getCommonTemplateVars(),
            name: user.name,
            email: user.email,
            resetUrl,
            expiresIn: '1 hora',
        });

        await this.sendMail({
            to: user.email,
            subject: `🔐 Restablecer tu contraseña - ${this.brandName}`,
            html,
        });
    }

    /**
     * Send a custom email using a specific template
     */
    async sendWithTemplate(
        to: string,
        subject: string,
        templateName: string,
        data: Record<string, any>,
    ): Promise<void> {
        const html = this.templateService.render(templateName, {
            ...data,
            email: to,
            year: new Date().getFullYear(),
        });

        await this.sendMail({ to, subject, html });
    }
}
