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

describe('transactions API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists with filters, cursor pagination and totals', async () => {
    const { createApp } = await import('../src/app');
    const { encodeDateCursor } = await import('../src/utils/pagination');
    const app = createApp();

    const items = Array.from({ length: 2 }, (_, i) => ({
      id: `t${i}`,
      effectiveDate: new Date(2026, 7, 10 - i),
      type: 'EXPENSE',
      amountCents: 100,
      account: {},
      category: {},
      subscription: null,
    }));
    prisma.transaction.findMany.mockResolvedValue(items);
    prisma.transaction.count.mockResolvedValue(2);
    prisma.transaction.groupBy.mockResolvedValue([
      { type: 'INCOME', _sum: { amountCents: 0 } },
      { type: 'EXPENSE', _sum: { amountCents: 200 } },
    ]);

    const cursor = encodeDateCursor({
      effectiveDate: items[0].effectiveDate.toISOString(),
      id: items[0].id,
    });
    const response = await request(app).get(
      `/api/transactions?month=8&year=2026&accountId=a1&categoryId=c1&type=EXPENSE&origin=single&search=cafe&cursor=${cursor}&limit=1`
    );
    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(1);
    expect(response.body.nextCursor).toBeTruthy();

    await request(app).get('/api/transactions?origin=installment');
    await request(app).get('/api/transactions?origin=subscription');
    await request(app).get('/api/transactions?origin=thirdParty');
  });

  it('creates, updates and deletes manual transactions', async () => {
    const { createApp } = await import('../src/app');
    const app = createApp();

    prisma.account.findUniqueOrThrow.mockResolvedValue({
      id: 'a1',
      type: 'BANK_ACCOUNT',
      closingDay: null,
      dueDay: null,
    });
    prisma.category.findUniqueOrThrow.mockResolvedValue({ id: 'c1', type: 'EXPENSE' });
    prisma.transaction.create.mockResolvedValue({ id: 't1' });
    const created = await request(app)
      .post('/api/transactions')
      .send({
        description: 'Cafe',
        amountCents: 500,
        type: 'EXPENSE',
        date: '2026-08-02',
        accountId: 'a1',
        categoryId: 'c1',
        isThirdParty: true,
        thirdPartyName: ' Bob ',
        isReimbursed: true,
      });
    expect(created.status).toBe(201);

    prisma.transaction.create.mockResolvedValue({ id: 't2' });
    expect(
      (
        await request(app)
          .post('/api/transactions')
          .send({
            description: 'Third no meta',
            amountCents: 100,
            type: 'EXPENSE',
            date: '2026-08-02',
            accountId: 'a1',
            categoryId: 'c1',
            isThirdParty: true,
            thirdPartyName: null,
          })
      ).status
    ).toBe(201);
    expect(prisma.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          isThirdParty: true,
          thirdPartyName: null,
          isReimbursed: false,
        }),
      })
    );

    prisma.transaction.findUniqueOrThrow
      .mockResolvedValueOnce({ installmentGroupId: null, subscriptionId: null })
      .mockResolvedValueOnce({
        id: 't1',
        date: new Date('2026-08-02'),
        type: 'EXPENSE',
        isThirdParty: true,
        thirdPartyName: 'Bob',
        isReimbursed: true,
        account: { id: 'a1', type: 'BANK_ACCOUNT', closingDay: null, dueDay: null },
        category: { id: 'c1', type: 'EXPENSE' },
      });
    prisma.transaction.update.mockResolvedValue({ id: 't1' });
    expect(
      (
        await request(app)
          .patch('/api/transactions/t1')
          .send({ description: 'Cafe 2', date: '2026-08-03', type: 'EXPENSE' })
      ).status
    ).toBe(200);

    prisma.transaction.findUniqueOrThrow.mockResolvedValue({
      installmentGroupId: 'g1',
      subscriptionId: null,
    });
    expect((await request(app).delete('/api/transactions/t1')).status).toBe(409);

    prisma.transaction.findUniqueOrThrow.mockResolvedValue({
      installmentGroupId: null,
      subscriptionId: null,
    });
    prisma.transaction.delete.mockResolvedValue({});
    expect((await request(app).delete('/api/transactions/t1')).status).toBe(204);
  });

  it('rejects category type mismatches on create and update', async () => {
    const { createApp } = await import('../src/app');
    const app = createApp();

    prisma.account.findUniqueOrThrow.mockResolvedValue({
      id: 'a1',
      type: 'BANK_ACCOUNT',
      closingDay: null,
      dueDay: null,
    });
    prisma.category.findUniqueOrThrow.mockResolvedValue({ id: 'c1', type: 'INCOME' });
    expect(
      (
        await request(app)
          .post('/api/transactions')
          .send({
            description: 'X',
            amountCents: 100,
            type: 'EXPENSE',
            date: '2026-08-02',
            accountId: 'a1',
            categoryId: 'c1',
          })
      ).status
    ).toBe(422);

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
    expect((await request(app).patch('/api/transactions/t1').send({ type: 'INCOME' })).status).toBe(
      422
    );
  });

  it('covers remaining list and update branches', async () => {
    const { createApp } = await import('../src/app');
    const app = createApp();

    prisma.transaction.findMany.mockResolvedValue([
      {
        id: 'only',
        effectiveDate: new Date(2026, 7, 1),
        type: 'INCOME',
        amountCents: 10,
        account: {},
        category: {},
        subscription: null,
      },
    ]);
    prisma.transaction.count.mockResolvedValue(1);
    prisma.transaction.groupBy.mockResolvedValue([]);
    const listed = await request(app).get('/api/transactions?type=INCOME&search=%20');
    expect(listed.status).toBe(200);
    expect(listed.body.nextCursor).toBeNull();
    expect(listed.body.totals.incomeCents).toBe(0);
    expect(listed.body.totals.expenseCents).toBe(0);

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
    prisma.category.findUniqueOrThrow.mockResolvedValue({ id: 'c2', type: 'EXPENSE' });
    prisma.transaction.update.mockResolvedValue({ id: 't1' });
    expect(
      (
        await request(app)
          .put('/api/transactions/t1')
          .send({ accountId: 'a2', categoryId: 'c2', isThirdParty: false })
      ).status
    ).toBe(200);

    prisma.account.findUniqueOrThrow.mockResolvedValue({
      id: 'a1',
      type: 'BANK_ACCOUNT',
      closingDay: null,
      dueDay: null,
    });
    prisma.category.findUniqueOrThrow.mockResolvedValue({ id: 'c1', type: 'INCOME' });
    prisma.transaction.create.mockResolvedValue({ id: 'income' });
    expect(
      (
        await request(app)
          .post('/api/transactions')
          .send({
            description: 'Salary',
            amountCents: 1000,
            type: 'INCOME',
            date: '2026-08-02',
            accountId: 'a1',
            categoryId: 'c1',
            isThirdParty: true,
            thirdPartyName: 'ignored',
          })
      ).status
    ).toBe(201);

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    prisma.transaction.findMany.mockRejectedValue(new Error('db'));
    expect((await request(app).get('/api/transactions')).status).toBe(500);
    consoleSpy.mockRestore();

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
    prisma.category.findUniqueOrThrow.mockResolvedValue({ id: 'c3', type: 'EXPENSE' });
    prisma.transaction.update.mockResolvedValue({ id: 't1' });
    expect(
      (await request(app).patch('/api/transactions/t1').send({ categoryId: 'c3' })).status
    ).toBe(200);

    prisma.transaction.findUniqueOrThrow.mockResolvedValueOnce({
      installmentGroupId: null,
      subscriptionId: null,
    });
    prisma.transaction.update.mockResolvedValue({ id: 't1' });
    expect(
      (await request(app).patch('/api/transactions/t1').send({ description: 'only desc' })).status
    ).toBe(200);

    prisma.transaction.findUniqueOrThrow.mockResolvedValue({
      installmentGroupId: null,
      subscriptionId: 's1',
    });
    expect((await request(app).delete('/api/transactions/t1')).status).toBe(409);
  });
});
