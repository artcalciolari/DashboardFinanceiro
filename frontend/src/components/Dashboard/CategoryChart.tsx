import { useQuery } from '@tanstack/react-query';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
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
    .filter((d) => d.type === 'EXPENSE' && d.total > 0)
    .sort((a, b) => b.total - a.total);
  const totalExpenses = expenseData.reduce((sum, item) => sum + item.total, 0);

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3 mb-4">
        <h3 className="text-base font-semibold text-gray-800">Despesas por Categoria</h3>
        {!isLoading && expenseData.length > 0 && (
          <span className="text-xs font-semibold text-red-500">{formatCurrency(totalExpenses)}</span>
        )}
      </div>
      {isLoading ? (
        <div className="h-64 flex items-center justify-center text-gray-400">Carregando...</div>
      ) : expenseData.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-gray-400 text-sm">
          Nenhuma despesa neste mês
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={expenseData}
              dataKey="total"
              nameKey="category.name"
              cx="50%"
              cy="50%"
              outerRadius={90}
              innerRadius={50}
            >
              {expenseData.map((entry) => (
                <Cell key={entry.category.id} fill={entry.category.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => formatCurrency(value)}
              contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }}
            />
            <Legend
              wrapperStyle={{ fontSize: 11 }}
              formatter={(value: string) => value}
            />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
