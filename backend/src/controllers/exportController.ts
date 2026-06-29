import { Request, Response, NextFunction } from 'express';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { createObjectCsvStringifier } from 'csv-writer';
import prisma from '../lib/prisma';
import { ensureSubscriptionTransactions, getSubscriptionHorizon } from '../services/subscriptionService';

export async function exportCSV(req: Request, res: Response, next: NextFunction) {
  try {
    const { month, year } = req.query;
    const where: Record<string, unknown> = {};

    if (month && year) {
      const startDate = new Date(Number(year), Number(month) - 1, 1);
      const endDate = new Date(Number(year), Number(month), 0, 23, 59, 59);
      where.effectiveDate = { gte: startDate, lte: endDate };
      await ensureSubscriptionTransactions(endDate);
    } else {
      await ensureSubscriptionTransactions(getSubscriptionHorizon());
    }

    const transactions = await prisma.transaction.findMany({
      where,
      include: { account: true, category: true, subscription: true },
      orderBy: { effectiveDate: 'asc' },
    });

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

    const records = transactions.map((t) => ({
      date: format(t.date, 'dd/MM/yyyy', { locale: ptBR }),
      effectiveDate: format(t.effectiveDate, 'dd/MM/yyyy', { locale: ptBR }),
      description: t.description,
      category: t.category.name,
      account: t.account.name,
      type: t.type === 'INCOME' ? 'Receita' : 'Despesa',
      amount: t.amount.toFixed(2).replace('.', ','),
      installment: t.installmentNumber ? `${t.installmentNumber}/${t.totalInstallments}` : '',
      subscription: t.subscription ? t.subscription.name : '',
      thirdParty: t.isThirdParty ? 'Sim' : 'Não',
      thirdPartyName: t.thirdPartyName ?? '',
      reimbursed: t.isThirdParty ? (t.isReimbursed ? 'Sim' : 'Não') : '',
      notes: t.notes ?? '',
    }));

    const csv = stringifier.getHeaderString() + stringifier.stringifyRecords(records);

    const filename =
      month && year
        ? `financeiro_${String(month).padStart(2, '0')}_${year}.csv`
        : 'financeiro_todos.csv';

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('\uFEFF' + csv); // BOM UTF-8 para compatibilidade com Excel
  } catch (err) {
    next(err);
  }
}
