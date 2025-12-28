import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Order, OrderDocument } from '../database/schemas';

/**
 * Hybrid access guard for orders.
 * 
 * Access Rules:
 * - Guest orders (order.user = null): Public access (anyone with orderId can access)
 * - User orders (order.user exists): Only the owner or an Admin can access
 * 
 * Must be used AFTER OptionalJwtAuthGuard to have req.user populated when authenticated.
 */
@Injectable()
export class OrderAccessGuard implements CanActivate {
    constructor(
        @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const orderId = request.params.id;
        const user = request.user; // Will be null/undefined if not authenticated

        // Find the order to check ownership
        const order = await this.orderModel.findById(orderId).select('user').lean().exec();

        if (!order) {
            throw new NotFoundException('Orden no encontrada');
        }

        // Guest order (no user associated) - allow public access
        if (!order.user) {
            return true;
        }

        // User order - requires authentication
        if (!user) {
            throw new UnauthorizedException('Esta orden requiere autenticación');
        }

        // Check if user is owner or admin
        const isOwner = order.user.toString() === user._id.toString();
        const isAdmin = user.role === 'admin';

        if (!isOwner && !isAdmin) {
            throw new ForbiddenException('No tienes permiso para acceder a esta orden');
        }

        return true;
    }
}
