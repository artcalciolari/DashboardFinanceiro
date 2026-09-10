import { beforeEach, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createPrismaMock } from './helpers/prismaMock';
const prisma = createPrismaMock();
vi.mock('../src/lib/prisma', () => ({ default: prisma }));
beforeEach(() => { vi.clearAllMocks(); });

it('prevents financial edits after settlement while allowing descriptive corrections', async () => {
  const { createApp } = await import('../src/app');
  const app = createApp();
  const base = { id: 't', type: 'EXPENSE', amountCents: 1000, accountId: 'a', categoryId: 'c', isThirdParty: true, isReimbursed: false, reimbursedAmountCents: 400, paidAt: null, account: { type: 'BANK_ACCOUNT' }, category: { type: 'EXPENSE' }, date: new Date(), installmentGroupId: null, subscriptionId: null };
  prisma.transaction.findUniqueOrThrow.mockResolvedValue(base);
  prisma.transaction.update.mockImplementation(async ({ data }) => ({ ...base, ...data }));
  for (const patch of [{ amountCents: 2000 }, { type: 'INCOME' }, { accountId: 'other' }, { isThirdParty: false }]) {
    expect((await request(app).patch('/api/transactions/t').send(patch)).status).toBe(409);
  }
  expect(prisma.transaction.update).not.toHaveBeenCalled();
  prisma.account.findUniqueOrThrow.mockResolvedValue({ type: 'BANK_ACCOUNT' });
  expect((await request(app).patch('/api/transactions/t').send({ description: 'Corrected', amountCents: 1000, type: 'EXPENSE', accountId: 'a', isThirdParty: true })).status).toBe(200);
  prisma.account.findUniqueOrThrow.mockResolvedValue({ type: 'BANK_ACCOUNT' });
  // A paid, personal expense remains editable descriptively without changing ownership.
  prisma.transaction.findUniqueOrThrow.mockResolvedValue({ ...base, reimbursedAmountCents: 0, paidAt: new Date(), isThirdParty: false });
  expect((await request(app).patch('/api/transactions/t').send({ isThirdParty: false, notes: 'Receipt saved' })).status).toBe(200);
});

it('keeps legacy full-reimbursement input consistent with the amount ledger', async () => {
  const { createApp } = await import('../src/app');
  const app = createApp();
  const base = { id: 't', type: 'EXPENSE', amountCents: 1000, isThirdParty: true, isReimbursed: false, reimbursedAmountCents: 0, paidAt: null, installmentGroupId: null, subscriptionId: null };
  prisma.transaction.findUniqueOrThrow.mockResolvedValue(base);
  prisma.transaction.update.mockImplementation(async ({ data }) => ({ ...base, ...data }));
  expect((await request(app).patch('/api/transactions/t').send({ isReimbursed: true })).body.reimbursedAmountCents).toBe(1000);
  expect((await request(app).patch('/api/transactions/t').send({ isReimbursed: true, amountCents: 1200 })).body.reimbursedAmountCents).toBe(1200);
  expect((await request(app).patch('/api/transactions/t').send({ isReimbursed: true, isThirdParty: false })).body.reimbursedAmountCents).toBe(0);
  prisma.transaction.findUniqueOrThrow.mockResolvedValue({ ...base, isReimbursed: true, reimbursedAmountCents: 1000 });
  expect((await request(app).patch('/api/transactions/t').send({ isReimbursed: false })).body.reimbursedAmountCents).toBe(0);
  prisma.account.findUniqueOrThrow.mockResolvedValue({ type: 'BANK_ACCOUNT' });
  prisma.category.findUniqueOrThrow.mockResolvedValue({ type: 'EXPENSE' });
  prisma.transaction.create.mockImplementation(async ({ data }) => ({ id: 'created', ...data }));
  expect((await request(app).post('/api/transactions').send({ description: 'Paid by friend', amountCents: 1000, type: 'EXPENSE', date: '2026-09-01', accountId: 'a', categoryId: 'c', isThirdParty: true, isReimbursed: true })).body.reimbursedAmountCents).toBe(1000);
});

