import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Subject, Observable } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { Order, OrderDocument, User, UserDocument, Product, ProductDocument, Variant, VariantDocument } from '../database/schemas';

export interface DashboardStats {
    monthlySales: {
        total: number;
        trend: number[];
        percentChange: number;
    };
    pendingApproval: {
        count: number;
        urgent: number;
    };
    activeProducts: number;
    todaySales: {
        total: number;
        count: number;
    };
    newCustomers: {
        thisMonth: number;
        total: number;
    };
    updatedAt: string;
}

@Injectable()
export class DashboardService {
    private readonly logger = new Logger(DashboardService.name);
    private statsSubject = new Subject<DashboardStats>();

    constructor(
        @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
        @InjectModel(User.name) private userModel: Model<UserDocument>,
        @InjectModel(Product.name) private productModel: Model<ProductDocument>,
        @InjectModel(Variant.name) private variantModel: Model<VariantDocument>,
    ) { }

    /**
     * Get current dashboard stats
     */
    async getStats(): Promise<DashboardStats> {
        const [
            monthlySales,
            pendingApproval,
            activeProducts,
            todaySales,
            newCustomers,
        ] = await Promise.all([
            this.getMonthlySales(),
            this.getPendingApproval(),
            this.getActiveProducts(),
            this.getTodaySales(),
            this.getNewCustomers(),
        ]);

        return {
            monthlySales,
            pendingApproval,
            activeProducts,
            todaySales,
            newCustomers,
            updatedAt: new Date().toISOString(),
        };
    }

    /**
     * SSE stream for real-time updates
     */
    getStatsStream(): Observable<MessageEvent> {
        return new Observable(subscriber => {
            // Send initial stats
            this.getStats().then(stats => {
                subscriber.next({ data: JSON.stringify(stats) } as MessageEvent);
            });

            // Subscribe to updates
            const subscription = this.statsSubject.subscribe(stats => {
                subscriber.next({ data: JSON.stringify(stats) } as MessageEvent);
            });

            return () => subscription.unsubscribe();
        });
    }

    /**
     * Notify all connected clients of stats update
     */
    async notifyStatsUpdate(): Promise<void> {
        try {
            const stats = await this.getStats();
            this.statsSubject.next(stats);
            this.logger.debug('Dashboard stats updated');
        } catch (error) {
            this.logger.error('Failed to notify stats update:', error);
        }
    }

    // --- Private calculation methods ---

    private async getMonthlySales(): Promise<DashboardStats['monthlySales']> {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

        // This month sales
        const thisMonthOrders = await this.orderModel.find({
            createdAt: { $gte: startOfMonth },
            status: { $in: ['pagada', 'en_produccion', 'enviada', 'completada'] },
        }).lean();

        const thisMonthTotal = thisMonthOrders.reduce((sum: number, order: any) => {
            return sum + (order.total || 0);
        }, 0);

        // Last month sales for comparison
        const lastMonthOrders = await this.orderModel.find({
            createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth },
            status: { $in: ['pagada', 'en_produccion', 'enviada', 'completada'] },
        }).lean();

        const lastMonthTotal = lastMonthOrders.reduce((sum: number, order: any) => {
            return sum + (order.total || 0);
        }, 0);

        // Trend: last 7 days
        const trend = await this.getLast7DaysSales();

        const percentChange = lastMonthTotal > 0
            ? Math.round(((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100)
            : thisMonthTotal > 0 ? 100 : 0;

        return {
            total: thisMonthTotal,
            trend,
            percentChange,
        };
    }

    private async getLast7DaysSales(): Promise<number[]> {
        const trend: number[] = [];
        const now = new Date();

        for (let i = 6; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            const startOfDay = new Date(date.setHours(0, 0, 0, 0));
            const endOfDay = new Date(date.setHours(23, 59, 59, 999));

            const orders = await this.orderModel.find({
                createdAt: { $gte: startOfDay, $lte: endOfDay },
                status: { $in: ['pagada', 'en_produccion', 'enviada', 'completada'] },
            }).lean();

            const total = orders.reduce((sum: number, order: any) => sum + (order.total || 0), 0);
            trend.push(total);
        }

        return trend;
    }

    private async getPendingApproval(): Promise<DashboardStats['pendingApproval']> {
        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

        // Orders with payment proof pending verification (matches PendingOrders component filter)
        const pendingOrders = await this.orderModel.find({
            'paymentProof.status': 'pending',
        }).lean();

        const count = pendingOrders.length;

        // Urgent: older than 3 days
        const urgent = pendingOrders.filter((order: any) => {
            const createdAt = new Date(order.createdAt);
            return createdAt < threeDaysAgo;
        }).length;

        return { count, urgent };
    }

    private async getActiveProducts(): Promise<number> {
        // Count products that have at least one variant with stock > 0
        const variants = await this.variantModel.find({ stock: { $gt: 0 } }).distinct('product');
        return variants.length;
    }

    private async getTodaySales(): Promise<DashboardStats['todaySales']> {
        const now = new Date();
        const startOfDay = new Date(now.setHours(0, 0, 0, 0));
        const endOfDay = new Date(now.setHours(23, 59, 59, 999));

        const orders = await this.orderModel.find({
            createdAt: { $gte: startOfDay, $lte: endOfDay },
            status: { $in: ['pagada', 'en_produccion', 'enviada', 'completada'] },
        }).lean();

        const total = orders.reduce((sum: number, order: any) => sum + (order.total || 0), 0);

        return {
            total,
            count: orders.length,
        };
    }

    private async getNewCustomers(): Promise<DashboardStats['newCustomers']> {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const [thisMonth, total] = await Promise.all([
            this.userModel.countDocuments({ createdAt: { $gte: startOfMonth }, role: 'user' }),
            this.userModel.countDocuments({ role: 'user' }),
        ]);

        return {
            thisMonth,
            total,
        };
    }
}
