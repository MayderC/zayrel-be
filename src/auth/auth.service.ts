import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { PasswordResetToken, PasswordResetTokenDocument, MagicLinkToken, MagicLinkTokenDocument } from '../database/schemas';
import {
  LoginDto,
  RegisterDto,
  ChangePasswordDto,
  AuthResponseDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dtos';
import { UserResponseDto } from '../users/dtos';

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private mailService: MailService,
    @InjectModel(PasswordResetToken.name)
    private passwordResetTokenModel: Model<PasswordResetTokenDocument>,
    @InjectModel(MagicLinkToken.name)
    private magicLinkTokenModel: Model<MagicLinkTokenDocument>,
  ) { }

  async register(registerDto: RegisterDto): Promise<AuthResponseDto> {
    try {
      // Crear el usuario usando el servicio de usuarios
      const user = await this.usersService.create(registerDto);

      // Create magic link for one-click login and send welcome email (non-blocking)
      this.createMagicLinkToken(user._id)
        .then(magicToken => {
          const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
          const magicLinkUrl = `${frontendUrl}/auth/magic-link?token=${magicToken}`;

          return this.mailService.sendUserWelcome({
            email: user.email,
            name: user.firstname,
          }, magicLinkUrl);
        })
        .then(() => {
          console.log('[REGISTER] Welcome email sent with magic link to:', user.email);
        })
        .catch(error => {
          console.error('[REGISTER] Error sending welcome email:', error.message);
          // Try fallback provider is already handled in mailService
        });

      // Generar tokens
      const tokens = await this.generateTokens(user);

      return {
        user: {
          _id: user._id,
          firstname: user.firstname,
          lastname: user.lastname,
          email: user.email,
          role: user.role,
          isEmailVerified: user.isEmailVerified,
        },
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      };
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      throw new BadRequestException('Error al registrar usuario');
    }
  }


  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.validateUser(loginDto.email, loginDto.password);

    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (user.isBanned) {
      throw new UnauthorizedException('Tu cuenta ha sido suspendida');
    }

    const tokens = await this.generateTokens(user);

    return {
      user: {
        _id: user._id,
        firstname: user.firstname,
        lastname: user.lastname,
        email: user.email,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async validateUser(email: string, password: string): Promise<UserResponseDto | null> {
    const user = await this.usersService.findByEmail(email, true);

    if (user && (await bcrypt.compare(password, user.password))) {
      return {
        _id: String(user.id),
        firstname: user.firstname,
        lastname: user.lastname,
        email: user.email,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        isBanned: user.isBanned,
        isDeleted: user.isDeleted,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };
    }

    return null;
  }

  async changePassword(userId: string, changePasswordDto: ChangePasswordDto): Promise<void> {
    const user = await this.usersService.findByEmail(
      (await this.usersService.findOne(userId)).email,
    );

    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    const isCurrentPasswordValid = await bcrypt.compare(
      changePasswordDto.currentPassword,
      user.password,
    );

    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('Contraseña actual incorrecta');
    }

    const saltRounds = 10;
    const hashedNewPassword = await bcrypt.hash(changePasswordDto.newPassword, saltRounds);

    await this.usersService.update(userId, { password: hashedNewPassword });
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto): Promise<void> {
    const user = await this.usersService.findByEmail(forgotPasswordDto.email);

    // Always return silently to not reveal if email exists
    if (!user) {
      return;
    }

    // Delete any existing tokens for this user
    await this.passwordResetTokenModel.deleteMany({ userId: user._id });

    // Generate a random token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    // Save token to database with 1 hour expiration
    await this.passwordResetTokenModel.create({
      userId: user._id,
      token: hashedToken,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
    });

    // Build reset URL
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const resetUrl = `${frontendUrl}/reset-password?token=${rawToken}`;

    // Log the reset URL (for development - replace with actual email in production)
    console.log('='.repeat(60));
    console.log('[PASSWORD RESET] Token generated for:', user.email);
    console.log('[PASSWORD RESET] Reset URL:', resetUrl);
    console.log('[PASSWORD RESET] Token expires at:', new Date(Date.now() + 60 * 60 * 1000).toISOString());
    console.log('='.repeat(60));

    // TODO: Send actual email when SMTP is configured
    // await this.mailService.sendPasswordReset({
    //   email: user.email,
    //   name: user.firstname,
    //   resetUrl,
    // });
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto): Promise<void> {
    // Hash the incoming token to compare with database
    const hashedToken = crypto.createHash('sha256')
      .update(resetPasswordDto.token)
      .digest('hex');

    // Find valid token
    const tokenDoc = await this.passwordResetTokenModel.findOne({
      token: hashedToken,
      expiresAt: { $gt: new Date() },
      isUsed: false,
    });

    if (!tokenDoc) {
      throw new BadRequestException('El enlace de restablecimiento es inválido o ha expirado');
    }

    // Hash new password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(resetPasswordDto.newPassword, saltRounds);

    // Update user password
    await this.usersService.update(tokenDoc.userId.toString(), {
      password: hashedPassword,
    });

    // Mark token as used
    await this.passwordResetTokenModel.findByIdAndUpdate(tokenDoc._id, {
      isUsed: true,
    });

    console.log('[PASSWORD RESET] Password successfully reset for userId:', tokenDoc.userId.toString());
  }

  async refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      const user = await this.usersService.findOne(payload.sub);

      if (!user || user.isBanned) {
        throw new UnauthorizedException('Token inválido');
      }

      const tokens = await this.generateTokens(user);

      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      };
    } catch {
      throw new UnauthorizedException('Token de refresh inválido');
    }
  }

  async getProfile(userId: string): Promise<UserResponseDto> {
    return this.usersService.findOne(userId);
  }

  private async generateTokens(user: UserResponseDto): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    const payload = {
      sub: user._id,
      email: user.email,
      role: user.role,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: this.configService.get<string>('JWT_EXPIRATION', '15m'),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRATION', '7d'),
      }),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }

  /**
   * Create a magic link token for one-click login from welcome email
   */
  async createMagicLinkToken(userId: string): Promise<string> {
    // Delete any existing tokens for this user
    await this.magicLinkTokenModel.deleteMany({ userId });

    // Generate a random token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    // Token expires in 24 hours
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Save to database
    await this.magicLinkTokenModel.create({
      userId,
      token: hashedToken,
      expiresAt,
    });

    return rawToken;
  }

  /**
   * Verify magic link token and return auth response for auto-login
   */
  async verifyMagicLink(token: string): Promise<AuthResponseDto> {
    // Hash the incoming token
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Find valid, unused token
    const tokenDoc = await this.magicLinkTokenModel.findOne({
      token: hashedToken,
      expiresAt: { $gt: new Date() },
      isUsed: false,
    });

    if (!tokenDoc) {
      throw new BadRequestException('El enlace es inválido o ha expirado');
    }

    // Get user
    const user = await this.usersService.findOne(tokenDoc.userId.toString());

    if (!user) {
      throw new BadRequestException('Usuario no encontrado');
    }

    if (user.isBanned) {
      throw new UnauthorizedException('Tu cuenta ha sido suspendida');
    }

    // Mark token as used (one-time use)
    await this.magicLinkTokenModel.findByIdAndUpdate(tokenDoc._id, {
      isUsed: true,
    });

    // Mark email as verified if not already
    if (!user.isEmailVerified) {
      await this.usersService.update(user._id, { isEmailVerified: true });
      user.isEmailVerified = true;
    }

    // Generate tokens for the user
    const tokens = await this.generateTokens(user);

    console.log('[MAGIC LINK] User logged in via magic link:', user.email);

    return {
      user: {
        _id: user._id,
        firstname: user.firstname,
        lastname: user.lastname,
        email: user.email,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }
}
