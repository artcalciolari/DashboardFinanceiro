import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import prisma from '../lib/prisma';
import { ensureSubscriptionTransactions } from '../services/subscriptionService';

const AlertSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  categoryId: z.string(),
  limitAmount: z.number().positive('Limite deve ser positivo'),
  period: z.enum(['MONTHLY', 'WEEKLY']),
  isActive: z.boolean().optional(),
});

export async function getAlerts(req: Request, res: Response, next: NextFunction) {
  try {
    const alerts = await prisma.alert.findMany({
      include: { category: true },
      orderBy: { createdAt: 'asc' },
    });
    res.json(alerts);
  } catch (err) {
    next(err);
  }
}

export async function createAlert(req: Request, res: Response, next: NextFunction) {
  try {
    const data = AlertSchema.parse(req.body);
    const alert = await prisma.alert.create({ data, include: { category: true } });
    res.status(201).json(alert);
  } catch (err) {
    next(err);
  }
}

export async function updateAlert(req: Request, res: Response, next: NextFunction) {
  try {
    const data = AlertSchema.partial().parse(req.body);
    const alert = await prisma.alert.update({
      where: { id: req.params.id },
      data,
      include: { category: true },
    });
    res.json(alert);
  } catch (err) {
    next(err);
  }
}

export async function deleteAlert(req: Request, res: Response, next: NextFunction) {
  try {
    await prisma.alert.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function checkAlerts(req: Request, res: Response, next: NextFunction) {
  try {
    const alerts = await prisma.alert.findMany({
      where: { isActive: true },
      include: { category: true },
    });

    const now = new Date();
    await ensureSubscriptionTransactions(endOfMonth(now));

    const results = await Promise.all(
      alerts.map(async (alert) => {
        const startDate =
          alert.period === 'WEEKLY'
            ? startOfWeek(now, { weekStartsOn: 0 })
            : startOfMonth(now);
        const endDate =
          alert.period === 'WEEKLY'
            ? endOfWeek(now, { weekStartsOn: 0 })
            : endOfMonth(now);

        const agg = await prisma.transaction.aggregate({
          where: {
            categoryId: alert.categoryId,
            type: 'EXPENSE',
            isThirdParty: false,
            effectiveDate: { gte: startDate, lte: endDate },
          },
          _sum: { amount: true },
        });

        const currentAmount = agg._sum.amount ?? 0;
        const percentage = (currentAmount / alert.limitAmount) * 100;

        return {
          ...alert,
          currentAmount,
          percentage,
          isTriggered: currentAmount >= alert.limitAmount,
          isWarning: percentage >= 80 && percentage < 100,
        };
      })
    );

    res.json(results);
  } catch (err) {
    next(err);
  }
}
