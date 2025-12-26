import { Controller, Get, Post, Body, Patch, Param, UseGuards, Request } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateOrderDto, UpdatePaymentProofDto, UpdateOrderTrackingDto } from './dtos';

@Controller('orders')
export class OrdersController {
    constructor(private readonly ordersService: OrdersService) { }

    @Post()
    create(@Body() createOrderDto: CreateOrderDto) {
        return this.ordersService.create(createOrderDto);
    }

    @Get()
    findAll() {
        return this.ordersService.findAll();
    }

    @UseGuards(JwtAuthGuard)
    @Get('mine')
    getMyOrders(@Request() req) {
        // Pass both userId and email so we can find orders by user OR by guestInfo.email
        return this.ordersService.findMyOrders(req.user._id, req.user.email);
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.ordersService.findOne(id);
    }

    @Patch(':id/payment-proof')
    updatePaymentProof(@Param('id') id: string, @Body() proofDto: UpdatePaymentProofDto) {
        return this.ordersService.updatePaymentProof(id, proofDto);
    }

    @Patch(':id/tracking')
    updateTracking(@Param('id') id: string, @Body() trackingDto: UpdateOrderTrackingDto) {
        return this.ordersService.updateTracking(id, trackingDto);
    }

    @Patch(':id/status')
    updateStatus(@Param('id') id: string, @Body() body: { status: string }) {
        return this.ordersService.updateStatus(id, body.status);
    }

    @Patch(':id/archive')
    archiveOrder(@Param('id') id: string) {
        return this.ordersService.archiveOrder(id);
    }

    @Patch(':id/cancel')
    cancelOrder(@Param('id') id: string) {
        return this.ordersService.cancelOrder(id);
    }

    @Patch(':id/unarchive')
    unarchiveOrder(@Param('id') id: string) {
        return this.ordersService.unarchiveOrder(id);
    }
}
