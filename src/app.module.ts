import { Module } from '@nestjs/common';
import { UsersModule } from './users/users.module';
import { ProductsModule } from './products/products.module';
import { DesignsModule } from './designs/designs.module';
import { DatabaseModule } from './database/database.module';

@Module({
  imports: [UsersModule, ProductsModule, DesignsModule, DatabaseModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
