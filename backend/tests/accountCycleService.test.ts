import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPrismaMock } from './helpers/prismaMock';

const prisma = createPrismaMock();

vi.mock('../src/lib/prisma', () => ({ default: prisma }));

describe('accountCycleService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates mutable manual and installment effective dates', async () => {
    const from = new Date(2026, 7, 1);
    prisma.account.findUniqueOrThrow.mockResolvedValue({
      id: 'acc',
      type: 'CREDIT_CARD',
      closingDay: 10,
      dueDay: 20,
    });
    prisma.transaction.findMany.mockResolvedValue([
      {
        id: 'm1',
        date: new Date(2026, 7, 5, 12),
        effectiveDate: new Date(2026, 7, 20, 12),
      },
      {
        id: 'skip',
        date: new Date(2026, 5, 5, 12),
        effectiveDate: new Date(2026, 5, 20, 12),
      },
    ]);
    prisma.installmentGroup.findMany.mockResolvedValue([
      {
        id: 'g1',
        startDate: new Date(2026, 0, 5, 12),
        transactions: [
          { id: 'i1', installmentNumber: 1, effectiveDate: new Date(2026, 7, 20, 12) },
          { id: 'i2', installmentNumber: null, effectiveDate: new Date(2026, 8, 20, 12) },
          { id: 'i3', installmentNumber: 3, effectiveDate: new Date(2026, 2, 20, 12) },
        ],
      },
    ]);
    prisma.transaction.update.mockResolvedValue({});
    prisma.$transaction.mockResolvedValue([]);

    const { recalculateAccountEffectiveDates } = await import('../src/services/accountCycleService');
    await recalculateAccountEffectiveDates('acc', from);

    expect(prisma.transaction.update).toHaveBeenCalled();
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.transaction.update.mock.calls.some((call) => call[0].where.id === 'i2')).toBe(true);
    expect(prisma.transaction.update.mock.calls.some((call) => call[0].where.id === 'i3')).toBe(false);
  });

  it('skips the write when no dates change into the mutable window', async () => {
    const from = new Date(2026, 7, 1);
    prisma.account.findUniqueOrThrow.mockResolvedValue({
      id: 'acc',
      type: 'BANK_ACCOUNT',
      closingDay: null,
      dueDay: null,
    });
    prisma.transaction.findMany.mockResolvedValue([
      {
        id: 'old',
        date: new Date(2026, 4, 5, 12),
        effectiveDate: new Date(2026, 4, 5, 12),
      },
    ]);
    prisma.installmentGroup.findMany.mockResolvedValue([]);

    const { recalculateAccountEffectiveDates } = await import('../src/services/accountCycleService');
    await recalculateAccountEffectiveDates('acc', from);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
