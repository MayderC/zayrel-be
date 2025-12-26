
import { Module, forwardRef } from '@nestjs/common';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { OnvopayStrategy } from './strategies/onvopay.strategy';
import { PaypalStrategy } from './strategies/paypal.strategy';
import { OrdersModule } from '../orders/orders.module';

import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';

@Module({
    imports: [
        HttpModule,
        ConfigModule,
        forwardRef(() => OrdersModule)
    ],
    controllers: [PaymentController],
    providers: [
        PaymentService,
        OnvopayStrategy,
        PaypalStrategy
    ],
    exports: [PaymentService]
})
export class PaymentModule { }
