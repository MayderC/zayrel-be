import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class MailService {
    constructor(private mailerService: MailerService) { }

    async sendUserWelcome(user: { email: string; name: string }) {
        await this.mailerService.sendMail({
            to: user.email,
            // from: '"Support Team" <support@zayrel.com>', // Override default from
            subject: 'Welcome to Zayrel! Confirm your Email',
            // template: './welcome', // We can set up templates later
            // context: { 
            //   name: user.name,
            //   url: confirmLink,
            // },
            html: `
        <h1>Welcome ${user.name}</h1>
        <p>Please confirm your email by clicking the link below:</p>
        <p><a href="#">Confirm Email</a></p>
        <p>(This is a mock email for Zayrel development)</p>
      `,
        });
        console.log(`[MailService] Mock email sent to ${user.email}`);
    }
}
