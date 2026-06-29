import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';

const AccountSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  type: z.enum(['BANK_ACCOUNT', 'CREDIT_CARD', 'CASH', 'INVESTMENT']),
  balance: z.number().default(0),
  color: z.string().default('#3B82F6'),
  creditLimit: z.number().positive().nullable().optional(),
  closingDay: z.number().min(1).max(31).nullable().optional(),
  dueDay: z.number().min(1).max(31).nullable().optional(),
});

type AccountInput = z.infer<typeof AccountSchema>;
type PartialAccountInput = Partial<AccountInput>;

function normalizeAccountData<T extends PartialAccountInput>(
  data: T,
  accountType: AccountInput['type']
) {
  if (accountType === 'CREDIT_CARD') {
    return { ...data, balance: 0 };
  }

  return {
    ...data,
    creditLimit: null,
    closingDay: null,
    dueDay: null,
  };
}

export async function getAccounts(req: Request, res: Response, next: NextFunction) {
  try {
    const accounts = await prisma.account.findMany({ orderBy: { createdAt: 'asc' } });
    res.json(accounts);
  } catch (err) {
    next(err);
  }
}

export async function createAccount(req: Request, res: Response, next: NextFunction) {
  try {
    const data = AccountSchema.parse(req.body);
    const account = await prisma.account.create({
      data: normalizeAccountData(data, data.type),
    });
    res.status(201).json(account);
  } catch (err) {
    next(err);
  }
}

export async function updateAccount(req: Request, res: Response, next: NextFunction) {
  try {
    const data = AccountSchema.partial().parse(req.body);
    const existing = await prisma.account.findUniqueOrThrow({ where: { id: req.params.id } });
    const accountType = data.type ?? existing.type;
    const account = await prisma.account.update({
      where: { id: req.params.id },
      data: normalizeAccountData(data, accountType),
    });
    res.json(account);
  } catch (err) {
    next(err);
  }
}

export async function deleteAccount(req: Request, res: Response, next: NextFunction) {
  try {
    await prisma.account.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
