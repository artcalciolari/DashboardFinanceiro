import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, RefreshCw } from 'lucide-react';
import { subscriptionsApi, accountsApi, categoriesApi } from '../services/api';
import { useDate } from '../context/DateContext';
import { centsToInput, formatCurrency, formatDate, parseCurrencyBR } from '../utils/formatters';
import type { Subscription } from '../types';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import FormError from '../components/ui/FormError';
import Skeleton from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import { getLocalDateInput } from '../utils/formatters';

interface FormState {
  name: string;
  amount: string;
  startDate: string;
  endDate: string;
  billingDay: string;
  accountId: string;
  categoryId: string;
  isActive: boolean;
  isThirdParty: boolean;
  thirdPartyName: string;
  isReimbursed: boolean;
  notes: string;
}

function createEmptyForm(): FormState {
  const today = new Date();
  return {
    name: '',
    amount: '',
    startDate: getLocalDateInput(today),
    endDate: '',
    billingDay: String(today.getDate()),
    accountId: '',
    categoryId: '',
    isActive: true,
    isThirdParty: false,
    thirdPartyName: '',
    isReimbursed: false,
    notes: '',
  };
}

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

function toInputDate(date?: string | null) {
  return date ? date.slice(0, 10) : '';
}

function toIsoDate(date: string) {
  return new Date(`${date}T12:00:00`).toISOString();
}

function getDayFromInputDate(date: string) {
  const day = date.split('-')[2];
  return day ? String(Number(day)) : '';
}

function getPeriodRange(month: number, year: number) {
  return {
    start: new Date(year, month - 1, 1, 0, 0, 0, 0),
    end: new Date(year, month, 0, 23, 59, 59, 999),
  };
}

