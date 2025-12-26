import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

/**
 * Guard for SSE endpoints that need authentication
 * 
 * EventSource (SSE) doesn't support custom headers, so we need to
 * accept the JWT token as a query parameter instead.
 * 
 * Usage: GET /dashboard/events?token=<jwt_token>
 */
@Injectable()
export class SseAuthGuard implements CanActivate {
    constructor(
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const token = request.query?.token;

        if (!token) {
            throw new UnauthorizedException('Token required for SSE connection');
        }

        try {
            const secret = this.configService.get<string>('JWT_SECRET');
            const payload = await this.jwtService.verifyAsync(token, { secret });

            // Check if user is admin
            if (payload.role !== 'admin') {
                throw new UnauthorizedException('Admin access required');
            }

            // Attach user to request
            request.user = payload;
            return true;
        } catch (error) {
            throw new UnauthorizedException('Invalid or expired token');
        }
    }
}
