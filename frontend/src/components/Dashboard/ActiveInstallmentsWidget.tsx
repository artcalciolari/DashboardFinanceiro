import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarClock, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { clsx } from 'clsx';
import { installmentsApi } from '../../services/api';
import { useDate } from '../../context/DateContext';
import { formatCurrency, formatDate } from '../../utils/formatters';
import type { InstallmentGroup, Transaction } from '../../types';

interface ActiveInstallmentView {
  group: InstallmentGroup;
  paid: number;
  total: number;
  pct: number;
  next?: Transaction;
  remainingAmount: number;
}

function buildActiveInstallment(group: InstallmentGroup, periodEnd: Date): ActiveInstallmentView {
  const transactions = group.transactions.slice().sort((a, b) => {
    const dateDiff = new Date(a.effectiveDate).getTime() - new Date(b.effectiveDate).getTime();
    return dateDiff || (a.installmentNumber ?? 0) - (b.installmentNumber ?? 0);
  });
  const futureTransactions = transactions.filter((t) => new Date(t.effectiveDate) > periodEnd);
  const paid = transactions.length - futureTransactions.length;
  const total = group.installmentCount;
  const pct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;

  return {
    group,
    paid,
    total,
    pct,
    next: futureTransactions[0],
    remainingAmount: futureTransactions.reduce((sum, t) => sum + t.amount, 0),
  };
}

export default function ActiveInstallmentsWidget() {
  const { month, year } = useDate();
  const selectedPeriodEnd = useMemo(
    () => new Date(year, month, 0, 23, 59, 59, 999),
    [month, year]
  );

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ['installments'],
    queryFn: installmentsApi.getAll,
  });

  const activeInstallments = useMemo(() => {
    return groups
      .map((group) => buildActiveInstallment(group, selectedPeriodEnd))
      .filter((view) => view.total > 0 && view.paid < view.total)
      .sort((a, b) => {
        const nextA = a.next ? new Date(a.next.effectiveDate).getTime() : Number.POSITIVE_INFINITY;
        const nextB = b.next ? new Date(b.next.effectiveDate).getTime() : Number.POSITIVE_INFINITY;

        return nextA - nextB || a.group.description.localeCompare(b.group.description);
      });
  }, [groups, selectedPeriodEnd]);

  const visibleInstallments = activeInstallments.slice(0, 5);
  const remainingTotal = activeInstallments.reduce((sum, view) => sum + view.remainingAmount, 0);

  return (
    <section className="card">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 font-display text-base font-semibold text-ink">
            <CalendarClock size={18} className="text-forest" />
            Comprometido este mês
          </h3>
          <p className="mt-0.5 text-[12.5px] text-faint">
            {activeInstallments.length} parcelamento(s) ativo(s) · restam {formatCurrency(remainingTotal)}
          </p>
        </div>
        <Link
          to="/installments"
          className="inline-flex items-center gap-1 self-start rounded-lg px-2 py-1 text-xs font-semibold text-forest transition-colors hover:bg-chip"
        >
          Ver todos
          <ChevronRight size={14} />
        </Link>
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-sm text-faint">Carregando...</div>
      ) : activeInstallments.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-faint">
          Nenhum parcelamento ativo
        </div>
      ) : (
        <div className="flex flex-col gap-[14px]">
          {visibleInstallments.map(({ group, paid, total, pct, next, remainingAmount }) => (
            <div key={group.id}>
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <span className="truncate text-[13.5px] font-medium text-ink">{group.description}</span>
                <span className="flex-shrink-0 text-[13px] text-faint">
                  {paid}/{total} · {formatCurrency(remainingAmount)}
                  {next ? ` · ${formatDate(next.effectiveDate)}` : ''}
                </span>
              </div>
              <div className="h-[7px] overflow-hidden rounded-pill bg-chip">
                <div
                  className={clsx('h-full rounded-pill transition-all', pct >= 75 ? 'bg-income' : 'bg-forest')}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          ))}

          {activeInstallments.length > visibleInstallments.length && (
            <Link
              to="/installments"
              className="block rounded-xl border border-dashed border-border px-3 py-2 text-center text-xs font-semibold text-muted transition-colors hover:border-forest/30 hover:text-forest"
            >
              Ver mais {activeInstallments.length - visibleInstallments.length} parcelamento(s)
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
