import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Prisma, type Account, type Category, type Transaction } from '@prisma/client';
import prisma from '../lib/prisma';
import { calculateEffectiveDate } from '../utils/creditCard';
import { ensureSubscriptionTransactions, getSubscriptionHorizon } from '../services/subscriptionService';
import { HttpError } from '../utils/httpError';
import { parsePeriodQuery } from '../utils/period';
import { PositiveMoneyCents } from '../utils/money';
import { decodeDateCursor, encodeDateCursor, parseLimit } from '../utils/pagination';

const DateString = z.string().refine((value) => !Number.isNaN(new Date(value).getTime()), {
  message: 'Data inválida',
});

const TransactionSchema = z.object({
  description: z.string().min(1, 'Descrição é obrigatória'),
  amountCents: PositiveMoneyCents,
  type: z.enum(['INCOME', 'EXPENSE']),
  date: DateString,
  accountId: z.string(),
  categoryId: z.string(),
  isThirdParty: z.boolean().optional(),
  thirdPartyName: z.string().optional().nullable(),
  isReimbursed: z.boolean().optional(),
  notes: z.string().optional(),
});

type TransactionInput = z.infer<typeof TransactionSchema>;
type ExistingTransaction = Transaction & { account: Account; category: Category };

async function ensureCategoryMatchesType(categoryId: string, type: TransactionInput['type']) {
  const category = await prisma.category.findUniqueOrThrow({ where: { id: categoryId } });
  if (category.type !== type) {
    throw new HttpError(
      422,
      'A categoria precisa ter o mesmo tipo da transação',
      'CATEGORY_TYPE_MISMATCH'
    );
  }
}

async function ensureTransactionIsManual(id: string) {
  const transaction = await prisma.transaction.findUniqueOrThrow({
    where: { id },
    select: { installmentGroupId: true, subscriptionId: true },
  });

  if (transaction.installmentGroupId || transaction.subscriptionId) {
    throw new HttpError(
      409,
      'Lançamentos de parcelamentos e assinaturas devem ser gerenciados na página de origem',
      'GENERATED_TRANSACTION'
    );
  }
}

function getThirdPartyData(
  type: TransactionInput['type'],
  isThirdPartyInput?: boolean,
  thirdPartyNameInput?: string | null,
  isReimbursedInput?: boolean
) {
  const isThirdParty = type === 'EXPENSE' && isThirdPartyInput === true;

  return {
    isThirdParty,
    thirdPartyName: isThirdParty ? thirdPartyNameInput?.trim() || null : null,
    isReimbursed: isThirdParty ? isReimbursedInput ?? false : false,
  };
}

