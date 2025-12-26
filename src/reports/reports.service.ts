
import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { OrdersService } from '../orders/orders.service';

@Injectable()
export class ReportsService {
    constructor(
        // Use OrdersService to get data. Ideally, we query the DB directly for analytics for performance, 
        // but re-using service is safer for consistency if logic is simple.
        private ordersService: OrdersService
    ) { }

    async getSalesReport(startDate: string, endDate: string) {
        // Fetch all orders - optimization logic would go here (e.g., dedicated DB query with date filter)
        // For now, we fetch all and filter in memory, assuming low volume, or we rely on OrdersService having a filter method.
        // Since OrdersService.findAll() returns everything, let's assume we can filter manually for MVP or add a method later.

        const allOrders = await this.ordersService.findAll();
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999); // End of day

        const filtered = allOrders.filter(order => {
            const d = new Date((order as any).createdAt);
            return d >= start && d <= end && (order as any).status === 'pagada';
        });

        const reportData = filtered.map(order => ({
            date: new Date((order as any).createdAt).toISOString().split('T')[0],
            orderNumber: (order as any)._id,
            total: (order as any).total,
            method: (order as any).paymentProof?.method || 'N/A', // Or from separate Payment entity
            status: (order as any).status
        }));

        return reportData;
    }
}
