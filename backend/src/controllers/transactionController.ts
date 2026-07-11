import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import type { Account, Category, Transaction } from '@prisma/client';
import prisma from '../lib/prisma';
import { calculateEffectiveDate } from '../utils/creditCard';
import { ensureSubscriptionTransactions, getSubscriptionHorizon } from '../services/subscriptionService';
import { HttpError } from '../utils/httpError';
import { parsePeriodQuery } from '../utils/period';

const DateString = z.string().refine((value) => !Number.isNaN(new Date(value).getTime()), {
  message: 'Data inválida',
});

const TransactionSchema = z.object({
  description: z.string().min(1, 'Descrição é obrigatória'),
  amount: z.number().positive('Valor deve ser positivo'),
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
    const { accountId, categoryId, type } = req.query;
    const { month, year } = parsePeriodQuery(req.query);

    const where: Record<string, unknown> = {};

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
    if (type) where.type = type as string;

    const transactions = await prisma.transaction.findMany({
      where,
      include: { account: true, category: true, subscription: true },
      orderBy: { effectiveDate: 'desc' },
    });

    res.json(transactions);
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
        amount: data.amount,
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
      if (!existing) {
        existing = await prisma.transaction.findUniqueOrThrow({
          where: { id: req.params.id },
          include: { account: true, category: true },
        });
      }
      const account = data.accountId
        ? await prisma.account.findUniqueOrThrow({ where: { id: data.accountId } })
        : existing.account;
      effectiveDate = calculateEffectiveDate(
        data.date ? new Date(data.date) : existing.date,
        account.type,
        account.closingDay,
        account.dueDay
      );
    }

    if (data.categoryId || data.type) {
      if (!existing) {
        existing = await prisma.transaction.findUniqueOrThrow({
          where: { id: req.params.id },
          include: { account: true, category: true },
        });
      }

      if (data.categoryId) {
        await ensureCategoryMatchesType(data.categoryId, data.type ?? existing.type);
      } else if (existing.category.type !== data.type) {
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
