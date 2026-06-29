import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { transactionsApi, accountsApi, categoriesApi } from '../services/api';
import { useDate } from '../context/DateContext';
import { formatCurrency, formatDate } from '../utils/formatters';
import type { Transaction } from '../types';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { clsx } from 'clsx';

interface FormState {
  description: string;
  amount: string;
  type: 'INCOME' | 'EXPENSE';
  date: string;
  accountId: string;
  categoryId: string;
  isThirdParty: boolean;
  thirdPartyName: string;
  isReimbursed: boolean;
  notes: string;
}

const emptyForm: FormState = {
  description: '',
  amount: '',
  type: 'EXPENSE',
  date: new Date().toISOString().slice(0, 10),
  accountId: '',
  categoryId: '',
  isThirdParty: false,
  thirdPartyName: '',
  isReimbursed: false,
  notes: '',
};

export default function Transactions() {
  const { month, year } = useDate();
  const qc = useQueryClient();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [filterAccount, setFilterAccount] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterType, setFilterType] = useState('');

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['transactions', month, year, filterAccount, filterCategory, filterType],
    queryFn: () =>
      transactionsApi.getAll({
        month,
        year,
        accountId: filterAccount || undefined,
        categoryId: filterCategory || undefined,
        type: filterType || undefined,
      }),
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: accountsApi.getAll,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: categoriesApi.getAll,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['transactions'] });
    qc.invalidateQueries({ queryKey: ['summary'] });
  };

  const createMutation = useMutation({
    mutationFn: transactionsApi.create,
    onSuccess: () => { invalidate(); closeModal(); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Transaction> }) =>
      transactionsApi.update(id, data),
    onSuccess: () => { invalidate(); closeModal(); },
  });

  const deleteMutation = useMutation({
    mutationFn: transactionsApi.delete,
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

  function openEdit(t: Transaction) {
    setEditing(t);
    setForm({
      description: t.description,
      amount: String(t.amount),
      type: t.type,
      date: t.date.slice(0, 10),
      accountId: t.accountId,
      categoryId: t.categoryId,
      isThirdParty: t.isThirdParty ?? false,
      thirdPartyName: t.thirdPartyName ?? '',
      isReimbursed: t.isReimbursed ?? false,
      notes: t.notes ?? '',
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
      description: form.description,
      amount: parseFloat(form.amount.replace(',', '.')),
      type: form.type,
      date: new Date(form.date + 'T12:00:00').toISOString(),
      accountId: form.accountId,
      categoryId: form.categoryId,
      isThirdParty: form.type === 'EXPENSE' ? form.isThirdParty : false,
      thirdPartyName:
        form.type === 'EXPENSE' && form.isThirdParty ? form.thirdPartyName || null : null,
      isReimbursed: form.type === 'EXPENSE' && form.isThirdParty ? form.isReimbursed : false,
      notes: form.notes || undefined,
    };

    if (editing) {
      updateMutation.mutate({ id: editing.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const filteredCategories = categories.filter((c) => c.type === form.type);
  const filterCategories = filterType
    ? categories.filter((c) => c.type === filterType)
    : categories;
  const hasActiveFilters = Boolean(filterType || filterAccount || filterCategory);

  const totalIncome = transactions.filter((t) => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0);
  const invoiceExpense = transactions.filter((t) => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0);
  const thirdPartyExpense = transactions
    .filter((t) => t.type === 'EXPENSE' && t.isThirdParty)
    .reduce((s, t) => s + t.amount, 0);
  const receivable = transactions
    .filter((t) => t.type === 'EXPENSE' && t.isThirdParty && !t.isReimbursed)
    .reduce((s, t) => s + t.amount, 0);
  const totalExpense = invoiceExpense - thirdPartyExpense;
  const balance = totalIncome - totalExpense;

  function resetFilters() {
    setFilterType('');
    setFilterAccount('');
    setFilterCategory('');
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Transações</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {transactions.length} transações · Receitas: {formatCurrency(totalIncome)} · Despesas pessoais: {formatCurrency(totalExpense)} · Fatura: {formatCurrency(invoiceExpense)} · A receber: {formatCurrency(receivable)} · Saldo: {formatCurrency(balance)}
          </p>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus size={16} />
          Nova
        </Button>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Select
            label="Tipo"
            value={filterType}
            onChange={(e) => {
              setFilterType(e.target.value);
              setFilterCategory('');
            }}
          >
            <option value="">Todos</option>
            <option value="INCOME">Receita</option>
            <option value="EXPENSE">Despesa</option>
          </Select>
          <Select
            label="Conta"
            value={filterAccount}
            onChange={(e) => setFilterAccount(e.target.value)}
          >
            <option value="">Todas</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </Select>
          <Select
            label="Categoria"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
          >
            <option value="">Todas</option>
            {filterCategories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
          <div className="flex items-end">
            <Button
              variant="secondary"
              className="w-full"
              onClick={resetFilters}
              disabled={!hasActiveFilters}
            >
              Limpar filtros
            </Button>
          </div>
        </div>
      </div>

      {/* Transaction list */}
      <div className="card p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Carregando...</div>
        ) : transactions.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <p className="text-sm">
              {hasActiveFilters ? 'Nenhuma transação encontrada com estes filtros' : 'Nenhuma transação encontrada'}
            </p>
            {hasActiveFilters ? (
              <Button variant="secondary" size="sm" className="mt-3" onClick={resetFilters}>
                Limpar filtros
              </Button>
            ) : (
              <Button variant="secondary" size="sm" className="mt-3" onClick={openCreate}>
                Adicionar primeira transação
              </Button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {transactions.map((t) => (
              <div key={t.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                <div className={clsx('p-2 rounded-lg flex-shrink-0', t.type === 'INCOME' ? 'bg-emerald-50' : 'bg-red-50')}>
                  {t.type === 'INCOME' ? (
                    <ArrowUpCircle size={16} className="text-emerald-600" />
                  ) : (
                    <ArrowDownCircle size={16} className="text-red-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{t.description}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-0.5">
                    <span
                      className="text-xs px-2 py-0.5 rounded-full text-white"
                      style={{ backgroundColor: t.category.color }}
                    >
                      {t.category.name}
                    </span>
                    <span className="text-xs text-gray-400">{t.account.name}</span>
                    {t.installmentNumber && (
                      <span className="text-xs text-gray-400">
                        Parcela {t.installmentNumber}/{t.totalInstallments}
                      </span>
                    )}
                    {t.subscriptionId && (
                      <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                        Assinatura
                      </span>
                    )}
                    {t.isThirdParty && (
                      <span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                        Terceiro{t.thirdPartyName ? `: ${t.thirdPartyName}` : ''}
                      </span>
                    )}
                    {t.isThirdParty && t.isReimbursed && (
                      <span className="text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                        Reembolsado
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={clsx('text-sm font-semibold', t.type === 'INCOME' ? 'text-emerald-600' : 'text-red-500')}>
                    {t.type === 'INCOME' ? '+' : '-'}{formatCurrency(t.amount)}
                  </p>
                  <p className="text-xs text-gray-400">{formatDate(t.effectiveDate)}</p>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button
                    onClick={() => openEdit(t)}
                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Editar transação"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(t)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Excluir transação"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editing ? 'Editar Transação' : 'Nova Transação'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Tipo"
              value={form.type}
              onChange={(e) => {
                const type = e.target.value as 'INCOME' | 'EXPENSE';
                setForm({
                  ...form,
                  type,
                  categoryId: '',
                  isThirdParty: type === 'EXPENSE' ? form.isThirdParty : false,
                  thirdPartyName: type === 'EXPENSE' ? form.thirdPartyName : '',
                  isReimbursed: type === 'EXPENSE' ? form.isReimbursed : false,
                });
              }}
              required
            >
              <option value="EXPENSE">Despesa</option>
              <option value="INCOME">Receita</option>
            </Select>
            <Input
              label="Valor (R$)"
              type="number"
              step="0.01"
              min="0.01"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="0,00"
              required
            />
          </div>
          <Input
            label="Descrição"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Ex: Mercado, Salário..."
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Conta / Cartão"
              value={form.accountId}
              onChange={(e) => setForm({ ...form, accountId: e.target.value })}
              required
            >
              <option value="">Selecione...</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
            <Select
              label="Categoria"
              value={form.categoryId}
              onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              required
            >
              <option value="">Selecione...</option>
              {filteredCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </div>
          <Input
            label="Data da Compra"
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            required
          />
          {form.type === 'EXPENSE' && (
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
                Compra de terceiro
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
          )}
          <Input
            label="Observações (opcional)"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Notas adicionais..."
          />
          {form.accountId && accounts.find((a) => a.id === form.accountId)?.type === 'CREDIT_CARD' && (
            <div className="text-xs text-blue-600 bg-blue-50 rounded-lg p-2">
              {(() => {
                const acc = accounts.find((a) => a.id === form.accountId);
                if (acc?.closingDay) {
                  return `Fechamento no dia ${acc.closingDay}. A data efetiva será calculada automaticamente.`;
                }
                return 'Configure o dia de fechamento da conta para cálculo automático da data efetiva.';
              })()}
            </div>
          )}
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
        title="Excluir transação"
        description={`Excluir "${deleteTarget?.description ?? ''}"? Esta ação remove a movimentação deste mês.`}
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
