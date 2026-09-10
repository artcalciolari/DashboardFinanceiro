import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { addDays, addMonths, startOfMonth } from 'date-fns';
import request from 'supertest';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const integrationSuite = testDatabaseUrl && /test/i.test(testDatabaseUrl) ? describe : describe.skip;

integrationSuite('subscription materialization', () => {
  let prisma: PrismaClient;
  let ensureSubscriptionTransactions: (untilDate: Date) => Promise<void>;
  let resetSubscriptionTransactionHorizon: () => void;
  let createApp: (typeof import('../../src/app'))['createApp'];
  let accountId: string;
  let categoryId: string;

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl;
    ({ default: prisma } = await import('../../src/lib/prisma'));
    ({ ensureSubscriptionTransactions, resetSubscriptionTransactionHorizon } = await import(
      '../../src/services/subscriptionService'
    ));
    ({ createApp } = await import('../../src/app'));
    await prisma.alert.deleteMany();
    await prisma.transaction.deleteMany();
    await prisma.installmentGroup.deleteMany();
    await prisma.subscription.deleteMany();
    await prisma.category.deleteMany();
    await prisma.account.deleteMany();
    const account = await prisma.account.create({
      data: { name: 'Integration card', type: 'CREDIT_CARD', closingDay: 10, dueDay: 20 },
    });
    const category = await prisma.category.create({
      data: { name: 'Integration subscriptions', type: 'EXPENSE' },
    });
    accountId = account.id;
    categoryId = category.id;
  });

  afterAll(async () => {
    if (prisma) await prisma.$disconnect();
  });

  it('creates one occurrence per subscription month under concurrent requests', async () => {
    const subscription = await prisma.subscription.create({
      data: {
        name: 'Integration recurring charge',
        amountCents: 1990,
        startDate: new Date(2026, 0, 5, 12),
        billingDay: 5,
        accountId,
        categoryId,
      },
    });

    resetSubscriptionTransactionHorizon();
    const horizon = new Date(2026, 2, 31, 23, 59, 59);
    await Promise.all([
      ensureSubscriptionTransactions(horizon),
      ensureSubscriptionTransactions(horizon),
      ensureSubscriptionTransactions(horizon),
    ]);

    const occurrences = await prisma.transaction.findMany({
      where: { subscriptionId: subscription.id },
      orderBy: [{ subscriptionYear: 'asc' }, { subscriptionMonth: 'asc' }],
    });
    expect(occurrences).toHaveLength(3);
    expect(new Set(occurrences.map((row) => `${row.subscriptionYear}-${row.subscriptionMonth}`)).size).toBe(3);
    expect(occurrences.every((row) => row.amountCents === 1990)).toBe(true);
  });

  it('uses the same daily cutoff when deleting future subscription and installment entries', async () => {
    const now = new Date();
    const start = addDays(startOfMonth(now), -1);
    const bankAccount = await prisma.account.create({
      data: { name: 'Integration bank', type: 'BANK_ACCOUNT' },
    });
    const subscription = await prisma.subscription.create({
      data: {
        name: 'Deletion subscription',
        amountCents: 900,
        startDate: start,
        billingDay: start.getDate(),
        accountId: bankAccount.id,
        categoryId,
      },
    });
    resetSubscriptionTransactionHorizon();
    await ensureSubscriptionTransactions(addMonths(now, 2));

    const subscriptionResponse = await request(createApp())
      .delete(`/api/subscriptions/${subscription.id}`)
      .query({ mode: 'future' });
    expect(subscriptionResponse.status).toBe(204);
    const preserved = await prisma.transaction.findMany({ where: { description: { startsWith: 'Deletion subscription' } } });
    expect(preserved).toHaveLength(1);
    expect(preserved[0].effectiveDate < new Date(now.getFullYear(), now.getMonth(), now.getDate())).toBe(true);
    expect(preserved.every((row) => row.subscriptionId === null && row.subscriptionMonth === null)).toBe(true);

    const group = await prisma.installmentGroup.create({
      data: {
        description: 'Deletion installment',
        totalAmountCents: 300,
        installmentCount: 3,
        startDate: addDays(now, -10),
        accountId: bankAccount.id,
        categoryId,
      },
    });
    await prisma.transaction.createMany({
      data: [addDays(now, -1), addDays(now, 1), addMonths(now, 1)].map((effectiveDate, index) => ({
        description: `Deletion installment (${index + 1}/3)`,
        amountCents: 100,
        type: 'EXPENSE' as const,
        date: group.startDate,
        effectiveDate,
        accountId: bankAccount.id,
        categoryId,
        installmentGroupId: group.id,
        installmentNumber: index + 1,
        totalInstallments: 3,
      })),
    });
    const installmentResponse = await request(createApp())
      .delete(`/api/installments/${group.id}`)
      .query({ mode: 'future' });
    expect(installmentResponse.status).toBe(204);
    expect(await prisma.transaction.count({ where: { installmentGroupId: group.id } })).toBe(1);
    expect((await prisma.installmentGroup.findUniqueOrThrow({ where: { id: group.id } })).isCancelled).toBe(true);

    const removableGroup = await prisma.installmentGroup.create({
      data: {
        description: 'Fully removable installment',
        totalAmountCents: 200,
        installmentCount: 2,
        startDate: now,
        accountId: bankAccount.id,
        categoryId,
      },
    });
    await prisma.transaction.create({
      data: {
        description: 'Fully removable installment (1/2)',
        amountCents: 100,
        type: 'EXPENSE',
        date: now,
        effectiveDate: now,
        accountId: bankAccount.id,
        categoryId,
        installmentGroupId: removableGroup.id,
        installmentNumber: 1,
        totalInstallments: 2,
      },
    });
    const allResponse = await request(createApp())
      .delete(`/api/installments/${removableGroup.id}`)
      .query({ mode: 'all' });
    expect(allResponse.status).toBe(204);
    expect(await prisma.installmentGroup.findUnique({ where: { id: removableGroup.id } })).toBeNull();
    expect(await prisma.transaction.count({ where: { installmentGroupId: removableGroup.id } })).toBe(0);
  });

  it('rolls back the account and every recalculation when a database write fails', async () => {
    const account = await prisma.account.create({ data: { name: 'Rollback card', type: 'CREDIT_CARD', closingDay: 10, dueDay: 20 } });
    const date = addDays(new Date(), 2);
    await prisma.transaction.create({ data: { id: 'rollback-occurrence', description: 'Rollback', amountCents: 100, type: 'EXPENSE', accountId: account.id, categoryId, date, effectiveDate: date } });
    await prisma.$executeRawUnsafe(`CREATE FUNCTION test_reject_recalculation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.id = 'rollback-occurrence' THEN RAISE EXCEPTION 'Injected recalculation failure'; END IF; RETURN NEW; END $$`);
    await prisma.$executeRawUnsafe(`CREATE TRIGGER test_reject_recalculation BEFORE UPDATE OF "effectiveDate" ON "Transaction" FOR EACH ROW EXECUTE FUNCTION test_reject_recalculation()`);
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      expect((await request(createApp()).patch(`/api/accounts/${account.id}`).send({ dueDay: 25 })).status).toBe(500);
      expect(consoleSpy.mock.calls.some(([error]) => String(error).includes('Injected recalculation failure'))).toBe(true);
      expect((await prisma.account.findUniqueOrThrow({ where: { id: account.id } })).dueDay).toBe(20);
      expect((await prisma.transaction.findUniqueOrThrow({ where: { id: 'rollback-occurrence' } })).effectiveDate).toEqual(date);
    } finally {
      consoleSpy.mockRestore();
      await prisma.$executeRawUnsafe('DROP TRIGGER test_reject_recalculation ON "Transaction"');
      await prisma.$executeRawUnsafe('DROP FUNCTION test_reject_recalculation()');
    }
  });

  it('blocks category type changes through the API and directly in PostgreSQL', async () => {
    const response = await request(createApp()).patch(`/api/categories/${categoryId}`).send({ type: 'INCOME' });
    expect(response.status).toBe(409);
    await expect(prisma.category.update({ where: { id: categoryId }, data: { type: 'INCOME' } })).rejects.toThrow();
    const income = await prisma.category.create({ data: { name: 'Income integrity', type: 'INCOME' } });
    await expect(prisma.transaction.create({ data: { description: 'Invalid', type: 'EXPENSE', amountCents: 100, date: new Date(), effectiveDate: new Date(), accountId, categoryId: income.id } })).rejects.toThrow();
  });

  it('preserves payment and partial reimbursement when editing and cancelling a subscription', async () => {
    const app = createApp();
    const bank = await prisma.account.create({ data: { name: 'Settlements bank', type: 'BANK_ACCOUNT' } });
    const startDate = new Date().toISOString();
    const created = await request(app).post('/api/subscriptions').send({ name: 'Shared charge', amountCents: 1000, startDate, accountId: bank.id, categoryId, isThirdParty: true });
    expect(created.status).toBe(201);
    const occurrence = await prisma.transaction.findFirstOrThrow({ where: { subscriptionId: created.body.id }, orderBy: { effectiveDate: 'asc' } });
    const paidAt = new Date().toISOString();
    expect((await request(app).patch(`/api/transactions/${occurrence.id}/settlement`).send({ paidAt })).status).toBe(200);
    expect((await request(app).patch(`/api/transactions/${occurrence.id}/reimbursement`).send({ reimbursedAmountCents: 400, reimbursedAt: paidAt })).status).toBe(200);
    expect((await request(app).patch(`/api/subscriptions/${created.body.id}`).send({ amountCents: 2000 })).status).toBe(200);
    const afterEdit = await prisma.transaction.findUniqueOrThrow({ where: { id: occurrence.id } });
    expect(afterEdit).toMatchObject({ amountCents: 1000, reimbursedAmountCents: 400, paidAt: new Date(paidAt) });
    const summary = await request(app).get('/api/summary/accounts').query({ month: occurrence.effectiveDate.getMonth() + 1, year: occurrence.effectiveDate.getFullYear() });
    expect(summary.body.find((item: { account: { id: string } }) => item.account.id === bank.id).receivableCents).toBe(600);
    expect((await request(app).delete(`/api/subscriptions/${created.body.id}`).query({ mode: 'future' })).status).toBe(204);
    expect((await prisma.transaction.findUniqueOrThrow({ where: { id: occurrence.id } })).reimbursedAmountCents).toBe(400);
  });

  it('materializes uniquely across independent PostgreSQL connections', async () => {
    const { PrismaClient } = await import('@prisma/client');
    const { synchronizeSubscriptionTransactions } = await import('../../src/services/subscriptionService');
    const other = new PrismaClient();
    const subscription = await prisma.subscription.create({ data: { name: 'Independent workers', amountCents: 100, startDate: new Date(2026, 0, 1, 12), billingDay: 1, accountId, categoryId } });
    try {
      const until = new Date(2026, 2, 31);
      await Promise.all([prisma, other].map((client) => client.$transaction((tx) => synchronizeSubscriptionTransactions(until, tx, undefined, subscription.id))));
      expect(await prisma.transaction.count({ where: { subscriptionId: subscription.id } })).toBe(3);
    } finally { await other.$disconnect(); }
  });

  it('keeps category invariants when a type change races a new expense', async () => {
    const { PrismaClient } = await import('@prisma/client');
    const other = new PrismaClient();
    const category = await prisma.category.create({ data: { name: 'Concurrent category', type: 'EXPENSE' } });
    try {
      const outcomes = await Promise.allSettled([
        prisma.category.update({ where: { id: category.id }, data: { type: 'INCOME' } }),
        other.transaction.create({ data: { description: 'Concurrent expense', type: 'EXPENSE', amountCents: 100, date: new Date(), effectiveDate: new Date(), accountId, categoryId: category.id } }),
      ]);
      expect(outcomes.filter((result) => result.status === 'rejected')).toHaveLength(1);
      const rows = await prisma.transaction.findMany({ where: { categoryId: category.id }, include: { category: true } });
      expect(rows.every((row) => row.type === row.category.type)).toBe(true);
    } finally { await other.$disconnect(); }
  });
});
