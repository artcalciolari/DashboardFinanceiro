import { useQuery } from '@tanstack/react-query';
import { summaryApi } from '../../services/api';
import { useDate } from '../../context/DateContext';
import { formatCurrency } from '../../utils/formatters';

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
      <div className="mb-[18px] flex items-start justify-between">
        <div>
          <h3 className="font-display text-base font-semibold text-ink">Onde você gastou</h3>
          <p className="mt-0.5 text-[12.5px] text-faint">Despesas por categoria</p>
        </div>
        {!isLoading && expenseData.length > 0 && (
          <span className="tabular font-display text-[15px] font-bold text-expense">
            {formatCurrency(totalExpenses)}
          </span>
        )}
      </div>
      {isLoading ? (
        <div className="flex h-64 items-center justify-center text-faint">Carregando...</div>
      ) : expenseData.length === 0 ? (
        <div className="flex h-64 items-center justify-center text-sm text-faint">
          Nenhuma despesa neste mês
        </div>
      ) : (
        <div className="flex flex-col gap-[15px]">
          {expenseData.map((item) => (
            <div key={item.category.id}>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-[13px] font-medium text-ink">
                  <span className="h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: item.category.color }} />
                  {item.category.name}
                </span>
                <span className="tabular text-[13px] font-semibold text-ink">
                  {formatCurrency(item.totalCents)}
                </span>
              </div>
              <div className="h-[7px] overflow-hidden rounded-pill bg-chip">
                <div
                  className="h-full rounded-pill transition-all"
                  style={{
                    width: `${maxValue > 0 ? Math.round((item.totalCents / maxValue) * 100) : 0}%`,
                    backgroundColor: item.category.color,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
