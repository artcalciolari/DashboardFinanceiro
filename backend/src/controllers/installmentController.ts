import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { addMonths } from 'date-fns';
import prisma from '../lib/prisma';
import { calculateEffectiveDate } from '../utils/creditCard';
import { HttpError } from '../utils/httpError';
import { PositiveMoneyCents, splitInstallmentCents } from '../utils/money';
import { parsePageQuery } from '../utils/pagination';
import { futureCutoff, mutablePeriodStart } from '../utils/businessTime';
import { financialTransaction } from '../services/financialTransaction';
import { parsePeriodQuery } from '../utils/period';

const DateString = z.string().refine((value) => !Number.isNaN(new Date(value).getTime()), {
  message: 'Data inválida',
});

const InstallmentSchema = z.object({
  description: z.string().min(1, 'Descrição é obrigatória'),
  totalAmountCents: PositiveMoneyCents,
  installmentCount: z.number().int().min(2, 'Mínimo 2 parcelas').max(120, 'Máximo 120 parcelas'),
  startDate: DateString,
  accountId: z.string(),
  categoryId: z.string(),
  isThirdParty: z.boolean().optional(),
  thirdPartyName: z.string().optional().nullable(),
  isReimbursed: z.boolean().optional(),
  notes: z.string().optional(),
});

const UpdatePaymentDateSchema = z.object({
  firstPaymentDate: DateString,
});

