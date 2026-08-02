import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { startOfMonth, endOfMonth } from 'date-fns';
import prisma from '../lib/prisma';
import { ensureSubscriptionTransactions } from '../services/subscriptionService';
import { HttpError } from '../utils/httpError';
import { PositiveMoneyCents } from '../utils/money';
import { alertWeekRange } from '../utils/businessTime';

const AlertSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  categoryId: z.string(),
  limitAmountCents: PositiveMoneyCents,
  period: z.enum(['MONTHLY', 'WEEKLY']),
  isActive: z.boolean().optional(),
});

async function ensureExpenseCategory(categoryId: string) {
  const category = await prisma.category.findUniqueOrThrow({ where: { id: categoryId } });
  if (category.type !== 'EXPENSE') {
    throw new HttpError(422, 'Alertas devem usar uma categoria de despesa', 'CATEGORY_TYPE_MISMATCH');
  }
}

export async function getAlerts(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await prisma.alert.findMany({ include: { category: true }, orderBy: { createdAt: 'asc' } }));
  } catch (err) { next(err); }
}

export async function createAlert(req: Request, res: Response, next: NextFunction) {
  try {
    const data = AlertSchema.parse(req.body);
    await ensureExpenseCategory(data.categoryId);
    res.status(201).json(await prisma.alert.create({ data, include: { category: true } }));
  } catch (err) { next(err); }
}

export async function updateAlert(req: Request, res: Response, next: NextFunction) {
  try {
    const data = AlertSchema.partial().parse(req.body);
    if (data.categoryId) await ensureExpenseCategory(data.categoryId);
    res.json(await prisma.alert.update({ where: { id: req.params.id }, data, include: { category: true } }));
  } catch (err) { next(err); }
}

export async function deleteAlert(req: Request, res: Response, next: NextFunction) {
  try {
    await prisma.alert.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) { next(err); }
}

export async function checkAlerts(_req: Request, res: Response, next: NextFunction) {
  try {
    const alerts = await prisma.alert.findMany({ where: { isActive: true }, include: { category: true } });
    const now = new Date();
    const monthlyRange = { gte: startOfMonth(now), lte: endOfMonth(now) };
    const week = alertWeekRange(now);
    const weeklyRange = { gte: week.startDate, lte: week.endDate };
    await ensureSubscriptionTransactions(monthlyRange.lte);
    const baseWhere = { type: 'EXPENSE' as const, isThirdParty: false };
    const [monthly, weekly] = await Promise.all([
      prisma.transaction.groupBy({
        by: ['categoryId'], where: { ...baseWhere, effectiveDate: monthlyRange }, _sum: { amountCents: true },
      }),
      prisma.transaction.groupBy({
        by: ['categoryId'], where: { ...baseWhere, effectiveDate: weeklyRange }, _sum: { amountCents: true },
      }),
    ]);
    const monthlyByCategory = new Map(monthly.map((row) => [row.categoryId, row._sum.amountCents ?? 0]));
    const weeklyByCategory = new Map(weekly.map((row) => [row.categoryId, row._sum.amountCents ?? 0]));
    res.json(alerts.map((alert) => {
      const currentAmountCents = (alert.period === 'WEEKLY' ? weeklyByCategory : monthlyByCategory)
        .get(alert.categoryId) ?? 0;
      const percentage = (currentAmountCents / alert.limitAmountCents) * 100;
      return {
        ...alert,
        currentAmountCents,
        percentage,
        isTriggered: currentAmountCents >= alert.limitAmountCents,
        isWarning: percentage >= 80 && percentage < 100,
      };
    }));
  } catch (err) { next(err); }
}
