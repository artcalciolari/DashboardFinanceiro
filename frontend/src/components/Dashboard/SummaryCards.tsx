import { TrendingUp, TrendingDown } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { summaryApi, transactionsApi } from '../../services/api';
import { useDate } from '../../context/DateContext';
import { formatCurrency, capitalize, sparkChartRange, sparkChartX, formatSummaryAmount } from '../../utils/formatters';
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

  const { data: incomePage } = useQuery({
    queryKey: ['transactions', 'income-count', month, year],
    queryFn: () => transactionsApi.getPage({ month, year, type: 'INCOME' }, null, 1),
  });

  const sortedEvolution = evolution
    .slice()
    .sort((a, b) => a.year * 12 + a.month - (b.year * 12 + b.month));

  let cumulative = 0;
  const sparkPoints = sortedEvolution.map((m) => {
    cumulative += m.incomeCents - m.expensesCents;
    return cumulative;
  });
  const currentIdx = sortedEvolution.findIndex((m) => m.month === month && m.year === year);
  const previous = currentIdx > 0 ? sortedEvolution[currentIdx - 1] : undefined;
  const currentBalance = data?.balanceCents ?? 0;
  const previousBalance = previous ? previous.incomeCents - previous.expensesCents : undefined;
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
  const sparkRange = sparkChartRange(sparkMin, sparkMax);
  const sparkCoords = sparkPoints.map((v, i) => {
    const x = sparkChartX(i, sparkPoints.length);
    const y = 44 - ((v - sparkMin) / sparkRange) * 40;
    return { x: Math.round(x), y: Math.round(y) };
  });
  const sparkPts = sparkCoords.map((p) => `${p.x},${p.y}`).join(' ');
  const areaPts =
    sparkCoords.length > 1
      ? `0,48 ${sparkPts} 260,48`
      : '';
  const lastPt = sparkCoords[sparkCoords.length - 1];

  const incomeCount = incomePage?.totalCount ?? 0;

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.4fr_1fr_1fr]">
      {/* Hero: Saldo do mês */}
      <div className="relative flex flex-col justify-between overflow-hidden rounded-card bg-gradient-to-br from-forest to-forest-deep p-7 text-white shadow-card-hover">
        <div
          className="pointer-events-none absolute -right-10 -top-10 h-[180px] w-[180px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(125,232,250,0.14), transparent 70%)' }}
        />
        <div
          className="pointer-events-none absolute -bottom-8 -left-8 h-[140px] w-[140px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(125,232,250,0.06), transparent 70%)' }}
        />
        <div className="relative flex items-center justify-between">
          <span className="eyebrow text-[#A3C0D2]">Saldo do mês</span>
          {pctChange !== undefined && (
            <span
              className={clsx(
                'inline-flex items-center gap-1 rounded-pill px-2.5 py-1 text-xs font-semibold',
                pctChange >= 0 ? 'bg-lime/15 text-lime' : 'bg-white/10 text-white'
              )}
            >
              {pctChange >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
              {pctChange >= 0 ? '+' : ''}{pctChange}%
            </span>
          )}
        </div>
        <div className="relative">
          <div className="tabular my-3.5 font-display text-display-xl leading-none tracking-tight">
            {isLoading ? '—' : formatCurrency(currentBalance)}
          </div>
          {balanceDiff !== undefined && previousLabel && (
            <div className="text-[13px] text-[#A3C0D2]">
              {balanceDiff >= 0 ? '+ ' : '- '}
              {formatCurrency(Math.abs(balanceDiff))} em relação a {previousLabel}
            </div>
          )}
        </div>
        {sparkPoints.length > 1 && (
          <svg viewBox="0 0 260 48" preserveAspectRatio="none" className="relative mt-3.5 h-11 w-full">
            <defs>
              <linearGradient id="sparkGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(125,232,250,0.25)" />
                <stop offset="100%" stopColor="rgba(125,232,250,0)" />
              </linearGradient>
            </defs>
            <polygon points={areaPts} fill="url(#sparkGradient)" />
            <polyline points={sparkPts} fill="none" stroke="#7DE8FA" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            {lastPt && (
              <circle cx={lastPt.x} cy={lastPt.y} r={3.5} fill="#7DE8FA" stroke="#0B3A5C" strokeWidth={1.5} />
            )}
          </svg>
        )}
      </div>

      {/* KPI: Receitas */}
      <div className="card flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="eyebrow">Receitas</span>
          <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#E7F5EC]">
            <TrendingUp size={17} className="text-income" strokeWidth={2.2} />
          </div>
        </div>
        <div>
          <div className="tabular mt-4 whitespace-nowrap font-display text-display-md tracking-tight text-income">
            {formatSummaryAmount(isLoading, data?.totalIncomeCents)}
          </div>
          <div className="mt-0.5 text-[12px] text-faint">
            {incomeCount} entrada{incomeCount === 1 ? '' : 's'} no mês
          </div>
        </div>
      </div>

      {/* KPI: Despesas pessoais */}
      <div className="card flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="eyebrow">Despesas pessoais</span>
          <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#FBEBE6]">
            <TrendingDown size={17} className="text-expense" strokeWidth={2.2} />
          </div>
        </div>
        <div>
          <div className="tabular mt-4 whitespace-nowrap font-display text-display-md tracking-tight text-expense">
            {formatSummaryAmount(isLoading, data?.totalExpensesCents)}
          </div>
          <div className="mt-0.5 text-[12px] text-faint">
            Fatura total: {formatCurrency(data?.invoiceExpensesCents ?? 0)}
          </div>
        </div>
      </div>
    </div>
  );
}
