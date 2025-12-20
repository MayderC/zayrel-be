import { Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { MailerModule } from '@nestjs-modules/mailer';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
    imports: [
        MailerModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: async (config: ConfigService) => ({
                transport: {
                    host: config.get('MAIL_HOST') || 'smtp.zoho.com',
                    port: 465,
                    secure: true,
                    auth: {
                        user: config.get('MAIL_USER') || 'mock-user',
                        pass: config.get('MAIL_PASSWORD') || 'mock-pass',
                    },
                    // Mock transport if no real credentials
                    // ignoreTLS: true,
                },
                defaults: {
                    from: '"No Reply" <noreply@zayrel.com>',
                },
            }),
            inject: [ConfigService],
        }),
    ],
    providers: [MailService],
    exports: [MailService],
})
export class MailModule { }
