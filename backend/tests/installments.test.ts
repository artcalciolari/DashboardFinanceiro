import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createPrismaMock } from './helpers/prismaMock';

const prisma = createPrismaMock();

vi.mock('../src/lib/prisma', () => ({ default: prisma }));

describe('installments API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists installments with paid/future aggregates and rejects invalid asOf', async () => {
    const { createApp } = await import('../src/app');
    const app = createApp();

    const asOf = new Date(2026, 7, 15);
    prisma.installmentGroup.findMany.mockResolvedValue([
      {
        id: 'g1',
        createdAt: new Date(),
        transactions: [
          { id: 't1', installmentNumber: 1, amountCents: 100, effectiveDate: new Date(2026, 6, 10), paidAt: new Date(2026, 6, 15) },
          { id: 't2', installmentNumber: 2, amountCents: 100, effectiveDate: new Date(2026, 8, 10) },
        ],
      },
      {
        id: 'g2',
        createdAt: new Date(),
        transactions: [],
      },
      {
        id: 'g3',
        createdAt: new Date(),
        transactions: [
          { id: 't3', installmentNumber: 1, amountCents: 250, effectiveDate: new Date(2026, 5, 10) },
          { id: 't4', installmentNumber: 2, amountCents: 250, effectiveDate: new Date(2026, 6, 10) },
        ],
      },
      {
        id: 'g4',
        installmentCount: 2,
        createdAt: new Date(),
        transactions: [
          { id: 't5', installmentNumber: 1, amountCents: 75, effectiveDate: new Date(2026, 6, 10), paidAt: new Date(2026, 6, 11) },
        ],
      },
    ]);
    prisma.installmentGroup.count.mockResolvedValue(3);

    const listed = await request(app).get(`/api/installments?asOf=${asOf.toISOString()}&page=1&pageSize=10`);
    expect(listed.status).toBe(200);
    expect(listed.body.items[0].paidCount).toBe(1);
    expect(listed.body.items[0].futureCount).toBe(1);
    expect(listed.body.items[1].installmentAmountCents).toBe(0);
    expect(listed.body.items[2].installmentAmountCents).toBe(250);
    expect(listed.body.items[2].futureCount).toBe(0);
    expect(listed.body.items[3].installmentAmountCents).toBe(75);

    const monthSummary = await request(app).get(`/api/installments?asOf=${asOf.toISOString()}&month=9&year=2026`);
    expect(monthSummary.status).toBe(200);
    expect(monthSummary.body.aggregates.committedMonthlyCents).toBe(100);

    expect((await request(app).get('/api/installments')).status).toBe(200);

    const invalid = await request(app).get('/api/installments?asOf=not-a-date');
    expect(invalid.status).toBe(422);
    expect(invalid.body.code).toBe('INVALID_AS_OF');

    expect((await request(app).get('/api/installments?month=9')).status).toBe(422);
  });

  it('creates installment groups including third-party fields', async () => {
    const { createApp } = await import('../src/app');
    const app = createApp();

    prisma.account.findUniqueOrThrow.mockResolvedValue({
      id: 'a1',
      type: 'CREDIT_CARD',
      closingDay: 10,
      dueDay: 20,
    });
    prisma.category.findUniqueOrThrow.mockResolvedValue({ id: 'c1', type: 'EXPENSE' });
    prisma.installmentGroup.create.mockResolvedValue({ id: 'g1' });
    prisma.transaction.createMany.mockResolvedValue({ count: 3 });
    prisma.installmentGroup.findUnique.mockResolvedValue({
      id: 'g1',
      account: {},
      category: {},
      transactions: [],
    });

    const created = await request(app)
      .post('/api/installments')
      .send({
        description: 'TV',
        totalAmountCents: 300,
        installmentCount: 3,
        startDate: '2026-08-02T12:00:00.000Z',
        accountId: 'a1',
        categoryId: 'c1',
        isThirdParty: true,
        thirdPartyName: ' Dana ',
        isReimbursed: true,
        notes: 'note',
      });
    expect(created.status).toBe(201);
    expect(prisma.installmentGroup.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          isThirdParty: true,
          thirdPartyName: 'Dana',
          isReimbursed: true,
        }),
      })
    );

    prisma.installmentGroup.create.mockResolvedValue({ id: 'g2' });
    prisma.installmentGroup.findUnique.mockResolvedValue({
      id: 'g2',
      account: {},
      category: {},
      transactions: [],
    });
    const personal = await request(app)
      .post('/api/installments')
      .send({
        description: 'Phone',
        totalAmountCents: 200,
        installmentCount: 2,
        startDate: '2026-08-02T12:00:00.000Z',
        accountId: 'a1',
        categoryId: 'c1',
        isThirdParty: true,
        thirdPartyName: '   ',
      });
    expect(personal.status).toBe(201);
    expect(prisma.installmentGroup.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          thirdPartyName: null,
          isReimbursed: false,
        }),
      })
    );

    prisma.installmentGroup.create.mockResolvedValue({ id: 'g3' });
    prisma.installmentGroup.findUnique.mockResolvedValue({ id: 'g3', transactions: [] });
    expect(
      (
        await request(app)
          .post('/api/installments')
          .send({
            description: 'Own',
            totalAmountCents: 200,
            installmentCount: 2,
            startDate: '2026-08-02T12:00:00.000Z',
            accountId: 'a1',
            categoryId: 'c1',
          })
      ).status
    ).toBe(201);

    prisma.category.findUniqueOrThrow.mockResolvedValue({ id: 'c2', type: 'INCOME' });
    expect(
      (
        await request(app)
          .post('/api/installments')
          .send({
            description: 'Bad',
            totalAmountCents: 100,
            installmentCount: 2,
            startDate: '2026-08-02',
            accountId: 'a1',
            categoryId: 'c2',
          })
      ).status
    ).toBe(422);

    prisma.category.findUniqueOrThrow.mockResolvedValue({ id: 'c1', type: 'EXPENSE' });
    expect(
      (
        await request(app)
          .post('/api/installments')
          .send({
            description: 'Tiny',
            totalAmountCents: 1,
            installmentCount: 2,
            startDate: '2026-08-02',
            accountId: 'a1',
            categoryId: 'c1',
          })
      ).status
    ).toBe(422);
  });

  it('deletes future or all installments and updates payment dates', async () => {
    const { createApp } = await import('../src/app');
    const app = createApp();

    prisma.transaction.deleteMany.mockResolvedValue({ count: 1 });
    prisma.installmentGroup.delete.mockResolvedValue({});
    expect((await request(app).delete('/api/installments/g1?mode=all')).status).toBe(204);

    prisma.transaction.count.mockResolvedValueOnce(0);
    prisma.installmentGroup.delete.mockResolvedValue({});
    expect((await request(app).delete('/api/installments/g1')).status).toBe(204);

    prisma.transaction.count.mockResolvedValueOnce(2);
    prisma.installmentGroup.update.mockResolvedValue({ id: 'g1', isCancelled: true });
    expect((await request(app).delete('/api/installments/g1?mode=future')).status).toBe(204);
    expect(prisma.installmentGroup.update).toHaveBeenCalled();

    prisma.installmentGroup.findUniqueOrThrow.mockResolvedValue({ id: 'g1', isCancelled: true });
    expect(
      (
        await request(app)
          .patch('/api/installments/g1/payment-date')
          .send({ firstPaymentDate: '2026-09-01' })
      ).status
    ).toBe(409);

    prisma.installmentGroup.findUniqueOrThrow.mockResolvedValue({ id: 'g1', isCancelled: false });
    prisma.transaction.findMany.mockResolvedValue([
      { id: 't1', installmentNumber: 1 },
      { id: 't2', installmentNumber: null },
    ]);
    prisma.transaction.update.mockResolvedValue({});
    prisma.installmentGroup.findUnique.mockResolvedValue({ id: 'g1', transactions: [] });
    expect(
      (
        await request(app)
          .patch('/api/installments/g1/payment-date')
          .send({ firstPaymentDate: '2026-09-01T12:00:00.000Z' })
      ).status
    ).toBe(200);

    prisma.transaction.findMany.mockResolvedValue([]);
    prisma.transaction.count.mockResolvedValue(0);
    expect((await request(app).get('/api/installments/g1/transactions')).status).toBe(200);
  });

  it('propagates unexpected errors through the error handler', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { createApp } = await import('../src/app');
    const app = createApp();
    prisma.installmentGroup.findMany.mockRejectedValue(new Error('db'));
    expect((await request(app).get('/api/installments')).status).toBe(500);

    prisma.account.findUniqueOrThrow.mockRejectedValue(new Error('db'));
    expect(
      (
        await request(app)
          .post('/api/installments')
          .send({
            description: 'X',
            totalAmountCents: 100,
            installmentCount: 2,
            startDate: '2026-08-02',
            accountId: 'a1',
            categoryId: 'c1',
          })
      ).status
    ).toBe(500);

    prisma.$transaction.mockRejectedValue(new Error('db'));
    expect((await request(app).delete('/api/installments/g1?mode=all')).status).toBe(500);

    prisma.installmentGroup.findUniqueOrThrow.mockRejectedValue(new Error('db'));
    expect(
      (
        await request(app)
          .patch('/api/installments/g1/payment-date')
          .send({ firstPaymentDate: '2026-09-01' })
      ).status
    ).toBe(500);

    prisma.transaction.findMany.mockRejectedValue(new Error('db'));
    expect((await request(app).get('/api/installments/g1/transactions')).status).toBe(500);
    consoleSpy.mockRestore();
  });

  it('filters active groups before pagination and returns global aggregates', async () => {
    const { createApp } = await import('../src/app');
    const app = createApp();
    const asOf = new Date('2026-08-31T23:59:59.999Z');
    const groups = Array.from({ length: 101 }, (_, index) => ({
      id: `g-${index}`,
      description: `Grupo ${String(index).padStart(3, '0')}`,
      installmentCount: 2,
      isCancelled: index === 100,
      createdAt: new Date(2026, 7, index % 20 + 1),
      transactions: [
        { id: `t-${index}`, amountCents: 100 + index, effectiveDate: new Date(2026, 8, 1 + (index % 10)), paidAt: null },
        { id: `tp-${index}`, amountCents: 100, effectiveDate: new Date(2026, 6, 1), paidAt: new Date(2026, 6, 2) },
      ],
    }));
    prisma.installmentGroup.findMany.mockResolvedValue(groups);
    prisma.installmentGroup.count.mockResolvedValue(101);

    const response = await request(app).get(`/api/installments?activeOnly=true&asOf=${asOf.toISOString()}&page=1&pageSize=2`);
    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(2);
    expect(response.body.pagination.total).toBe(100);
    expect(response.body.aggregates.activeCount).toBe(100);
    expect(response.body.aggregates.remainingAmountCents).toBeGreaterThan(10000);
    expect(response.body.items.every((item: { isCancelled: boolean }) => !item.isCancelled)).toBe(true);
  });

  it('does not move settled installment dates', async () => {
    const { createApp } = await import('../src/app');
    const app = createApp();
    prisma.installmentGroup.findUniqueOrThrow.mockResolvedValue({ id: 'g1', isCancelled: false });
    prisma.transaction.findMany.mockResolvedValue([
      { id: 'paid', installmentNumber: 1, effectiveDate: new Date('2026-08-10'), paidAt: new Date('2026-08-10'), reimbursedAmountCents: 0 },
      { id: 'reimbursed', installmentNumber: 2, effectiveDate: new Date('2026-10-10'), paidAt: null, reimbursedAmountCents: 100 },
      { id: 'open', installmentNumber: 3, effectiveDate: new Date('2026-12-10'), paidAt: null, reimbursedAmountCents: 0 },
    ]);
    prisma.transaction.update.mockResolvedValue({});
    prisma.installmentGroup.findUnique.mockResolvedValue({ id: 'g1', transactions: [] });
    prisma.$transaction.mockImplementation(async (operation: any) => operation(prisma));

    expect((await request(app).patch('/api/installments/g1/payment-date').send({ firstPaymentDate: '2026-11-01' })).status).toBe(200);
    expect(prisma.transaction.update).toHaveBeenCalledTimes(1);
    expect(prisma.transaction.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'open' } }));
  });
});
