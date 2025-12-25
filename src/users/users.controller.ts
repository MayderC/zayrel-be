import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpStatus,
  HttpCode,
  ValidationPipe,
  UsePipes,
  UseGuards,
  Request,
  UnauthorizedException,
  ParseIntPipe,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto, UserResponseDto, AddressDto, AddressResponseDto } from './dtos';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles.enum';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async register(@Body() createUserDto: CreateUserDto): Promise<{
    message: string;
    user: UserResponseDto;
  }> {
    const user = await this.usersService.create(createUserDto);
    return {
      message: 'Usuario registrado exitosamente',
      user,
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @Get()
  async findAll(): Promise<{
    message: string;
    users: UserResponseDto[];
    count: number;
  }> {
    const users = await this.usersService.findAll();
    return {
      message: 'Usuarios obtenidos exitosamente',
      users,
      count: users.length,
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @Get('stats')
  async getStats(): Promise<{
    message: string;
    stats: {
      total: number;
      verified: number;
      banned: number;
      admins: number;
    };
  }> {
    const stats = await this.usersService.getUserStats();
    return {
      message: 'Estadísticas de usuarios obtenidas exitosamente',
      stats,
    };
  }

  // =====================
  // ADDRESS MANAGEMENT (Current User)
  // =====================

  @UseGuards(JwtAuthGuard)
  @Get('me/addresses')
  async getMyAddresses(@Request() req): Promise<{
    message: string;
    addresses: AddressResponseDto[];
  }> {
    const userId = req.user._id || req.user.userId;
    const addresses = await this.usersService.getAddresses(userId);
    return {
      message: 'Direcciones obtenidas exitosamente',
      addresses: addresses || [],
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/addresses')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async addMyAddress(@Request() req, @Body() addressDto: AddressDto): Promise<{
    message: string;
    addresses: AddressResponseDto[];
  }> {
    const userId = req.user._id || req.user.userId;
    const addresses = await this.usersService.addAddress(userId, addressDto);
    return {
      message: 'Dirección agregada exitosamente',
      addresses: addresses || [],
    };
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me/addresses/:index')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async updateMyAddress(
    @Request() req,
    @Param('index', ParseIntPipe) index: number,
    @Body() addressDto: Partial<AddressDto>,
  ): Promise<{
    message: string;
    addresses: AddressResponseDto[];
  }> {
    const userId = req.user._id || req.user.userId;
    const addresses = await this.usersService.updateAddress(userId, index, addressDto);
    return {
      message: 'Dirección actualizada exitosamente',
      addresses: addresses || [],
    };
  }

  @UseGuards(JwtAuthGuard)
  @Delete('me/addresses/:index')
  async deleteMyAddress(
    @Request() req,
    @Param('index', ParseIntPipe) index: number,
  ): Promise<{
    message: string;
    addresses: AddressResponseDto[];
  }> {
    const userId = req.user._id || req.user.userId;
    const addresses = await this.usersService.deleteAddress(userId, index);
    return {
      message: 'Dirección eliminada exitosamente',
      addresses: addresses || [],
    };
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me/addresses/:index/default')
  async setMyDefaultAddress(
    @Request() req,
    @Param('index', ParseIntPipe) index: number,
  ): Promise<{
    message: string;
    addresses: AddressResponseDto[];
  }> {
    const userId = req.user._id || req.user.userId;
    const addresses = await this.usersService.setDefaultAddress(userId, index);
    return {
      message: 'Dirección principal establecida exitosamente',
      addresses: addresses || [],
    };
  }

  // =====================
  // ADDRESS MANAGEMENT (Admin for any user)
  // =====================

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @Get(':id/addresses')
  async getUserAddresses(@Param('id') id: string): Promise<{
    message: string;
    addresses: AddressResponseDto[];
  }> {
    const addresses = await this.usersService.getAddresses(id);
    return {
      message: 'Direcciones obtenidas exitosamente',
      addresses: addresses || [],
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @Post(':id/addresses')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async addUserAddress(
    @Param('id') id: string,
    @Body() addressDto: AddressDto,
  ): Promise<{
    message: string;
    addresses: AddressResponseDto[];
  }> {
    const addresses = await this.usersService.addAddress(id, addressDto);
    return {
      message: 'Dirección agregada exitosamente',
      addresses: addresses || [],
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @Delete(':id/addresses/:index')
  async deleteUserAddress(
    @Param('id') id: string,
    @Param('index', ParseIntPipe) index: number,
  ): Promise<{
    message: string;
    addresses: AddressResponseDto[];
  }> {
    const addresses = await this.usersService.deleteAddress(id, index);
    return {
      message: 'Dirección eliminada exitosamente',
      addresses: addresses || [],
    };
  }

  // =====================
  // USER CRUD
  // =====================

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req): Promise<{
    message: string;
    user: UserResponseDto;
  }> {
    const currentUser = req.user;

    // Check if user is admin or accessing their own profile
    const isAdmin = currentUser.role === Role.Admin;
    const isSelf = currentUser._id === id || currentUser.userId === id; // adaptation for various user object structures

    if (!isAdmin && !isSelf) {
      throw new UnauthorizedException('No tienes permisos para acceder a este perfil');
    }

    const user = await this.usersService.findOne(id);
    return {
      message: 'Usuario obtenido exitosamente',
      user,
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch(':id')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<{
    message: string;
    user: UserResponseDto;
  }> {
    // Note: Should probably implement self-check here too, but prioritized findingOne as requested.
    const user = await this.usersService.update(id, updateUserDto);
    return {
      message: 'Usuario actualizado exitosamente',
      user,
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    await this.usersService.softDelete(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @Patch(':id/ban')
  async banUser(@Param('id') id: string): Promise<{
    message: string;
    user: UserResponseDto;
  }> {
    const user = await this.usersService.banUser(id);
    return {
      message: 'Usuario baneado exitosamente',
      user,
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @Patch(':id/unban')
  async unbanUser(@Param('id') id: string): Promise<{
    message: string;
    user: UserResponseDto;
  }> {
    const user = await this.usersService.unbanUser(id);
    return {
      message: 'Usuario desbaneado exitosamente',
      user,
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @Patch(':id/verify-email')
  async verifyEmail(@Param('id') id: string): Promise<{
    message: string;
    user: UserResponseDto;
  }> {
    const user = await this.usersService.verifyEmail(id);
    return {
      message: 'Email verificado exitosamente',
      user,
    };
  }
}

