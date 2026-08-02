import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createPrismaMock } from './helpers/prismaMock';

const prisma = createPrismaMock();

vi.mock('../src/lib/prisma', () => ({ default: prisma }));
vi.mock('../src/services/subscriptionService', () => ({
  ensureSubscriptionTransactions: vi.fn().mockResolvedValue(undefined),
  getSubscriptionHorizon: vi.fn(() => new Date(2026, 7, 31, 23, 59, 59)),
  resetSubscriptionTransactionHorizon: vi.fn(),
}));

describe('subscriptions API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists subscriptions with next occurrence summary and empty page', async () => {
    const { createApp } = await import('../src/app');
    const app = createApp();

    prisma.subscription.findMany.mockResolvedValue([]);
    prisma.subscription.count.mockResolvedValue(0);
    prisma.subscription.aggregate.mockResolvedValue({ _sum: { amountCents: null } });
    const empty = await request(app).get('/api/subscriptions');
    expect(empty.status).toBe(200);
    expect(empty.body.items).toEqual([]);
    expect(empty.body.summary.monthlyTotalCents).toBe(0);

    prisma.subscription.findMany.mockResolvedValue([
      { id: 's1', name: 'Netflix', isActive: true },
      { id: 's2', name: 'Gym', isActive: true },
    ]);
    prisma.subscription.count.mockResolvedValueOnce(2).mockResolvedValueOnce(2);
    prisma.subscription.aggregate
      .mockResolvedValueOnce({ _sum: { amountCents: 5000 } })
      .mockResolvedValueOnce({ _sum: { amountCents: 1000 } });
    prisma.transaction.findMany.mockResolvedValue([
      { id: 't1', subscriptionId: 's1', effectiveDate: new Date(2026, 8, 1) },
      { id: 't2', subscriptionId: 's1', effectiveDate: new Date(2026, 9, 1) },
      { id: 't3', subscriptionId: null, effectiveDate: new Date(2026, 8, 1) },
    ]);
    prisma.transaction.groupBy.mockResolvedValue([
      { subscriptionId: 's1', _count: { _all: 3 } },
      { subscriptionId: null, _count: { _all: 1 } },
    ]);

    const listed = await request(app).get('/api/subscriptions?asOf=2026-08-01&page=1&pageSize=10');
    expect(listed.status).toBe(200);
    expect(listed.body.items[0].nextTransaction.id).toBe('t1');
    expect(listed.body.items[0].occurrenceCount).toBe(3);
    expect(listed.body.items[1].occurrenceCount).toBe(0);

    expect((await request(app).get('/api/subscriptions?asOf=not-a-date')).status).toBe(422);

    const { getSubscriptionHorizon } = await import('../src/services/subscriptionService');
    (getSubscriptionHorizon as ReturnType<typeof vi.fn>).mockReturnValueOnce(new Date(2020, 0, 1));
    prisma.subscription.findMany.mockResolvedValue([]);
    prisma.subscription.count.mockResolvedValue(0);
    prisma.subscription.aggregate.mockResolvedValue({ _sum: { amountCents: 0 } });
    expect(
      (await request(app).get('/api/subscriptions?asOf=2099-01-01T00:00:00.000Z')).status
    ).toBe(200);
  });

  it('creates, updates and deletes subscriptions', async () => {
    const { createApp } = await import('../src/app');
    const { resetSubscriptionTransactionHorizon, ensureSubscriptionTransactions } = await import(
      '../src/services/subscriptionService'
    );
    const app = createApp();

    prisma.category.findUniqueOrThrow.mockResolvedValue({ id: 'c1', type: 'EXPENSE' });
    prisma.subscription.create.mockResolvedValue({ id: 's1', name: 'Netflix' });
    const created = await request(app)
      .post('/api/subscriptions')
      .send({
        name: 'Netflix',
        amountCents: 5000,
        startDate: '2026-01-05',
        accountId: 'a1',
        categoryId: 'c1',
        isThirdParty: true,
        thirdPartyName: ' Eve ',
        isReimbursed: true,
      });
    expect(created.status).toBe(201);
    expect(resetSubscriptionTransactionHorizon).toHaveBeenCalled();
    expect(ensureSubscriptionTransactions).toHaveBeenCalled();

    expect(
      (
        await request(app)
          .post('/api/subscriptions')
          .send({
            name: 'Bad',
            amountCents: 100,
            startDate: '2026-02-01',
            endDate: '2026-01-01',
            accountId: 'a1',
            categoryId: 'c1',
          })
      ).status
    ).toBe(422);

    prisma.category.findUniqueOrThrow.mockResolvedValue({ id: 'c2', type: 'INCOME' });
    expect(
      (
        await request(app)
          .post('/api/subscriptions')
          .send({
            name: 'BadCat',
            amountCents: 100,
            startDate: '2026-01-05',
            accountId: 'a1',
            categoryId: 'c2',
          })
      ).status
    ).toBe(422);

    prisma.category.findUniqueOrThrow.mockResolvedValue({ id: 'c1', type: 'EXPENSE' });
    prisma.subscription.findUniqueOrThrow.mockResolvedValue({
      id: 's1',
      name: 'Netflix',
      amountCents: 5000,
      startDate: new Date('2026-01-05'),
      endDate: null,
      billingDay: 5,
      isActive: true,
      accountId: 'a1',
      categoryId: 'c1',
      isThirdParty: false,
      thirdPartyName: null,
      isReimbursed: false,
      notes: null,
    });
    prisma.subscription.update.mockResolvedValue({ id: 's1', name: 'Netflix Plus' });
    prisma.transaction.deleteMany.mockResolvedValue({ count: 1 });
    expect(
      (await request(app).patch('/api/subscriptions/s1').send({ name: 'Netflix Plus' })).status
    ).toBe(200);

    prisma.subscription.findUniqueOrThrow.mockResolvedValue({
      id: 's1',
      name: 'Netflix',
      amountCents: 5000,
      startDate: new Date('2026-01-05T12:00:00'),
      endDate: new Date('2026-12-01T12:00:00'),
      billingDay: 5,
      isActive: true,
      accountId: 'a1',
      categoryId: 'c1',
      isThirdParty: false,
      thirdPartyName: null,
      isReimbursed: false,
      notes: 'keep',
    });
    prisma.$transaction.mockResolvedValue([{ id: 's1', endDate: new Date('2026-12-01') }]);
    expect(
      (await request(app).put('/api/subscriptions/s1').send({ isActive: false })).status
    ).toBe(200);

    prisma.transaction.deleteMany.mockResolvedValue({ count: 1 });
    prisma.transaction.updateMany.mockResolvedValue({ count: 1 });
    prisma.subscription.delete.mockResolvedValue({});
    expect((await request(app).delete('/api/subscriptions/s1?mode=all')).status).toBe(204);
    expect((await request(app).delete('/api/subscriptions/s1')).status).toBe(204);

    prisma.transaction.findMany.mockResolvedValue([]);
    prisma.transaction.count.mockResolvedValue(0);
    expect((await request(app).get('/api/subscriptions/s1/transactions')).status).toBe(200);

    prisma.category.findUniqueOrThrow.mockResolvedValue({ id: 'c1', type: 'EXPENSE' });
    prisma.subscription.create.mockResolvedValue({ id: 's2' });
    expect(
      (
        await request(app)
          .post('/api/subscriptions')
          .send({
            name: 'Defaults',
            amountCents: 100,
            startDate: '2026-01-15T12:00:00.000',
            accountId: 'a1',
            categoryId: 'c1',
            isThirdParty: true,
            thirdPartyName: '   ',
          })
      ).status
    ).toBe(201);
    expect(prisma.subscription.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          billingDay: 15,
          isActive: true,
          notes: null,
          thirdPartyName: null,
          isReimbursed: false,
        }),
      })
    );

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    prisma.subscription.findUniqueOrThrow.mockRejectedValue(new Error('db'));
    expect((await request(app).put('/api/subscriptions/s1').send({ name: 'X' })).status).toBe(500);
    prisma.$transaction.mockRejectedValue(new Error('db'));
    expect((await request(app).delete('/api/subscriptions/s1')).status).toBe(500);
    prisma.transaction.findMany.mockRejectedValue(new Error('db'));
    expect((await request(app).get('/api/subscriptions/s1/transactions')).status).toBe(500);
    consoleSpy.mockRestore();
  });

  it('propagates list errors', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { createApp } = await import('../src/app');
    prisma.subscription.findMany.mockRejectedValue(new Error('db'));
    expect((await request(createApp()).get('/api/subscriptions')).status).toBe(500);
    consoleSpy.mockRestore();
  });
});
