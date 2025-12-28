
import { Controller, Get, Query, BadRequestException, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles.enum';

@Controller('reports')
export class ReportsController {
    constructor(private readonly reportsService: ReportsService) { }

    // Admin only - sales reports contain sensitive business data
    @Get('sales')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.Admin)
    async getSales(@Query('start') start: string, @Query('end') end: string) {
        if (!start || !end) {
            throw new BadRequestException('Start and End dates are required');
        }
        return this.reportsService.getSalesReport(start, end);
    }
}

