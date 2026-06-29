import { useQuery } from '@tanstack/react-query';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { summaryApi } from '../../services/api';
import { formatCurrency } from '../../utils/formatters';

export default function MonthlyChart() {
  const { data = [], isLoading } = useQuery({
    queryKey: ['summary', 'evolution'],
    queryFn: summaryApi.getEvolution,
  });

  return (
    <div className="card">
      <h3 className="text-base font-semibold text-gray-800 mb-4">Evolução Mensal</h3>
      {isLoading ? (
        <div className="h-64 flex items-center justify-center text-gray-400">Carregando...</div>
      ) : (
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 12, fill: '#6b7280' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#6b7280' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) =>
                v >= 1000 ? `R$${(v / 1000).toFixed(1)}k` : `R$${v}`
              }
            />
            <Tooltip
              formatter={(value: number) => formatCurrency(value)}
              labelStyle={{ fontWeight: 600 }}
              contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="income" name="Receitas" fill="#10b981" radius={[4, 4, 0, 0]} />
            <Bar dataKey="expenses" name="Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
