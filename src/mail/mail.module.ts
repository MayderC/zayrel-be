import { Module, DynamicModule, Logger } from '@nestjs/common';
import { MailService } from './mail.service';
import { MailController } from './mail.controller';
import { MailerModule } from '@nestjs-modules/mailer';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EMAIL_PROVIDER, EMAIL_FALLBACK_PROVIDER, ZohoProvider, ResendProvider, EmailProvider } from './providers';
import { EmailTemplateService } from './email-template.service';

@Module({})
export class MailModule {
    private static readonly logger = new Logger('MailModule');

    private static getProvider(
        providerName: string,
        zohoProvider: ZohoProvider,
        resendProvider: ResendProvider,
    ): EmailProvider | null {
        switch (providerName?.toLowerCase()) {
            case 'resend':
                return resendProvider;
            case 'zoho':
                return zohoProvider;
            default:
                return null;
        }
    }

    static forRoot(): DynamicModule {
        return {
            module: MailModule,
            global: true,
            imports: [
                ConfigModule,
                // Zoho SMTP configuration (used when provider is 'zoho')
                MailerModule.forRootAsync({
                    imports: [ConfigModule],
                    useFactory: async (config: ConfigService) => ({
                        transport: {
                            host: config.get('MAIL_HOST') || 'smtppro.zoho.com',
                            port: parseInt(config.get('MAIL_PORT') || '465'),
                            secure: config.get('MAIL_SECURE') !== 'false',
                            auth: {
                                user: config.get('MAIL_USER') || '',
                                pass: config.get('MAIL_PASSWORD') || '',
                            },
                        },
                        defaults: {
                            from: config.get('MAIL_FROM') || config.get('MAIL_USER'),
                        },
                    }),
                    inject: [ConfigService],
                }),
            ],
            controllers: [MailController],
            providers: [
                MailService,
                EmailTemplateService,
                ZohoProvider,
                ResendProvider,
                {
                    provide: EMAIL_PROVIDER,
                    useFactory: (
                        config: ConfigService,
                        zohoProvider: ZohoProvider,
                        resendProvider: ResendProvider,
                    ) => {
                        const providerName = config.get<string>('MAIL_PROVIDER') || 'resend';
                        const provider = MailModule.getProvider(providerName, zohoProvider, resendProvider);

                        MailModule.logger.log(`📧 Primary email provider: ${providerName.toUpperCase()}`);

                        return provider || resendProvider;
                    },
                    inject: [ConfigService, ZohoProvider, ResendProvider],
                },
                {
                    provide: EMAIL_FALLBACK_PROVIDER,
                    useFactory: (
                        config: ConfigService,
                        zohoProvider: ZohoProvider,
                        resendProvider: ResendProvider,
                    ) => {
                        const fallbackName = config.get<string>('MAIL_PROVIDER_FALLBACK');

                        if (!fallbackName) {
                            MailModule.logger.log(`📧 No fallback provider configured`);
                            return null;
                        }

                        const provider = MailModule.getProvider(fallbackName, zohoProvider, resendProvider);
                        MailModule.logger.log(`📧 Fallback email provider: ${fallbackName.toUpperCase()}`);

                        return provider;
                    },
                    inject: [ConfigService, ZohoProvider, ResendProvider],
                },
            ],
            exports: [MailService, EMAIL_PROVIDER, EMAIL_FALLBACK_PROVIDER],
        };
    }
}
