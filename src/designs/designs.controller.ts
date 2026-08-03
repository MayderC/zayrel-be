import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  Query,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DesignsService } from './designs.service';
import { CreateDesignDto, UpdateDesignDto, UpdateRelatedDesignsDto } from './designs.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles.enum';

interface AuthenticatedRequest extends Request {
  user: { userId: string; role: string };
}

@Controller('designs')
export class DesignsController {
  constructor(private readonly designsService: DesignsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @UseInterceptors(FileInterceptor('file'))
  async create(
    @UploadedFile() file: any,
    @Body() createDesignDto: CreateDesignDto,
    @Request() req: AuthenticatedRequest,
  ) {
    if (!file) {
      throw new BadRequestException('Se requiere un archivo de imagen');
    }
    return await this.designsService.create(createDesignDto, file, req.user.userId);
  }

  @Get()
  async findAll(
    @Query('tag') tag?: string,
    @Query('search') search?: string,
    @Query('category') category?: string,
  ) {
    return await this.designsService.findAll({ tag, search, category });
  }

  @Get('tags')
  async findAllTags() {
    return await this.designsService.findAllTags();
  }

  @Get('categories')
  async findAllCategories() {
    return await this.designsService.findAllCategories();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return await this.designsService.findOne(id);
  }

  @Get(':id/related')
  async findRelated(@Param('id') id: string, @Query('depth') depth?: string) {
    const depthNum = depth ? parseInt(depth, 10) || 1 : 1;
    return await this.designsService.findRelated(id, depthNum);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  async update(@Param('id') id: string, @Body() updateDesignDto: UpdateDesignDto) {
    return await this.designsService.update(id, updateDesignDto);
  }

  @Patch(':id/related')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  async updateRelated(@Param('id') id: string, @Body() dto: UpdateRelatedDesignsDto) {
    return await this.designsService.updateRelated(id, dto.relatedDesignIds);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  async remove(@Param('id') id: string) {
    return await this.designsService.remove(id);
  }
}
