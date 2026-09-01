import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { configuration } from '../config/configuration.js';
import { envSchema } from '../config/env.schema.js';
import { DatabaseModule } from '../database/database.module.js';
import { OrdersModule } from '../orders/orders.module.js';
import { TablesModule } from '../tables/tables.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema: envSchema,
    }),

    DatabaseModule,

    OrdersModule,
    TablesModule,
  ],
})
export class AppModule {}
