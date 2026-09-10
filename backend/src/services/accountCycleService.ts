import { addMonths } from 'date-fns';
import type { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { calculateEffectiveDate } from '../utils/creditCard';

export async function recalculateAccountEffectiveDates(accountId: string, from: Date, db: Prisma.TransactionClient = prisma) {
  const [account, manualTransactions, installmentGroups] = await Promise.all([
    db.account.findUniqueOrThrow({ where: { id: accountId } }),
    db.transaction.findMany({
      where: {
        accountId,
        installmentGroupId: null,
        subscriptionId: null,
        paidAt: null,
        reimbursedAmountCents: 0,
        OR: [{ effectiveDate: { gte: from } }, { date: { gte: addMonths(from, -1) } }],
      },
      select: { id: true, date: true, effectiveDate: true },
    }),
    db.installmentGroup.findMany({
      where: { accountId },
      include: {
        transactions: {
          where: { paidAt: null, reimbursedAmountCents: 0 },
          orderBy: { installmentNumber: 'asc' },
          select: { id: true, installmentNumber: true, effectiveDate: true },
        },
      },
    }),
  ]);

  const updates = manualTransactions.flatMap((transaction) => {
    const nextDate = calculateEffectiveDate(
      transaction.date,
      account.type,
      account.closingDay,
      account.dueDay
    );
    if (transaction.effectiveDate < from || nextDate < from) return [];
    return db.transaction.update({ where: { id: transaction.id }, data: { effectiveDate: nextDate } });
  });

  for (const group of installmentGroups) {
    const firstPaymentDate = calculateEffectiveDate(
      group.startDate,
      account.type,
      account.closingDay,
      account.dueDay
    );
    for (const [index, transaction] of group.transactions.entries()) {
      const number = transaction.installmentNumber ?? index + 1;
      const nextDate = addMonths(firstPaymentDate, number - 1);
      if (transaction.effectiveDate < from || nextDate < from) continue;
      updates.push(
        db.transaction.update({ where: { id: transaction.id }, data: { effectiveDate: nextDate } })
      );
    }
  }

  if (updates.length > 0) {
    if (db === prisma) await prisma.$transaction(updates);
    else await Promise.all(updates);
  }
}
