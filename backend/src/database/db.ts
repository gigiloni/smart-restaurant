import type { Prisma } from '../generated/prisma/client.js';

/**
 * Either the Prisma client or an interactive transaction. Repository methods
 * take one so a service can run several of them inside a single transaction.
 */
export type Db = Prisma.TransactionClient;
