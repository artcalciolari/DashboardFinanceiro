import { TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { summaryApi } from '../../services/api';
import { useDate } from '../../context/DateContext';
import { formatCurrency } from '../../utils/formatters';
import { clsx } from 'clsx';

export default function SummaryCards() {
  const { month, year } = useDate();

  const { data, isLoading } = useQuery({
    queryKey: ['summary', 'monthly', month, year],
    queryFn: () => summaryApi.getMonthly(month, year),
  });

  const cards = [
    {
      label: 'Receitas',
      value: data?.totalIncome ?? 0,
      icon: TrendingUp,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      border: 'border-emerald-100',
    },
    {
      label: 'Despesas pessoais',
      value: data?.totalExpenses ?? 0,
      description: `Fatura: ${formatCurrency(data?.invoiceExpenses ?? 0)}`,
      icon: TrendingDown,
      color: 'text-red-600',
      bg: 'bg-red-50',
      border: 'border-red-100',
    },
    {
      label: 'A receber',
      value: data?.receivableAmount ?? 0,
      description: `Terceiros: ${formatCurrency(data?.thirdPartyExpenses ?? 0)}`,
      icon: Wallet,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      border: 'border-amber-100',
    },
    {
      label: 'Saldo',
      value: data?.balance ?? 0,
      icon: Wallet,
      color: (data?.balance ?? 0) >= 0 ? 'text-blue-600' : 'text-red-600',
      bg: (data?.balance ?? 0) >= 0 ? 'bg-blue-50' : 'bg-red-50',
      border: (data?.balance ?? 0) >= 0 ? 'border-blue-100' : 'border-red-100',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {cards.map(({ label, value, description, icon: Icon, color, bg, border }) => (
        <div key={label} className={clsx('card border', border)}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">{label}</p>
              <p className={clsx('text-2xl font-bold mt-1', color)}>
                {isLoading ? '—' : formatCurrency(value)}
              </p>
              {description && (
                <p className="text-xs text-gray-400 mt-1">
                  {isLoading ? ' ' : description}
                </p>
              )}
            </div>
            <div className={clsx('p-3 rounded-xl', bg)}>
              <Icon size={22} className={color} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
