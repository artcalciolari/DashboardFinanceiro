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
    <div className={clsx('card border', active.length > 0 ? 'border-amber-100' : 'border-emerald-100')}>
      <h3 className="text-base font-semibold text-gray-800 mb-3 flex items-center gap-2">
        {active.length > 0 ? (
          <AlertTriangle size={18} className="text-amber-500" />
        ) : (
          <CheckCircle size={18} className="text-emerald-500" />
        )}
        Alertas de Gastos
      </h3>
      {isLoading ? (
        <div className="py-8 text-center text-sm text-gray-400">Carregando...</div>
      ) : data.length === 0 ? (
        <div className="py-8 text-center text-sm text-gray-400">Nenhum alerta configurado</div>
      ) : active.length === 0 ? (
        <div className="py-8 text-center text-sm text-gray-400">Nenhum alerta próximo do limite</div>
      ) : (
        <div className="space-y-3">
          {active.map((alert) => {
            const pct = Math.min(alert.percentage, 100);
            return (
              <div key={alert.id}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    {alert.isTriggered ? (
                      <XCircle size={14} className="text-red-500" />
                    ) : (
                      <CheckCircle size={14} className="text-amber-500" />
                    )}
                    <span className="text-sm font-medium text-gray-700">{alert.name}</span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {formatCurrency(alert.currentAmount)} / {formatCurrency(alert.limitAmount)}
                  </span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={clsx(
                      'h-full rounded-full transition-all',
                      alert.isTriggered ? 'bg-red-500' : 'bg-amber-400'
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
