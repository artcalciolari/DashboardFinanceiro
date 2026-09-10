import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { HttpError } from '../utils/httpError';
import { MoneyCents } from '../utils/money';
import { financialTransaction } from '../services/financialTransaction';

const RecordedDate = z.string().datetime({ offset: true }).refine(
  (value) => new Date(value) <= new Date(), 'A data não pode estar no futuro'
).nullable();

export async function settleTransaction(req: Request, res: Response, next: NextFunction) {
  try {
    const { paidAt } = z.object({ paidAt: RecordedDate }).strict().parse(req.body);
    const transaction = await financialTransaction((tx) => tx.transaction.update({
      where: { id: req.params.id },
      data: { paidAt: paidAt ? new Date(paidAt) : null },
      include: { account: true, category: true, subscription: true },
    }));
    res.json(transaction);
  } catch (err) { next(err); }
}

export async function reimburseTransaction(req: Request, res: Response, next: NextFunction) {
  try {
    const data = z.object({ reimbursedAmountCents: MoneyCents.min(0), reimbursedAt: RecordedDate }).strict().parse(req.body);
    if (data.reimbursedAmountCents > 0 && !data.reimbursedAt) {
      throw new HttpError(422, 'Informe a data do reembolso', 'REIMBURSEMENT_DATE_REQUIRED');
    }
    const result = await financialTransaction(async (tx) => {
      const existing = await tx.transaction.findUniqueOrThrow({ where: { id: req.params.id } });
      if (existing.type !== 'EXPENSE' || !existing.isThirdParty) {
        throw new HttpError(422, 'Somente despesas de terceiros podem receber reembolso', 'NOT_REIMBURSABLE');
      }
      if (data.reimbursedAmountCents > existing.amountCents) {
        throw new HttpError(422, 'O reembolso não pode exceder o valor da despesa', 'REIMBURSEMENT_EXCEEDS_AMOUNT');
      }
      return tx.transaction.update({
        where: { id: existing.id },
        data: {
          reimbursedAmountCents: data.reimbursedAmountCents,
          reimbursedAt: data.reimbursedAmountCents > 0 ? new Date(data.reimbursedAt!) : null,
          isReimbursed: data.reimbursedAmountCents === existing.amountCents,
        },
        include: { account: true, category: true, subscription: true },
      });
    });
    res.json(result);
  } catch (err) { next(err); }
}
