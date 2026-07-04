import { TrendingUp, TrendingDown } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { summaryApi, transactionsApi } from '../../services/api';
import { useDate } from '../../context/DateContext';
import { formatCurrency, capitalize } from '../../utils/formatters';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { clsx } from 'clsx';

export default function SummaryCards() {
  const { month, year } = useDate();

  const { data, isLoading } = useQuery({
    queryKey: ['summary', 'monthly', month, year],
    queryFn: () => summaryApi.getMonthly(month, year),
  });

  const { data: evolution = [] } = useQuery({
    queryKey: ['summary', 'evolution'],
    queryFn: summaryApi.getEvolution,
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions', month, year],
    queryFn: () => transactionsApi.getAll({ month, year }),
  });

  const sortedEvolution = evolution
    .slice()
    .sort((a, b) => a.year * 12 + a.month - (b.year * 12 + b.month));

  let cumulative = 0;
  const sparkPoints = sortedEvolution.map((m) => {
    cumulative += m.income - m.expenses;
    return cumulative;
  });
  const currentIdx = sortedEvolution.findIndex((m) => m.month === month && m.year === year);
  const previous = currentIdx > 0 ? sortedEvolution[currentIdx - 1] : undefined;
  const currentBalance = data?.balance ?? 0;
  const previousBalance = previous ? previous.income - previous.expenses : undefined;
  const balanceDiff = previousBalance !== undefined ? currentBalance - previousBalance : undefined;
  const pctChange =
    previousBalance !== undefined && previousBalance !== 0
      ? Math.round((balanceDiff! / Math.abs(previousBalance)) * 100)
      : undefined;
  const previousLabel = previous
    ? capitalize(format(new Date(previous.year, previous.month - 1, 1), 'MMMM', { locale: ptBR }))
    : undefined;

  const sparkMin = sparkPoints.length ? Math.min(0, ...sparkPoints) : 0;
  const sparkMax = sparkPoints.length ? Math.max(0, ...sparkPoints) : 1;
  const sparkRange = sparkMax - sparkMin || 1;
  const sparkPts = sparkPoints
    .map((v, i) => {
      const x = sparkPoints.length > 1 ? (i / (sparkPoints.length - 1)) * 260 : 0;
      const y = 44 - ((v - sparkMin) / sparkRange) * 40;
      return `${Math.round(x)},${Math.round(y)}`;
    })
    .join(' ');

  const incomeCount = transactions.filter((t) => t.type === 'INCOME').length;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr_1fr]">
      {/* Hero: Saldo do mês */}
      <div className="relative flex flex-col justify-between overflow-hidden rounded-card bg-forest p-6 text-white">
        <div
          className="pointer-events-none absolute -right-10 -top-10 h-[180px] w-[180px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(200,241,105,0.18), transparent 70%)' }}
        />
        <div className="relative flex items-center justify-between">
          <span className="text-[13px] font-medium text-[#9DBFB0]">Saldo do mês</span>
          {pctChange !== undefined && (
            <span
              className={clsx(
                'inline-flex items-center gap-1 rounded-pill px-2.5 py-1 text-xs font-semibold',
                pctChange >= 0 ? 'bg-lime/[0.16] text-lime' : 'bg-white/10 text-white'
              )}
            >
              {pctChange >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
              {pctChange >= 0 ? '+' : ''}{pctChange}%
            </span>
          )}
        </div>
        <div className="relative">
          <div className="tabular my-3.5 font-display text-[42px] font-bold leading-none tracking-tight">
            {isLoading ? '—' : formatCurrency(currentBalance)}
          </div>
          {balanceDiff !== undefined && previousLabel && (
            <div className="text-[13px] text-[#9DBFB0]">
              {balanceDiff >= 0 ? '+ ' : '- '}
              {formatCurrency(Math.abs(balanceDiff))} em relação a {previousLabel}
            </div>
          )}
        </div>
        {sparkPoints.length > 1 && (
          <svg viewBox="0 0 260 48" preserveAspectRatio="none" className="relative mt-3.5 h-11 w-full">
            <polyline points={sparkPts} fill="none" stroke="#C8F169" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>

      {/* KPI: Receitas */}
      <div className="flex flex-col justify-between rounded-card border border-border bg-card p-[22px]">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-medium text-muted">Receitas</span>
          <div className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-[#E7F5EC]">
            <TrendingUp size={17} className="text-income" strokeWidth={2.2} />
          </div>
        </div>
        <div>
          <div className="tabular mt-4 whitespace-nowrap font-display text-[27px] font-bold tracking-tight text-income">
            {isLoading ? '—' : formatCurrency(data?.totalIncome ?? 0)}
          </div>
          <div className="mt-0.5 text-[12.5px] text-faint">
            {incomeCount} entrada{incomeCount === 1 ? '' : 's'} no mês
          </div>
        </div>
      </div>

      {/* KPI: Despesas pessoais */}
      <div className="flex flex-col justify-between rounded-card border border-border bg-card p-[22px]">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-medium text-muted">Despesas pessoais</span>
          <div className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-[#FBEBE6]">
            <TrendingDown size={17} className="text-expense" strokeWidth={2.2} />
          </div>
        </div>
        <div>
          <div className="tabular mt-4 whitespace-nowrap font-display text-[27px] font-bold tracking-tight text-expense">
            {isLoading ? '—' : formatCurrency(data?.totalExpenses ?? 0)}
          </div>
          <div className="mt-0.5 text-[12.5px] text-faint">
            Fatura total: {formatCurrency(data?.invoiceExpenses ?? 0)}
          </div>
        </div>
      </div>
    </div>
  );
}
