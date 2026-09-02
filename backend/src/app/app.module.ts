import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { configuration } from '../config/configuration.js';
import { envSchema } from '../config/env.schema.js';
import { DatabaseModule } from '../database/database.module.js';
import { IngredientsModule } from '../ingredients/ingredients.module.js';
import { OrderItemsModule } from '../order-items/order-items.module.js';
import { OrdersModule } from '../orders/orders.module.js';
import { ProductsModule } from '../products/products.module.js';
import { TablesModule } from '../tables/tables.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema: envSchema,
    }),

    DatabaseModule,

    IngredientsModule,
    OrderItemsModule,
    OrdersModule,
    ProductsModule,
    TablesModule,
  ],
})
export class AppModule {}
