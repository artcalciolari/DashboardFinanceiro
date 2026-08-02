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

describe('categories and accounts API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists, creates, updates and deletes categories', async () => {
    const { createApp } = await import('../src/app');
    const app = createApp();

    prisma.category.findMany.mockResolvedValue([{ id: 'c1', name: 'Food', type: 'EXPENSE' }]);
    expect((await request(app).get('/api/categories')).body).toEqual([
      { id: 'c1', name: 'Food', type: 'EXPENSE' },
    ]);

    prisma.category.create.mockResolvedValue({ id: 'c2', name: 'Salary', type: 'INCOME', color: '#10B981' });
    const created = await request(app)
      .post('/api/categories')
      .send({ name: 'Salary', type: 'INCOME' });
    expect(created.status).toBe(201);

    prisma.category.update.mockResolvedValue({ id: 'c2', name: 'Pay', type: 'INCOME' });
    expect((await request(app).patch('/api/categories/c2').send({ name: 'Pay' })).status).toBe(200);

    prisma.category.delete.mockResolvedValue({});
    expect((await request(app).delete('/api/categories/c2')).status).toBe(204);
  });

  it('lists, creates, updates and deletes accounts including cycle recalc', async () => {
    const { createApp } = await import('../src/app');
    const { recalculateAccountEffectiveDates } = await import('../src/services/accountCycleService');
    const app = createApp();

    prisma.account.findMany.mockResolvedValue([]);
    expect((await request(app).get('/api/accounts')).status).toBe(200);

    prisma.account.create.mockResolvedValue({ id: 'a1', type: 'CREDIT_CARD', openingBalanceCents: 0 });
    const created = await request(app)
      .post('/api/accounts')
      .send({ name: 'Card', type: 'CREDIT_CARD', closingDay: 10, dueDay: 20, openingBalanceCents: 500 });
    expect(created.status).toBe(201);
    expect(prisma.account.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ openingBalanceCents: 0 }),
      })
    );

    prisma.account.findUniqueOrThrow.mockResolvedValue({
      id: 'a1',
      type: 'CREDIT_CARD',
      closingDay: 10,
      dueDay: 20,
    });
    prisma.account.update.mockResolvedValue({
      id: 'a1',
      type: 'CREDIT_CARD',
      closingDay: 12,
      dueDay: 20,
    });
    const updated = await request(app).patch('/api/accounts/a1').send({ closingDay: 12 });
    expect(updated.status).toBe(200);
    expect(recalculateAccountEffectiveDates).toHaveBeenCalled();

    prisma.account.create.mockResolvedValue({ id: 'a2', type: 'BANK_ACCOUNT' });
    await request(app).post('/api/accounts').send({ name: 'Bank', type: 'BANK_ACCOUNT', closingDay: 1 });
    expect(prisma.account.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ creditLimitCents: null, closingDay: null, dueDay: null }),
      })
    );

    prisma.account.findUniqueOrThrow.mockResolvedValue({
      id: 'a1',
      type: 'CREDIT_CARD',
      closingDay: 12,
      dueDay: 20,
    });
    prisma.account.update.mockResolvedValue({
      id: 'a1',
      type: 'CREDIT_CARD',
      closingDay: 12,
      dueDay: 20,
    });
    await request(app).put('/api/accounts/a1').send({ name: 'Card 2' });
    expect(recalculateAccountEffectiveDates).toHaveBeenCalledTimes(1);

    prisma.account.delete.mockResolvedValue({});
    expect((await request(app).delete('/api/accounts/a1')).status).toBe(204);

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    prisma.account.findMany.mockRejectedValue(new Error('db'));
    expect((await request(app).get('/api/accounts')).status).toBe(500);
    prisma.category.findMany.mockRejectedValue(new Error('db'));
    expect((await request(app).get('/api/categories')).status).toBe(500);
    consoleSpy.mockRestore();
  });
});
