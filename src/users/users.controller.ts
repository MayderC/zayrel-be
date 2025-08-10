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
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto, UserResponseDto } from './dtos';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

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

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<{
    message: string;
    user: UserResponseDto;
  }> {
    const user = await this.usersService.findOne(id);
    return {
      message: 'Usuario obtenido exitosamente',
      user,
    };
  }

  @Patch(':id')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<{
    message: string;
    user: UserResponseDto;
  }> {
    const user = await this.usersService.update(id, updateUserDto);
    return {
      message: 'Usuario actualizado exitosamente',
      user,
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    await this.usersService.softDelete(id);
  }

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
