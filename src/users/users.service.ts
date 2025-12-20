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
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