export default function Subscriptions() {
  const qc = useQueryClient();
  const { month, year } = useDate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Subscription | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Subscription | null>(null);
  const [form, setForm] = useState<FormState>(createEmptyForm);
  const [page, setPage] = useState(1);
  const period = useMemo(() => getPeriodRange(month, year), [month, year]);

  const { data, isLoading } = useQuery({
    queryKey: ['subscriptions', page, month, year],
    queryFn: () => subscriptionsApi.getPage(page, 25, period.end.toISOString()),
  });
  const subscriptions = data?.items ?? [];

  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: accountsApi.getAll });
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: categoriesApi.getAll });

  const expenseCategories = categories.filter((category) => category.type === 'EXPENSE');
  const selectedAccount = accounts.find((account) => account.id === form.accountId);

  const sortedSubscriptions = subscriptions.slice().sort((a, b) => {
    const nextA =
      (a.nextTransaction ? new Date(a.nextTransaction.effectiveDate).getTime() : Number.POSITIVE_INFINITY);
    const nextB =
      (b.nextTransaction ? new Date(b.nextTransaction.effectiveDate).getTime() : Number.POSITIVE_INFINITY);

    return Number(b.isActive) - Number(a.isActive) || nextA - nextB || a.name.localeCompare(b.name);
  });

  const activeCount = data?.summary.activeCount ?? 0;
  const monthlyTotal = data?.summary.monthlyTotalCents ?? 0;
  const thirdPartyTotal = data?.summary.thirdPartyTotalCents ?? 0;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['subscriptions'] });
    qc.invalidateQueries({ queryKey: ['transactions'] });
    qc.invalidateQueries({ queryKey: ['summary'] });
    qc.invalidateQueries({ queryKey: ['alerts'] });
  };

  const createMutation = useMutation({
    mutationFn: subscriptionsApi.create,
    onSuccess: () => {
      invalidate();
      closeModal();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Subscription> }) =>
      subscriptionsApi.update(id, data),
    onSuccess: () => {
      invalidate();
      closeModal();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => subscriptionsApi.delete(id, 'future'),
    onSuccess: () => {
      invalidate();
      setDeleteTarget(null);
    },
  });

  function openCreate() {
    setEditing(null);
    setForm(createEmptyForm());
    setIsModalOpen(true);
  }

  function openEdit(subscription: Subscription) {
    setEditing(subscription);
    setForm({
      name: subscription.name,
      amount: centsToInput(subscription.amountCents),
      startDate: toInputDate(subscription.startDate),
      endDate: toInputDate(subscription.endDate),
      billingDay: String(subscription.billingDay),
      accountId: subscription.accountId,
      categoryId: subscription.categoryId,
      isActive: subscription.isActive,
      isThirdParty: subscription.isThirdParty,
      thirdPartyName: subscription.thirdPartyName ?? '',
      isReimbursed: subscription.isReimbursed,
      notes: subscription.notes ?? '',
    });
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditing(null);
    setForm(createEmptyForm());
    createMutation.reset();
    updateMutation.reset();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const payload = {
      name: form.name,
      amountCents: parseCurrencyBR(form.amount),
      startDate: toIsoDate(form.startDate),
      endDate: form.endDate ? toIsoDate(form.endDate) : null,
      billingDay: parseInt(form.billingDay),
      accountId: form.accountId,
      categoryId: form.categoryId,
      isActive: form.isActive,
      isThirdParty: form.isThirdParty,
      thirdPartyName: form.isThirdParty ? form.thirdPartyName || null : null,
      isReimbursed: form.isThirdParty ? form.isReimbursed : false,
      notes: form.notes || undefined,
    };

    if (editing) {
      updateMutation.mutate({ id: editing.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-display-lg tracking-tight text-ink">Assinaturas</h1>
          <p className="mt-1 text-[13.5px] capitalize text-muted">
            {activeCount} ativa(s) · {formatCurrency(monthlyTotal)} por mês
            {thirdPartyTotal > 0 && ` · terceiros ${formatCurrency(thirdPartyTotal)}`}
          </p>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus size={16} />
          Nova assinatura
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-[64px] w-full" />
          ))}
          <span className="sr-only">Carregando...</span>
        </div>
      ) : subscriptions.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={RefreshCw}
            title="Nenhuma assinatura cadastrada"
            actionLabel="Registrar assinatura"
            onAction={openCreate}
          />
        </div>
      ) : (
        <div className="overflow-hidden rounded-card border border-border bg-card">
          {sortedSubscriptions.map((subscription) => {
            const nextTransaction = subscription.nextTransaction ?? null;

            return (
              <div
                key={subscription.id}
                className="group flex items-center gap-3.5 border-b border-border-faint px-5 py-4 transition-colors last:border-b-0 hover:bg-paper"
              >
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[12px] bg-forest-soft font-display text-[13px] font-bold text-forest">
                  {initials(subscription.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-[14.5px] font-semibold text-ink">{subscription.name}</p>
                    {!subscription.isActive && (
                      <span className="rounded-pill bg-chip px-2 py-0.5 text-[10px] font-semibold text-faint">
                        Inativa
                      </span>
                    )}
                    {subscription.isThirdParty && (
                      <span className="rounded-pill bg-amber/10 px-2 py-0.5 text-[10px] font-semibold text-amber">
                        Terceiro{subscription.thirdPartyName ? `: ${subscription.thirdPartyName}` : ''}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[12.5px] text-faint">{subscription.account.name}</p>
                </div>
                <div className="mr-2 flex-shrink-0 text-right">
                  <div className="text-[11.5px] text-faint">Próx. cobrança</div>
                  <div className="text-[13px] font-semibold text-ink">
                    {nextTransaction ? formatDate(nextTransaction.effectiveDate) : `dia ${subscription.billingDay}`}
                  </div>
                </div>
                <div className="tabular flex-shrink-0 font-display text-[16px] font-bold text-ink">
                  {formatCurrency(subscription.amountCents)}
                </div>
                <div className="ml-2 flex flex-shrink-0 gap-1 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
                  <button
                    onClick={() => openEdit(subscription)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-faint transition-colors hover:bg-chip hover:text-forest"
                    title="Editar assinatura"
                    aria-label={`Editar ${subscription.name}`}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(subscription)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-faint transition-colors hover:bg-expense/10 hover:text-expense"
                    title="Encerrar assinatura"
                    aria-label={`Encerrar ${subscription.name}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {(data?.pagination.totalPages ?? 0) > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3">
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
            Anterior
          </Button>
          <span className="text-xs text-faint">Página {page} de {data?.pagination.totalPages}</span>
          <Button
            variant="secondary"
            size="sm"
            disabled={page >= data!.pagination.totalPages}
            onClick={() => setPage((value) => value + 1)}
          >
            Próxima
          </Button>
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editing ? 'Editar assinatura' : 'Nova assinatura'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nome da assinatura"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Ex: OpenAI, Spotify, iCloud..."
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Valor mensal (R$)"
              type="number"
              min="0.01"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="0,00"
              required
            />
            <Input
              label="Dia da cobrança"
              type="number"
              min="1"
              max="31"
              value={form.billingDay}
              onChange={(e) => setForm({ ...form, billingDay: e.target.value })}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Início"
              type="date"
              value={form.startDate}
              onChange={(e) => {
                const nextStart = e.target.value;
                const shouldSyncBillingDay =
                  !editing && form.billingDay === getDayFromInputDate(form.startDate);
                setForm({
                  ...form,
                  startDate: nextStart,
                  billingDay:
                    shouldSyncBillingDay || !form.billingDay
                      ? getDayFromInputDate(nextStart)
                      : form.billingDay,
                });
              }}
              required
            />
            <Input
              label="Fim (opcional)"
              type="date"
              value={form.endDate}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Conta / Cartão"
              value={form.accountId}
              onChange={(e) => setForm({ ...form, accountId: e.target.value })}
              required
            >
              <option value="">Selecione...</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>{account.name}</option>
              ))}
            </Select>
            <Select
              label="Categoria"
              value={form.categoryId}
              onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              required
            >
              <option value="">Selecione...</option>
              {expenseCategories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </Select>
          </div>
          {selectedAccount?.type === 'CREDIT_CARD' && (
            <p className="rounded-xl bg-forest-soft p-2.5 text-xs text-forest">
              {selectedAccount.closingDay && selectedAccount.dueDay
                ? `Fechamento dia ${selectedAccount.closingDay} · vencimento dia ${selectedAccount.dueDay}. A cobrança mensal respeitará a fatura do cartão.`
                : 'Complete fechamento e vencimento do cartão para calcular a cobrança automaticamente.'}
            </p>
          )}
          <div className="space-y-3 rounded-xl border border-border bg-chip/60 p-3">
            <label className="flex items-center gap-2 text-sm font-medium text-ink">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-border text-forest focus:ring-forest"
                checked={form.isThirdParty}
                onChange={(e) =>
                  setForm({
                    ...form,
                    isThirdParty: e.target.checked,
                    thirdPartyName: e.target.checked ? form.thirdPartyName : '',
                    isReimbursed: e.target.checked ? form.isReimbursed : false,
                  })
                }
              />
              Assinatura de terceiro
            </label>
            {form.isThirdParty && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input
                  label="Responsável"
                  value={form.thirdPartyName}
                  onChange={(e) => setForm({ ...form, thirdPartyName: e.target.value })}
                  placeholder="Ex: Lucas"
                />
                <label className="flex items-end gap-2 pb-2 text-sm font-medium text-ink">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-border text-forest focus:ring-forest"
                    checked={form.isReimbursed}
                    onChange={(e) => setForm({ ...form, isReimbursed: e.target.checked })}
                  />
                  Já foi reembolsado
                </label>
              </div>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm font-medium text-ink">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-border text-forest focus:ring-forest"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            Assinatura ativa
          </label>
          <Input
            label="Observações (opcional)"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Notas adicionais..."
          />
          <FormError error={createMutation.error ?? updateMutation.error} />
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={closeModal}>
              Cancelar
            </Button>
            <Button
              type="submit"
              className="flex-1"
              loading={createMutation.isPending || updateMutation.isPending}
            >
              {editing ? 'Salvar' : 'Adicionar'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Encerrar assinatura"
        description={`Encerrar "${deleteTarget?.name ?? ''}"? As cobranças futuras serão removidas, mas os meses antigos permanecem no histórico.`}
        confirmLabel="Encerrar"
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
