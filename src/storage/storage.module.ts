import { Module, Global } from '@nestjs/common';
import { MongoBase64StorageService } from './services/mongo-base64-storage.service';

@Global()
@Module({
    providers: [
        {
            provide: 'PAYMENT_STORAGE',
            useClass: MongoBase64StorageService
        }
    ],
    exports: ['PAYMENT_STORAGE']
})
export class StorageModule { }
