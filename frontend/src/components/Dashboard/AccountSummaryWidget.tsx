import { useQuery } from '@tanstack/react-query';
import { summaryApi } from '../../services/api';
import { useDate } from '../../context/DateContext';
import { formatCurrency, ACCOUNT_TYPE_LABELS } from '../../utils/formatters';
import { clsx } from 'clsx';

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
          <h3 className="font-display text-base font-semibold text-ink">Suas contas</h3>
          <p className="mt-0.5 text-[12.5px] text-faint">Movimentação líquida do mês</p>
        </div>
      </div>
      {isLoading ? (
        <div className="py-8 text-center text-sm text-faint">Carregando...</div>
      ) : withMovement.length === 0 ? (
        <div className="py-8 text-center text-sm text-faint">Nenhuma movimentação por conta neste mês</div>
      ) : (
        <div className="flex flex-col gap-3">
          {withMovement.map(({ account, incomeCents, expensesCents, invoiceExpensesCents, receivableCents, netCents }) => (
            <div key={account.id} className="flex items-center gap-3">
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
