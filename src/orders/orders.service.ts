import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { IPaymentStorageService } from '../storage/interfaces/payment-storage.interface';
import { NotificationsService } from '../notifications/notifications.service';
import { DashboardService } from '../dashboard/dashboard.service';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Order, OrderDocument, OrderItem, OrderItemDocument, Variant, VariantDocument, Product, ProductDocument, User, UserDocument } from '../database/schemas';
import { CreateOrderDto, UpdatePaymentProofDto } from './dtos';

@Injectable()
export class OrdersService {
    constructor(
        @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
        @InjectModel(OrderItem.name) private orderItemModel: Model<OrderItemDocument>,
        @InjectModel(Variant.name) private variantModel: Model<VariantDocument>,
        @InjectModel(Product.name) private productModel: Model<ProductDocument>,
        @InjectModel(User.name) private userModel: Model<UserDocument>,
        private notificationsService: NotificationsService,
        @Inject('PAYMENT_STORAGE') private storageService: IPaymentStorageService,
        @Inject(forwardRef(() => DashboardService)) private dashboardService: DashboardService,
    ) { }

    async create(createOrderDto: CreateOrderDto, authenticatedUser?: any) {
        // SECURITY: Log incoming data for debugging
        console.log('[OrdersService.create] AuthenticatedUser:', authenticatedUser?._id, 'guestInfo:', createOrderDto.guestInfo?.email);

        // 1. Validate Items & Stock
        const orderItemsData: any[] = [];

        // Check stock for all items
        for (const item of createOrderDto.items) {
            const variant = await this.variantModel.findById(item.variantId).populate('product');
            if (!variant) throw new NotFoundException(`Variant ${item.variantId} not found`);
            if (variant.stock < item.quantity) {
                throw new BadRequestException(`Insufficient stock for variant ${item.variantId}`);
            }

            // SECURITY: Always fetch price from database to prevent price manipulation
            const product = variant.product as any;
            if (!product || typeof product.price !== 'number') {
                throw new BadRequestException(`Price not found for variant ${item.variantId}`);
            }
            const price = product.price;

            orderItemsData.push({
                variantId: item.variantId,
                quantity: item.quantity,
                unitPrice: price,
                variantDoc: variant,
                productName: product?.name || 'Producto',
                size: (variant as any).size?.name,
                color: (variant as any).color?.name,
            });
        }

        // 2. SECURITY: Determine user securely - use authenticated user, ignore DTO.user
        let userIdForOrder: Types.ObjectId | undefined;
        let guestInfoForOrder = createOrderDto.guestInfo;

        if (authenticatedUser) {
            // Authenticated user: use their ID from the verified token
            userIdForOrder = new Types.ObjectId(authenticatedUser._id);
            guestInfoForOrder = undefined; // Logged in users are not guests
        } else if (createOrderDto.user) {
            // SECURITY: Guest checkout with user ID in payload - ignore and log
            console.warn(`[SECURITY] Guest order attempted with user ID (${createOrderDto.user}). Ignoring.`);
        }

        const newOrder = new this.orderModel({
            user: userIdForOrder,
            guestInfo: guestInfoForOrder,
            shippingAddress: createOrderDto.shippingAddress,
            orderType: createOrderDto.orderType || 'online',
            status: createOrderDto.orderType === 'manual_sale' ? 'pagada' : 'esperando_pago',
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

        // 4. Send order confirmation email (async, non-blocking)
        // Get user email if this is an authenticated order
        let userEmail: string | undefined;
        if (userIdForOrder) {
            const user = await this.userModel.findById(userIdForOrder).select('email firstname lastname');
            userEmail = user?.email;
        }

        // Prepare order object with items for email template
        const orderForEmail = {
            ...savedOrder.toObject(),
            user: userIdForOrder ? {
                email: userEmail,
                _id: userIdForOrder
            } : undefined,
            items: orderItemsData.map(item => ({
                name: item.productName,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                size: item.size,
                color: item.color,
            })),
            total: orderItemsData.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0),
        };

        // Don't await - let email send in background
        this.notificationsService.notifyOrderCreated(orderForEmail).catch(err => {
            console.error('Failed to send order confirmation email:', err);
        });

        // Notify dashboard SSE of new order (non-blocking)
        this.dashboardService.notifyStatsUpdate().catch(err => {
            console.error('Failed to notify dashboard:', err);
        });

        return savedOrder;
    }

    async findAll(options?: {
        page?: number;
        limit?: number;
        search?: string;
        status?: string;
    }) {
        console.log('[findAll] Options received:', options);
        const { page = 1, limit = 10, search, status } = options || {};
        const skip = (page - 1) * limit;
        console.log('[findAll] Using: page=', page, 'limit=', limit, 'search=', search, 'status=', status);

        // Build query
        const query: any = {};

        // Filter by status (if not 'todas' or empty)
        if (status && status !== 'todas') {
            query.status = status;
        }

        // Search by name, email, or ID
        if (search && search.trim()) {
            const searchTerm = search.trim().toLowerCase();
            const searchConditions: any[] = [
                { 'guestInfo.name': { $regex: searchTerm, $options: 'i' } },
                { 'guestInfo.email': { $regex: searchTerm, $options: 'i' } },
            ];

            // If search term looks like a hex string (potential order ID) with at least 3 chars
            if (/^[a-fA-F0-9]+$/.test(searchTerm) && searchTerm.length >= 3) {
                // For full ObjectId match (24 chars)
                if (searchTerm.length === 24) {
                    try {
                        searchConditions.push({ _id: new Types.ObjectId(searchTerm) });
                    } catch {
                        // Not a valid ObjectId, ignore
                    }
                } else {
                    // For short ID (3+ chars), find all IDs first and filter 
                    // Search in the last 6 chars of the ID (the "short ID" shown to users)
                    // This is a workaround since $where is not allowed in MongoDB Atlas
                    const allIds = await this.orderModel.find(
                        status && status !== 'todas' ? { status } : {},
                        { _id: 1 }
                    ).lean().exec();

                    const matchingIds = allIds
                        .filter(doc => {
                            const shortId = doc._id.toString().slice(-6).toLowerCase();
                            return shortId.includes(searchTerm);
                        })
                        .map(doc => doc._id);

                    if (matchingIds.length > 0) {
                        searchConditions.push({ _id: { $in: matchingIds } });
                    }
                }
            }

            query.$or = searchConditions;
        }

        // Execute query with pagination
        const [orders, total] = await Promise.all([
            this.orderModel.find(query)
                .populate('user')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .exec(),
            this.orderModel.countDocuments(query),
        ]);

        // For each order, fetch its items
        const ordersWithItems = await Promise.all(
            orders.map(async (order) => {
                const items = await this.orderItemModel.find({ orderId: order._id }).populate({
                    path: 'variantId',
                    populate: { path: 'product size color' }
                }).exec();

                // Calculate total
                const orderTotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);

                return { ...order.toObject(), items, total: orderTotal };
            })
        );

        return {
            orders: ordersWithItems,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            }
        };
    }

    async findMyOrders(userId: string, userEmail?: string) {
        // Debug logging
        console.log('[findMyOrders] userId received:', userId, 'email:', userEmail);

        // Convert to ObjectId for proper MongoDB comparison
        let userObjectId: Types.ObjectId | null = null;
        try {
            userObjectId = new Types.ObjectId(userId);
        } catch {
            console.warn('[findMyOrders] Invalid userId format:', userId);
        }

        // Build query: find orders by user ID OR by guestInfo.email matching user's email
        const query: any = {};
        if (userObjectId && userEmail) {
            query.$or = [
                { user: userObjectId },
                { 'guestInfo.email': userEmail }
            ];
        } else if (userObjectId) {
            query.user = userObjectId;
        } else if (userEmail) {
            query['guestInfo.email'] = userEmail;
        }

        console.log('[findMyOrders] Query:', JSON.stringify(query));

        const orders = await this.orderModel.find(query).populate('user').sort({ createdAt: -1 }).exec();
        console.log('[findMyOrders] Found orders count:', orders.length);

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
        const total = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
        return { ...order.toObject(), items, total };
    }

    async updatePaymentProof(id: string, proofDto: UpdatePaymentProofDto) {
        // Populate user to get email for notifications
        const order = await this.orderModel.findById(id).populate('user');
        if (!order) throw new NotFoundException('Order not found');



        const currentProof = order.paymentProof || {} as any;
        let storedUrl = currentProof.url;

        // Only upload/store new file if URL is provided (base64)
        if (proofDto.url) {
            storedUrl = await this.storageService.store(proofDto.url, String(order._id));
        }

        order.paymentProof = {
            url: storedUrl,
            method: proofDto.type || currentProof.method, // Keep existing if not provided
            reference: proofDto.reference || currentProof.reference,
            status: proofDto.status || currentProof.status || 'pending',
            reason: proofDto.reason // Always update reason if provided (or clear it? usually specific to status update)
        };

        if (proofDto.reason !== undefined) {
            order.paymentProof.reason = proofDto.reason;
        } else {
            // Keep existing reason if not specified? Or maybe clean if approved?
            // For now, let's keep existing behavior or use simple assignment above if stricter.
            // Actually, simplified approach:
            order.paymentProof.reason = proofDto.reason || (proofDto.status === 'verified' ? undefined : currentProof.reason);
        }

        // Simplified assignment block to replace above complex logic for reason:
        order.paymentProof = {
            url: storedUrl,
            method: proofDto.type || currentProof.method,
            reference: proofDto.reference || currentProof.reference,
            status: proofDto.status || currentProof.status || 'pending',
            reason: proofDto.reason || (proofDto.status === 'verified' ? undefined : currentProof.reason)
        };

        // Notify customer when they upload a new payment proof (when a new URL is uploaded)
        // This happens when: we have a new URL AND we're not also changing status (admin approval/rejection)
        const isAdminStatusChange = proofDto.status === 'verified' || proofDto.status === 'rejected';
        const isNewProofUpload = proofDto.url && !isAdminStatusChange;

        console.log('[DEBUG] isNewProofUpload:', isNewProofUpload, 'url:', !!proofDto.url, 'status:', proofDto.status);

        if (isNewProofUpload) {
            // Fetch items to calculate total and display detailed list
            const items = await this.orderItemModel.find({ orderId: order._id }).lean();
            const total = items.reduce((sum, item: any) => sum + (item.quantity * item.unitPrice), 0);

            const notificationPayload = {
                ...order.toObject(),
                user: order.user,
                guestInfo: order.guestInfo,
                items,
                total
            };

            this.notificationsService.notifyPaymentProofReceived(notificationPayload).catch(err => {
                console.error('Failed to send payment proof received notification:', err);
            });
        }


        if (proofDto.status === 'verified') {
            // Only advance to 'pagada' if currently waiting for payment
            // Don't regress orders that are already further in the pipeline
            if (order.status === 'esperando_pago') {
                order.status = 'pagada';
            }

            // Get order items and calculate total for notification
            const items = await this.orderItemModel.find({ orderId: order._id }).lean();
            const total = items.reduce((sum, item: any) => sum + (item.quantity * item.unitPrice), 0);

            const notificationPayload = {
                ...order.toObject(),
                user: order.user,
                guestInfo: order.guestInfo,
                items,
                total,
            };

            await this.notificationsService.notifyPaymentApproved(notificationPayload);
        }

        if (proofDto.status === 'rejected') {
            // Get order items and calculate total for notification
            const items = await this.orderItemModel.find({ orderId: order._id }).lean();
            const total = items.reduce((sum, item: any) => sum + (item.quantity * item.unitPrice), 0);

            const notificationPayload = {
                ...order.toObject(),
                user: order.user,
                guestInfo: order.guestInfo,
                items,
                total,
            };

            await this.notificationsService.notifyPaymentRejected(notificationPayload, proofDto.reason);
        }

        const savedOrder = await order.save();

        // Notify dashboard SSE of payment update (non-blocking)
        this.dashboardService.notifyStatsUpdate().catch(err => {
            console.error('Failed to notify dashboard:', err);
        });

        return savedOrder;
    }

    async updateTracking(id: string, trackingDto: any) {
        const order = await this.orderModel.findById(id);
        if (!order) throw new NotFoundException('Order not found');

        order.trackingNumber = trackingDto.trackingNumber;
        order.shippingProvider = trackingDto.shippingProvider;
        order.status = 'enviada'; // Auto-update status to 'enviada' (shipped)

        const savedOrder = await order.save();

        // Notify customer
        const items = await this.orderItemModel.find({ orderId: order._id }).lean();
        const notificationPayload = {
            ...savedOrder.toObject(),
            user: order.user,
            guestInfo: order.guestInfo,
            items,
        };
        await this.notificationsService.notifyOrderShipped(notificationPayload);

        return savedOrder;
    }

    async updateStatus(id: string, status: string) {
        const order = await this.orderModel.findById(id).populate('user');
        if (!order) throw new NotFoundException('Order not found');

        const previousStatus = order.status;
        order.status = status as any;

        // Sync paymentProof.status when order moves to a "paid" state
        // If order is marked as pagada, en_produccion, enviada, or completada,
        // the payment should be considered verified
        const paidStatuses = ['pagada', 'en_produccion', 'enviada', 'completada'];
        if (paidStatuses.includes(status) && order.paymentProof?.status === 'pending') {
            order.paymentProof.status = 'verified';
        }

        const savedOrder = await order.save();

        // Notify dashboard (non-blocking)
        this.dashboardService.notifyStatsUpdate().catch(err => console.error(err));

        // Handle Status Change Notifications
        if (status !== previousStatus) {
            // Prepare payload
            const items = await this.orderItemModel.find({ orderId: order._id }).lean();
            const total = items.reduce((sum, item: any) => sum + (item.quantity * item.unitPrice), 0);

            const payload = {
                ...savedOrder.toObject(),
                user: order.user,
                guestInfo: order.guestInfo,
                items,
                total
            };

            if (status === 'en_produccion') {
                await this.notificationsService.notifyOrderInProduction(payload);
            } else if (status === 'enviada') {
                await this.notificationsService.notifyOrderShipped(payload);
            } else if (status === 'completada') {
                await this.notificationsService.notifyOrderCompleted(payload);

                // Award VTO tokens
                if (order.user) {
                    await this.userModel.findByIdAndUpdate(order.user._id || order.user, { $inc: { vtoTokens: 5 } });
                }
            }
        }

        return order;
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
