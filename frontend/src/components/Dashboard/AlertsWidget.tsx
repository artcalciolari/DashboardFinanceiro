import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { alertsApi } from '../../services/api';
import { formatCurrency } from '../../utils/formatters';
import { clsx } from 'clsx';

export default function AlertsWidget() {
  const { data = [], isLoading } = useQuery({
    queryKey: ['alerts', 'check'],
    queryFn: alertsApi.check,
    refetchInterval: 1000 * 60 * 5, // Atualiza a cada 5 minutos
  });

  const active = data.filter((a) => a.isTriggered || a.isWarning);

  return (
    <div className="card">
      <h3 className="mb-3 flex items-center gap-2 font-display text-base font-semibold text-ink">
        {active.length > 0 ? (
          <AlertTriangle size={18} className="text-amber" />
        ) : (
          <CheckCircle size={18} className="text-income" />
        )}
        Alertas de gastos
      </h3>
      {isLoading ? (
        <div className="py-8 text-center text-sm text-faint">Carregando...</div>
      ) : data.length === 0 ? (
        <div className="py-8 text-center text-sm text-faint">Nenhum alerta configurado</div>
      ) : active.length === 0 ? (
        <div className="py-8 text-center text-sm text-faint">Nenhum alerta próximo do limite</div>
      ) : (
        <div className="flex flex-col gap-3">
          {active.map((alert) => {
            const pct = Math.min(alert.percentage, 100);
            return (
              <div key={alert.id}>
                <div className="mb-1 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    {alert.isTriggered ? (
                      <XCircle size={14} className="text-expense" />
                    ) : (
                      <CheckCircle size={14} className="text-amber" />
                    )}
                    <span className="text-sm font-medium text-ink">{alert.name}</span>
                  </div>
                  <span className="text-xs text-faint">
                    {formatCurrency(alert.currentAmountCents)} / {formatCurrency(alert.limitAmountCents)}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-pill bg-chip">
                  <div
                    className={clsx(
                      'h-full rounded-pill transition-all',
                      alert.isTriggered ? 'bg-expense' : 'bg-amber'
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
