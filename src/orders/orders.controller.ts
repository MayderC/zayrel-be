import { Controller, Get, Post, Body, Patch, Param, UseGuards, Request, Query } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles.enum';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { OrderAccessGuard } from '../auth/order-access.guard';
import { CreateOrderDto, UpdatePaymentProofDto, UpdateOrderTrackingDto } from './dtos';

@Controller('orders')
export class OrdersController {
    constructor(private readonly ordersService: OrdersService) { }

    // Hybrid - allows guest checkout, uses token if available for security
    @Post()
    @UseGuards(OptionalJwtAuthGuard)
    create(@Body() createOrderDto: CreateOrderDto, @Request() req) {
        return this.ordersService.create(createOrderDto, req.user);
    }

    // Admin only - list all orders
    @Get()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.Admin)
    findAll(
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('search') search?: string,
        @Query('status') status?: string,
    ) {
        return this.ordersService.findAll({
            page: page ? parseInt(page, 10) : 1,
            limit: limit ? parseInt(limit, 10) : 10,
            search,
            status,
        });
    }

    // Authenticated user - get own orders
    @UseGuards(JwtAuthGuard)
    @Get('mine')
    getMyOrders(@Request() req) {
        // Pass both userId and email so we can find orders by user OR by guestInfo.email
        return this.ordersService.findMyOrders(req.user._id, req.user.email);
    }

    // Hybrid - guests can access their orders, users need to be owner/admin
    @Get(':id')
    @UseGuards(OptionalJwtAuthGuard, OrderAccessGuard)
    findOne(@Param('id') id: string) {
        return this.ordersService.findOne(id);
    }

    // Hybrid - guests can upload proof, users need to be owner/admin
    @Patch(':id/payment-proof')
    @UseGuards(OptionalJwtAuthGuard, OrderAccessGuard)
    updatePaymentProof(@Param('id') id: string, @Body() proofDto: UpdatePaymentProofDto) {
        return this.ordersService.updatePaymentProof(id, proofDto);
    }

    // Admin only - update tracking info
    @Patch(':id/tracking')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.Admin)
    updateTracking(@Param('id') id: string, @Body() trackingDto: UpdateOrderTrackingDto) {
        return this.ordersService.updateTracking(id, trackingDto);
    }

    // Admin only - update order status
    @Patch(':id/status')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.Admin)
    updateStatus(@Param('id') id: string, @Body() body: { status: string }) {
        return this.ordersService.updateStatus(id, body.status);
    }

    // Admin only - archive order
    @Patch(':id/archive')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.Admin)
    archiveOrder(@Param('id') id: string) {
        return this.ordersService.archiveOrder(id);
    }

    // Hybrid - owners can cancel their own orders, admins can cancel any
    @Patch(':id/cancel')
    @UseGuards(OptionalJwtAuthGuard, OrderAccessGuard)
    cancelOrder(@Param('id') id: string) {
        return this.ordersService.cancelOrder(id);
    }

    // Admin only - unarchive order
    @Patch(':id/unarchive')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.Admin)
    unarchiveOrder(@Param('id') id: string) {
        return this.ordersService.unarchiveOrder(id);
    }
}
