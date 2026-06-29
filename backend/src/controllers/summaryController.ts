import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { ensureSubscriptionTransactions } from '../services/subscriptionService';

function getPeriodDates(month: number, year: number) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);
  return { startDate, endDate };
}

export async function getMonthlySummary(req: Request, res: Response, next: NextFunction) {
  try {
    const now = new Date();
    const month = req.query.month ? Number(req.query.month) : now.getMonth() + 1;
    const year = req.query.year ? Number(req.query.year) : now.getFullYear();
    const { startDate, endDate } = getPeriodDates(month, year);

    await ensureSubscriptionTransactions(endDate);

    const transactions = await prisma.transaction.findMany({
      where: { effectiveDate: { gte: startDate, lte: endDate } },
    });

    const totalIncome = transactions
      .filter((t) => t.type === 'INCOME')
      .reduce((sum, t) => sum + t.amount, 0);

    const invoiceExpenses = transactions
      .filter((t) => t.type === 'EXPENSE')
      .reduce((sum, t) => sum + t.amount, 0);
    const thirdPartyExpenses = transactions
      .filter((t) => t.type === 'EXPENSE' && t.isThirdParty)
      .reduce((sum, t) => sum + t.amount, 0);
    const receivableAmount = transactions
      .filter((t) => t.type === 'EXPENSE' && t.isThirdParty && !t.isReimbursed)
      .reduce((sum, t) => sum + t.amount, 0);
    const totalExpenses = invoiceExpenses - thirdPartyExpenses;

    res.json({
      totalIncome,
      totalExpenses,
      invoiceExpenses,
      thirdPartyExpenses,
      receivableAmount,
      balance: totalIncome - totalExpenses,
      month,
      year,
    });
  } catch (err) {
    next(err);
  }
}

export async function getCategorySummary(req: Request, res: Response, next: NextFunction) {
  try {
    const now = new Date();
    const month = req.query.month ? Number(req.query.month) : now.getMonth() + 1;
    const year = req.query.year ? Number(req.query.year) : now.getFullYear();
    const { startDate, endDate } = getPeriodDates(month, year);

    await ensureSubscriptionTransactions(endDate);

    const grouped = await prisma.transaction.groupBy({
      by: ['categoryId', 'type'],
      where: { effectiveDate: { gte: startDate, lte: endDate }, isThirdParty: false },
      _sum: { amount: true },
    });

    const categories = await prisma.category.findMany();
    const catMap = Object.fromEntries(categories.map((c) => [c.id, c]));

    const result = grouped.map((r) => ({
      category: catMap[r.categoryId],
      type: r.type,
      total: r._sum.amount ?? 0,
    }));

    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getMonthlyEvolution(req: Request, res: Response, next: NextFunction) {
  try {
    const months = 6;
    const now = new Date();
    const result = [];

    for (let i = months - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const { startDate, endDate } = getPeriodDates(
        date.getMonth() + 1,
        date.getFullYear()
      );

      await ensureSubscriptionTransactions(endDate);

      const transactions = await prisma.transaction.findMany({
        where: { effectiveDate: { gte: startDate, lte: endDate } },
      });

      const income = transactions
        .filter((t) => t.type === 'INCOME')
        .reduce((s, t) => s + t.amount, 0);
      const expenses = transactions
        .filter((t) => t.type === 'EXPENSE' && !t.isThirdParty)
        .reduce((s, t) => s + t.amount, 0);

      result.push({
        month: date.getMonth() + 1,
        year: date.getFullYear(),
        label: date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
        income,
        expenses,
      });
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getAccountSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const now = new Date();
    const month = req.query.month ? Number(req.query.month) : now.getMonth() + 1;
    const year = req.query.year ? Number(req.query.year) : now.getFullYear();
    const { startDate, endDate } = getPeriodDates(month, year);

    await ensureSubscriptionTransactions(endDate);

    const accounts = await prisma.account.findMany();

    const result = await Promise.all(
      accounts.map(async (account) => {
        const transactions = await prisma.transaction.findMany({
          where: { accountId: account.id, effectiveDate: { gte: startDate, lte: endDate } },
        });

        const income = transactions
          .filter((t) => t.type === 'INCOME')
          .reduce((s, t) => s + t.amount, 0);
        const invoiceExpenses = transactions
          .filter((t) => t.type === 'EXPENSE')
          .reduce((s, t) => s + t.amount, 0);
        const thirdPartyExpenses = transactions
          .filter((t) => t.type === 'EXPENSE' && t.isThirdParty)
          .reduce((s, t) => s + t.amount, 0);
        const receivableAmount = transactions
          .filter((t) => t.type === 'EXPENSE' && t.isThirdParty && !t.isReimbursed)
          .reduce((s, t) => s + t.amount, 0);
        const expenses = invoiceExpenses - thirdPartyExpenses;

        return {
          account,
          income,
          expenses,
          invoiceExpenses,
          thirdPartyExpenses,
          receivableAmount,
          net: income - expenses,
        };
      })
    );

    res.json(result);
  } catch (err) {
    next(err);
  }
}
