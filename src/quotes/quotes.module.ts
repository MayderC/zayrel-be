import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { QuotesController } from './quotes.controller';
import { QuotesService } from './quotes.service';
import { Quote, QuoteSchema, Variant, VariantSchema, Product, ProductSchema, User, UserSchema } from '../database/schemas';
import { MailModule } from '../mail/mail.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Quote.name, schema: QuoteSchema },
            { name: Variant.name, schema: VariantSchema },
            { name: Product.name, schema: ProductSchema },
            { name: User.name, schema: UserSchema },
        ]),
        MailModule,
        NotificationsModule,
    ],
    controllers: [QuotesController],
    providers: [QuotesService],
    exports: [QuotesService],
})
export class QuotesModule { }
