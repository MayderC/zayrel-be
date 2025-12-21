import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MongooseModule } from '@nestjs/mongoose';
import { VirtualTryOnController } from './virtual-try-on.controller';
import { VirtualTryOnService } from './virtual-try-on.service';
import { User, UserSchema } from '../database/schemas';

@Module({
    imports: [
        HttpModule,
        MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    ],
    controllers: [VirtualTryOnController],
    providers: [VirtualTryOnService],
})
export class VirtualTryOnModule { }
