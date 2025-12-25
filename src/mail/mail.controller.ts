import { Controller, Post, Body, HttpCode, HttpStatus, Get } from '@nestjs/common';
import { MailService } from './mail.service';
import { ConfigService } from '@nestjs/config';
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

class TestEmailDto {
    @IsEmail()
    @IsNotEmpty()
    to: string;

    @IsString()
    @IsNotEmpty()
    name: string;
}

class TestPasswordResetDto {
    @IsEmail()
    @IsNotEmpty()
    to: string;

    @IsString()
    @IsNotEmpty()
    name: string;

    @IsString()
    @IsOptional()
    resetUrl?: string;
}

@Controller('mail')
export class MailController {
    private readonly isDevelopment: boolean;

    constructor(
        private readonly mailService: MailService,
        private readonly configService: ConfigService,
    ) {
        this.isDevelopment = this.configService.get('NODE_ENV') === 'development';
    }

    /**
     * Debug endpoint to check mail configuration
     * Only available in development mode
     */
    @Get('debug')
    getMailConfig() {
        if (!this.isDevelopment) {
            return { error: 'This endpoint is only available in development mode' };
        }

        const password = this.configService.get('MAIL_PASSWORD') || '';
        const providerInfo = this.mailService.getProviderInfo();

        return {
            provider: providerInfo.provider,
            fallbackProvider: providerInfo.fallbackProvider || 'NOT SET',
            host: this.configService.get('MAIL_HOST') || 'NOT SET',
            port: this.configService.get('MAIL_PORT') || '465',
            secure: this.configService.get('MAIL_SECURE') || 'true',
            user: this.configService.get('MAIL_USER') || 'NOT SET',
            passwordSet: password.length > 0,
            passwordLength: password.length,
            passwordPreview: password.length > 4 ? `${password.substring(0, 2)}...${password.substring(password.length - 2)}` : '****',
            from: this.configService.get('MAIL_FROM') || 'NOT SET',
            resendApiKeySet: !!this.configService.get('RESEND_API_KEY'),
            testRecipient: providerInfo.testRecipient || 'NOT SET',
            isTestMode: providerInfo.isTestMode,
            nodeEnv: this.configService.get('NODE_ENV') || 'NOT SET',
        };
    }

    /**
     * Test endpoint for welcome email
     * Only available in development mode
     */
    @Post('test/welcome')
    @HttpCode(HttpStatus.OK)
    async testWelcomeEmail(@Body() dto: TestEmailDto) {
        if (!this.isDevelopment) {
            return { error: 'This endpoint is only available in development mode' };
        }

        await this.mailService.sendUserWelcome({
            email: dto.to,
            name: dto.name,
        });

        return {
            success: true,
            message: `Welcome email sent to ${dto.to}`,
            testMode: true,
        };
    }

    /**
     * Test endpoint for password reset email
     * Only available in development mode
     */
    @Post('test/password-reset')
    @HttpCode(HttpStatus.OK)
    async testPasswordResetEmail(@Body() dto: TestPasswordResetDto) {
        if (!this.isDevelopment) {
            return { error: 'This endpoint is only available in development mode' };
        }

        const siteUrl = this.configService.get('SITE_URL') || 'https://www.zayrelstudio.com';
        const resetUrl = dto.resetUrl || `${siteUrl}/auth/reset-password?token=test-token-123`;

        await this.mailService.sendPasswordReset(
            { email: dto.to, name: dto.name },
            resetUrl,
        );

        return {
            success: true,
            message: `Password reset email sent to ${dto.to}`,
            testMode: true,
        };
    }
}

