import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPrismaMock } from './helpers/prismaMock';

const prisma = createPrismaMock();

vi.mock('../src/lib/prisma', () => ({ default: prisma }));

function bankAccount(overrides: Record<string, unknown> = {}) {
  return {
    id: 'acc',
    type: 'BANK_ACCOUNT',
    closingDay: null,
    dueDay: null,
    ...overrides,
  };
}

function baseSubscription(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sub1',
    name: 'Netflix',
    amountCents: 5000,
    startDate: new Date(2026, 0, 5, 12),
    endDate: null,
    billingDay: 5,
    isActive: true,
    accountId: 'acc',
    categoryId: 'cat',
    isThirdParty: false,
    thirdPartyName: null,
    isReimbursed: false,
    notes: null,
    account: bankAccount(),
    ...overrides,
  };
}

describe('subscriptionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns early when there are no active subscriptions', async () => {
    prisma.subscription.findMany.mockResolvedValue([]);
    const { ensureSubscriptionTransactions, resetSubscriptionTransactionHorizon } = await import(
      '../src/services/subscriptionService'
    );
    resetSubscriptionTransactionHorizon();
    await ensureSubscriptionTransactions(new Date(2026, 2, 31));
    expect(prisma.transaction.findMany).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('creates missing occurrences including clamped billing days', async () => {
    prisma.subscription.findMany.mockResolvedValue([
      baseSubscription({
        billingDay: 31,
        startDate: new Date(2026, 0, 31, 12),
      }),
    ]);
    prisma.transaction.findMany.mockResolvedValue([]);
    prisma.transaction.createMany.mockResolvedValue({ count: 2 });
    prisma.$transaction.mockResolvedValue([]);

    const { ensureSubscriptionTransactions, resetSubscriptionTransactionHorizon } = await import(
      '../src/services/subscriptionService'
    );
    resetSubscriptionTransactionHorizon();
    await ensureSubscriptionTransactions(new Date(2026, 1, 28, 23, 59, 59));

    expect(prisma.transaction.createMany).toHaveBeenCalled();
    const createManyArg = prisma.transaction.createMany.mock.calls[0][0];
    expect(createManyArg.data.length).toBeGreaterThanOrEqual(2);
    expect(createManyArg.skipDuplicates).toBe(true);
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('skips closed months and updates every mutable field on existing rows', async () => {
    const mutableFrom = new Date(2026, 7, 1);
    vi.setSystemTime(new Date(2026, 7, 15, 12));

    const subscription = baseSubscription({
      name: 'Spotify',
      amountCents: 2990,
      startDate: new Date(2026, 5, 10, 12),
      billingDay: 10,
      accountId: 'acc2',
      categoryId: 'cat2',
      isThirdParty: true,
      thirdPartyName: 'Alice',
      isReimbursed: true,
      notes: 'updated notes',
      account: bankAccount({ id: 'acc2' }),
    });
    prisma.subscription.findMany.mockResolvedValue([subscription]);
    prisma.transaction.findMany.mockResolvedValue([
      {
        id: 'closed',
        subscriptionId: 'sub1',
        subscriptionYear: 2026,
        subscriptionMonth: 6,
        date: new Date(2026, 5, 10, 12),
        effectiveDate: new Date(2026, 5, 10, 12),
        description: 'old',
        amountCents: 1,
        accountId: 'acc',
        categoryId: 'cat',
        isThirdParty: false,
        thirdPartyName: null,
        isReimbursed: false,
        notes: null,
      },
      {
        id: 'open',
        subscriptionId: 'sub1',
        subscriptionYear: 2026,
        subscriptionMonth: 8,
        date: new Date(2026, 7, 1, 12),
        effectiveDate: new Date(2026, 7, 15, 12),
        description: 'wrong',
        amountCents: 1,
        accountId: 'acc',
        categoryId: 'cat',
        isThirdParty: false,
        thirdPartyName: 'Bob',
        isReimbursed: true,
        notes: 'old',
      },
    ]);
    prisma.transaction.update.mockResolvedValue({});
    prisma.$transaction.mockResolvedValue([]);

    const { ensureSubscriptionTransactions, resetSubscriptionTransactionHorizon } = await import(
      '../src/services/subscriptionService'
    );
    resetSubscriptionTransactionHorizon();
    await ensureSubscriptionTransactions(new Date(2026, 7, 31));

    expect(prisma.transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'open' },
        data: expect.objectContaining({
          description: 'Spotify (08/2026)',
          amountCents: 2990,
          accountId: 'acc2',
          categoryId: 'cat2',
          isThirdParty: true,
          thirdPartyName: 'Alice',
          notes: 'updated notes',
          isReimbursed: false,
        }),
      })
    );
    expect(prisma.transaction.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'closed' } })
    );

    vi.useRealTimers();
  });

  it('filters by endDate and uses startDate when it is after billingDay', async () => {
    prisma.subscription.findMany.mockResolvedValue([
      baseSubscription({
        startDate: new Date(2026, 0, 20, 12),
        billingDay: 5,
        endDate: new Date(2026, 1, 10, 12),
      }),
    ]);
    prisma.transaction.findMany.mockResolvedValue([]);
    prisma.transaction.createMany.mockResolvedValue({ count: 1 });
    prisma.$transaction.mockResolvedValue([]);

    const { ensureSubscriptionTransactions, resetSubscriptionTransactionHorizon } = await import(
      '../src/services/subscriptionService'
    );
    resetSubscriptionTransactionHorizon();
    await ensureSubscriptionTransactions(new Date(2026, 2, 31));

    const rows = prisma.transaction.createMany.mock.calls[0][0].data;
    expect(rows.every((row: { date: Date }) => row.date <= new Date(2026, 1, 10, 23, 59, 59, 999))).toBe(
      true
    );
    expect(rows[0].date).toEqual(new Date(2026, 0, 20, 12));
  });

  it('keeps reimbursed only on the initial third-party occurrence', async () => {
    prisma.subscription.findMany.mockResolvedValue([
      baseSubscription({
        startDate: new Date(2026, 0, 5, 12),
        billingDay: 5,
        isThirdParty: true,
        thirdPartyName: 'Carol',
        isReimbursed: true,
      }),
    ]);
    prisma.transaction.findMany.mockResolvedValue([]);
    prisma.transaction.createMany.mockResolvedValue({ count: 2 });
    prisma.$transaction.mockResolvedValue([]);

    const { ensureSubscriptionTransactions, resetSubscriptionTransactionHorizon } = await import(
      '../src/services/subscriptionService'
    );
    resetSubscriptionTransactionHorizon();
    await ensureSubscriptionTransactions(new Date(2026, 1, 28));

    const rows = prisma.transaction.createMany.mock.calls[0][0].data;
    const january = rows.find((row: { subscriptionMonth: number }) => row.subscriptionMonth === 1);
    const february = rows.find((row: { subscriptionMonth: number }) => row.subscriptionMonth === 2);
    expect(january.isReimbursed).toBe(true);
    expect(february.isReimbursed).toBe(false);
  });

  it('returns early when the horizon is already synchronized and recovers after queue errors', async () => {
    prisma.subscription.findMany
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const {
      ensureSubscriptionTransactions,
      resetSubscriptionTransactionHorizon,
      getSubscriptionHorizon,
    } = await import('../src/services/subscriptionService');
    resetSubscriptionTransactionHorizon();

    await expect(ensureSubscriptionTransactions(new Date(2026, 2, 31))).rejects.toThrow('boom');

    await ensureSubscriptionTransactions(new Date(2026, 2, 31));
    const callsAfterFirstSuccess = prisma.subscription.findMany.mock.calls.length;
    await ensureSubscriptionTransactions(new Date(2026, 1, 15));
    expect(prisma.subscription.findMany.mock.calls.length).toBe(callsAfterFirstSuccess);

    resetSubscriptionTransactionHorizon();
    await ensureSubscriptionTransactions(getSubscriptionHorizon());
    expect(prisma.subscription.findMany.mock.calls.length).toBeGreaterThan(callsAfterFirstSuccess);
  });

  it('skips createMany when existing rows already match expected data', async () => {
    vi.setSystemTime(new Date(2026, 0, 15, 12));
    const purchaseDate = new Date(2026, 0, 5, 12);
    prisma.subscription.findMany.mockResolvedValue([
      baseSubscription({ startDate: purchaseDate, billingDay: 5 }),
    ]);
    prisma.transaction.findMany.mockResolvedValue([
      {
        id: 'same',
        subscriptionId: 'sub1',
        subscriptionYear: 2026,
        subscriptionMonth: 1,
        date: purchaseDate,
        effectiveDate: purchaseDate,
        description: 'Netflix (01/2026)',
        amountCents: 5000,
        accountId: 'acc',
        categoryId: 'cat',
        isThirdParty: false,
        thirdPartyName: null,
        isReimbursed: false,
        notes: null,
      },
    ]);

    const { ensureSubscriptionTransactions, resetSubscriptionTransactionHorizon } = await import(
      '../src/services/subscriptionService'
    );
    resetSubscriptionTransactionHorizon();
    await ensureSubscriptionTransactions(new Date(2026, 0, 31));

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.transaction.createMany).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('clamps invalid billing days to the month range', async () => {
    prisma.subscription.findMany.mockResolvedValue([
      baseSubscription({
        billingDay: 0,
        startDate: new Date(2026, 0, 1, 12),
      }),
    ]);
    prisma.transaction.findMany.mockResolvedValue([]);
    prisma.transaction.createMany.mockResolvedValue({ count: 1 });
    prisma.$transaction.mockResolvedValue([]);

    const { ensureSubscriptionTransactions, resetSubscriptionTransactionHorizon } = await import(
      '../src/services/subscriptionService'
    );
    resetSubscriptionTransactionHorizon();
    await ensureSubscriptionTransactions(new Date(2026, 0, 31));

    const rows = prisma.transaction.createMany.mock.calls[0][0].data;
    expect(rows[0].date.getDate()).toBe(1);
  });
});
