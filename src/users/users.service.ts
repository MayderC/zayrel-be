import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { User, UserDocument } from '../database/schemas';
import { CreateUserDto, UpdateUserDto, UserResponseDto } from './dtos';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) { }

  async create(createUserDto: CreateUserDto): Promise<UserResponseDto> {
    // Verificar si el email ya existe
    const existingUser = await this.userModel.findOne({ email: createUserDto.email });
    if (existingUser) {
      throw new ConflictException('El email ya está registrado');
    }

    // Hash de la contraseña
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(createUserDto.password, saltRounds);

    // Crear el usuario
    const user = new this.userModel({
      ...createUserDto,
      password: hashedPassword,
      role: createUserDto.role || 'user',
    });

    const savedUser = await user.save();
    return this.toUserResponseDto(savedUser);
  }

  async findAll(): Promise<UserResponseDto[]> {
    const users = await this.userModel
      .find({ isDeleted: false })
      .select('-password')
      .sort({ createdAt: -1 });

    return users.map((user) => this.toUserResponseDto(user));
  }

  async findOne(id: string): Promise<UserResponseDto> {
    const user = await this.userModel.findOne({ _id: id, isDeleted: false }).select('-password');

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return this.toUserResponseDto(user);
  }

  async findByEmail(email: string, includePassword = false): Promise<UserDocument | null> {
    const query = this.userModel.findOne({ email, isDeleted: false });
    if (includePassword) {
      query.select('+password');
    }
    return query;
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<UserResponseDto> {
    // Verificar si el usuario existe
    const existingUser = await this.userModel.findOne({ _id: id, isDeleted: false });
    if (!existingUser) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Verificar si el email ya está en uso por otro usuario
    if (updateUserDto.email) {
      const emailInUse = await this.userModel.findOne({
        email: updateUserDto.email,
        _id: { $ne: id },
        isDeleted: false,
      });
      if (emailInUse) {
        throw new ConflictException('El email ya está en uso por otro usuario');
      }
    }

    const updatedUser = await this.userModel
      .findByIdAndUpdate(id, updateUserDto, { new: true })
      .select('-password');

    if (!updatedUser) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return this.toUserResponseDto(updatedUser);
  }

  async softDelete(id: string): Promise<void> {
    const user = await this.userModel.findOne({ _id: id, isDeleted: false });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    await this.userModel.findByIdAndUpdate(id, { isDeleted: true });
  }

  async banUser(id: string): Promise<UserResponseDto> {
    const user = await this.userModel.findOne({ _id: id, isDeleted: false });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (user.isBanned) {
      throw new BadRequestException('El usuario ya está baneado');
    }

    const updatedUser = await this.userModel
      .findByIdAndUpdate(id, { isBanned: true }, { new: true })
      .select('-password');

    if (!updatedUser) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return this.toUserResponseDto(updatedUser);
  }

  async unbanUser(id: string): Promise<UserResponseDto> {
    const user = await this.userModel.findOne({ _id: id, isDeleted: false });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (!user.isBanned) {
      throw new BadRequestException('El usuario no está baneado');
    }

    const updatedUser = await this.userModel
      .findByIdAndUpdate(id, { isBanned: false }, { new: true })
      .select('-password');

    if (!updatedUser) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return this.toUserResponseDto(updatedUser);
  }

  async verifyEmail(id: string): Promise<UserResponseDto> {
    const user = await this.userModel.findOne({ _id: id, isDeleted: false });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (user.isEmailVerified) {
      throw new BadRequestException('El email ya está verificado');
    }

    const updatedUser = await this.userModel
      .findByIdAndUpdate(id, { isEmailVerified: true }, { new: true })
      .select('-password');

    if (!updatedUser) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return this.toUserResponseDto(updatedUser);
  }

  async getUserStats(): Promise<{
    total: number;
    verified: number;
    banned: number;
    admins: number;
  }> {
    const [total, verified, banned, admins] = await Promise.all([
      this.userModel.countDocuments({ isDeleted: false }),
      this.userModel.countDocuments({ isDeleted: false, isEmailVerified: true }),
      this.userModel.countDocuments({ isDeleted: false, isBanned: true }),
      this.userModel.countDocuments({ isDeleted: false, role: 'admin' }),
    ]);

    return {
      total,
      verified,
      banned,
      admins,
    };
  }

  // =====================
  // ADDRESS MANAGEMENT
  // =====================

  async getAddresses(userId: string): Promise<UserResponseDto['addresses']> {
    const user = await this.userModel.findOne({ _id: userId, isDeleted: false });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
    return user.addresses || [];
  }

  async addAddress(userId: string, address: {
    label?: string;
    street: string;
    city: string;
    state: string;
    zipRegion?: string;
    country: string;
    phone: string;
    isDefault?: boolean;
  }): Promise<UserResponseDto['addresses']> {
    const user = await this.userModel.findOne({ _id: userId, isDeleted: false });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // If this is the first address or marked as default, ensure it's the only default
    const addresses = user.addresses || [];
    if (address.isDefault || addresses.length === 0) {
      // Remove default from all other addresses
      addresses.forEach(addr => addr.isDefault = false);
      address.isDefault = true;
    }

    addresses.push({
      label: address.label || '',
      street: address.street,
      city: address.city,
      state: address.state,
      zipRegion: address.zipRegion || '',
      country: address.country,
      phone: address.phone,
      isDefault: address.isDefault || false,
    });

    await this.userModel.findByIdAndUpdate(userId, { addresses });
    return addresses;
  }

  async updateAddress(userId: string, addressIndex: number, addressData: {
    label?: string;
    street?: string;
    city?: string;
    state?: string;
    zipRegion?: string;
    country?: string;
    phone?: string;
    isDefault?: boolean;
  }): Promise<UserResponseDto['addresses']> {
    const user = await this.userModel.findOne({ _id: userId, isDeleted: false });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const addresses = user.addresses || [];
    if (addressIndex < 0 || addressIndex >= addresses.length) {
      throw new BadRequestException('Índice de dirección inválido');
    }

    // Update the address fields
    const currentAddress = addresses[addressIndex];
    if (addressData.label !== undefined) currentAddress.label = addressData.label;
    if (addressData.street !== undefined) currentAddress.street = addressData.street;
    if (addressData.city !== undefined) currentAddress.city = addressData.city;
    if (addressData.state !== undefined) currentAddress.state = addressData.state;
    if (addressData.zipRegion !== undefined) currentAddress.zipRegion = addressData.zipRegion;
    if (addressData.country !== undefined) currentAddress.country = addressData.country;
    if (addressData.phone !== undefined) currentAddress.phone = addressData.phone;

    // Handle default flag
    if (addressData.isDefault) {
      addresses.forEach((addr, i) => {
        addr.isDefault = (i === addressIndex);
      });
    }

    await this.userModel.findByIdAndUpdate(userId, { addresses });
    return addresses;
  }

  async deleteAddress(userId: string, addressIndex: number): Promise<UserResponseDto['addresses']> {
    const user = await this.userModel.findOne({ _id: userId, isDeleted: false });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const addresses = user.addresses || [];
    if (addressIndex < 0 || addressIndex >= addresses.length) {
      throw new BadRequestException('Índice de dirección inválido');
    }

    const wasDefault = addresses[addressIndex].isDefault;
    addresses.splice(addressIndex, 1);

    // If deleted address was default and there are remaining addresses, make first one default
    if (wasDefault && addresses.length > 0) {
      addresses[0].isDefault = true;
    }

    await this.userModel.findByIdAndUpdate(userId, { addresses });
    return addresses;
  }

  async setDefaultAddress(userId: string, addressIndex: number): Promise<UserResponseDto['addresses']> {
    const user = await this.userModel.findOne({ _id: userId, isDeleted: false });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const addresses = user.addresses || [];
    if (addressIndex < 0 || addressIndex >= addresses.length) {
      throw new BadRequestException('Índice de dirección inválido');
    }

    // Set all to false, then set the selected one to true
    addresses.forEach((addr, i) => {
      addr.isDefault = (i === addressIndex);
    });

    await this.userModel.findByIdAndUpdate(userId, { addresses });
    return addresses;
  }

  private toUserResponseDto(user: UserDocument): UserResponseDto {
    return {
      _id: (user._id as Types.ObjectId).toString(),
      firstname: user.firstname,
      lastname: user.lastname,
      email: user.email,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
      isBanned: user.isBanned,
      isDeleted: user.isDeleted,
      addresses: user.addresses?.map(addr => ({
        label: addr.label,
        street: addr.street,
        city: addr.city,
        state: addr.state,
        zipRegion: addr.zipRegion,
        country: addr.country,
        phone: addr.phone,
        isDefault: addr.isDefault,
      })),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
