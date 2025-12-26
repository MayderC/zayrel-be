
import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { OrdersModule } from '../orders/orders.module'; // Needed to fetch order data

@Module({
    imports: [OrdersModule],
    controllers: [ReportsController],
    providers: [ReportsService],
})
export class ReportsModule { }