export async function getTransactions(req: Request, res: Response, next: NextFunction) {
  try {
    const { accountId, categoryId, type, origin, search } = req.query;
    const { month, year } = parsePeriodQuery(req.query);
    const limit = parseLimit(req.query.limit);
    const cursor = decodeDateCursor(req.query.cursor);

    const where: Prisma.TransactionWhereInput = {};

    if (month !== undefined && year !== undefined) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59, 999);
      where.effectiveDate = { gte: startDate, lte: endDate };
      await ensureSubscriptionTransactions(endDate);
    } else {
      await ensureSubscriptionTransactions(getSubscriptionHorizon());
    }

    if (accountId) where.accountId = accountId as string;
    if (categoryId) where.categoryId = categoryId as string;
    if (type === 'INCOME' || type === 'EXPENSE') where.type = type;
    if (typeof search === 'string' && search.trim()) {
      where.OR = [
        { description: { contains: search.trim(), mode: 'insensitive' } },
        { account: { name: { contains: search.trim(), mode: 'insensitive' } } },
        { category: { name: { contains: search.trim(), mode: 'insensitive' } } },
      ];
    }
    if (origin === 'single') where.AND = [{ installmentGroupId: null }, { subscriptionId: null }];
    if (origin === 'installment') where.installmentGroupId = { not: null };
    if (origin === 'subscription') where.subscriptionId = { not: null };
    if (origin === 'thirdParty') where.isThirdParty = true;
    const baseWhere = { ...where };
    let pagedWhere = baseWhere;
    if (cursor) {
      const cursorDate = new Date(cursor.effectiveDate);
      const cursorFilter: Prisma.TransactionWhereInput = {
        OR: [
          { effectiveDate: { lt: cursorDate } },
          { effectiveDate: cursorDate, id: { lt: cursor.id } },
        ],
      };
      pagedWhere = { AND: [baseWhere, cursorFilter] };
    }

    const [transactions, totalCount, groupedTotals] = await Promise.all([
      prisma.transaction.findMany({
        where: pagedWhere,
        include: { account: true, category: true, subscription: true },
        orderBy: [{ effectiveDate: 'desc' }, { id: 'desc' }],
        take: limit + 1,
      }),
      prisma.transaction.count({ where: baseWhere }),
      prisma.transaction.groupBy({ by: ['type'], where: baseWhere, _sum: { amountCents: true } }),
    ]);

    const hasMore = transactions.length > limit;
    const items = hasMore ? transactions.slice(0, limit) : transactions;
    const last = items.at(-1);
    res.json({
      items,
      nextCursor: hasMore && last
        ? encodeDateCursor({ effectiveDate: last.effectiveDate.toISOString(), id: last.id })
        : null,
      totalCount,
      totals: {
        incomeCents: groupedTotals.find((row) => row.type === 'INCOME')?._sum.amountCents ?? 0,
        expenseCents: groupedTotals.find((row) => row.type === 'EXPENSE')?._sum.amountCents ?? 0,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function createTransaction(req: Request, res: Response, next: NextFunction) {
  try {
    const data = TransactionSchema.parse(req.body);

    const account = await prisma.account.findUniqueOrThrow({
      where: { id: data.accountId },
    });
    await ensureCategoryMatchesType(data.categoryId, data.type);

    const purchaseDate = new Date(data.date);
    const effectiveDate = calculateEffectiveDate(
      purchaseDate,
      account.type,
      account.closingDay,
      account.dueDay
    );

    const transaction = await prisma.transaction.create({
      data: {
        description: data.description,
        amountCents: data.amountCents,
        type: data.type,
        date: purchaseDate,
        effectiveDate,
        accountId: data.accountId,
        categoryId: data.categoryId,
        ...getThirdPartyData(
          data.type,
          data.isThirdParty,
          data.thirdPartyName,
          data.isReimbursed
        ),
        notes: data.notes,
      },
      include: { account: true, category: true, subscription: true },
    });

    res.status(201).json(transaction);
  } catch (err) {
    next(err);
  }
}

export async function updateTransaction(req: Request, res: Response, next: NextFunction) {
  try {
    await ensureTransactionIsManual(req.params.id);
    const data = TransactionSchema.partial().parse(req.body);

    let effectiveDate: Date | undefined;
    let existing: ExistingTransaction | undefined;
    const touchesThirdParty =
      data.type ||
      data.isThirdParty !== undefined ||
      data.thirdPartyName !== undefined ||
      data.isReimbursed !== undefined;

    if (data.date || data.accountId || data.categoryId || data.type || touchesThirdParty) {
      existing = await prisma.transaction.findUniqueOrThrow({
        where: { id: req.params.id },
        include: { account: true, category: true },
      });
    }

    if (data.date || data.accountId) {
      const account = data.accountId
        ? await prisma.account.findUniqueOrThrow({ where: { id: data.accountId } })
        : existing!.account;
      effectiveDate = calculateEffectiveDate(
        data.date ? new Date(data.date) : existing!.date,
        account.type,
        account.closingDay,
        account.dueDay
      );
    }

    if (data.categoryId || data.type) {
      if (data.categoryId) {
        await ensureCategoryMatchesType(data.categoryId, data.type ?? existing!.type);
      } else if (existing!.category.type !== data.type) {
        throw new HttpError(
          422,
          'A categoria precisa ter o mesmo tipo da transação',
          'CATEGORY_TYPE_MISMATCH'
        );
      }
    }

    const transaction = await prisma.transaction.update({
      where: { id: req.params.id },
      data: {
        ...data,
        date: data.date ? new Date(data.date) : undefined,
        ...(effectiveDate && { effectiveDate }),
        ...(touchesThirdParty && existing
          ? getThirdPartyData(
              data.type ?? existing.type,
              data.isThirdParty ?? existing.isThirdParty,
              data.thirdPartyName ?? existing.thirdPartyName,
              data.isReimbursed ?? existing.isReimbursed
            )
          : {}),
      },
      include: { account: true, category: true, subscription: true },
    });

    res.json(transaction);
  } catch (err) {
    next(err);
  }
}

export async function deleteTransaction(req: Request, res: Response, next: NextFunction) {
  try {
    await ensureTransactionIsManual(req.params.id);
    await prisma.transaction.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
