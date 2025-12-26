import { Controller, Get, Sse, UseGuards, Query } from '@nestjs/common';
import { Observable } from 'rxjs';
import { DashboardService, DashboardStats } from './dashboard.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles.enum';
import { SseAuthGuard } from '../auth/sse-auth.guard';

@Controller('dashboard')
export class DashboardController {
    constructor(private readonly dashboardService: DashboardService) { }

    /**
     * Get current dashboard stats (uses standard JWT auth)
     */
    @Get('stats')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.Admin)
    async getStats(): Promise<DashboardStats> {
        return this.dashboardService.getStats();
    }

    /**
     * SSE endpoint for real-time stats updates
     * Uses query param auth since EventSource doesn't support headers
     * 
     * Usage: GET /dashboard/events?token=<jwt_token>
     */
    @Sse('events')
    @UseGuards(SseAuthGuard)
    streamEvents(): Observable<MessageEvent> {
        return this.dashboardService.getStatsStream();
    }
}
