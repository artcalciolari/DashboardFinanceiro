import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { addMonths } from 'date-fns';
import prisma from '../lib/prisma';
import {
  ensureSubscriptionTransactions,
  getSubscriptionHorizon,
  resetSubscriptionTransactionHorizon,
} from '../services/subscriptionService';
import { HttpError } from '../utils/httpError';
import { PositiveMoneyCents } from '../utils/money';
import { parsePageQuery } from '../utils/pagination';
import { futureCutoff } from '../utils/businessTime';

const DateString = z.string().refine((value) => !Number.isNaN(new Date(value).getTime()), {
  message: 'Data inválida',
});

const SubscriptionFields = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  amountCents: PositiveMoneyCents,
  startDate: DateString,
  endDate: DateString.nullable().optional(),
  billingDay: z.number().int().min(1).max(31).optional(),
  isActive: z.boolean().optional(),
  accountId: z.string(),
  categoryId: z.string(),
  isThirdParty: z.boolean().optional(),
  thirdPartyName: z.string().nullable().optional(),
  isReimbursed: z.boolean().optional(),
  notes: z.string().nullable().optional(),
});

const SubscriptionSchema = SubscriptionFields.superRefine((data, ctx) => {
  if (data.endDate && new Date(data.endDate) < new Date(data.startDate)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['endDate'],
      message: 'A data final deve ser posterior à data inicial',
    });
  }
});

type SubscriptionInput = z.infer<typeof SubscriptionSchema>;

function normalizeSubscriptionData(data: SubscriptionInput) {
  const startDate = new Date(data.startDate);
  const isThirdParty = data.isThirdParty === true;

  return {
    name: data.name,
    amountCents: data.amountCents,
    startDate,
    endDate: data.endDate ? new Date(data.endDate) : null,
    billingDay: data.billingDay ?? startDate.getDate(),
    isActive: data.isActive ?? true,
    accountId: data.accountId,
    categoryId: data.categoryId,
    isThirdParty,
    thirdPartyName: isThirdParty ? data.thirdPartyName?.trim() || null : null,
    isReimbursed: isThirdParty ? data.isReimbursed ?? false : false,
    notes: data.notes ?? null,
  };
}

async function ensureExpenseCategory(categoryId: string) {
  const category = await prisma.category.findUniqueOrThrow({ where: { id: categoryId } });
  if (category.type !== 'EXPENSE') {
    throw new HttpError(422, 'Assinaturas devem usar uma categoria de despesa', 'CATEGORY_TYPE_MISMATCH');
  }
}

function parseAsOf(value: unknown) {
  const asOf = typeof value === 'string' ? new Date(value) : new Date();
  if (Number.isNaN(asOf.getTime())) throw new HttpError(422, 'Data de referência inválida', 'INVALID_AS_OF');
  return asOf;
}

