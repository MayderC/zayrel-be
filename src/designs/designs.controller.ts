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
import { CreateDesignDto, UpdateDesignDto } from './designs.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles.enum';

@Controller('designs')
export class DesignsController {
    constructor(private readonly designsService: DesignsService) { }

    @Post()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.Admin)
    @UseInterceptors(FileInterceptor('file'))
    async create(
        @UploadedFile() file: any,
        @Body() createDesignDto: CreateDesignDto,
        @Request() req: any,
    ) {
        if (!file) {
            throw new BadRequestException('Se requiere un archivo de imagen');
        }
        return await this.designsService.create(createDesignDto, file, req.user.userId);
    }

    @Get()
    async findAll(@Query('tag') tag?: string, @Query('search') search?: string) {
        return await this.designsService.findAll({ tag, search });
    }

    @Get('tags')
    async findAllTags() {
        return await this.designsService.findAllTags();
    }

    @Get(':id')
    async findOne(@Param('id') id: string) {
        return await this.designsService.findOne(id);
    }

    @Patch(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.Admin)
    async update(@Param('id') id: string, @Body() updateDesignDto: UpdateDesignDto) {
        return await this.designsService.update(id, updateDesignDto);
    }

    @Delete(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.Admin)
    async remove(@Param('id') id: string) {
        return await this.designsService.remove(id);
    }
}
