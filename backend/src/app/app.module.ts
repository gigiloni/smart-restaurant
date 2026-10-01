import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClsPluginTransactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { ClsModule } from 'nestjs-cls';

import { configuration } from '../config/configuration.js';
import { envSchema } from '../config/env.schema.js';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { PrismaService } from '../database/prisma.service.js';
import { EmployeesModule } from '../employees/employees.module.js';
import { IngredientsModule } from '../ingredients/ingredients.module.js';
import { LiveModule } from '../live/live.module.js';
import { OrderEventsModule } from '../order-events/order-events.module.js';
import { OrderItemsModule } from '../order-items/order-items.module.js';
import { OrdersModule } from '../orders/orders.module.js';
import { ProductsModule } from '../products/products.module.js';
import { TableSessionsModule } from '../table-sessions/table-sessions.module.js';
import { TablesModule } from '../tables/tables.module.js';
import { ViewerModule } from '../viewer/viewer.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema: envSchema,
    }),

    DatabaseModule,
    // `@Transactional()` and `TransactionHost`; see database/transaction.ts.
    ClsModule.forRoot({
      global: true,
      plugins: [
        new ClsPluginTransactional({
          imports: [DatabaseModule],
          adapter: new TransactionalAdapterPrisma({ prismaInjectionToken: PrismaService }),
        }),
      ],
    }),
    OrderEventsModule,
    AuthModule,

    EmployeesModule,
    IngredientsModule,
    LiveModule,
    OrderItemsModule,
    OrdersModule,
    ProductsModule,
    TableSessionsModule,
    TablesModule,
    ViewerModule,
  ],
})
export class AppModule {}
