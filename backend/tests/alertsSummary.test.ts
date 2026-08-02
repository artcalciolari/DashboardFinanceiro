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

describe('alerts and summary API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('covers alert CRUD and check thresholds', async () => {
    const { createApp } = await import('../src/app');
    const app = createApp();

    prisma.alert.findMany.mockResolvedValue([{ id: 'al1' }]);
    expect((await request(app).get('/api/alerts')).status).toBe(200);

    prisma.category.findUniqueOrThrow.mockResolvedValue({ id: 'c1', type: 'EXPENSE' });
    prisma.alert.create.mockResolvedValue({ id: 'al1', name: 'Food' });
    expect(
      (
        await request(app)
          .post('/api/alerts')
          .send({ name: 'Food', categoryId: 'c1', limitAmountCents: 10000, period: 'MONTHLY' })
      ).status
    ).toBe(201);

    prisma.category.findUniqueOrThrow.mockResolvedValue({ id: 'c2', type: 'INCOME' });
    expect(
      (
        await request(app)
          .post('/api/alerts')
          .send({ name: 'Bad', categoryId: 'c2', limitAmountCents: 10000, period: 'WEEKLY' })
      ).status
    ).toBe(422);

    prisma.category.findUniqueOrThrow.mockResolvedValue({ id: 'c1', type: 'EXPENSE' });
    prisma.alert.update.mockResolvedValue({ id: 'al1' });
    expect(
      (await request(app).patch('/api/alerts/al1').send({ categoryId: 'c1', name: 'Food2' })).status
    ).toBe(200);

    prisma.alert.delete.mockResolvedValue({});
    expect((await request(app).delete('/api/alerts/al1')).status).toBe(204);

    prisma.alert.update.mockResolvedValue({ id: 'al1' });
    expect((await request(app).put('/api/alerts/al1').send({ name: 'OnlyName' })).status).toBe(200);

    prisma.alert.findMany.mockResolvedValue([
      {
        id: 'a1',
        categoryId: 'c1',
        limitAmountCents: 10000,
        period: 'MONTHLY',
        category: { id: 'c1' },
      },
      {
        id: 'a2',
        categoryId: 'c2',
        limitAmountCents: 10000,
        period: 'WEEKLY',
        category: { id: 'c2' },
      },
      {
        id: 'a3',
        categoryId: 'missing',
        limitAmountCents: 10000,
        period: 'MONTHLY',
        category: { id: 'missing' },
      },
    ]);
    prisma.transaction.groupBy
      .mockResolvedValueOnce([
        { categoryId: 'c1', _sum: { amountCents: 9000 } },
        { categoryId: 'c3', _sum: { amountCents: null } },
      ])
      .mockResolvedValueOnce([
        { categoryId: 'c2', _sum: { amountCents: 10000 } },
        { categoryId: 'c4', _sum: { amountCents: null } },
      ]);
    const check = await request(app).get('/api/alerts/check');
    expect(check.status).toBe(200);
    expect(check.body[0].isWarning).toBe(true);
    expect(check.body[1].isTriggered).toBe(true);
    expect(check.body[2].currentAmountCents).toBe(0);
    expect(check.body[2].isWarning).toBe(false);

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    prisma.alert.findMany.mockRejectedValue(new Error('db'));
    expect((await request(app).get('/api/alerts')).status).toBe(500);

    prisma.alert.findMany.mockResolvedValue([]);
    prisma.category.findUniqueOrThrow.mockResolvedValue({ id: 'c2', type: 'INCOME' });
    expect(
      (await request(app).patch('/api/alerts/al1').send({ categoryId: 'c2' })).status
    ).toBe(422);

    prisma.alert.update.mockRejectedValue(new Error('db'));
    expect((await request(app).patch('/api/alerts/al1').send({ name: 'x' })).status).toBe(500);
    prisma.alert.delete.mockRejectedValue(new Error('db'));
    expect((await request(app).delete('/api/alerts/al1')).status).toBe(500);

    prisma.alert.findMany.mockResolvedValue([
      {
        id: 'warn80',
        categoryId: 'c1',
        limitAmountCents: 10000,
        period: 'MONTHLY',
        category: { id: 'c1' },
      },
    ]);
    prisma.transaction.groupBy
      .mockResolvedValueOnce([{ categoryId: 'c1', _sum: { amountCents: 8000 } }])
      .mockResolvedValueOnce([]);
    const edge = await request(app).get('/api/alerts/check');
    expect(edge.body[0].isWarning).toBe(true);

    prisma.alert.findMany.mockRejectedValue(new Error('db'));
    expect((await request(app).get('/api/alerts/check')).status).toBe(500);
    consoleSpy.mockRestore();
  });

  it('covers summary endpoints', async () => {
    const { createApp } = await import('../src/app');
    const app = createApp();

    prisma.transaction.findMany.mockResolvedValue([
      { type: 'INCOME', amountCents: 10000, isThirdParty: false, isReimbursed: false },
      { type: 'EXPENSE', amountCents: 3000, isThirdParty: false, isReimbursed: false },
      { type: 'EXPENSE', amountCents: 2000, isThirdParty: true, isReimbursed: false },
      { type: 'EXPENSE', amountCents: 1000, isThirdParty: true, isReimbursed: true },
    ]);
    const monthly = await request(app).get('/api/summary/monthly?month=8&year=2026');
    expect(monthly.status).toBe(200);
    expect(monthly.body.totalIncomeCents).toBe(10000);

    const monthlyDefault = await request(app).get('/api/summary/monthly');
    expect(monthlyDefault.status).toBe(200);

    prisma.transaction.groupBy.mockResolvedValue([
      { categoryId: 'c1', type: 'EXPENSE', _sum: { amountCents: 500 } },
      { categoryId: 'c2', type: 'INCOME', _sum: { amountCents: null } },
    ]);
    prisma.category.findMany.mockResolvedValue([{ id: 'c1', name: 'Food' }]);
    expect((await request(app).get('/api/summary/categories?month=8&year=2026')).status).toBe(200);

    prisma.transaction.findMany.mockResolvedValue([
      {
        effectiveDate: new Date(2026, 7, 2),
        type: 'INCOME',
        amountCents: 100,
        isThirdParty: false,
        isReimbursed: false,
      },
      {
        effectiveDate: new Date(2099, 0, 2),
        type: 'EXPENSE',
        amountCents: 50,
        isThirdParty: true,
        isReimbursed: false,
      },
    ]);
    expect((await request(app).get('/api/summary/evolution')).status).toBe(200);

    prisma.account.findMany.mockResolvedValue([{ id: 'a1', name: 'Bank' }]);
    prisma.transaction.findMany.mockResolvedValue([
      {
        accountId: 'a1',
        type: 'EXPENSE',
        amountCents: 50,
        isThirdParty: false,
        isReimbursed: false,
      },
      {
        accountId: 'missing',
        type: 'INCOME',
        amountCents: 10,
        isThirdParty: false,
        isReimbursed: false,
      },
    ]);
    expect((await request(app).get('/api/summary/accounts?month=8&year=2026')).status).toBe(200);

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    prisma.transaction.findMany.mockRejectedValue(new Error('db'));
    expect((await request(app).get('/api/summary/monthly')).status).toBe(500);
    consoleSpy.mockRestore();
  });
});
