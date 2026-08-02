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
vi.mock('../src/services/accountCycleService', () => ({
  recalculateAccountEffectiveDates: vi.fn().mockResolvedValue(undefined),
}));

describe('controller catch paths and remaining branches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('forwards prisma failures through next/errorHandler for CRUD controllers', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { createApp } = await import('../src/app');
    const app = createApp();
    const boom = new Error('db boom');

    prisma.account.findMany.mockRejectedValue(boom);
    expect((await request(app).get('/api/accounts')).status).toBe(500);

    prisma.account.create.mockRejectedValue(boom);
    expect((await request(app).post('/api/accounts').send({ name: 'A', type: 'CASH' })).status).toBe(
      500
    );

    prisma.account.findUniqueOrThrow.mockRejectedValue(boom);
    expect((await request(app).patch('/api/accounts/a1').send({ name: 'B' })).status).toBe(500);

    prisma.account.delete.mockRejectedValue(boom);
    expect((await request(app).delete('/api/accounts/a1')).status).toBe(500);

    prisma.category.findMany.mockRejectedValue(boom);
    expect((await request(app).get('/api/categories')).status).toBe(500);
    prisma.category.create.mockRejectedValue(boom);
    expect(
      (await request(app).post('/api/categories').send({ name: 'C', type: 'EXPENSE' })).status
    ).toBe(500);
    prisma.category.update.mockRejectedValue(boom);
    expect((await request(app).patch('/api/categories/c1').send({ name: 'D' })).status).toBe(500);
    prisma.category.delete.mockRejectedValue(boom);
    expect((await request(app).delete('/api/categories/c1')).status).toBe(500);

    prisma.alert.findMany.mockRejectedValue(boom);
    expect((await request(app).get('/api/alerts')).status).toBe(500);
    prisma.category.findUniqueOrThrow.mockRejectedValue(boom);
    expect(
      (
        await request(app)
          .post('/api/alerts')
          .send({ name: 'A', categoryId: 'c1', limitAmountCents: 100, period: 'MONTHLY' })
      ).status
    ).toBe(500);
    prisma.alert.update.mockRejectedValue(boom);
    expect((await request(app).patch('/api/alerts/a1').send({ name: 'B' })).status).toBe(500);
    prisma.alert.delete.mockRejectedValue(boom);
    expect((await request(app).delete('/api/alerts/a1')).status).toBe(500);
    prisma.alert.findMany.mockRejectedValue(boom);
    expect((await request(app).get('/api/alerts/check')).status).toBe(500);

    prisma.transaction.findMany.mockRejectedValue(boom);
    expect((await request(app).get('/api/summary/monthly')).status).toBe(500);
    expect((await request(app).get('/api/summary/evolution')).status).toBe(500);
    prisma.transaction.groupBy.mockRejectedValue(boom);
    expect((await request(app).get('/api/summary/categories')).status).toBe(500);
    prisma.account.findMany.mockRejectedValue(boom);
    expect((await request(app).get('/api/summary/accounts')).status).toBe(500);

    prisma.transaction.findMany.mockRejectedValue(boom);
    expect((await request(app).get('/api/transactions')).status).toBe(500);
    prisma.account.findUniqueOrThrow.mockRejectedValue(boom);
    expect(
      (
        await request(app)
          .post('/api/transactions')
          .send({
            description: 'x',
            amountCents: 100,
            type: 'EXPENSE',
            date: '2026-08-01',
            accountId: 'a1',
            categoryId: 'c1',
          })
      ).status
    ).toBe(500);
    prisma.transaction.findUniqueOrThrow.mockRejectedValue(boom);
    expect((await request(app).patch('/api/transactions/t1').send({ description: 'y' })).status).toBe(
      500
    );
    expect((await request(app).delete('/api/transactions/t1')).status).toBe(500);

    prisma.installmentGroup.findMany.mockRejectedValue(boom);
    expect((await request(app).get('/api/installments')).status).toBe(500);
    prisma.account.findUniqueOrThrow.mockRejectedValue(boom);
    expect(
      (
        await request(app)
          .post('/api/installments')
          .send({
            description: 'x',
            totalAmountCents: 1000,
            installmentCount: 2,
            startDate: '2026-08-01',
            accountId: 'a1',
            categoryId: 'c1',
          })
      ).status
    ).toBe(500);
    prisma.$transaction.mockRejectedValue(boom);
    expect((await request(app).delete('/api/installments/g1')).status).toBe(500);
    prisma.installmentGroup.findUniqueOrThrow.mockRejectedValue(boom);
    expect(
      (
        await request(app)
          .patch('/api/installments/g1/payment-date')
          .send({ firstPaymentDate: '2026-09-01' })
      ).status
    ).toBe(500);
    prisma.transaction.findMany.mockRejectedValue(boom);
    expect((await request(app).get('/api/installments/g1/transactions')).status).toBe(500);

    prisma.subscription.findMany.mockRejectedValue(boom);
    expect((await request(app).get('/api/subscriptions')).status).toBe(500);
    prisma.category.findUniqueOrThrow.mockRejectedValue(boom);
    expect(
      (
        await request(app)
          .post('/api/subscriptions')
          .send({
            name: 'S',
            amountCents: 100,
            startDate: '2026-01-01',
            accountId: 'a1',
            categoryId: 'c1',
          })
      ).status
    ).toBe(500);
    prisma.subscription.findUniqueOrThrow.mockRejectedValue(boom);
    expect((await request(app).patch('/api/subscriptions/s1').send({ name: 'T' })).status).toBe(500);
    prisma.$transaction.mockRejectedValue(boom);
    expect((await request(app).delete('/api/subscriptions/s1')).status).toBe(500);
    prisma.transaction.findMany.mockRejectedValue(boom);
    expect((await request(app).get('/api/subscriptions/s1/transactions')).status).toBe(500);
    consoleSpy.mockRestore();
  });

  it('covers account update without cycle change and empty installment amount fallbacks', async () => {
    const { createApp } = await import('../src/app');
    const { recalculateAccountEffectiveDates } = await import('../src/services/accountCycleService');
    const app = createApp();

    prisma.account.findUniqueOrThrow.mockResolvedValue({
      id: 'a1',
      type: 'BANK_ACCOUNT',
      closingDay: null,
      dueDay: null,
    });
    prisma.account.update.mockResolvedValue({
      id: 'a1',
      type: 'BANK_ACCOUNT',
      closingDay: null,
      dueDay: null,
      name: 'Renamed',
    });
    expect((await request(app).patch('/api/accounts/a1').send({ name: 'Renamed' })).status).toBe(200);
    expect(recalculateAccountEffectiveDates).not.toHaveBeenCalled();

    prisma.installmentGroup.findMany.mockResolvedValue([
      {
        id: 'g1',
        transactions: [],
      },
    ]);
    prisma.installmentGroup.count.mockResolvedValue(1);
    const listed = await request(app).get('/api/installments');
    expect(listed.body.items[0].installmentAmountCents).toBe(0);
    expect(listed.body.items[0].firstTransaction).toBeNull();
  });

  it('covers transaction update paths for account change and categoryId-only', async () => {
    const { createApp } = await import('../src/app');
    const app = createApp();

    prisma.transaction.findUniqueOrThrow
      .mockResolvedValueOnce({ installmentGroupId: null, subscriptionId: null })
      .mockResolvedValueOnce({
        id: 't1',
        date: new Date('2026-08-02'),
        type: 'EXPENSE',
        isThirdParty: false,
        thirdPartyName: null,
        isReimbursed: false,
        account: { id: 'a1', type: 'BANK_ACCOUNT', closingDay: null, dueDay: null },
        category: { id: 'c1', type: 'EXPENSE' },
      });
    prisma.account.findUniqueOrThrow.mockResolvedValue({
      id: 'a2',
      type: 'CREDIT_CARD',
      closingDay: 10,
      dueDay: 20,
    });
    prisma.transaction.update.mockResolvedValue({ id: 't1' });
    expect((await request(app).patch('/api/transactions/t1').send({ accountId: 'a2' })).status).toBe(
      200
    );

    prisma.transaction.findUniqueOrThrow
      .mockResolvedValueOnce({ installmentGroupId: null, subscriptionId: null })
      .mockResolvedValueOnce({
        id: 't1',
        date: new Date('2026-08-02'),
        type: 'EXPENSE',
        isThirdParty: false,
        thirdPartyName: null,
        isReimbursed: false,
        account: { id: 'a1', type: 'BANK_ACCOUNT', closingDay: null, dueDay: null },
        category: { id: 'c1', type: 'EXPENSE' },
      });
    prisma.category.findUniqueOrThrow.mockResolvedValue({ id: 'c2', type: 'EXPENSE' });
    expect(
      (await request(app).patch('/api/transactions/t1').send({ categoryId: 'c2' })).status
    ).toBe(200);

    prisma.transaction.findUniqueOrThrow
      .mockResolvedValueOnce({ installmentGroupId: null, subscriptionId: null })
      .mockResolvedValueOnce({
        id: 't1',
        date: new Date('2026-08-02'),
        type: 'INCOME',
        isThirdParty: false,
        thirdPartyName: null,
        isReimbursed: false,
        account: { id: 'a1', type: 'BANK_ACCOUNT', closingDay: null, dueDay: null },
        category: { id: 'c1', type: 'INCOME' },
      });
    prisma.transaction.update.mockResolvedValue({ id: 't1' });
    expect(
      (await request(app).patch('/api/transactions/t1').send({ description: 'only desc' })).status
    ).toBe(200);
  });

  it('covers alert check with zero spend and update without category change', async () => {
    const { createApp } = await import('../src/app');
    const app = createApp();

    prisma.alert.update.mockResolvedValue({ id: 'a1' });
    expect((await request(app).patch('/api/alerts/a1').send({ name: 'Only name' })).status).toBe(200);

    prisma.alert.findMany.mockResolvedValue([
      {
        id: 'a1',
        categoryId: 'missing',
        limitAmountCents: 10000,
        period: 'MONTHLY',
        category: { id: 'missing' },
      },
    ]);
    prisma.transaction.groupBy.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    const check = await request(app).get('/api/alerts/check');
    expect(check.body[0].currentAmountCents).toBe(0);
    expect(check.body[0].isTriggered).toBe(false);
    expect(check.body[0].isWarning).toBe(false);
  });

  it('covers subscription list with empty page and asOf beyond horizon', async () => {
    const { createApp } = await import('../src/app');
    const app = createApp();

    prisma.subscription.findMany.mockResolvedValue([]);
    prisma.subscription.count.mockResolvedValue(0);
    prisma.subscription.aggregate.mockResolvedValue({ _sum: { amountCents: null } });
    const far = new Date(2035, 0, 1).toISOString();
    expect((await request(app).get(`/api/subscriptions?asOf=${far}`)).status).toBe(200);
  });
});
