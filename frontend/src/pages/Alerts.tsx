import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Bell, BellOff } from 'lucide-react';
import { alertsApi, categoriesApi } from '../services/api';
import { formatCurrency } from '../utils/formatters';
import type { Alert, AlertPeriod } from '../types';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { clsx } from 'clsx';

interface FormState {
  name: string;
  categoryId: string;
  limitAmount: string;
  period: AlertPeriod;
  isActive: boolean;
}

const emptyForm: FormState = {
  name: '',
  categoryId: '',
  limitAmount: '',
  period: 'MONTHLY',
  isActive: true,
};

export default function Alerts() {
  const qc = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Alert | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Alert | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ['alerts'],
    queryFn: alertsApi.getAll,
  });

  const { data: alertStatuses = [] } = useQuery({
    queryKey: ['alerts', 'check'],
    queryFn: alertsApi.check,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: categoriesApi.getAll,
  });

  const expenseCategories = categories.filter((c) => c.type === 'EXPENSE');
  const invalidate = () => qc.invalidateQueries({ queryKey: ['alerts'] });

  const createMutation = useMutation({
    mutationFn: alertsApi.create,
    onSuccess: () => { invalidate(); closeModal(); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Alert> }) =>
      alertsApi.update(id, data),
    onSuccess: () => { invalidate(); closeModal(); },
  });

  const deleteMutation = useMutation({
    mutationFn: alertsApi.delete,
    onSuccess: () => {
      invalidate();
      setDeleteTarget(null);
    },
  });

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setIsModalOpen(true);
  }

  function openEdit(alert: Alert) {
    setEditing(alert);
    setForm({
      name: alert.name,
      categoryId: alert.categoryId,
      limitAmount: String(alert.limitAmount),
      period: alert.period,
      isActive: alert.isActive,
    });
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditing(null);
    setForm(emptyForm);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      name: form.name,
      categoryId: form.categoryId,
      limitAmount: parseFloat(form.limitAmount.replace(',', '.')),
      period: form.period,
      isActive: form.isActive,
    };
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const statusMap = Object.fromEntries(alertStatuses.map((s) => [s.id, s]));
  const sortedAlerts = alerts.slice().sort((a, b) => {
    const aStatus = statusMap[a.id];
    const bStatus = statusMap[b.id];
    const score = (alert: Alert, status: typeof aStatus) => {
      if (!alert.isActive) return 0;
      if (status?.isTriggered) return 3;
      if (status?.isWarning) return 2;
      return 1;
    };

    return score(b, bStatus) - score(a, aStatus);
  });
  const attentionCount = alertStatuses.filter((status) => status.isTriggered || status.isWarning).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Alertas de Gastos</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {alerts.length} alerta(s) · {attentionCount} exigindo atenção
          </p>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus size={16} />
          Novo Alerta
        </Button>
      </div>

      {isLoading ? (
        <div className="card text-center py-8 text-gray-400">Carregando...</div>
      ) : alerts.length === 0 ? (
        <div className="card text-center py-8">
          <Bell size={32} className="text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400 mb-3">Nenhum alerta configurado</p>
          <Button variant="secondary" size="sm" onClick={openCreate}>Criar alerta</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedAlerts.map((alert) => {
            const status = statusMap[alert.id];
            const pct = status ? Math.min(status.percentage, 100) : 0;

            return (
              <div key={alert.id} className={clsx('card border', status?.isTriggered ? 'border-red-200' : status?.isWarning ? 'border-amber-200' : 'border-gray-100')}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={clsx('p-2 rounded-lg', !alert.isActive ? 'bg-gray-100' : status?.isTriggered ? 'bg-red-50' : status?.isWarning ? 'bg-amber-50' : 'bg-blue-50')}>
                      {alert.isActive ? (
                        <Bell size={18} className={clsx(status?.isTriggered ? 'text-red-500' : status?.isWarning ? 'text-amber-500' : 'text-blue-500')} />
                      ) : (
                        <BellOff size={18} className="text-gray-400" />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800">{alert.name}</p>
                      <p className="text-xs text-gray-500 flex flex-wrap items-center gap-1.5">
                        <span style={{ color: alert.category.color }}>{alert.category.name}</span>
                        <span>·</span>
                        <span>{alert.period === 'MONTHLY' ? 'Mensal' : 'Semanal'}</span>
                        {!alert.isActive && (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500">
                            Inativo
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => updateMutation.mutate({ id: alert.id, data: { isActive: !alert.isActive } })}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title={alert.isActive ? 'Desativar' : 'Ativar'}
                    >
                      {alert.isActive ? <Bell size={14} /> : <BellOff size={14} />}
                    </button>
                    <button
                      onClick={() => openEdit(alert)}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Editar alerta"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(alert)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Excluir alerta"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {alert.isActive && status && (
                  <div className="mt-4">
                    <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                      <span>
                        {formatCurrency(status.currentAmount)} de {formatCurrency(alert.limitAmount)}
                        {status.isTriggered && ' · ⚠ Limite ultrapassado!'}
                        {status.isWarning && !status.isTriggered && ' · ⚡ Quase no limite'}
                      </span>
                      <span className={clsx('font-semibold', status.isTriggered ? 'text-red-500' : status.isWarning ? 'text-amber-500' : 'text-gray-600')}>
                        {Math.round(status.percentage)}%
                      </span>
                    </div>
                    <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={clsx('h-full rounded-full transition-all', status.isTriggered ? 'bg-red-500' : status.isWarning ? 'bg-amber-400' : 'bg-blue-500')}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={closeModal} title={editing ? 'Editar Alerta' : 'Novo Alerta'} size="sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nome do alerta"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Ex: Limite de alimentação"
            required
          />
          <Select
            label="Categoria"
            value={form.categoryId}
            onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
            required
          >
            <option value="">Selecione...</option>
            {expenseCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Limite (R$)"
              type="number"
              step="0.01"
              min="0.01"
              value={form.limitAmount}
              onChange={(e) => setForm({ ...form, limitAmount: e.target.value })}
              placeholder="0,00"
              required
            />
            <Select
              label="Período"
              value={form.period}
              onChange={(e) => setForm({ ...form, period: e.target.value as AlertPeriod })}
            >
              <option value="MONTHLY">Mensal</option>
              <option value="WEEKLY">Semanal</option>
            </Select>
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={closeModal}>Cancelar</Button>
            <Button type="submit" className="flex-1" loading={createMutation.isPending || updateMutation.isPending}>
              {editing ? 'Salvar' : 'Criar Alerta'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Excluir alerta"
        description={`Excluir "${deleteTarget?.name ?? ''}"? Esta regra deixará de monitorar o limite configurado.`}
        confirmLabel="Excluir"
        loading={deleteMutation.isPending}
        onClose={() => {
          if (!deleteMutation.isPending) setDeleteTarget(null);
        }}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
        }}
      />
    </div>
  );
}
