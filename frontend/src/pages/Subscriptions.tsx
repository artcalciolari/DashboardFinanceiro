import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, RefreshCw } from 'lucide-react';
import { clsx } from 'clsx';
import { subscriptionsApi, accountsApi, categoriesApi } from '../services/api';
import { useDate } from '../context/DateContext';
import { formatCurrency, formatDate, formatMonthYear } from '../utils/formatters';
import type { Subscription } from '../types';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import ConfirmDialog from '../components/ui/ConfirmDialog';

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

const todayInput = new Date().toISOString().slice(0, 10);

const emptyForm: FormState = {
  name: '',
  amount: '',
  startDate: todayInput,
  endDate: '',
  billingDay: String(new Date().getDate()),
  accountId: '',
  categoryId: '',
  isActive: true,
  isThirdParty: false,
  thirdPartyName: '',
  isReimbursed: false,
  notes: '',
};

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
  const [form, setForm] = useState<FormState>(emptyForm);

  const { data: subscriptions = [], isLoading } = useQuery({
    queryKey: ['subscriptions'],
    queryFn: subscriptionsApi.getAll,
  });

  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: accountsApi.getAll });
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: categoriesApi.getAll });

  const expenseCategories = categories.filter((category) => category.type === 'EXPENSE');
  const selectedAccount = accounts.find((account) => account.id === form.accountId);
  const period = useMemo(() => getPeriodRange(month, year), [month, year]);

  const sortedSubscriptions = subscriptions.slice().sort((a, b) => {
    const nextA =
      a.transactions
        ?.map((transaction) => new Date(transaction.effectiveDate).getTime())
        .filter((time) => time > period.end.getTime())
        .sort((left, right) => left - right)[0] ?? Number.POSITIVE_INFINITY;
    const nextB =
      b.transactions
        ?.map((transaction) => new Date(transaction.effectiveDate).getTime())
        .filter((time) => time > period.end.getTime())
        .sort((left, right) => left - right)[0] ?? Number.POSITIVE_INFINITY;

    return Number(b.isActive) - Number(a.isActive) || nextA - nextB || a.name.localeCompare(b.name);
  });

  const monthlyTotal = subscriptions
    .filter((subscription) => subscription.isActive && !subscription.isThirdParty)
    .reduce((sum, subscription) => sum + subscription.amount, 0);
  const thirdPartyTotal = subscriptions
    .filter((subscription) => subscription.isActive && subscription.isThirdParty)
    .reduce((sum, subscription) => sum + subscription.amount, 0);

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
    setForm(emptyForm);
    setIsModalOpen(true);
  }

  function openEdit(subscription: Subscription) {
    setEditing(subscription);
    setForm({
      name: subscription.name,
      amount: String(subscription.amount),
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
    setForm(emptyForm);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const payload = {
      name: form.name,
      amount: parseFloat(form.amount.replace(',', '.')),
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
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Assinaturas</h1>
          <p className="text-sm text-gray-500 mt-0.5 capitalize">
            {subscriptions.length} assinatura(s) · pessoais {formatCurrency(monthlyTotal)} · terceiros {formatCurrency(thirdPartyTotal)} · referência {formatMonthYear(month, year)}
          </p>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus size={16} />
          Nova Assinatura
        </Button>
      </div>

      {isLoading ? (
        <div className="card text-center py-8 text-gray-400">Carregando...</div>
      ) : subscriptions.length === 0 ? (
        <div className="card text-center py-8">
          <RefreshCw size={32} className="text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400 mb-3">Nenhuma assinatura cadastrada</p>
          <Button variant="secondary" size="sm" onClick={openCreate}>
            Registrar assinatura
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedSubscriptions.map((subscription) => {
            const transactions = subscription.transactions ?? [];
            const currentTransaction = transactions.find((transaction) => {
              const effectiveDate = new Date(transaction.effectiveDate);
              return effectiveDate >= period.start && effectiveDate <= period.end;
            });
            const nextTransaction = transactions.find(
              (transaction) => new Date(transaction.effectiveDate) > period.end
            );

            return (
              <div key={subscription.id} className="card">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="p-2 rounded-lg flex-shrink-0"
                      style={{ backgroundColor: subscription.category.color + '20' }}
                    >
                      <RefreshCw size={18} style={{ color: subscription.category.color }} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-gray-800 truncate">{subscription.name}</p>
                        <span
                          className={clsx(
                            'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                            subscription.isActive
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-gray-100 text-gray-500'
                          )}
                        >
                          {subscription.isActive ? 'Ativa' : 'Inativa'}
                        </span>
                        {subscription.isThirdParty && (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                            Terceiro{subscription.thirdPartyName ? `: ${subscription.thirdPartyName}` : ''}
                          </span>
                        )}
                        {subscription.isThirdParty && currentTransaction?.isReimbursed && (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                            Reembolsado
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        {subscription.account.name} ·{' '}
                        <span style={{ color: subscription.category.color }}>{subscription.category.name}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => openEdit(subscription)}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Editar assinatura"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(subscription)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Encerrar assinatura"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div>
                    <p className="text-xs text-gray-500">Valor mensal</p>
                    <p className="text-sm font-bold text-gray-800">{formatCurrency(subscription.amount)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Cobrança</p>
                    <p className="text-sm font-bold text-gray-800">Dia {subscription.billingDay}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Neste mês</p>
                    <p className="text-sm font-bold text-gray-800">
                      {currentTransaction ? formatDate(currentTransaction.effectiveDate) : 'Sem cobrança'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Próxima</p>
                    <p className="text-sm font-bold text-gray-800">
                      {nextTransaction ? formatDate(nextTransaction.effectiveDate) : 'Não prevista'}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editing ? 'Editar Assinatura' : 'Nova Assinatura'}
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
            <p className="text-xs text-blue-600 bg-blue-50 rounded-lg p-2">
              {selectedAccount.closingDay && selectedAccount.dueDay
                ? `Fechamento dia ${selectedAccount.closingDay} · vencimento dia ${selectedAccount.dueDay}. A cobrança mensal respeitará a fatura do cartão.`
                : 'Complete fechamento e vencimento do cartão para calcular a cobrança automaticamente.'}
            </p>
          )}
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-3">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Responsável"
                  value={form.thirdPartyName}
                  onChange={(e) => setForm({ ...form, thirdPartyName: e.target.value })}
                  placeholder="Ex: Lucas"
                />
                <label className="flex items-end gap-2 text-sm font-medium text-gray-700 pb-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    checked={form.isReimbursed}
                    onChange={(e) => setForm({ ...form, isReimbursed: e.target.checked })}
                  />
                  Já foi reembolsado
                </label>
              </div>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
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
