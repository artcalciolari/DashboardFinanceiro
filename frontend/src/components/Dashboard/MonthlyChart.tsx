import { useQuery } from '@tanstack/react-query';
import {
  ComposedChart,
  Bar,
  Line,
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

  const sorted = data
    .slice()
    .sort((a, b) => a.year * 12 + a.month - (b.year * 12 + b.month));

  let cumulative = 0;
  const chartData = sorted.map((m) => {
    cumulative += m.incomeCents - m.expensesCents;
    return { ...m, cumulative };
  });

  return (
    <div className="card">
      <div className="mb-1 flex items-start justify-between">
        <div>
          <h3 className="font-display text-base font-semibold text-ink">Fluxo & saldo acumulado</h3>
          <p className="mt-0.5 text-[12.5px] text-faint">Últimos 6 meses</p>
        </div>
      </div>
      {isLoading ? (
        <div className="flex h-64 items-center justify-center text-faint">Carregando...</div>
      ) : (
        <ResponsiveContainer width="100%" height={270}>
          <ComposedChart data={chartData} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 4" stroke="#F2F0E8" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 12, fill: '#8A978F', fontFamily: 'Instrument Sans' }}
              axisLine={{ stroke: '#E6E3DA' }}
              tickLine={false}
            />
            <YAxis yAxisId="bars" hide />
            <YAxis yAxisId="line" orientation="right" hide />
            <Tooltip
              formatter={(value: number) => formatCurrency(value)}
              labelStyle={{ fontWeight: 600, color: '#12241D' }}
              contentStyle={{ borderRadius: 12, border: '1px solid #E6E3DA', fontSize: 13 }}
            />
            <Legend
              verticalAlign="top"
              align="right"
              height={28}
              wrapperStyle={{ fontSize: 12, color: '#5B6B63' }}
              iconType="square"
              iconSize={9}
            />
            <Bar yAxisId="bars" dataKey="incomeCents" name="Receitas" fill="#7FC59E" radius={[4, 4, 0, 0]} barSize={18} />
            <Bar yAxisId="bars" dataKey="expensesCents" name="Despesas" fill="#E0A594" radius={[4, 4, 0, 0]} barSize={18} />
            <Line
              yAxisId="line"
              type="monotone"
              dataKey="cumulative"
              name="Acumulado"
              stroke="#0C3B2E"
              strokeWidth={2.5}
              dot={{ r: 4, fill: '#fff', stroke: '#0C3B2E', strokeWidth: 2.5 }}
              activeDot={{ r: 5 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
