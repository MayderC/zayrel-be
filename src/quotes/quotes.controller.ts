import { Controller, Post, Get, Patch, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { QuotesService } from './quotes.service';
import { CreateQuoteDto, PriceQuoteDto, RejectQuoteDto } from './quotes.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles.enum';

@Controller('quotes')
export class QuotesController {
    constructor(private readonly quotesService: QuotesService) { }

    @Post()
    @UseGuards(OptionalJwtAuthGuard)
    create(@Body() dto: CreateQuoteDto, @Request() req: any) {
        return this.quotesService.create(dto, req.user);
    }

    @Get()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.Admin)
    findAll(
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('search') search?: string,
        @Query('status') status?: string,
    ) {
        return this.quotesService.findAll({
            page: page ? parseInt(page, 10) : 1,
            limit: limit ? parseInt(limit, 10) : 10,
            search,
            status,
        });
    }

    @Get('mine')
    @UseGuards(JwtAuthGuard)
    findMyQuotes(@Request() req: any) {
        return this.quotesService.findMyQuotes(req.user._id);
    }

    @Get(':id')
    @UseGuards(JwtAuthGuard)
    findOne(@Param('id') id: string) {
        return this.quotesService.findOne(id);
    }

    @Patch(':id/price')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.Admin)
    setPrice(@Param('id') id: string, @Body() dto: PriceQuoteDto) {
        return this.quotesService.setPrice(id, dto);
    }

    @Patch(':id/accept')
    @UseGuards(JwtAuthGuard)
    acceptQuote(@Param('id') id: string, @Request() req: any) {
        return this.quotesService.acceptQuote(id, req.user._id);
    }

    @Patch(':id/reject')
    @UseGuards(JwtAuthGuard)
    rejectQuote(@Param('id') id: string, @Body() dto: RejectQuoteDto, @Request() req: any) {
        return this.quotesService.rejectQuote(id, req.user._id, dto);
    }

    @Patch(':id/convert')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.Admin)
    markConverted(@Param('id') id: string, @Body('orderId') orderId: string) {
        return this.quotesService.markConverted(id, orderId);
    }
}
