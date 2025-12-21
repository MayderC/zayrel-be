import {
    Controller,
    Post,
    Get,
    Param,
    UseInterceptors,
    UploadedFiles,
    Body,
    BadRequestException,
    UseGuards,
    Req,
    ForbiddenException,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { VirtualTryOnService } from './virtual-try-on.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../database/schemas';

interface UploadedFile {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
}

@Controller('virtual-try-on')
export class VirtualTryOnController {
    constructor(
        private readonly virtualTryOnService: VirtualTryOnService,
        @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    ) { }

    /**
     * GET /virtual-try-on/tokens
     * Returns the current user's VTO token count
     */
    @Get('tokens')
    @UseGuards(JwtAuthGuard)
    async getTokens(@Req() req: any) {
        const userId = req.user?.userId || req.user?.sub;
        const user = await this.userModel.findById(userId).select('vtoTokens');

        if (!user) {
            throw new BadRequestException('User not found');
        }

        return { tokens: user.vtoTokens ?? 4 };
    }

    /**
     * POST /virtual-try-on/start
     * Starts a VTO process (requires auth and tokens)
     */
    @Post('start')
    @UseGuards(JwtAuthGuard)
    @UseInterceptors(
        FileFieldsInterceptor([
            { name: 'humanImage', maxCount: 1 },
            { name: 'clothImage', maxCount: 1 },
        ]),
    )
    async startProcess(
        @Req() req: any,
        @UploadedFiles()
        files: {
            humanImage?: UploadedFile[];
            clothImage?: UploadedFile[];
        },
        @Body('garmentType') garmentType: 'upper_body' | 'lower_body' | 'full_body',
    ) {
        const userId = req.user?.userId || req.user?.sub;

        // Check tokens
        const user = await this.userModel.findById(userId);
        if (!user) {
            throw new BadRequestException('User not found');
        }

        if ((user.vtoTokens ?? 0) <= 0) {
            throw new ForbiddenException('No tienes tokens disponibles. Realiza una compra para obtener más.');
        }

        // Validate files
        if (!files.humanImage?.[0] || !files.clothImage?.[0]) {
            throw new BadRequestException('Both humanImage and clothImage are required');
        }

        // Decrement token BEFORE calling API (optimistic)
        await this.userModel.findByIdAndUpdate(userId, { $inc: { vtoTokens: -1 } });

        try {
            const result = await this.virtualTryOnService.createProcess(
                files.humanImage[0],
                files.clothImage[0],
                garmentType || 'upper_body',
            );

            return {
                ...result,
                tokensRemaining: (user.vtoTokens ?? 1) - 1,
            };
        } catch (error) {
            // If API fails, refund the token
            await this.userModel.findByIdAndUpdate(userId, { $inc: { vtoTokens: 1 } });
            throw error;
        }
    }

    @Get('status/:jobId')
    @UseGuards(JwtAuthGuard)
    async getStatus(@Param('jobId') jobId: string) {
        return this.virtualTryOnService.getStatus(jobId);
    }
}
