import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { ensureSubscriptionTransactions } from '../services/subscriptionService';
import { parsePeriodQuery } from '../utils/period';

function getPeriodDates(month: number, year: number) {
  return {
    startDate: new Date(year, month - 1, 1),
    endDate: new Date(year, month, 0, 23, 59, 59, 999),
  };
}

function getRequestedPeriod(req: Request) {
  const now = new Date();
  const period = parsePeriodQuery(req.query);
  const month = period.month ?? now.getMonth() + 1;
  const year = period.year ?? now.getFullYear();
  return { month, year, ...getPeriodDates(month, year) };
}

interface Totals {
  incomeCents: number;
  invoiceExpensesCents: number;
  thirdPartyExpensesCents: number;
  receivableCents: number;
}

function emptyTotals(): Totals {
  return { incomeCents: 0, invoiceExpensesCents: 0, thirdPartyExpensesCents: 0, receivableCents: 0 };
}

function addTransaction(totals: Totals, transaction: {
  type: 'INCOME' | 'EXPENSE'; amountCents: number; isThirdParty: boolean; isReimbursed: boolean;
}) {
  if (transaction.type === 'INCOME') {
    totals.incomeCents += transaction.amountCents;
    return;
  }
  totals.invoiceExpensesCents += transaction.amountCents;
  if (transaction.isThirdParty) {
    totals.thirdPartyExpensesCents += transaction.amountCents;
    if (!transaction.isReimbursed) totals.receivableCents += transaction.amountCents;
  }
}

function serializeTotals(totals: Totals) {
  const expensesCents = totals.invoiceExpensesCents - totals.thirdPartyExpensesCents;
  return { ...totals, expensesCents, netCents: totals.incomeCents - expensesCents };
}

export async function getMonthlySummary(req: Request, res: Response, next: NextFunction) {
  try {
    const { month, year, startDate, endDate } = getRequestedPeriod(req);
    await ensureSubscriptionTransactions(endDate);
    const transactions = await prisma.transaction.findMany({
      where: { effectiveDate: { gte: startDate, lte: endDate } },
      select: { type: true, amountCents: true, isThirdParty: true, isReimbursed: true },
    });
    const totals = emptyTotals();
    for (const transaction of transactions) addTransaction(totals, transaction);
    res.json({
      totalIncomeCents: totals.incomeCents,
      totalExpensesCents: totals.invoiceExpensesCents - totals.thirdPartyExpensesCents,
      invoiceExpensesCents: totals.invoiceExpensesCents,
      thirdPartyExpensesCents: totals.thirdPartyExpensesCents,
      receivableAmountCents: totals.receivableCents,
      balanceCents: totals.incomeCents - (totals.invoiceExpensesCents - totals.thirdPartyExpensesCents),
      month,
      year,
    });
  } catch (err) {
    next(err);
  }
}

export async function getCategorySummary(req: Request, res: Response, next: NextFunction) {
  try {
    const { startDate, endDate } = getRequestedPeriod(req);
    await ensureSubscriptionTransactions(endDate);
    const [grouped, categories] = await Promise.all([
      prisma.transaction.groupBy({
        by: ['categoryId', 'type'],
        where: { effectiveDate: { gte: startDate, lte: endDate }, isThirdParty: false },
        _sum: { amountCents: true },
      }),
      prisma.category.findMany(),
    ]);
    const categoryById = new Map(categories.map((category) => [category.id, category]));
    res.json(grouped.map((row) => ({
      category: categoryById.get(row.categoryId),
      type: row.type,
      totalCents: row._sum.amountCents ?? 0,
    })));
  } catch (err) {
    next(err);
  }
}

export async function getMonthlyEvolution(req: Request, res: Response, next: NextFunction) {
  try {
    const months = 6;
    const now = new Date();
    const periods = Array.from({ length: months }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (months - 1 - index), 1);
      return { month: date.getMonth() + 1, year: date.getFullYear(), date, totals: emptyTotals() };
    });
    const first = periods[0];
    const last = periods.at(-1)!;
    const startDate = getPeriodDates(first.month, first.year).startDate;
    const endDate = getPeriodDates(last.month, last.year).endDate;
    await ensureSubscriptionTransactions(endDate);
    const transactions = await prisma.transaction.findMany({
      where: { effectiveDate: { gte: startDate, lte: endDate } },
      select: { effectiveDate: true, type: true, amountCents: true, isThirdParty: true, isReimbursed: true },
    });
    const totalsByPeriod = new Map(periods.map((period) => [`${period.year}-${period.month}`, period.totals]));
    for (const transaction of transactions) {
      const key = `${transaction.effectiveDate.getFullYear()}-${transaction.effectiveDate.getMonth() + 1}`;
      const totals = totalsByPeriod.get(key);
      if (totals) addTransaction(totals, transaction);
    }
    res.json(periods.map((period) => ({
      month: period.month,
      year: period.year,
      label: period.date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
      incomeCents: period.totals.incomeCents,
      expensesCents: period.totals.invoiceExpensesCents - period.totals.thirdPartyExpensesCents,
    })));
  } catch (err) {
    next(err);
  }
}

export async function getAccountSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const { startDate, endDate } = getRequestedPeriod(req);
    await ensureSubscriptionTransactions(endDate);
    const [accounts, transactions] = await Promise.all([
      prisma.account.findMany(),
      prisma.transaction.findMany({
        where: { effectiveDate: { gte: startDate, lte: endDate } },
        select: { accountId: true, type: true, amountCents: true, isThirdParty: true, isReimbursed: true },
      }),
    ]);
    const totalsByAccount = new Map(accounts.map((account) => [account.id, emptyTotals()]));
    for (const transaction of transactions) {
      const totals = totalsByAccount.get(transaction.accountId);
      if (totals) addTransaction(totals, transaction);
    }
    res.json(accounts.map((account) => ({ account, ...serializeTotals(totalsByAccount.get(account.id)!) })));
  } catch (err) {
    next(err);
  }
}
