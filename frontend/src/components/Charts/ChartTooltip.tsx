import { formatCurrency } from '../../utils/formatters';

interface ChartTooltipProps {
  active?: boolean;
  label?: string;
  payload?: Array<{ name?: string; value?: number | string; color?: string }>;
}

export default function ChartTooltip({ active, label, payload }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-xl bg-forest-deep px-3.5 py-2.5 shadow-popover">
      {label && <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[#9DBBAD]">{label}</div>}
      <div className="flex flex-col gap-1">
        {payload.map((entry) => (
          <div key={entry.name} className="flex items-center gap-2 text-[12.5px]">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color ?? '#C8F169' }} />
            <span className="text-[#C9D8D0]">{entry.name}</span>
            <span className="tabular ml-auto pl-4 font-semibold text-white">
              {formatCurrency(Number(entry.value ?? 0))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
