import { Request, Response, NextFunction } from 'express';
import { once } from 'node:events';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { createObjectCsvStringifier } from 'csv-writer';
import type { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { ensureSubscriptionTransactions, getSubscriptionHorizon } from '../services/subscriptionService';
import { parsePeriodQuery } from '../utils/period';
import { formatCentsForCsv } from '../utils/money';

function safeSpreadsheetCell(value: string) {
  const trimmed = value.trimStart();
  return /^[=+\-@\t\r]/.test(trimmed) ? `'${value}` : value;
}

export async function exportCSV(req: Request, res: Response, next: NextFunction) {
  try {
    const { month, year } = parsePeriodQuery(req.query);
    const baseWhere: Prisma.TransactionWhereInput = {};
    if (month !== undefined && year !== undefined) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59, 999);
      baseWhere.effectiveDate = { gte: startDate, lte: endDate };
      await ensureSubscriptionTransactions(endDate);
    } else {
      await ensureSubscriptionTransactions(getSubscriptionHorizon());
    }

    const stringifier = createObjectCsvStringifier({
      header: [
        { id: 'date', title: 'Data Compra' },
        { id: 'effectiveDate', title: 'Data Efetiva' },
        { id: 'description', title: 'Descrição' },
        { id: 'category', title: 'Categoria' },
        { id: 'account', title: 'Conta/Cartão' },
        { id: 'type', title: 'Tipo' },
        { id: 'amount', title: 'Valor (R$)' },
        { id: 'installment', title: 'Parcela' },
        { id: 'subscription', title: 'Assinatura' },
        { id: 'thirdParty', title: 'Terceiro' },
        { id: 'thirdPartyName', title: 'Responsável' },
        { id: 'reimbursed', title: 'Reembolsado' },
        { id: 'notes', title: 'Observações' },
      ],
    });
    const filename = month && year
      ? `financeiro_${String(month).padStart(2, '0')}_${year}.csv`
      : 'financeiro_todos.csv';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.write('\uFEFF' + stringifier.getHeaderString());

    let cursor: { effectiveDate: Date; id: string } | undefined;
    while (true) {
      const cursorWhere: Prisma.TransactionWhereInput | undefined = cursor
        ? { OR: [
            { effectiveDate: { gt: cursor.effectiveDate } },
            { effectiveDate: cursor.effectiveDate, id: { gt: cursor.id } },
          ] }
        : undefined;
      const transactions = await prisma.transaction.findMany({
        where: cursorWhere ? { AND: [baseWhere, cursorWhere] } : baseWhere,
        include: { account: true, category: true, subscription: true },
        orderBy: [{ effectiveDate: 'asc' }, { id: 'asc' }],
        take: 500,
      });
      if (transactions.length === 0) break;
      const records = transactions.map((transaction) => ({
        date: format(transaction.date, 'dd/MM/yyyy', { locale: ptBR }),
        effectiveDate: format(transaction.effectiveDate, 'dd/MM/yyyy', { locale: ptBR }),
        description: safeSpreadsheetCell(transaction.description),
        category: safeSpreadsheetCell(transaction.category.name),
        account: safeSpreadsheetCell(transaction.account.name),
        type: transaction.type === 'INCOME' ? 'Receita' : 'Despesa',
        amount: formatCentsForCsv(transaction.amountCents),
        installment: transaction.installmentNumber
          ? `${transaction.installmentNumber}/${transaction.totalInstallments}`
          : '',
        subscription: transaction.subscription ? safeSpreadsheetCell(transaction.subscription.name) : '',
        thirdParty: transaction.isThirdParty ? 'Sim' : 'Não',
        thirdPartyName: transaction.thirdPartyName ? safeSpreadsheetCell(transaction.thirdPartyName) : '',
        reimbursed: transaction.isThirdParty ? (transaction.isReimbursed ? 'Sim' : 'Não') : '',
        notes: transaction.notes ? safeSpreadsheetCell(transaction.notes) : '',
      }));
      if (!res.write(stringifier.stringifyRecords(records))) await once(res, 'drain');
      const last = transactions.at(-1)!;
      cursor = { effectiveDate: last.effectiveDate, id: last.id };
      if (transactions.length < 500) break;
    }
    res.end();
  } catch (err) {
    if (res.headersSent) {
      res.destroy(err instanceof Error ? err : undefined);
      return;
    }
    next(err);
  }
}
