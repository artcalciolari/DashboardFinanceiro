import { useQuery } from '@tanstack/react-query';
import { summaryApi } from '../../services/api';
import { useDate } from '../../context/DateContext';
import { formatCurrency, ACCOUNT_TYPE_LABELS } from '../../utils/formatters';
import { clsx } from 'clsx';
import Skeleton from '../ui/Skeleton';

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

export default function AccountSummaryWidget() {
  const { month, year } = useDate();

  const { data = [], isLoading } = useQuery({
    queryKey: ['summary', 'accounts', month, year],
    queryFn: () => summaryApi.getAccounts(month, year),
  });

  const withMovement = data.filter(
    (item) => item.incomeCents > 0 || item.expensesCents > 0 || item.invoiceExpensesCents > 0
  );

  return (
    <div className="card">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <div className="eyebrow">Movimentação líquida do mês</div>
          <h3 className="mt-1 font-display text-[15px] font-semibold text-ink">Suas contas</h3>
        </div>
      </div>
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-[64px] w-full" />
          <Skeleton className="h-[64px] w-full" />
          <span className="sr-only">Carregando...</span>
        </div>
      ) : withMovement.length === 0 ? (
        <div className="py-8 text-center text-sm text-faint">Nenhuma movimentação por conta neste mês</div>
      ) : (
        <div className="flex flex-col gap-1">
          {withMovement.map(({ account, incomeCents, expensesCents, invoiceExpensesCents, receivableCents, netCents }) => (
            <div key={account.id} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-paper">
              <div
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] font-display text-xs font-bold"
                style={{ backgroundColor: `${account.color}20`, color: account.color }}
              >
                {initials(account.name)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-semibold text-ink">{account.name}</div>
                <p className="truncate text-xs text-faint">
                  {ACCOUNT_TYPE_LABELS[account.type]} · +{formatCurrency(incomeCents)} / -{formatCurrency(expensesCents)}
                  {invoiceExpensesCents > expensesCents && ` · fatura ${formatCurrency(invoiceExpensesCents)}`}
                  {receivableCents > 0 && ` · a receber ${formatCurrency(receivableCents)}`}
                </p>
              </div>
              <div
                className={clsx('tabular flex-shrink-0 text-sm font-semibold', netCents >= 0 ? 'text-income' : 'text-expense')}
              >
                {formatCurrency(netCents)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
