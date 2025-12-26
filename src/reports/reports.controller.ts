
import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
    constructor(private readonly reportsService: ReportsService) { }

    @Get('sales')
    async getSales(@Query('start') start: string, @Query('end') end: string) {
        if (!start || !end) {
            throw new BadRequestException('Start and End dates are required');
        }
        return this.reportsService.getSalesReport(start, end);
    }
}
