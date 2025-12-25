import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import {
  LoginDto,
  RegisterDto,
  ChangePasswordDto,
  AuthResponseDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  RefreshTokenDto,
} from './dtos';
import { UserResponseDto } from '../users/dtos';

interface AuthenticatedRequest extends Request {
  user: UserResponseDto;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() registerDto: RegisterDto): Promise<AuthResponseDto> {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto): Promise<AuthResponseDto> {
    return this.authService.login(loginDto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto): Promise<{ accessToken: string; refreshToken: string }> {
    return this.authService.refreshToken(refreshTokenDto.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@Request() req: AuthenticatedRequest): Promise<UserResponseDto> {
    return this.authService.getProfile(req.user._id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @Request() req: AuthenticatedRequest,
    @Body() changePasswordDto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    await this.authService.changePassword(req.user._id, changePasswordDto);
    return { message: 'Contraseña cambiada exitosamente' };
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto): Promise<{ message: string }> {
    await this.authService.forgotPassword(forgotPasswordDto);
    return { message: 'Si el email existe, se enviará un enlace de recuperación' };
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto): Promise<{ message: string }> {
    await this.authService.resetPassword(resetPasswordDto);
    return { message: 'Contraseña restablecida exitosamente' };
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(): { message: string } {
    // En una implementación real, podrías invalidar el token
    // Por ahora, solo retornamos un mensaje de éxito
    return { message: 'Sesión cerrada exitosamente' };
  }

  /**
   * Verify magic link token and auto-login user
   * GET /auth/magic-link?token=xxx
   */
  @Get('magic-link')
  @HttpCode(HttpStatus.OK)
  async verifyMagicLink(@Query('token') token: string): Promise<AuthResponseDto> {
    if (!token) {
      throw new BadRequestException('Token es requerido');
    }
    return this.authService.verifyMagicLink(token);
  }
}
