import { afterAll, beforeAll, describe, expect, it } from 'vitest';
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
});
