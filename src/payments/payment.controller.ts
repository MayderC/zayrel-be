
import { Controller, Post, Body, Param, Req, BadRequestException, UseGuards } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('payments')
export class PaymentController {
    constructor(private readonly paymentService: PaymentService) { }

    // Authenticated users only - requires valid JWT token
    @Post('initiate')
    @UseGuards(JwtAuthGuard)
    async initiate(@Body() dto: InitiatePaymentDto, @Req() req: any) {
        const userId = req.user._id;
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

