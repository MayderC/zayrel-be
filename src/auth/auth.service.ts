import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
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
  ) { }

  async register(registerDto: RegisterDto): Promise<AuthResponseDto> {
    try {
      // Crear el usuario usando el servicio de usuarios
      const user = await this.usersService.create(registerDto);

      // Enviar correo de bienvenida
      /* try {
        await this.mailService.sendUserWelcome({
          email: user.email,
          name: user.firstname,
        });
      } catch (error) {
        console.error('Error sending welcome email', error);
      } */

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
    if (!user) {
      return;
    }
    console.log(`Reset password token would be sent to ${forgotPasswordDto.email}`);
  }

  resetPassword(resetPasswordDto: ResetPasswordDto): Promise<void> {
    console.log(resetPasswordDto);
    throw new BadRequestException(
      'Funcionalidad de reset de contraseña no implementada completamente',
    );
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
}
