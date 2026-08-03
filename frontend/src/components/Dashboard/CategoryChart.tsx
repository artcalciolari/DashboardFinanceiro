import { useQuery } from '@tanstack/react-query';
import { PieChart } from 'lucide-react';
import { summaryApi } from '../../services/api';
import { useDate } from '../../context/DateContext';
import { formatCurrency } from '../../utils/formatters';
import EmptyState from '../ui/EmptyState';
import Skeleton from '../ui/Skeleton';

export default function CategoryChart() {
  const { month, year } = useDate();

  const { data = [], isLoading } = useQuery({
    queryKey: ['summary', 'categories', month, year],
    queryFn: () => summaryApi.getCategories(month, year),
  });

  const expenseData = data
    .filter((item) => item.type === 'EXPENSE' && item.totalCents > 0)
    .sort((a, b) => b.totalCents - a.totalCents);
  const totalExpenses = expenseData.reduce((sum, item) => sum + item.totalCents, 0);
  const maxValue = expenseData.length ? expenseData[0].totalCents : 0;

  return (
    <div className="card">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <div className="eyebrow">Despesas por categoria</div>
          <h3 className="mt-1 font-display text-[15px] font-semibold text-ink">Onde você gastou</h3>
        </div>
        {!isLoading && expenseData.length > 0 && (
          <span className="tabular font-display text-[15px] font-bold text-expense">
            {formatCurrency(totalExpenses)}
          </span>
        )}
      </div>
      {isLoading ? (
        <div>
          <Skeleton className="h-[280px] w-full" />
          <span className="sr-only">Carregando...</span>
        </div>
      ) : expenseData.length === 0 ? (
        <EmptyState icon={PieChart} title="Nenhuma despesa neste mês" />
      ) : (
        <div className="flex flex-col gap-[15px]">
          {expenseData.map((item) => {
            const share = Math.round((item.totalCents / totalExpenses) * 100);
            return (
              <div key={item.category.id}>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 text-[13px] font-medium text-ink">
                    <span className="h-2.5 w-2.5 rounded-[4px]" style={{ backgroundColor: item.category.color }} />
                    {item.category.name}
                  </span>
                  <span className="inline-flex items-baseline gap-1.5">
                    <span className="tabular text-[13px] font-semibold text-ink">
                      {formatCurrency(item.totalCents)}
                    </span>
                    <span className="text-[11.5px] text-faint">{share}%</span>
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-pill bg-chip">
                  <div
                    className="h-full rounded-pill transition-[width] duration-500 ease-out-expo"
                    style={{
                      width: `${Math.round((item.totalCents / maxValue) * 100)}%`,
                      backgroundColor: item.category.color,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
