import { useQuery } from '@tanstack/react-query';
import {
  ComposedChart,
  Bar,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { summaryApi } from '../../services/api';
import ChartTooltip from '../Charts/ChartTooltip';
import Skeleton from '../ui/Skeleton';

const LEGEND = [
  { name: 'Receitas', color: '#3E9E72' },
  { name: 'Despesas', color: '#E5A08B' },
  { name: 'Acumulado', color: '#0B3529' },
];

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
      <div className="mb-4 flex items-start justify-between">
        <div>
          <div className="eyebrow">Últimos 6 meses</div>
          <h3 className="mt-1 font-display text-[15px] font-semibold text-ink">Fluxo & saldo acumulado</h3>
        </div>
        <div className="flex items-center gap-3">
          {LEGEND.map((item) => (
            <span key={item.name} className="inline-flex items-center gap-1.5 text-[12px] text-muted">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
              {item.name}
            </span>
          ))}
        </div>
      </div>
      {isLoading ? (
        <div>
          <Skeleton className="h-[280px] w-full" />
          <span className="sr-only">Carregando...</span>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={chartData} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="cumGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0B3529" stopOpacity={0.10} />
                <stop offset="100%" stopColor="#0B3529" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#ECEAE3" strokeDasharray="2 6" vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11.5, fill: '#8B968F' }}
              dy={6}
            />
            <YAxis yAxisId="bars" hide />
            <YAxis yAxisId="line" orientation="right" hide />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(11,53,41,0.04)' }} />
            <Bar yAxisId="bars" dataKey="incomeCents" name="Receitas" fill="#3E9E72" radius={[6, 6, 0, 0]} barSize={20} />
            <Bar yAxisId="bars" dataKey="expensesCents" name="Despesas" fill="#E5A08B" radius={[6, 6, 0, 0]} barSize={20} />
            <Area
              yAxisId="line"
              type="monotone"
              dataKey="cumulative"
              stroke="none"
              fill="url(#cumGradient)"
            />
            <Line
              yAxisId="line"
              type="monotone"
              dataKey="cumulative"
              name="Acumulado"
              stroke="#0B3529"
              strokeWidth={2.5}
              dot={{ r: 3.5, fill: '#fff', stroke: '#0B3529', strokeWidth: 2.5 }}
              activeDot={{ r: 5 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
