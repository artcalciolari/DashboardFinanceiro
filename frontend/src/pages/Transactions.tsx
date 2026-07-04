import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Pencil, Trash2 } from 'lucide-react';
import { transactionsApi } from '../services/api';
import { useDate } from '../context/DateContext';
import { useSearch } from '../context/SearchContext';
import { useTransactionModal } from '../context/TransactionModalContext';
import { formatCurrency, formatDate, formatMonthYear } from '../utils/formatters';
import type { Transaction } from '../types';
import Button from '../components/ui/Button';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { clsx } from 'clsx';

type TypeFilter = 'all' | 'INCOME' | 'EXPENSE';

export default function Transactions() {
  const { month, year } = useDate();
  const { search, setSearch } = useSearch();
  const { openEdit } = useTransactionModal();
  const qc = useQueryClient();

  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['transactions', month, year],
    queryFn: () => transactionsApi.getAll({ month, year }),
  });

  const deleteMutation = useMutation({
    mutationFn: transactionsApi.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['summary'] });
      setDeleteTarget(null);
    },
  });

  const q = search.trim().toLowerCase();
  const filtered = transactions.filter((t) => {
    const okType = typeFilter === 'all' || t.type === typeFilter;
    const okSearch =
      !q ||
      t.description.toLowerCase().includes(q) ||
      t.category.name.toLowerCase().includes(q) ||
      t.account.name.toLowerCase().includes(q);
    return okType && okSearch;
  });

  const sumIncome = filtered.filter((t) => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0);
  const sumExpense = filtered.filter((t) => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0);
  const hasActiveFilters = typeFilter !== 'all' || q.length > 0;

  function resetFilters() {
    setTypeFilter('all');
    setSearch('');
  }

  const segments: { key: TypeFilter; label: string }[] = [
    { key: 'all', label: 'Todas' },
    { key: 'INCOME', label: 'Receitas' },
    { key: 'EXPENSE', label: 'Despesas' },
  ];

  return (
    <div>
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[24px] font-bold tracking-tight text-ink">Transações</h1>
          <p className="mt-1 text-sm text-muted">
            {filtered.length} lançamento{filtered.length === 1 ? '' : 's'} · <span className="capitalize">{formatMonthYear(month, year)}</span>
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div className="inline-flex gap-0.5 rounded-xl bg-[#EDEAE0] p-1">
          {segments.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setTypeFilter(s.key)}
              className={clsx(
                'rounded-[9px] px-4 py-1.5 text-[13px] font-semibold transition-colors',
                typeFilter === s.key ? 'bg-white text-forest shadow-sm' : 'bg-transparent text-muted font-medium'
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="flex gap-6">
          <div className="text-right">
            <div className="text-[11.5px] font-medium text-faint">Entradas</div>
            <div className="tabular font-display text-base font-bold text-income">{formatCurrency(sumIncome)}</div>
          </div>
          <div className="text-right">
            <div className="text-[11.5px] font-medium text-faint">Saídas</div>
            <div className="tabular font-display text-base font-bold text-expense">{formatCurrency(sumExpense)}</div>
          </div>
          <div className="text-right">
            <div className="text-[11.5px] font-medium text-faint">Saldo</div>
            <div className="tabular font-display text-base font-bold text-ink">{formatCurrency(sumIncome - sumExpense)}</div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-card border border-border bg-card">
        {isLoading ? (
          <div className="p-8 text-center text-faint">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-chip">
              <Search size={28} className="text-faint" />
            </div>
            <h3 className="font-display text-[17px] font-semibold text-ink">Nenhuma transação encontrada</h3>
            <p className="mt-1.5 text-[13.5px] text-faint">
              {hasActiveFilters ? 'Tente ajustar a busca ou os filtros aplicados.' : 'Nenhum lançamento neste mês.'}
            </p>
            {hasActiveFilters && (
              <Button variant="secondary" size="sm" className="mt-4" onClick={resetFilters}>
                Limpar filtros
              </Button>
            )}
          </div>
        ) : (
          <div>
            {filtered.map((t) => (
              <div
                key={t.id}
                className="group flex items-center gap-3.5 border-b border-border-faint px-5 py-3.5 transition-colors last:border-b-0 hover:bg-[#FAF9F4]"
              >
                <div
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl"
                  style={{ backgroundColor: t.type === 'INCOME' ? '#E7F5EC' : '#FBEBE6' }}
                >
                  <span className="h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: t.category.color }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{t.description}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-faint">{t.category.name}</span>
                    <span className="h-[3px] w-[3px] rounded-full bg-[#CFCABC]" />
                    <span className="text-xs text-faint">{t.account.name}</span>
                    {t.installmentNumber && (
                      <span className="rounded-pill bg-[#E9F0EC] px-2 py-0.5 text-[11px] font-semibold text-forest">
                        Parcela {t.installmentNumber}/{t.totalInstallments}
                      </span>
                    )}
                    {t.subscriptionId && (
                      <span className="rounded-pill bg-[#E9F0EC] px-2 py-0.5 text-[11px] font-semibold text-forest">
                        Assinatura
                      </span>
                    )}
                    {t.isThirdParty && (
                      <span className="rounded-pill bg-amber/10 px-2 py-0.5 text-[11px] font-semibold text-amber">
                        {t.isReimbursed ? 'Reembolsado' : 'A receber'}
                        {t.thirdPartyName ? `: ${t.thirdPartyName}` : ''}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex-shrink-0 text-right">
                  <div className={clsx('tabular font-display text-[15px] font-bold', t.type === 'INCOME' ? 'text-income' : 'text-expense')}>
                    {t.type === 'INCOME' ? '+ ' : '- '}{formatCurrency(t.amount)}
                  </div>
                  <div className="mt-0.5 text-xs text-faint">{formatDate(t.effectiveDate)}</div>
                </div>
                <div className="flex flex-shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={() => openEdit(t)}
                    className="rounded-lg p-1.5 text-faint transition-colors hover:bg-chip hover:text-forest"
                    title="Editar transação"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(t)}
                    className="rounded-lg p-1.5 text-faint transition-colors hover:bg-expense/10 hover:text-expense"
                    title="Excluir transação"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Excluir transação"
        description={`Excluir "${deleteTarget?.description ?? ''}"? Esta ação remove a movimentação deste mês.`}
        confirmLabel="Excluir"
        loading={deleteMutation.isPending}
        onClose={() => {
          if (!deleteMutation.isPending) setDeleteTarget(null);
        }}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
        }}
      />
    </div>
  );
}
