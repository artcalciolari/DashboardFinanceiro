import { useQuery } from '@tanstack/react-query';
import { summaryApi } from '../../services/api';
import { useDate } from '../../context/DateContext';
import { formatCurrency, ACCOUNT_TYPE_LABELS } from '../../utils/formatters';
import { clsx } from 'clsx';

export default function AccountSummaryWidget() {
  const { month, year } = useDate();

  const { data = [], isLoading } = useQuery({
    queryKey: ['summary', 'accounts', month, year],
    queryFn: () => summaryApi.getAccounts(month, year),
  });

  const withMovement = data.filter((d) => d.income > 0 || d.expenses > 0 || d.invoiceExpenses > 0);

  return (
    <div className="card">
      <h3 className="text-base font-semibold text-gray-800 mb-3">Resumo por Conta</h3>
      {isLoading ? (
        <div className="py-8 text-center text-sm text-gray-400">Carregando...</div>
      ) : withMovement.length === 0 ? (
        <div className="py-8 text-center text-sm text-gray-400">Nenhuma movimentação por conta neste mês</div>
      ) : (
        <div className="space-y-3">
          {withMovement.map(({ account, income, expenses, invoiceExpenses, receivableAmount, net }) => (
            <div key={account.id} className="flex items-center gap-3">
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: account.color }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-800 truncate">{account.name}</span>
                  <span
                    className={clsx(
                      'text-sm font-semibold',
                      net >= 0 ? 'text-emerald-600' : 'text-red-600'
                    )}
                  >
                    {formatCurrency(net)}
                  </span>
                </div>
                <p className="text-xs text-gray-400">
                  {ACCOUNT_TYPE_LABELS[account.type]} · +{formatCurrency(income)} / pessoal -{formatCurrency(expenses)}
                  {invoiceExpenses > expenses && ` · fatura ${formatCurrency(invoiceExpenses)}`}
                  {receivableAmount > 0 && ` · a receber ${formatCurrency(receivableAmount)}`}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