export async function getSubscriptions(req: Request, res: Response, next: NextFunction) {
  try {
    const { page, pageSize, skip } = parsePageQuery(req.query);
    const asOf = parseAsOf(req.query.asOf);
    const horizon = getSubscriptionHorizon();
    await ensureSubscriptionTransactions(asOf > horizon ? addMonths(asOf, 1) : horizon);

    const [subscriptions, total, activeCount, personalAggregate, thirdPartyAggregate] = await Promise.all([
      prisma.subscription.findMany({
        include: { account: true, category: true },
        orderBy: [{ isActive: 'desc' }, { name: 'asc' }, { id: 'asc' }],
        skip,
        take: pageSize,
      }),
      prisma.subscription.count(),
      prisma.subscription.count({ where: { isActive: true } }),
      prisma.subscription.aggregate({
        where: { isActive: true, isThirdParty: false },
        _sum: { amountCents: true },
      }),
      prisma.subscription.aggregate({
        where: { isActive: true, isThirdParty: true },
        _sum: { amountCents: true },
      }),
    ]);

    const ids = subscriptions.map((subscription) => subscription.id);
    const [futureTransactions, occurrenceCounts] = ids.length > 0
      ? await Promise.all([
          prisma.transaction.findMany({
            where: { subscriptionId: { in: ids }, effectiveDate: { gt: asOf } },
            orderBy: [{ effectiveDate: 'asc' }, { id: 'asc' }],
          }),
          prisma.transaction.groupBy({
            by: ['subscriptionId'],
            where: { subscriptionId: { in: ids } },
            _count: { _all: true },
          }),
        ])
      : [[], []];

    const nextBySubscription = new Map<string, (typeof futureTransactions)[number]>();
    for (const transaction of futureTransactions) {
      if (transaction.subscriptionId && !nextBySubscription.has(transaction.subscriptionId)) {
        nextBySubscription.set(transaction.subscriptionId, transaction);
      }
    }
    const countBySubscription = new Map(
      occurrenceCounts.flatMap((row) => row.subscriptionId ? [[row.subscriptionId, row._count._all] as const] : [])
    );

    const items = subscriptions.map((subscription) => ({
      ...subscription,
      occurrenceCount: countBySubscription.get(subscription.id) ?? 0,
      nextTransaction: nextBySubscription.get(subscription.id) ?? null,
    }));

    res.json({
      items,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
      summary: {
        activeCount,
        monthlyTotalCents: personalAggregate._sum.amountCents ?? 0,
        thirdPartyTotalCents: thirdPartyAggregate._sum.amountCents ?? 0,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getSubscriptionTransactions(req: Request, res: Response, next: NextFunction) {
  try {
    const { page, pageSize, skip } = parsePageQuery(req.query);
    const where = { subscriptionId: req.params.id };
    const [items, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: { account: true, category: true },
        orderBy: [{ effectiveDate: 'desc' }, { id: 'desc' }],
        skip,
        take: pageSize,
      }),
      prisma.transaction.count({ where }),
    ]);
    res.json({ items, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } });
  } catch (err) {
    next(err);
  }
}

export async function createSubscription(req: Request, res: Response, next: NextFunction) {
  try {
    const data = normalizeSubscriptionData(SubscriptionSchema.parse(req.body));
    await ensureExpenseCategory(data.categoryId);

    const subscription = await prisma.subscription.create({
      data,
      include: { account: true, category: true },
    });

    resetSubscriptionTransactionHorizon();
    await ensureSubscriptionTransactions(getSubscriptionHorizon());
    res.status(201).json(subscription);
  } catch (err) {
    next(err);
  }
}

export async function updateSubscription(req: Request, res: Response, next: NextFunction) {
  try {
    const patch = SubscriptionFields.partial().parse(req.body);
    const existing = await prisma.subscription.findUniqueOrThrow({ where: { id: req.params.id } });
    const merged = SubscriptionSchema.parse({
      name: existing.name,
      amountCents: existing.amountCents,
      startDate: existing.startDate.toISOString(),
      endDate: existing.endDate?.toISOString() ?? null,
      billingDay: existing.billingDay,
      isActive: existing.isActive,
      accountId: existing.accountId,
      categoryId: existing.categoryId,
      isThirdParty: existing.isThirdParty,
      thirdPartyName: existing.thirdPartyName,
      isReimbursed: existing.isReimbursed,
      notes: existing.notes,
      ...patch,
    });
    const data = normalizeSubscriptionData(merged);
    await ensureExpenseCategory(data.categoryId);

    const [subscription] = await prisma.$transaction([
      prisma.subscription.update({
        where: { id: req.params.id },
        data,
        include: { account: true, category: true },
      }),
      prisma.transaction.deleteMany({
        where: { subscriptionId: req.params.id, effectiveDate: { gte: futureCutoff() } },
      }),
    ]);

    resetSubscriptionTransactionHorizon();
    await ensureSubscriptionTransactions(getSubscriptionHorizon());
    res.json(subscription);
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
          ...(mode === 'future' ? { effectiveDate: { gte: futureCutoff() } } : {}),
        },
      });
      await tx.transaction.updateMany({
        where: { subscriptionId: req.params.id },
        data: { subscriptionId: null, subscriptionYear: null, subscriptionMonth: null },
      });
      await tx.subscription.delete({ where: { id: req.params.id } });
    });

    resetSubscriptionTransactionHorizon();
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
