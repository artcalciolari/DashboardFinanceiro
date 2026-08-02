import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { addMonths } from 'date-fns';
import prisma from '../lib/prisma';
import { calculateEffectiveDate } from '../utils/creditCard';
import { HttpError } from '../utils/httpError';
import { PositiveMoneyCents, splitInstallmentCents } from '../utils/money';
import { parsePageQuery } from '../utils/pagination';
import { futureCutoff } from '../utils/businessTime';

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

    const [groups, total] = await Promise.all([
      prisma.installmentGroup.findMany({
        include: {
          account: true,
          category: true,
          transactions: { orderBy: [{ installmentNumber: 'asc' }, { effectiveDate: 'asc' }] },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: pageSize,
      }),
      prisma.installmentGroup.count(),
    ]);

    const deletionCutoff = futureCutoff();
    const items = groups.map((group) => {
      const paidTransactions = group.transactions.filter((transaction) => transaction.effectiveDate <= asOf);
      const futureTransactions = group.transactions.filter((transaction) => transaction.effectiveDate > asOf);
      return {
        ...group,
        transactions: undefined,
        paidCount: paidTransactions.length,
        futureCount: futureTransactions.length,
        historicalCount: group.transactions.filter((transaction) => transaction.effectiveDate < deletionCutoff).length,
        deletableFutureCount: group.transactions.filter((transaction) => transaction.effectiveDate >= deletionCutoff).length,
        remainingAmountCents: futureTransactions.reduce((sum, transaction) => sum + transaction.amountCents, 0),
        installmentAmountCents: futureTransactions[0]?.amountCents ?? group.transactions.at(-1)?.amountCents ?? 0,
        firstTransaction: group.transactions[0] ?? null,
        nextTransaction: futureTransactions[0] ?? null,
        lastTransaction: group.transactions.at(-1) ?? null,
      };
    });

    res.json({ items, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } });
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

    if (Number.isNaN(firstDate.getTime())) {
      res.status(400).json({ message: 'Data de pagamento inválida' });
      return;
    }

    const group = await prisma.installmentGroup.findUniqueOrThrow({ where: { id: req.params.id } });
    if (group.isCancelled) {
      throw new HttpError(409, 'Não é possível alterar um parcelamento cancelado', 'INSTALLMENT_CANCELLED');
    }

    const transactions = await prisma.transaction.findMany({
      where: { installmentGroupId: req.params.id },
      orderBy: [{ installmentNumber: 'asc' }, { date: 'asc' }],
      select: { id: true, installmentNumber: true },
    });

    await prisma.$transaction(
      transactions.map((tx, index) => {
        const installmentNumber = tx.installmentNumber ?? index + 1;
        const newEffectiveDate = addMonths(firstDate, installmentNumber - 1);

        return prisma.transaction.update({
          where: { id: tx.id },
          data: { effectiveDate: new Date(newEffectiveDate.setHours(12, 0, 0, 0)) },
        });
      })
    );

    const updatedGroup = await prisma.installmentGroup.findUnique({
      where: { id: req.params.id },
      include: {
        account: true,
        category: true,
        transactions: { orderBy: { installmentNumber: 'asc' } },
      },
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
