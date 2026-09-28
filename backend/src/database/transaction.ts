import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';

import type { PrismaService } from './prisma.service.js';

/**
 * How transactions work here.
 *
 * A service method marked `@Transactional()` runs in a transaction. Every
 * repository call made while it runs — directly or through other services —
 * joins that transaction automatically: repositories read the current client
 * from `TransactionHost<PrismaAdapter>.tx`, which is the transaction's client
 * inside one and the plain client outside. Nothing has to pass a client along.
 *
 * The transaction commits when the method returns and rolls back when it
 * throws. Map Prisma errors to HTTP errors outside the transactional method: a
 * failed statement aborts the transaction, so no further query can run inside
 * it.
 */
export type PrismaAdapter = TransactionalAdapterPrisma<PrismaService>;
