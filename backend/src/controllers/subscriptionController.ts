import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { startOfMonth } from 'date-fns';
import prisma from '../lib/prisma';
import { ensureSubscriptionTransactions, getSubscriptionHorizon } from '../services/subscriptionService';

const SubscriptionSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  amount: z.number().positive('Valor deve ser positivo'),
  startDate: z.string(),
  endDate: z.string().nullable().optional(),
  billingDay: z.number().int().min(1).max(31).optional(),
  isActive: z.boolean().optional(),
  accountId: z.string(),
  categoryId: z.string(),
  isThirdParty: z.boolean().optional(),
  thirdPartyName: z.string().nullable().optional(),
  isReimbursed: z.boolean().optional(),
  notes: z.string().optional(),
});

function normalizeSubscriptionData(data: z.infer<typeof SubscriptionSchema>) {
  const startDate = new Date(data.startDate);
  const isThirdParty = data.isThirdParty === true;

  return {
    name: data.name,
    amount: data.amount,
    startDate,
    endDate: data.endDate ? new Date(data.endDate) : null,
    billingDay: data.billingDay ?? startDate.getDate(),
    isActive: data.isActive ?? true,
    accountId: data.accountId,
    categoryId: data.categoryId,
    isThirdParty,
    thirdPartyName: isThirdParty ? data.thirdPartyName?.trim() || null : null,
    isReimbursed: isThirdParty ? data.isReimbursed ?? false : false,
    notes: data.notes,
  };
}

export async function getSubscriptions(req: Request, res: Response, next: NextFunction) {
  try {
    await ensureSubscriptionTransactions(getSubscriptionHorizon());

    const subscriptions = await prisma.subscription.findMany({
      include: {
        account: true,
        category: true,
        transactions: { orderBy: { effectiveDate: 'asc' } },
      },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });

    res.json(subscriptions);
  } catch (err) {
    next(err);
  }
}

export async function createSubscription(req: Request, res: Response, next: NextFunction) {
  try {
    const data = normalizeSubscriptionData(SubscriptionSchema.parse(req.body));

    const subscription = await prisma.subscription.create({
      data,
      include: { account: true, category: true, transactions: true },
    });

    await ensureSubscriptionTransactions(getSubscriptionHorizon());

    const result = await prisma.subscription.findUnique({
      where: { id: subscription.id },
      include: {
        account: true,
        category: true,
        transactions: { orderBy: { effectiveDate: 'asc' } },
      },
    });

    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function updateSubscription(req: Request, res: Response, next: NextFunction) {
  try {
    const data = normalizeSubscriptionData(SubscriptionSchema.parse(req.body));

    await prisma.$transaction([
      prisma.subscription.update({
        where: { id: req.params.id },
        data,
      }),
      prisma.transaction.deleteMany({
        where: {
          subscriptionId: req.params.id,
          effectiveDate: { gte: startOfMonth(new Date()) },
        },
      }),
    ]);

    await ensureSubscriptionTransactions(getSubscriptionHorizon());

    const result = await prisma.subscription.findUnique({
      where: { id: req.params.id },
      include: {
        account: true,
        category: true,
        transactions: { orderBy: { effectiveDate: 'asc' } },
      },
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function deleteSubscription(req: Request, res: Response, next: NextFunction) {
  try {
    const mode = req.query.mode === 'all' ? 'all' : 'future';

    await prisma.$transaction(async (tx) => {
      await tx.transaction.deleteMany({
        where: {
          subscriptionId: req.params.id,
          ...(mode === 'future' ? { effectiveDate: { gte: startOfMonth(new Date()) } } : {}),
        },
      });

      await tx.subscription.delete({ where: { id: req.params.id } });
    });

    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
