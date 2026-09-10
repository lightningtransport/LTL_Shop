import { Prisma } from '@prisma/client';

type TransactionWithRawQuery = {
  $queryRaw?: <T = unknown>(query: Prisma.Sql) => Promise<T>;
};

/**
 * Serialize mutations that can change the operational state of one truck.
 * The lock lives for the current PostgreSQL transaction, so every caller
 * must invoke this before reading the state it is about to mutate.
 *
 * The optional guard keeps lightweight unit-test transaction doubles usable;
 * the real Prisma transaction client always exposes $queryRaw.
 */
export async function lockTruckMutation(tx: TransactionWithRawQuery, truckId: string) {
  if (typeof tx.$queryRaw !== 'function') return;
  await tx.$queryRaw(
    Prisma.sql`SELECT 1 AS "locked" FROM pg_advisory_xact_lock(hashtextextended(${`ltl:truck:${truckId}`}, 0))`,
  );
}