export async function getInstallments(req: Request, res: Response, next: NextFunction) {
  try {
    const { page, pageSize, skip } = parsePageQuery(req.query);
    const asOf = typeof req.query.asOf === 'string' ? new Date(req.query.asOf) : new Date();
    if (Number.isNaN(asOf.getTime())) throw new HttpError(422, 'Data de referência inválida', 'INVALID_AS_OF');
    const period = parsePeriodQuery(req.query);
    const activeOnly = req.query.activeOnly === 'true';
    const activeWhere = activeOnly
      ? {
          isCancelled: false,
          transactions: {
            some: { OR: [{ paidAt: null }, { paidAt: { gt: asOf } }] },
          },
        }
      : undefined;

    const [groups, allGroups, total] = await Promise.all([
      prisma.installmentGroup.findMany({
        where: activeWhere,
        include: {
          account: true,
          category: true,
          transactions: { orderBy: [{ installmentNumber: 'asc' }, { effectiveDate: 'asc' }] },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: activeOnly ? 0 : skip,
        take: activeOnly ? 0 : pageSize,
      }),
      prisma.installmentGroup.findMany({
        where: activeWhere,
        select: {
          id: true,
          description: true,
          installmentCount: true,
          isCancelled: true,
          transactions: { select: { id: true, installmentNumber: true, amountCents: true, effectiveDate: true, paidAt: true, reimbursedAmountCents: true }, orderBy: [{ installmentNumber: 'asc' }, { effectiveDate: 'asc' }] },
        },
      }),
      activeOnly ? Promise.resolve(0) : prisma.installmentGroup.count(),
    ]);

    const deletionCutoff = futureCutoff();
    const toItem = (group: (typeof groups)[number] | (typeof allGroups)[number]) => {
      const paidTransactions = group.transactions.filter((transaction) => transaction.paidAt !== null && transaction.paidAt !== undefined && transaction.paidAt <= asOf);
      const unpaidTransactions = group.transactions.filter((transaction) => transaction.paidAt === null || transaction.paidAt === undefined || transaction.paidAt > asOf);
      const futureTransactions = unpaidTransactions.filter((transaction) => transaction.effectiveDate > asOf);
      const overdueTransactions = unpaidTransactions.filter((transaction) => transaction.effectiveDate < new Date(Math.min(Date.now(), asOf.getTime())));
      return {
        ...group,
        transactions: undefined,
        paidCount: paidTransactions.length,
        futureCount: futureTransactions.length,
        overdueCount: overdueTransactions.length,
        historicalCount: group.transactions.filter((transaction) => transaction.effectiveDate < deletionCutoff).length,
        deletableFutureCount: group.transactions.filter((transaction) => transaction.effectiveDate >= deletionCutoff && transaction.paidAt === null && transaction.reimbursedAmountCents === 0).length,
        remainingAmountCents: unpaidTransactions.reduce((sum, transaction) => sum + transaction.amountCents, 0),
        installmentAmountCents: unpaidTransactions[0]?.amountCents ?? group.transactions.at(-1)?.amountCents ?? 0,
        firstTransaction: group.transactions[0] ?? null,
        nextTransaction: unpaidTransactions[0] ?? null,
        lastTransaction: group.transactions.at(-1) ?? null,
      };
    };
    const items = groups.map(toItem);

    const aggregateItems = allGroups
      .map(toItem)
      .filter((item) => !item.isCancelled && item.nextTransaction !== null && item.paidCount < (item.installmentCount ?? 0))
      .sort((a, b) => {
        const nextA = a.nextTransaction!.effectiveDate.getTime();
        const nextB = b.nextTransaction!.effectiveDate.getTime();
        return nextA - nextB || a.description.localeCompare(b.description);
      });
    const selectedMonth = period.month ?? asOf.getMonth() + 1;
    const selectedYear = period.year ?? asOf.getFullYear();
    const monthStart = new Date(selectedYear, selectedMonth - 1, 1);
    const monthEnd = new Date(selectedYear, selectedMonth, 0, 23, 59, 59, 999);
    const committedMonthlyCents = allGroups
      .filter((group) => !group.isCancelled)
      .flatMap((group) => group.transactions)
      .filter((transaction) => {
        const unpaid = transaction.paidAt === null || transaction.paidAt === undefined || transaction.paidAt > asOf;
        return unpaid && transaction.effectiveDate >= monthStart && transaction.effectiveDate <= monthEnd;
      })
      .reduce((sum, transaction) => sum + transaction.amountCents, 0);
    let responseItems = items;
    if (activeOnly) {
      const selectedIds = aggregateItems.slice(skip, skip + pageSize).map((item) => item.id);
      const selectedGroups = await prisma.installmentGroup.findMany({
        where: { id: { in: selectedIds } },
        include: {
          account: true,
          category: true,
          transactions: { orderBy: [{ installmentNumber: 'asc' }, { effectiveDate: 'asc' }] },
        },
      });
      const selectedById = new Map(selectedGroups.map((group) => [group.id, toItem(group)]));
      responseItems = selectedIds.map((id) => selectedById.get(id)).filter((item): item is (typeof items)[number] => item !== undefined);
    }
    res.json({
      items: responseItems,
      pagination: { page, pageSize, total: activeOnly ? aggregateItems.length : total, totalPages: Math.ceil((activeOnly ? aggregateItems.length : total) / pageSize) },
      aggregates: {
        activeCount: aggregateItems.length,
        remainingAmountCents: aggregateItems.reduce((sum, item) => sum + item.remainingAmountCents, 0),
        committedMonthlyCents,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function createInstallment(req: Request, res: Response, next: NextFunction) {
  try {
    const data = InstallmentSchema.parse(req.body);
    const account = await prisma.account.findUniqueOrThrow({ where: { id: data.accountId } });
    const category = await prisma.category.findUniqueOrThrow({ where: { id: data.categoryId } });

    if (category.type !== 'EXPENSE') {
      throw new HttpError(422, 'Parcelamentos devem usar uma categoria de despesa', 'CATEGORY_TYPE_MISMATCH');
    }

    if (data.totalAmountCents < data.installmentCount) {
      throw new HttpError(422, 'Cada parcela precisa ter pelo menos um centavo', 'INSTALLMENT_TOO_SMALL');
    }
    const installmentAmounts = splitInstallmentCents(data.totalAmountCents, data.installmentCount);
    const startDate = new Date(data.startDate);
    const isThirdParty = data.isThirdParty === true;

    // Calcula a data de vencimento da 1ª parcela com base nas regras do cartão.
    // As parcelas seguintes são simplesmente +1 mês em relação à anterior,
    // sem reaplicar a regra de fechamento (que se aplica apenas ao momento da compra).
    const firstPaymentDate = calculateEffectiveDate(
      startDate,
      account.type,
      account.closingDay,
      account.dueDay
    );

    const result = await prisma.$transaction(async (tx) => {
      const group = await tx.installmentGroup.create({
        data: {
          description: data.description,
          totalAmountCents: data.totalAmountCents,
          installmentCount: data.installmentCount,
          startDate,
          isThirdParty,
          thirdPartyName: isThirdParty ? data.thirdPartyName?.trim() || null : null,
          isReimbursed: isThirdParty ? data.isReimbursed ?? false : false,
          accountId: data.accountId,
          categoryId: data.categoryId,
        },
      });

      const transactionsData = [];
      for (let i = 0; i < data.installmentCount; i++) {
        const purchaseDate = startDate;
        const effectiveDate = addMonths(firstPaymentDate, i);
        const installmentCents = installmentAmounts[i];

        transactionsData.push({
          description: `${data.description} (${i + 1}/${data.installmentCount})`,
          amountCents: installmentCents,
          type: 'EXPENSE' as const,
          date: purchaseDate,
          effectiveDate,
          accountId: data.accountId,
          categoryId: data.categoryId,
          installmentGroupId: group.id,
          installmentNumber: i + 1,
          totalInstallments: data.installmentCount,
          isThirdParty,
          thirdPartyName: isThirdParty ? data.thirdPartyName?.trim() || null : null,
          isReimbursed: isThirdParty ? data.isReimbursed ?? false : false,
          reimbursedAmountCents: isThirdParty && data.isReimbursed ? installmentCents : 0,
          reimbursedAt: isThirdParty && data.isReimbursed ? new Date() : null,
          notes: data.notes,
        });
      }

      await tx.transaction.createMany({ data: transactionsData });

      return tx.installmentGroup.findUnique({
        where: { id: group.id },
        include: {
          account: true,
          category: true,
          transactions: { orderBy: { date: 'asc' } },
        },
      });
    });

    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function deleteInstallment(req: Request, res: Response, next: NextFunction) {
  try {
    const mode = req.query.mode === 'all' ? 'all' : 'future';

    if (mode === 'all') {
      await prisma.$transaction([
        prisma.transaction.deleteMany({
          where: { installmentGroupId: req.params.id },
        }),
        prisma.installmentGroup.delete({ where: { id: req.params.id } }),
      ]);
    } else {
      await prisma.$transaction(async (tx) => {
        await tx.transaction.deleteMany({
          where: {
            installmentGroupId: req.params.id,
            effectiveDate: { gte: futureCutoff() },
            paidAt: null,
            reimbursedAmountCents: 0,
          },
        });

        const remaining = await tx.transaction.count({
          where: { installmentGroupId: req.params.id },
        });

        if (remaining === 0) {
          await tx.installmentGroup.delete({ where: { id: req.params.id } });
        } else {
          await tx.installmentGroup.update({
            where: { id: req.params.id },
            data: { isCancelled: true, cancelledAt: new Date() },
          });
        }
      });
    }

    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function updateInstallmentPaymentDate(req: Request, res: Response, next: NextFunction) {
  try {
    const { firstPaymentDate } = UpdatePaymentDateSchema.parse(req.body);
    const firstDate = new Date(firstPaymentDate);

    const updatedGroup = await financialTransaction(async (db) => {
    const group = await db.installmentGroup.findUniqueOrThrow({ where: { id: req.params.id } });
    if (group.isCancelled) {
      throw new HttpError(409, 'Não é possível alterar um parcelamento cancelado', 'INSTALLMENT_CANCELLED');
    }

    const transactions = await db.transaction.findMany({
      where: { installmentGroupId: req.params.id },
      orderBy: [{ installmentNumber: 'asc' }, { date: 'asc' }],
      select: { id: true, installmentNumber: true, effectiveDate: true, paidAt: true, reimbursedAmountCents: true },
    });

    const mutableFrom = mutablePeriodStart();
    for (const [index, tx] of transactions.entries()) {
        const installmentNumber = tx.installmentNumber ?? index + 1;
        const newEffectiveDate = addMonths(firstDate, installmentNumber - 1);
        newEffectiveDate.setHours(12, 0, 0, 0);
        if (tx.paidAt || tx.reimbursedAmountCents > 0 || tx.effectiveDate < mutableFrom || newEffectiveDate < mutableFrom) continue;
        await db.transaction.update({
          where: { id: tx.id },
          data: { effectiveDate: newEffectiveDate },
        });
    }

    return db.installmentGroup.findUnique({
      where: { id: req.params.id },
      include: {
        account: true,
        category: true,
        transactions: { orderBy: { installmentNumber: 'asc' } },
      },
    });
    });

    res.json(updatedGroup);
  } catch (err) {
    next(err);
  }
}

export async function getInstallmentTransactions(req: Request, res: Response, next: NextFunction) {
  try {
    const { page, pageSize, skip } = parsePageQuery(req.query);
    const where = { installmentGroupId: req.params.id };
    const [items, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: { account: true, category: true },
        orderBy: [{ installmentNumber: 'asc' }, { effectiveDate: 'asc' }],
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
