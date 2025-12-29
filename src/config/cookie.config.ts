/**
 * Cookie Configuration for HttpOnly Secure Cookies
 * 
 * This configuration is PREPARED but DISABLED by default for development.
 * To enable HttpOnly cookies, set USE_HTTP_ONLY_COOKIES=true in your .env file.
 * 
 * Usage in auth.service.ts (when enabled):
 * 
 * import { CookieConfig } from '../config/cookie.config';
 * 
 * // In login method:
 * if (CookieConfig.enabled) {
 *   response.cookie('accessToken', tokens.accessToken, CookieConfig.options);
 * }
 */

export const CookieConfig = {
    /**
     * Toggle to enable/disable HttpOnly cookies
     * Set USE_HTTP_ONLY_COOKIES=true in .env to enable
     */
    enabled: process.env.USE_HTTP_ONLY_COOKIES === 'true',

    /**
     * Cookie options for secure session management
     */
    options: {
        httpOnly: true,   // JavaScript cannot access the cookie (XSS protection)
        secure: process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production', // HTTPS required
        sameSite: (process.env.COOKIE_SAME_SITE || 'lax') as 'none' | 'lax' | 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/',
    },

    /**
     * Cookie name for access token
     */
    accessTokenName: 'accessToken',

    /**
     * Cookie name for refresh token
     */
    refreshTokenName: 'refreshToken',
};

/**
 * How to enable HttpOnly cookies:
 * 
 * 1. Add to your .env:
 *    USE_HTTP_ONLY_COOKIES=true
 * 
 * 2. Update auth.service.ts login method to set cookies:
 * 
 *    async login(loginDto: LoginDto, response?: Response) {
 *      // ... validation logic ...
 *      const tokens = this.generateTokens(user);
 *      
 *      if (CookieConfig.enabled && response) {
 *        response.cookie(CookieConfig.accessTokenName, tokens.accessToken, CookieConfig.options);
 *        response.cookie(CookieConfig.refreshTokenName, tokens.refreshToken, CookieConfig.options);
 *      }
 *      
 *      return { user, ...tokens };
 *    }
 * 
 * 3. Update auth.controller.ts to pass Response object:
 * 
 *    @Post('login')
 *    async login(@Body() loginDto: LoginDto, @Res({ passthrough: true }) response: Response) {
 *      return this.authService.login(loginDto, response);
 *    }
 * 
 * 4. Update jwt.strategy.ts to also extract token from cookie:
 * 
 *    jwtFromRequest: ExtractJwt.fromExtractors([
 *      ExtractJwt.fromAuthHeaderAsBearerToken(),
 *      (req) => req?.cookies?.[CookieConfig.accessTokenName] || null,
 *    ]),
 * 
 * 5. Update frontend to use credentials: 'include' in all fetch calls
 */
