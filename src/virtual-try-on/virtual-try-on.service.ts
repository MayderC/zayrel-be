import { HttpService } from '@nestjs/axios';
import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { AxiosResponse } from 'axios';
import FormData from 'form-data';

// Define a simple file interface to avoid Multer type issues
interface UploadedFile {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
}

@Injectable()
export class VirtualTryOnService {
    private readonly logger = new Logger(VirtualTryOnService.name);
    private readonly apiUrl = 'https://api.miragic.ai/api/v1/virtual-try-on';
    private readonly apiKey: string;

    constructor(
        private readonly httpService: HttpService,
        private readonly configService: ConfigService,
    ) {
        this.apiKey = this.configService.get<string>('MIRAGIC_API_KEY') || '';
        if (!this.apiKey) {
            this.logger.warn('MIRAGIC_API_KEY is not defined in environment variables');
        }
    }

    async createProcess(
        humanImage: UploadedFile,
        clothImage: UploadedFile,
        garmentType: 'upper_body' | 'lower_body' | 'full_body',
    ) {
        try {
            const formData = new FormData();
            formData.append('humanImage', humanImage.buffer, humanImage.originalname);
            formData.append('clothImage', clothImage.buffer, clothImage.originalname);
            formData.append('garmentType', garmentType);

            const response: AxiosResponse = await firstValueFrom(
                this.httpService.post(this.apiUrl, formData, {
                    headers: {
                        'X-API-Key': this.apiKey,
                        ...formData.getHeaders(),
                    },
                }),
            );

            return response.data;
        } catch (error: any) {
            this.logger.error('Error creating VTO process', error.response?.data || error.message);
            throw new HttpException(
                error.response?.data || 'Failed to create virtual try-on process',
                error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    async getStatus(jobId: string) {
        try {
            const url = `${this.apiUrl}/status/${jobId}`;
            const response: AxiosResponse = await firstValueFrom(
                this.httpService.get(url, {
                    headers: {
                        'X-API-Key': this.apiKey,
                    },
                }),
            );

            return response.data;
        } catch (error: any) {
            this.logger.error(`Error getting status for job ${jobId}`, error.response?.data || error.message);
            throw new HttpException(
                error.response?.data || 'Failed to get process status',
                error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }
}