it('runs cycle recalculation on the caller transaction rather than committing separately', async () => {
  const { recalculateAccountEffectiveDates } = await import('../src/services/accountCycleService');
  const tx = { ...prisma };
  prisma.account.findUniqueOrThrow.mockResolvedValue({ type: 'BANK_ACCOUNT' });
  prisma.transaction.findMany.mockResolvedValue([{ id: 't', date: new Date(2026, 8, 5), effectiveDate: new Date(2026, 8, 6) }]);
  prisma.installmentGroup.findMany.mockResolvedValue([]);
  prisma.transaction.update.mockResolvedValue({});
  await recalculateAccountEffectiveDates('a', new Date(2026, 8, 1), tx as never);
  expect(prisma.transaction.update).toHaveBeenCalled();
  expect(prisma.$transaction).not.toHaveBeenCalled();
});

it('preserves paid and partially reimbursed subscription occurrences during synchronization', async () => {
  const { synchronizeSubscriptionTransactions } = await import('../src/services/subscriptionService');
  const start = new Date(); start.setDate(1); start.setHours(12, 0, 0, 0);
  const subscription = { id: 's', name: 'Subscription', amountCents: 2000, startDate: start, billingDay: 1, accountId: 'a', categoryId: 'c', isThirdParty: true, isReimbursed: false, thirdPartyName: 'Friend', notes: null, account: { type: 'BANK_ACCOUNT' } };
  prisma.subscription.findMany.mockResolvedValue([subscription]);
  const occurrence = { id: 't', subscriptionId: 's', subscriptionYear: start.getFullYear(), subscriptionMonth: start.getMonth() + 1, effectiveDate: start, paidAt: null, reimbursedAmountCents: 400 };
  for (const state of [{ ...occurrence }, { ...occurrence, reimbursedAmountCents: 0, paidAt: new Date() }]) {
    prisma.transaction.findMany.mockResolvedValue([state]);
    await synchronizeSubscriptionTransactions(start, { ...prisma } as never, 'a', 's');
  }
  expect(prisma.transaction.update).not.toHaveBeenCalled();
  prisma.account.findUniqueOrThrow.mockResolvedValue({ type: 'BANK_ACCOUNT' });
  prisma.transaction.findMany.mockResolvedValue([]);
  prisma.transaction.createMany.mockResolvedValue({ count: 1 });
  await synchronizeSubscriptionTransactions(start, { ...prisma } as never, 'a', 's');
  expect(prisma.transaction.createMany).toHaveBeenCalled();
  expect(prisma.$transaction).not.toHaveBeenCalled();
});

it('never moves current entries into closed months or rewrites closed entries', async () => {
  const { recalculateAccountEffectiveDates } = await import('../src/services/accountCycleService');
  const from = new Date(2026, 8, 1);
  prisma.account.findUniqueOrThrow.mockResolvedValue({ type: 'BANK_ACCOUNT' });
  prisma.transaction.findMany.mockResolvedValue([
    { id: 'move-back', date: new Date(2026, 7, 5), effectiveDate: new Date(2026, 8, 5) },
    { id: 'closed', date: new Date(2026, 8, 5), effectiveDate: new Date(2026, 7, 5) },
  ]);
  prisma.installmentGroup.findMany.mockResolvedValue([{ startDate: new Date(2026, 7, 5), transactions: [{ id: 'parcel-back', installmentNumber: 1, effectiveDate: new Date(2026, 8, 5) }] }]);
  await recalculateAccountEffectiveDates('a', from, { ...prisma } as never);
  expect(prisma.transaction.update).not.toHaveBeenCalled();
});

it('does not move a subscription occurrence back into a closed month', async () => {
  const { synchronizeSubscriptionTransactions } = await import('../src/services/subscriptionService');
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 12);
  prisma.subscription.findMany.mockResolvedValue([{ id: 's', name: 'Closed', amountCents: 100, startDate: start, billingDay: 1, account: { type: 'BANK_ACCOUNT' } }]);
  prisma.transaction.findMany.mockResolvedValue([{ id: 't', subscriptionId: 's', subscriptionYear: start.getFullYear(), subscriptionMonth: start.getMonth() + 1, effectiveDate: now }]);
  await synchronizeSubscriptionTransactions(start, { ...prisma } as never);
  expect(prisma.transaction.update).not.toHaveBeenCalled();
});
