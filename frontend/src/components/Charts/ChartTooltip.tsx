import { formatCurrency } from '../../utils/formatters';

interface ChartTooltipProps {
  active?: boolean;
  label?: string;
  payload?: Array<{ name?: string; value?: number | string; color?: string }>;
  /** dataKeys de séries auxiliares (ex: Area de preenchimento) a ocultar */
  exclude?: string[];
}

export default function ChartTooltip({ active, label, payload, exclude = [] }: ChartTooltipProps) {
  const entries = payload?.filter((entry) => entry.name && !exclude.includes(entry.name));
  if (!active || !entries || entries.length === 0) return null;
  return (
    <div className="rounded-xl bg-forest-deep px-3.5 py-2.5 shadow-popover">
      {label && <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[#9FB9CC]">{label}</div>}
      <div className="flex flex-col gap-1">
        {entries.map((entry) => (
          <div key={entry.name} className="flex items-center gap-2 text-[12.5px]">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color ?? '#7DE8FA' }} />
            <span className="text-[#C9DAE4]">{entry.name}</span>
            <span className="tabular ml-auto pl-4 font-semibold text-white">
              {formatCurrency(Number(entry.value ?? 0))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
