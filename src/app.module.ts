import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { ProductsModule } from './products/products.module';
import { DesignsModule } from './designs/designs.module';
import { DatabaseModule } from './database/database.module';
import { MailModule } from './mail/mail.module';
import { OrdersModule } from './orders/orders.module';
import { VirtualTryOnModule } from './virtual-try-on/virtual-try-on.module';
import { ImagesModule } from './images/images.module';
import { CartModule } from './cart/cart.module';
import { CouponModule } from './coupon/coupon.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DatabaseModule,
    UsersModule,
    AuthModule,
    ProductsModule,
    DesignsModule,
    MailModule.forRoot(),
    OrdersModule,
    VirtualTryOnModule,
    ImagesModule,
    CartModule,
    CouponModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule { }

