import { addMonths } from 'date-fns';
import type { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { calculateEffectiveDate } from '../utils/creditCard';

function clampDay(year: number, month: number, day: number) {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return Math.min(Math.max(day, 1), lastDay);
}

function getOccurrenceDate(baseDate: Date, billingDay: number) {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  return new Date(year, month, clampDay(year, month, billingDay), 12, 0, 0);
}

function atNoon(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0);
}

function endOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function isSameMonth(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth();
}

function hasNoManualUpdates(createdAt: Date, updatedAt: Date) {
  return Math.abs(updatedAt.getTime() - createdAt.getTime()) < 1000;
}

export function getSubscriptionHorizon(monthsAhead = 12) {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + monthsAhead + 1, 0, 23, 59, 59);
}

export async function ensureSubscriptionTransactions(untilDate: Date) {
  const subscriptions = await prisma.subscription.findMany({
    where: {
      isActive: true,
      startDate: { lte: untilDate },
    },
    include: { account: true },
  });

  if (subscriptions.length === 0) return;

  const existingTransactions = await prisma.transaction.findMany({
    where: {
      subscriptionId: { in: subscriptions.map((subscription) => subscription.id) },
      subscriptionYear: { not: null },
      subscriptionMonth: { not: null },
    },
    select: {
      subscriptionId: true,
      subscriptionYear: true,
      subscriptionMonth: true,
      id: true,
      date: true,
      effectiveDate: true,
      isReimbursed: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  const existingTransactionsByKey = new Map<string, (typeof existingTransactions)[number]>(
    existingTransactions.map(
      (transaction) =>
        [
          `${transaction.subscriptionId}:${transaction.subscriptionYear}:${transaction.subscriptionMonth}`,
          transaction,
        ] as const
    )
  );
  const transactionUpdates: Prisma.PrismaPromise<unknown>[] = [];

  const transactionsData = subscriptions.flatMap((subscription) => {
    const occurrences = [];
    const startDate = atNoon(subscription.startDate);
    const endDate = subscription.endDate ? endOfDay(subscription.endDate) : null;
    let cursor = new Date(
      startDate.getFullYear(),
      startDate.getMonth(),
      1,
      12,
      0,
      0
    );
    const untilMonth = new Date(untilDate.getFullYear(), untilDate.getMonth(), 1, 12, 0, 0);

    while (cursor <= untilMonth) {
      const isStartMonth = isSameMonth(cursor, startDate);
      const purchaseDate =
        isStartMonth && startDate.getDate() > subscription.billingDay
          ? startDate
          : getOccurrenceDate(cursor, subscription.billingDay);

      if (purchaseDate >= startDate && (!endDate || purchaseDate <= endDate)) {
        const effectiveDate = calculateEffectiveDate(
          purchaseDate,
          subscription.account.type,
          subscription.account.closingDay,
          subscription.account.dueDay
        );
        const month = purchaseDate.getMonth() + 1;
        const year = purchaseDate.getFullYear();
        const key = `${subscription.id}:${year}:${month}`;
        const isInitialOccurrence = isSameMonth(purchaseDate, startDate);
        const expectedIsReimbursed =
          subscription.isThirdParty && isInitialOccurrence ? subscription.isReimbursed : false;
        const existingTransaction = existingTransactionsByKey.get(key);

        if (existingTransaction) {
          const updateData: Prisma.TransactionUpdateInput = {};

          if (existingTransaction.date.getTime() !== purchaseDate.getTime()) {
            updateData.date = purchaseDate;
          }
          if (existingTransaction.effectiveDate.getTime() !== effectiveDate.getTime()) {
            updateData.effectiveDate = effectiveDate;
          }
          if (
            !isInitialOccurrence &&
            subscription.isThirdParty &&
            subscription.isReimbursed &&
            existingTransaction.isReimbursed &&
            hasNoManualUpdates(existingTransaction.createdAt, existingTransaction.updatedAt)
          ) {
            updateData.isReimbursed = false;
          }

          if (Object.keys(updateData).length > 0) {
            transactionUpdates.push(
              prisma.transaction.update({
                where: { id: existingTransaction.id },
                data: updateData,
              })
            );
          }

          cursor = addMonths(cursor, 1);
          continue;
        }

        occurrences.push({
          description: `${subscription.name} (${String(month).padStart(2, '0')}/${year})`,
          amount: subscription.amount,
          type: 'EXPENSE' as const,
          date: purchaseDate,
          effectiveDate,
          accountId: subscription.accountId,
          categoryId: subscription.categoryId,
          subscriptionId: subscription.id,
          subscriptionYear: year,
          subscriptionMonth: month,
          isThirdParty: subscription.isThirdParty,
          thirdPartyName: subscription.isThirdParty ? subscription.thirdPartyName : null,
          isReimbursed: expectedIsReimbursed,
          notes: subscription.notes,
        });
      }

      cursor = addMonths(cursor, 1);
    }

    return occurrences;
  });

  const writeOperations: Prisma.PrismaPromise<unknown>[] = [...transactionUpdates];

  if (transactionsData.length > 0) {
    writeOperations.push(
      prisma.transaction.createMany({
        data: transactionsData,
      })
    );
  }

  if (writeOperations.length === 0) return;

  await prisma.$transaction(writeOperations);
}
