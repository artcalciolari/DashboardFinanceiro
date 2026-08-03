import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Bell, BellOff } from 'lucide-react';
import { alertsApi, categoriesApi } from '../services/api';
import { centsToInput, formatCurrency, parseCurrencyBR } from '../utils/formatters';
import type { Alert, AlertPeriod } from '../types';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import FormError from '../components/ui/FormError';
import Skeleton from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
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
    createMutation.reset();
    updateMutation.reset();
    setIsModalOpen(true);
  }

  function openEdit(alert: Alert) {
    setEditing(alert);
    setForm({
      name: alert.name,
      categoryId: alert.categoryId,
      limitAmount: centsToInput(alert.limitAmountCents),
      period: alert.period,
      isActive: alert.isActive,
    });
    createMutation.reset();
    updateMutation.reset();
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditing(null);
    setForm(emptyForm);
    createMutation.reset();
    updateMutation.reset();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      name: form.name,
      categoryId: form.categoryId,
      limitAmountCents: parseCurrencyBR(form.limitAmount),
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
          <h1 className="font-display text-display-lg tracking-tight text-ink">Alertas</h1>
          <p className="mt-1 text-[13.5px] text-muted">
            {alerts.length} alerta(s) · {attentionCount} exigindo atenção
          </p>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus size={16} />
          Novo alerta
        </Button>
      </div>

      {isLoading ? (
        <div className="flex max-w-[720px] flex-col gap-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-[88px] w-full rounded-2xl" />
          ))}
          <span className="sr-only">Carregando...</span>
        </div>
      ) : alerts.length === 0 ? (
        <div className="card max-w-[720px]">
          <EmptyState icon={Bell} title="Nenhum alerta configurado" actionLabel="Criar alerta" onAction={openCreate} />
        </div>
      ) : (
        <div className="flex max-w-[720px] flex-col gap-3">
          {sortedAlerts.map((alert) => {
            const status = statusMap[alert.id];
            const pct = status ? Math.min(status.percentage, 100) : 0;

            return (
              <div
                key={alert.id}
                className={clsx(
                  'flex items-start gap-3.5 rounded-2xl border border-border bg-card py-[18px] pl-5 pr-5 border-l-[3px]',
                  !alert.isActive && 'border-l-faint',
                  alert.isActive &&
                    (status?.isTriggered
                      ? 'border-l-expense'
                      : status?.isWarning
                        ? 'border-l-amber'
                        : 'border-l-forest')
                )}
              >
                <div
                  className={clsx(
                    'flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-[11px]',
                    !alert.isActive && 'bg-chip text-faint',
                    alert.isActive &&
                      status?.isTriggered &&
                      'bg-expense/10 text-expense',
                    alert.isActive &&
                      status?.isWarning &&
                      !status?.isTriggered &&
                      'bg-amber/10 text-amber',
                    alert.isActive &&
                      (!status || (!status.isTriggered && !status.isWarning)) &&
                      'bg-forest-soft text-income'
                  )}
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
                          {formatCurrency(status.currentAmountCents)} de {formatCurrency(alert.limitAmountCents)}
                          {status.isTriggered && ' · limite ultrapassado'}
                          {status.isWarning && !status.isTriggered && ' · quase no limite'}
                        </span>
                        <span
                          className={clsx(
                            'font-semibold',
                            status.isTriggered
                              ? 'text-expense'
                              : status.isWarning
                                ? 'text-amber'
                                : 'text-income'
                          )}
                        >
                          {Math.round(status.percentage)}%
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-pill bg-chip">
                        <div
                          className={clsx(
                            'h-full rounded-pill transition-[width] duration-500',
                            status.isTriggered ? 'bg-expense' : status.isWarning ? 'bg-amber' : 'bg-forest'
                          )}
                          style={{ width: `${pct}%` }}
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
          <FormError error={createMutation.error ?? updateMutation.error} />
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
        error={deleteMutation.error}
        onClose={() => {
          if (!deleteMutation.isPending) {
            setDeleteTarget(null);
            deleteMutation.reset();
          }
        }}
        onConfirm={() => {
          deleteMutation.mutate(deleteTarget!.id);
        }}
      />
    </div>
  );
}
