import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';

// DTO para login
export class LoginDto {
  @IsEmail({}, { message: 'El email debe tener un formato válido' })
  email: string;

  @IsString({ message: 'La contraseña debe ser una cadena de texto' })
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  password: string;
}

// DTO para registro
export class RegisterDto {
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  firstname: string;

  @IsString({ message: 'El apellido debe ser una cadena de texto' })
  lastname: string;

  @IsEmail({}, { message: 'El email debe tener un formato válido' })
  email: string;

  @IsString({ message: 'La contraseña debe ser una cadena de texto' })
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  password: string;

  @IsOptional()
  @IsString({ message: 'El rol debe ser una cadena de texto' })
  role?: string;
}

// DTO para cambio de contraseña
export class ChangePasswordDto {
  @IsString({ message: 'La contraseña actual debe ser una cadena de texto' })
  currentPassword: string;

  @IsString({ message: 'La nueva contraseña debe ser una cadena de texto' })
  @MinLength(6, { message: 'La nueva contraseña debe tener al menos 6 caracteres' })
  newPassword: string;
}

// DTO para reset de contraseña
export class ForgotPasswordDto {
  @IsEmail({}, { message: 'El email debe tener un formato válido' })
  email: string;
}

export class ResetPasswordDto {
  @IsString({ message: 'El token debe ser una cadena de texto' })
  token: string;

  @IsString({ message: 'La nueva contraseña debe ser una cadena de texto' })
  @MinLength(6, { message: 'La nueva contraseña debe tener al menos 6 caracteres' })
  newPassword: string;
}

// Response DTOs
export class AuthResponseDto {
  user: {
    _id: string;
    firstname: string;
    lastname: string;
    email: string;
    role: string;
    isEmailVerified: boolean;
  };
  accessToken: string;
  refreshToken?: string;
}

export class RefreshTokenDto {
  @IsString({ message: 'El refresh token debe ser una cadena de texto' })
  refreshToken: string;
}
