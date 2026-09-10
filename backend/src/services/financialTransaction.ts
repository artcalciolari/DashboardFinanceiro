import type { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';

// Serialize financial recalculations across API processes, and retry a stale
// PostgreSQL serializable snapshot without returning a partially applied edit.
export async function financialTransaction<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(739214)::text`;
        return operation(tx);
      }, { isolationLevel: 'Serializable', timeout: 30_000 });
    } catch (error) {
      if (attempt >= 2 || !(error instanceof Error) || !('code' in error) || error.code !== 'P2034') throw error;
    }
  }
}
