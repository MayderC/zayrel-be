import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard that allows optional authentication.
 * If a valid JWT token is provided, it will populate req.user.
 * If no token is provided, the request proceeds without a user.
 * Use this for endpoints that need hybrid guest/authenticated access.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
    canActivate(context: ExecutionContext) {
        return super.canActivate(context);
    }

    handleRequest(err: any, user: any) {
        // Don't throw error if no user - just return null/undefined
        // This allows the request to proceed without authentication
        return user || null;
    }
}
