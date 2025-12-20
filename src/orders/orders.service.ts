import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Order, OrderDocument, OrderItem, OrderItemDocument, Variant, VariantDocument, Product, ProductDocument } from '../database/schemas';
import { CreateOrderDto, UpdatePaymentProofDto } from './dtos';

@Injectable()
export class OrdersService {
    constructor(
        @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
        @InjectModel(OrderItem.name) private orderItemModel: Model<OrderItemDocument>,
        @InjectModel(Variant.name) private variantModel: Model<VariantDocument>,
        @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    ) { }

    async create(createOrderDto: CreateOrderDto) {
        // 1. Validate Items & Stock
        const orderItemsData: any[] = [];
        let loadVariants = [];

        // Check stock for all items
        for (const item of createOrderDto.items) {
            const variant = await this.variantModel.findById(item.variantId).populate('product');
            if (!variant) throw new NotFoundException(`Variant ${item.variantId} not found`);
            if (variant.stock < item.quantity) {
                throw new BadRequestException(`Insufficient stock for variant ${item.variantId}`);
            }

            // Determine price: Use provided unitPrice or fetch from Product
            let price = item.unitPrice;
            if (price === undefined) {
                // Assuming Product has price. Variant usually doesn't have price override in this schema unless listing?
                // Product has price.
                // Cast variant.product to any or ProductDocument if populated
                const product = variant.product as any;
                price = product.price;
            }

            orderItemsData.push({
                variantId: item.variantId,
                quantity: item.quantity,
                unitPrice: price,
                variantDoc: variant
            });
        }

        // 2. Create Order
        const newOrder = new this.orderModel({
            user: createOrderDto.user ? new Types.ObjectId(createOrderDto.user) : undefined,
            guestInfo: createOrderDto.guestInfo,
            shippingAddress: createOrderDto.shippingAddress,
            orderType: createOrderDto.orderType || 'online',
            status: createOrderDto.orderType === 'manual_sale' ? 'pagada' : 'pendiente',
        });
        const savedOrder = await newOrder.save();

        // 3. Create OrderItems and Deduct Stock
        for (const itemData of orderItemsData) {
            await this.orderItemModel.create({
                orderId: savedOrder._id,
                variantId: itemData.variantId,
                quantity: itemData.quantity,
                unitPrice: itemData.unitPrice,
            });

            // Deduct Stock
            await this.variantModel.updateOne(
                { _id: itemData.variantId },
                { $inc: { stock: -itemData.quantity } }
            );
        }

        return savedOrder;
    }

    async findAll() {
        const orders = await this.orderModel.find().populate('user').sort({ createdAt: -1 }).exec();

        // For each order, fetch its items
        const ordersWithItems = await Promise.all(
            orders.map(async (order) => {
                const items = await this.orderItemModel.find({ orderId: order._id }).populate({
                    path: 'variantId',
                    populate: { path: 'product size color' }
                }).exec();

                // Calculate total
                const total = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);

                return { ...order.toObject(), items, total };
            })
        );

        return ordersWithItems;
    }

    async findOne(id: string) {
        const order = await this.orderModel.findById(id).populate('user').exec();
        if (!order) throw new NotFoundException('Order not found');
        const items = await this.orderItemModel.find({ orderId: order._id }).populate({
            path: 'variantId',
            populate: { path: 'product size color' }
        }).exec();
        return { ...order.toObject(), items };
    }

    async updatePaymentProof(id: string, proofDto: UpdatePaymentProofDto) {
        const order = await this.orderModel.findById(id);
        if (!order) throw new NotFoundException('Order not found');

        order.paymentProof = {
            url: proofDto.url,
            type: proofDto.type,
            reference: proofDto.reference,
            status: proofDto.status || 'pending'
        };

        if (proofDto.status === 'verified') {
            order.status = 'paid';
        }

        return order.save();
    }

    async updateTracking(id: string, trackingDto: any) {
        const order = await this.orderModel.findById(id);
        if (!order) throw new NotFoundException('Order not found');

        order.trackingNumber = trackingDto.trackingNumber;
        order.shippingProvider = trackingDto.shippingProvider;
        order.status = 'enviada'; // Auto-update status to 'enviada' (shipped)

        return order.save();
    }

    async updateStatus(id: string, status: string) {
        const order = await this.orderModel.findById(id);
        if (!order) throw new NotFoundException('Order not found');

        order.status = status as any;
        return order.save();
    }

    // Cancel order: Returns stock and sets status to 'cancelada'
    async cancelOrder(id: string) {
        const order = await this.orderModel.findById(id);
        if (!order) throw new NotFoundException('Order not found');
        if (order.status === 'cancelada') throw new BadRequestException('Order is already cancelled');

        // Get order items to return stock
        const items = await this.orderItemModel.find({ orderId: order._id }).exec();

        // Return stock to each variant
        for (const item of items) {
            await this.variantModel.updateOne(
                { _id: item.variantId },
                { $inc: { stock: item.quantity } }
            );
        }

        order.status = 'cancelada';
        return order.save();
    }

    // Archive order: Just visual cleanup, NO stock change
    async archiveOrder(id: string) {
        const order = await this.orderModel.findById(id);
        if (!order) throw new NotFoundException('Order not found');

        order.status = 'archivada';
        return order.save();
    }

    // Unarchive order: Restores to 'completada' (assuming archived from completed)
    // Note: Since archive didn't return stock, unarchive doesn't deduct it.
    async unarchiveOrder(id: string) {
        const order = await this.orderModel.findById(id);
        if (!order) throw new NotFoundException('Order not found');
        if (order.status !== 'archivada') {
            throw new BadRequestException('Order is not archived');
        }

        // Default restore to 'completada' as it's the safest assumption for archived orders
        order.status = 'completada';
        return order.save();
    }
}
