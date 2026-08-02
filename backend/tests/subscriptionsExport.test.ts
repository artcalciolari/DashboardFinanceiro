import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createPrismaMock } from './helpers/prismaMock';

const prisma = createPrismaMock();

vi.mock('../src/lib/prisma', () => ({ default: prisma }));
vi.mock('../src/services/subscriptionService', () => ({
  ensureSubscriptionTransactions: vi.fn().mockResolvedValue(undefined),
  getSubscriptionHorizon: vi.fn(() => new Date(2027, 7, 31, 23, 59, 59)),
  resetSubscriptionTransactionHorizon: vi.fn(),
}));

describe('subscriptions and export API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists creates updates and deletes subscriptions', async () => {
    const { createApp } = await import('../src/app');
    const app = createApp();

    prisma.subscription.findMany.mockResolvedValue([]);
    prisma.subscription.count.mockResolvedValue(0);
    prisma.subscription.aggregate.mockResolvedValue({ _sum: { amountCents: 0 } });
    expect((await request(app).get('/api/subscriptions?asOf=bad')).status).toBe(422);

    prisma.subscription.findMany.mockResolvedValue([
      { id: 's1', name: 'Netflix', isActive: true },
    ]);
    prisma.subscription.count.mockResolvedValueOnce(1).mockResolvedValueOnce(1);
    prisma.subscription.aggregate
      .mockResolvedValueOnce({ _sum: { amountCents: 100 } })
      .mockResolvedValueOnce({ _sum: { amountCents: 50 } });
    prisma.transaction.findMany.mockResolvedValue([
      { id: 't1', subscriptionId: 's1', effectiveDate: new Date(2030, 1, 1) },
    ]);
    prisma.transaction.groupBy.mockResolvedValue([
      { subscriptionId: 's1', _count: { _all: 2 } },
      { subscriptionId: null, _count: { _all: 1 } },
    ]);
    expect((await request(app).get('/api/subscriptions')).status).toBe(200);

    prisma.category.findUniqueOrThrow.mockResolvedValue({ id: 'c1', type: 'EXPENSE' });
    prisma.subscription.create.mockResolvedValue({ id: 's1' });
    expect(
      (
        await request(app)
          .post('/api/subscriptions')
          .send({
            name: 'Netflix',
            amountCents: 5000,
            startDate: '2026-01-01',
            endDate: '2026-12-01',
            accountId: 'a1',
            categoryId: 'c1',
            isThirdParty: true,
            thirdPartyName: ' Bob ',
          })
      ).status
    ).toBe(201);

    expect(
      (
        await request(app)
          .post('/api/subscriptions')
          .send({
            name: 'Bad',
            amountCents: 5000,
            startDate: '2026-12-01',
            endDate: '2026-01-01',
            accountId: 'a1',
            categoryId: 'c1',
          })
      ).status
    ).toBe(422);

    prisma.subscription.findUniqueOrThrow.mockResolvedValue({
      id: 's1',
      name: 'Netflix',
      amountCents: 5000,
      startDate: new Date('2026-01-01'),
      endDate: null,
      billingDay: 1,
      isActive: true,
      accountId: 'a1',
      categoryId: 'c1',
      isThirdParty: false,
      thirdPartyName: null,
      isReimbursed: false,
      notes: null,
    });
    prisma.$transaction.mockResolvedValue([{ id: 's1', name: 'Updated' }]);
    expect(
      (await request(app).patch('/api/subscriptions/s1').send({ name: 'Updated' })).status
    ).toBe(200);

    prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => Promise<unknown>) => {
      prisma.transaction.deleteMany.mockResolvedValue({ count: 1 });
      prisma.transaction.updateMany.mockResolvedValue({ count: 0 });
      prisma.subscription.delete.mockResolvedValue({});
      return fn(prisma);
    });
    expect((await request(app).delete('/api/subscriptions/s1?mode=all')).status).toBe(204);
    expect((await request(app).delete('/api/subscriptions/s1')).status).toBe(204);

    prisma.transaction.findMany.mockResolvedValue([]);
    prisma.transaction.count.mockResolvedValue(0);
    expect((await request(app).get('/api/subscriptions/s1/transactions')).status).toBe(200);
  });

  it('streams CSV export with formula-safe cells and pagination', async () => {
    const { createApp } = await import('../src/app');
    const app = createApp();

    const makeTx = (id: string) => ({
      id,
      date: new Date(2026, 7, 2),
      effectiveDate: new Date(2026, 7, 2),
      description: '=1+1',
      amountCents: 150,
      type: 'EXPENSE',
      installmentNumber: 1,
      totalInstallments: 2,
      isThirdParty: true,
      thirdPartyName: '+evil',
      isReimbursed: false,
      notes: '@note',
      account: { name: '-acc' },
      category: { name: 'Food' },
      subscription: { name: 'Netflix' },
    });

    const page = Array.from({ length: 500 }, (_, i) => makeTx(`p${i}`));
    prisma.transaction.findMany
      .mockResolvedValueOnce(page)
      .mockResolvedValueOnce([makeTx('last')])
      .mockResolvedValueOnce([]);

    const withPeriod = await request(app).get('/api/export/csv?month=8&year=2026');
    expect(withPeriod.status).toBe(200);
    expect(withPeriod.headers['content-type']).toMatch(/csv/);
    expect(withPeriod.text).toContain("'=1+1");

    prisma.transaction.findMany.mockResolvedValueOnce([]);
    const all = await request(app).get('/api/export/csv');
    expect(all.status).toBe(200);
    expect(all.headers['content-disposition']).toContain('financeiro_todos.csv');
  });
});
