import { beforeEach, expect, it, vi } from 'vitest';
import { createPrismaMock } from './helpers/prismaMock';
const prisma = createPrismaMock();
vi.mock('../src/lib/prisma', () => ({ default: prisma }));
beforeEach(() => { vi.clearAllMocks(); });
it('retries serialization conflicts and returns the committed result', async () => {
  const { financialTransaction } = await import('../src/services/financialTransaction');
  const operation = vi.fn().mockRejectedValueOnce(Object.assign(new Error('conflict'), { code: 'P2034' })).mockResolvedValue('committed');
  expect(await financialTransaction(operation)).toBe('committed');
  expect(operation).toHaveBeenCalledTimes(2);
});
it('limits retries and propagates non-retryable errors', async () => {
  const { financialTransaction } = await import('../src/services/financialTransaction');
  const operation = vi.fn().mockRejectedValue(Object.assign(new Error('conflict'), { code: 'P2034' }));
  await expect(financialTransaction(operation)).rejects.toThrow('conflict');
  expect(operation).toHaveBeenCalledTimes(3);
  for (const error of ['failure', new Error('failure'), Object.assign(new Error('failure'), { code: 'P2003' })]) {
    await expect(financialTransaction(async () => { throw error; })).rejects.toBe(error);
  }
});
