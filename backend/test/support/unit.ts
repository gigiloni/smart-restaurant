import type { Provider } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ClsPluginTransactional, NoOpTransactionalAdapter } from '@nestjs-cls/transactional';
import { ClsModule } from 'nestjs-cls';

import { Prisma } from '../../src/generated/prisma/client.js';

/** A Prisma known-request error, as a repository would throw it. */
export function prismaError(code: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(`Simulated ${code}`, {
    code,
    clientVersion: 'test',
  });
}

/** A partial test double typed as the real thing. */
export function stub<T>(partial: object = {}): T {
  return partial as T;
}

/**
 * Builds `subject` with its collaborators replaced. Methods marked
 * `@Transactional()` need the transactional plugin registered; the no-op
 * adapter satisfies it without a database.
 */
export async function withTransactions<T>(
  subject: new (...args: never[]) => T,
  providers: Provider[],
): Promise<T> {
  const moduleRef = await Test.createTestingModule({
    imports: [
      ClsModule.forRoot({
        global: true,
        plugins: [
          new ClsPluginTransactional({
            adapter: new NoOpTransactionalAdapter({ tx: {}, disableWarning: true }),
          }),
        ],
      }),
    ],
    providers: [subject, ...providers],
  }).compile();

  return moduleRef.get(subject);
}
