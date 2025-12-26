
import { Controller, Post, Body, Param, Req, BadRequestException, UseGuards } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';

// Assuming we have some AuthGuard. For now we skip or add TODO.
// import { AuthGuard } from '../auth/auth.guard'; 

@Controller('payments')
export class PaymentController {
    constructor(private readonly paymentService: PaymentService) { }

    @Post('initiate')
    // @UseGuards(JwtAuthGuard) // validation
    async initiate(@Body() dto: InitiatePaymentDto, @Req() req: any) {
        // const userId = req.user?.userId;
        const userId = "temp_user_id"; // Replace with actual user extraction
        return this.paymentService.initiatePayment(userId, dto);
    }

    @Post('webhook/:gateway')
    async handleWebhook(@Param('gateway') gateway: string, @Body() payload: any, @Req() req: any) {
        // Extract signature from headers based on gateway
        // Onvopay uses X-Webhook-Secret header
        const signature = req.headers['x-webhook-secret'] || req.headers['x-signature'] || req.headers['paypal-auth-algo'];
        return this.paymentService.handleWebhook(gateway, payload, signature);
    }
}
