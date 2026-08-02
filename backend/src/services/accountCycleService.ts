import { addMonths } from 'date-fns';
import prisma from '../lib/prisma';
import { calculateEffectiveDate } from '../utils/creditCard';

export async function recalculateAccountEffectiveDates(accountId: string, from: Date) {
  const [account, manualTransactions, installmentGroups] = await Promise.all([
    prisma.account.findUniqueOrThrow({ where: { id: accountId } }),
    prisma.transaction.findMany({
      where: {
        accountId,
        installmentGroupId: null,
        subscriptionId: null,
        OR: [{ effectiveDate: { gte: from } }, { date: { gte: addMonths(from, -1) } }],
      },
      select: { id: true, date: true, effectiveDate: true },
    }),
    prisma.installmentGroup.findMany({
      where: { accountId },
      include: {
        transactions: {
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
    if (transaction.effectiveDate < from && nextDate < from) return [];
    return prisma.transaction.update({ where: { id: transaction.id }, data: { effectiveDate: nextDate } });
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
      if (transaction.effectiveDate < from && nextDate < from) continue;
      updates.push(
        prisma.transaction.update({ where: { id: transaction.id }, data: { effectiveDate: nextDate } })
      );
    }
  }

  if (updates.length > 0) await prisma.$transaction(updates);
}
