import { Injectable } from '@nestjs/common';
import { IPaymentStorageService } from '../interfaces/payment-storage.interface';

@Injectable()
export class MongoBase64StorageService implements IPaymentStorageService {
    async store(fileBase64: string, orderId?: string): Promise<string> {
        // In the database-stored approach, the URL IS the base64 string itself.
        // This keeps the current behavior where the 'url' field contains the data URI.
        // We can add validation here if needed.
        return fileBase64;
    }
}
