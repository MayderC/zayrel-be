import { Module, Global } from '@nestjs/common';
import { MongoBase64StorageService } from './services/mongo-base64-storage.service';
import { StorageController } from './storage.controller';

@Global()
@Module({
  controllers: [StorageController],
  providers: [
    {
      provide: 'PAYMENT_STORAGE',
      useClass: MongoBase64StorageService,
    },
  ],
  exports: ['PAYMENT_STORAGE'],
})
export class StorageModule {}
