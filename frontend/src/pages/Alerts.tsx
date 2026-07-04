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
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="font-display text-[24px] font-bold tracking-tight text-ink">Alertas</h1>
          <p className="mt-1 text-sm text-muted">
            {alerts.length} alerta(s) · {attentionCount} exigindo atenção
          </p>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus size={16} />
          Novo alerta
        </Button>
      </div>

      {isLoading ? (
        <div className="card py-8 text-center text-faint">Carregando...</div>
      ) : alerts.length === 0 ? (
        <div className="card py-8 text-center">
          <Bell size={32} className="mx-auto mb-2 text-faint" />
          <p className="mb-3 text-sm text-faint">Nenhum alerta configurado</p>
          <Button variant="secondary" size="sm" onClick={openCreate}>Criar alerta</Button>
        </div>
      ) : (
        <div className="flex max-w-[720px] flex-col gap-3">
          {sortedAlerts.map((alert) => {
            const status = statusMap[alert.id];
            const pct = status ? Math.min(status.percentage, 100) : 0;
            const accent = !alert.isActive
              ? '#8A978F'
              : status?.isTriggered
                ? '#C0523B'
                : status?.isWarning
                  ? '#B07A1E'
                  : '#0C3B2E';
            const iconBg = !alert.isActive
              ? '#F0EEE6'
              : status?.isTriggered
                ? '#FBEBE6'
                : status?.isWarning
                  ? '#FEF3C7'
                  : '#E9F0EC';

            return (
              <div
                key={alert.id}
                className="flex items-start gap-3.5 rounded-2xl border border-border bg-card py-[18px] pl-5 pr-5"
                style={{ borderLeft: `3px solid ${accent}` }}
              >
                <div
                  className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-[11px]"
                  style={{ backgroundColor: iconBg, color: accent }}
                >
                  {alert.isActive ? <Bell size={18} /> : <BellOff size={18} />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink">{alert.name}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-faint">
                    <span style={{ color: alert.category.color }}>{alert.category.name}</span>
                    <span>·</span>
                    <span>{alert.period === 'MONTHLY' ? 'Mensal' : 'Semanal'}</span>
                    {!alert.isActive && (
                      <span className="rounded-pill bg-chip px-2 py-0.5 text-[10px] font-semibold text-muted">
                        Inativo
                      </span>
                    )}
                  </p>

                  {alert.isActive && status && (
                    <div className="mt-3">
                      <div className="mb-1.5 flex justify-between text-xs text-muted">
                        <span>
                          {formatCurrency(status.currentAmount)} de {formatCurrency(alert.limitAmount)}
                          {status.isTriggered && ' · limite ultrapassado'}
                          {status.isWarning && !status.isTriggered && ' · quase no limite'}
                        </span>
                        <span className="font-semibold" style={{ color: accent }}>
                          {Math.round(status.percentage)}%
                        </span>
                      </div>
                      <div className="h-[7px] overflow-hidden rounded-pill bg-chip">
                        <div
                          className="h-full rounded-pill transition-all"
                          style={{ width: `${pct}%`, backgroundColor: accent }}
                        />
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex flex-shrink-0 items-center gap-1">
                  <button
                    onClick={() => updateMutation.mutate({ id: alert.id, data: { isActive: !alert.isActive } })}
                    className="rounded-lg p-1.5 text-faint transition-colors hover:bg-chip hover:text-forest"
                    title={alert.isActive ? 'Desativar' : 'Ativar'}
                  >
                    {alert.isActive ? <Bell size={14} /> : <BellOff size={14} />}
                  </button>
                  <button
                    onClick={() => openEdit(alert)}
                    className="rounded-lg p-1.5 text-faint transition-colors hover:bg-chip hover:text-forest"
                    title="Editar alerta"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(alert)}
                    className="rounded-lg p-1.5 text-faint transition-colors hover:bg-expense/10 hover:text-expense"
                    title="Excluir alerta"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={closeModal} title={editing ? 'Editar alerta' : 'Novo alerta'} size="sm">
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
              {editing ? 'Salvar' : 'Criar alerta'}
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
