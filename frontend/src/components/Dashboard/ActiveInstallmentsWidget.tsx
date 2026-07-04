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
          <h3 className="flex items-center gap-2 text-base font-semibold text-gray-800">
            <CalendarClock size={18} className="text-blue-600" />
            Parcelamentos ativos
          </h3>
          <p className="mt-1 text-xs text-gray-400">
            {activeInstallments.length} em andamento · saldo futuro {formatCurrency(remainingTotal)}
          </p>
        </div>
        <Link
          to="/installments"
          className="inline-flex items-center gap-1 self-start rounded-lg px-2 py-1 text-xs font-semibold text-blue-600 transition-colors hover:bg-blue-50"
        >
          Ver todos
          <ChevronRight size={14} />
        </Link>
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-sm text-gray-400">Carregando...</div>
      ) : activeInstallments.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 py-8 text-center text-sm text-gray-400">
          Nenhum parcelamento ativo
        </div>
      ) : (
        <div className="space-y-3">
          {visibleInstallments.map(({ group, paid, total, pct, next, remainingAmount }) => (
            <div
              key={group.id}
              className="rounded-lg border border-gray-100 p-3 transition-colors hover:border-blue-100 hover:bg-blue-50/30"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className="h-9 w-9 flex-shrink-0 rounded-lg"
                    style={{ backgroundColor: `${group.category.color}20` }}
                  >
                    <div
                      className="m-auto mt-3 h-3 w-3 rounded-full"
                      style={{ backgroundColor: group.category.color }}
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-800">{group.description}</p>
                    <p className="truncate text-xs text-gray-400">
                      {group.account.name} · {group.category.name}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-left sm:min-w-[260px] sm:text-right">
                  <div>
                    <p className="text-[11px] font-medium uppercase text-gray-400">Próxima</p>
                    <p className="text-sm font-semibold text-gray-700">
                      {next ? formatDate(next.effectiveDate) : 'Sem data'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium uppercase text-gray-400">Restante</p>
                    <p className="text-sm font-semibold text-gray-700">
                      {formatCurrency(remainingAmount)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-3">
                <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
                  <span>
                    {paid}/{total} parcelas
                  </span>
                  <span>{pct}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className={clsx('h-full rounded-full transition-all', pct >= 75 ? 'bg-emerald-500' : 'bg-blue-500')}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            </div>
          ))}

          {activeInstallments.length > visibleInstallments.length && (
            <Link
              to="/installments"
              className="block rounded-lg border border-dashed border-gray-200 px-3 py-2 text-center text-xs font-semibold text-gray-500 transition-colors hover:border-blue-200 hover:text-blue-600"
            >
              Ver mais {activeInstallments.length - visibleInstallments.length} parcelamento(s)
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
