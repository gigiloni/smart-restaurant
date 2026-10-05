import { PrismaPg } from '@prisma/adapter-pg';

type Connection = Awaited<ReturnType<PrismaPg['connect']>>;
type Transaction = Awaited<ReturnType<Connection['startTransaction']>>;

/** Prisma's relation queries can run concurrently on a transaction's single pg client. */
export function serializeTransactionQueries(transaction: Transaction): Transaction {
  let pending: Promise<void> = Promise.resolve();
  const enqueue = <T>(query: () => Promise<T>): Promise<T> => {
    const result = pending.then(query);
    // Preserve rejection for the caller while allowing ROLLBACK after a failed query.
    pending = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };
  const queryRaw = transaction.queryRaw.bind(transaction);
  const executeRaw = transaction.executeRaw.bind(transaction);
  const commit = transaction.commit.bind(transaction);
  const rollback = transaction.rollback.bind(transaction);
  transaction.queryRaw = (query) => enqueue(() => queryRaw(query));
  transaction.executeRaw = (query) => enqueue(() => executeRaw(query));
  transaction.commit = () => enqueue(commit);
  transaction.rollback = () => enqueue(rollback);
  return transaction;
}

export class SerialPrismaPg extends PrismaPg {
  override async connect(): Promise<Connection> {
    const connection = await super.connect();
    const startTransaction = connection.startTransaction.bind(connection);
    connection.startTransaction = async (isolationLevel) =>
      serializeTransactionQueries(await startTransaction(isolationLevel));
    return connection;
  }
}
