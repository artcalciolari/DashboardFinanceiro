import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, CreditCard, Building2, Wallet, TrendingUp } from 'lucide-react';
import { accountsApi } from '../services/api';
import { formatCurrency, ACCOUNT_TYPE_LABELS } from '../utils/formatters';
import type { Account, AccountType } from '../types';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import ColorPicker from '../components/ui/ColorPicker';
import ConfirmDialog from '../components/ui/ConfirmDialog';

const ACCOUNT_ICONS: Record<AccountType, typeof CreditCard> = {
  CREDIT_CARD: CreditCard,
  BANK_ACCOUNT: Building2,
  CASH: Wallet,
  INVESTMENT: TrendingUp,
};

interface FormState {
  name: string;
  type: AccountType;
  balance: string;
  creditLimit: string;
  color: string;
  closingDay: string;
  dueDay: string;
}

const emptyForm: FormState = {
  name: '',
  type: 'BANK_ACCOUNT',
  balance: '0',
  creditLimit: '',
  color: '#3B82F6',
  closingDay: '',
  dueDay: '',
};

export default function Accounts() {
  const qc = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Account | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: accountsApi.getAll,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['accounts'] });
    qc.invalidateQueries({ queryKey: ['summary'] });
  };

  const createMutation = useMutation({
    mutationFn: accountsApi.create,
    onSuccess: () => { invalidate(); closeModal(); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Account> }) =>
      accountsApi.update(id, data),
    onSuccess: () => { invalidate(); closeModal(); },
  });

  const deleteMutation = useMutation({
    mutationFn: accountsApi.delete,
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

  function openEdit(account: Account) {
    setEditing(account);
    setForm({
      name: account.name,
      type: account.type,
      balance: String(account.balance),
      creditLimit: account.creditLimit ? String(account.creditLimit) : '',
      color: account.color,
      closingDay: account.closingDay ? String(account.closingDay) : '',
      dueDay: account.dueDay ? String(account.dueDay) : '',
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
      type: form.type,
      balance: form.type === 'CREDIT_CARD' ? 0 : parseFloat(form.balance.replace(',', '.')),
      color: form.color,
      creditLimit:
        form.type === 'CREDIT_CARD' && form.creditLimit
          ? parseFloat(form.creditLimit.replace(',', '.'))
          : null,
      closingDay: form.closingDay ? parseInt(form.closingDay) : null,
      dueDay: form.dueDay ? parseInt(form.dueDay) : null,
    };

    if (editing) {
      updateMutation.mutate({ id: editing.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const cashBalance = accounts
    .filter((account) => account.type !== 'CREDIT_CARD')
    .reduce((sum, account) => sum + account.balance, 0);
  const creditCards = accounts.filter((account) => account.type === 'CREDIT_CARD');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Contas e Cartões</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {accounts.length} conta(s) · {creditCards.length} cartão(ões) · Saldo base {formatCurrency(cashBalance)}
          </p>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus size={16} />
          Nova Conta
        </Button>
      </div>

      {isLoading ? (
        <div className="card text-center text-gray-400 py-8">Carregando...</div>
      ) : accounts.length === 0 ? (
        <div className="card text-center py-8">
          <p className="text-gray-400 text-sm mb-3">Nenhuma conta cadastrada</p>
          <Button variant="secondary" size="sm" onClick={openCreate}>Adicionar conta</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map((account) => {
            const Icon = ACCOUNT_ICONS[account.type];
            return (
              <div key={account.id} className="card border border-gray-100">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="p-2.5 rounded-xl"
                      style={{ backgroundColor: account.color + '20' }}
                    >
                      <Icon size={20} style={{ color: account.color }} />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800">{account.name}</p>
                      <p className="text-xs text-gray-500">{ACCOUNT_TYPE_LABELS[account.type]}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => openEdit(account)}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Editar conta"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(account)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Excluir conta"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-gray-50">
                  {account.type === 'CREDIT_CARD' ? (
                    <>
                      <p className="text-xs text-gray-500">Limite total</p>
                      <p className="text-lg font-bold text-gray-800">
                        {account.creditLimit ? formatCurrency(account.creditLimit) : 'Não informado'}
                      </p>
                      {(account.closingDay || account.dueDay) && (
                        <p className="text-xs text-gray-400 mt-1">
                          {account.closingDay && `Fecha dia ${account.closingDay}`}
                          {account.closingDay && account.dueDay && ' · '}
                          {account.dueDay && `Vence dia ${account.dueDay}`}
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="text-xs text-gray-500">Saldo inicial</p>
                      <p className="text-lg font-bold text-gray-800">{formatCurrency(account.balance)}</p>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      <Modal isOpen={isModalOpen} onClose={closeModal} title={editing ? 'Editar Conta' : 'Nova Conta'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nome da conta"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Ex: Nubank, Bradesco, Dinheiro..."
            required
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Tipo"
              value={form.type}
              onChange={(e) => {
                const type = e.target.value as AccountType;
                setForm({
                  ...form,
                  type,
                  balance: type === 'CREDIT_CARD' ? '0' : form.balance,
                  creditLimit: type === 'CREDIT_CARD' ? form.creditLimit : '',
                });
              }}
              required
            >
              {Object.entries(ACCOUNT_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
            {form.type === 'CREDIT_CARD' ? (
              <Input
                label="Limite total (opcional)"
                type="number"
                step="0.01"
                min="0.01"
                value={form.creditLimit}
                onChange={(e) => setForm({ ...form, creditLimit: e.target.value })}
                placeholder="Ex: 5000"
              />
            ) : (
              <Input
                label="Saldo inicial (R$)"
                type="number"
                step="0.01"
                value={form.balance}
                onChange={(e) => setForm({ ...form, balance: e.target.value })}
              />
            )}
          </div>

          {form.type === 'CREDIT_CARD' && (
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Dia de fechamento"
                type="number"
                min="1"
                max="31"
                value={form.closingDay}
                onChange={(e) => setForm({ ...form, closingDay: e.target.value })}
                placeholder="Ex: 10"
              />
              <Input
                label="Dia de vencimento"
                type="number"
                min="1"
                max="31"
                value={form.dueDay}
                onChange={(e) => setForm({ ...form, dueDay: e.target.value })}
                placeholder="Ex: 20"
              />
            </div>
          )}

          <ColorPicker
            label="Cor"
            value={form.color}
            onChange={(color) => setForm({ ...form, color })}
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
        title="Excluir conta"
        description={`Excluir "${deleteTarget?.name ?? ''}"? Todas as transações associadas também serão removidas.`}
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
