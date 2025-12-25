import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  IsOptional,
  IsBoolean,
  IsEnum,
  ValidateNested,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';

// Address DTO for user addresses
export class AddressDto {
  @IsOptional()
  @IsString()
  label?: string; // e.g., "Casa", "Oficina"

  @IsString()
  @IsNotEmpty()
  street: string;

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsString()
  @IsNotEmpty()
  state: string;

  @IsOptional()
  @IsString()
  zipRegion?: string;

  @IsString()
  @IsNotEmpty()
  country: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  firstname: string;

  @IsString()
  @IsNotEmpty()
  lastname: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsOptional()
  @IsEnum(['user', 'admin'])
  role?: string;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  firstname?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  lastname?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @IsOptional()
  @IsBoolean()
  isEmailVerified?: boolean;

  @IsOptional()
  @IsBoolean()
  isBanned?: boolean;

  @IsOptional()
  @IsBoolean()
  isDeleted?: boolean;

  @IsOptional()
  @IsEnum(['user', 'admin'])
  role?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddressDto)
  addresses?: AddressDto[];
}

// Response type for addresses
export interface AddressResponseDto {
  label?: string;
  street: string;
  city: string;
  state: string;
  zipRegion?: string;
  country: string;
  phone: string;
  isDefault: boolean;
}

export class UserResponseDto {
  _id: string;
  firstname: string;
  lastname: string;
  email: string;
  role: string;
  isEmailVerified: boolean;
  isBanned: boolean;
  isDeleted: boolean;
  addresses?: AddressResponseDto[];
  createdAt: Date;
  updatedAt: Date;
}

