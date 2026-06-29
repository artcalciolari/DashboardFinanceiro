import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { addMonths } from 'date-fns';
import prisma from '../lib/prisma';
import { calculateEffectiveDate } from '../utils/creditCard';

const InstallmentSchema = z.object({
  description: z.string().min(1, 'Descrição é obrigatória'),
  totalAmount: z.number().positive('Valor total deve ser positivo'),
  installmentCount: z.number().int().min(2, 'Mínimo 2 parcelas'),
  startDate: z.string(),
  accountId: z.string(),
  categoryId: z.string(),
  isThirdParty: z.boolean().optional(),
  thirdPartyName: z.string().optional().nullable(),
  isReimbursed: z.boolean().optional(),
  notes: z.string().optional(),
});

const UpdatePaymentDateSchema = z.object({
  firstPaymentDate: z.string(),
});

export async function getInstallments(req: Request, res: Response, next: NextFunction) {
  try {
    const groups = await prisma.installmentGroup.findMany({
      include: {
        account: true,
        category: true,
        transactions: { orderBy: { date: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(groups);
  } catch (err) {
    next(err);
  }
}

export async function createInstallment(req: Request, res: Response, next: NextFunction) {
  try {
    const data = InstallmentSchema.parse(req.body);
    const account = await prisma.account.findUniqueOrThrow({ where: { id: data.accountId } });

    const totalCents = Math.round(data.totalAmount * 100);
    const totalAmount = totalCents / 100;
    const baseInstallmentCents = Math.floor(totalCents / data.installmentCount);
    const remainderCents = totalCents - baseInstallmentCents * data.installmentCount;
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

    const group = await prisma.installmentGroup.create({
      data: {
        description: data.description,
        totalAmount,
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
      const purchaseDate = addMonths(startDate, i);
      const effectiveDate = addMonths(firstPaymentDate, i);
      const installmentCents = baseInstallmentCents + (
        i === data.installmentCount - 1 ? remainderCents : 0
      );

      transactionsData.push({
        description: `${data.description} (${i + 1}/${data.installmentCount})`,
        amount: installmentCents / 100,
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

    await prisma.transaction.createMany({ data: transactionsData });

    const result = await prisma.installmentGroup.findUnique({
      where: { id: group.id },
      include: {
        account: true,
        category: true,
        transactions: { orderBy: { date: 'asc' } },
      },
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
      await prisma.transaction.deleteMany({
        where: {
          installmentGroupId: req.params.id,
          effectiveDate: { gte: new Date() },
        },
      });

      const remaining = await prisma.transaction.count({
        where: { installmentGroupId: req.params.id },
      });

      if (remaining === 0) {
        await prisma.installmentGroup.delete({ where: { id: req.params.id } });
      }
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
