import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { SseAuthGuard } from '../auth/sse-auth.guard';
import { Order, OrderSchema, User, UserSchema, Product, ProductSchema, Variant, VariantSchema } from '../database/schemas';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Order.name, schema: OrderSchema },
            { name: User.name, schema: UserSchema },
            { name: Product.name, schema: ProductSchema },
            { name: Variant.name, schema: VariantSchema },
        ]),
        JwtModule.registerAsync({
            imports: [ConfigModule],
            useFactory: async (configService: ConfigService) => ({
                secret: configService.get<string>('JWT_SECRET'),
            }),
            inject: [ConfigService],
        }),
        forwardRef(() => AuthModule),
    ],
    controllers: [DashboardController],
    providers: [DashboardService, SseAuthGuard],
    exports: [DashboardService],
})
export class DashboardModule { }
