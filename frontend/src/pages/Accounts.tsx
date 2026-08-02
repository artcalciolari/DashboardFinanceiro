import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, CreditCard, Building2, Wallet, TrendingUp } from 'lucide-react';
import { accountsApi } from '../services/api';
import { centsToInput, formatCurrency, parseCurrencyBR, ACCOUNT_TYPE_LABELS } from '../utils/formatters';
import type { Account, AccountType } from '../types';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import ColorPicker from '../components/ui/ColorPicker';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import FormError from '../components/ui/FormError';

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
      balance: centsToInput(account.openingBalanceCents),
      creditLimit: centsToInput(account.creditLimitCents),
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
    createMutation.reset();
    updateMutation.reset();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      name: form.name,
      type: form.type,
      openingBalanceCents: form.type === 'CREDIT_CARD' ? 0 : parseCurrencyBR(form.balance),
      color: form.color,
      creditLimitCents:
        form.type === 'CREDIT_CARD' && form.creditLimit
          ? parseCurrencyBR(form.creditLimit)
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
    .reduce((sum, account) => sum + account.openingBalanceCents, 0);
  const creditCards = accounts.filter((account) => account.type === 'CREDIT_CARD');

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="font-display text-[24px] font-bold tracking-tight text-ink">Contas & cartões</h1>
          <p className="mt-1 text-sm text-muted">
            {accounts.length} conta(s) · {creditCards.length} cartão(ões) · Saldo base{' '}
            <b className="text-ink">{formatCurrency(cashBalance)}</b>
          </p>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus size={16} />
          Nova conta
        </Button>
      </div>

      {isLoading ? (
        <div className="card py-8 text-center text-faint">Carregando...</div>
      ) : accounts.length === 0 ? (
        <div className="card py-8 text-center">
          <p className="mb-3 text-sm text-faint">Nenhuma conta cadastrada</p>
          <Button variant="secondary" size="sm" onClick={openCreate}>Adicionar conta</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => {
            const Icon = ACCOUNT_ICONS[account.type];
            return (
              <div key={account.id} className="card">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-11 w-11 items-center justify-center rounded-xl"
                      style={{ backgroundColor: account.color + '20' }}
                    >
                      <Icon size={20} style={{ color: account.color }} />
                    </div>
                    <div>
                      <p className="text-[15px] font-semibold text-ink">{account.name}</p>
                      <p className="text-[12.5px] text-faint">{ACCOUNT_TYPE_LABELS[account.type]}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => openEdit(account)}
                      className="rounded-lg p-1.5 text-faint transition-colors hover:bg-chip hover:text-forest"
                      title="Editar conta"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(account)}
                      className="rounded-lg p-1.5 text-faint transition-colors hover:bg-expense/10 hover:text-expense"
                      title="Excluir conta"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="mt-[18px]">
                  {account.type === 'CREDIT_CARD' ? (
                    <>
                      <p className="text-[12.5px] text-faint">Limite total</p>
                      <p className="tabular mt-0.5 font-display text-[26px] font-bold tracking-tight text-ink">
                        {account.creditLimitCents ? formatCurrency(account.creditLimitCents) : 'Não informado'}
                      </p>
                      {(account.closingDay || account.dueDay) && (
                        <p className="mt-1 text-xs text-faint">
                          {account.closingDay && `Fecha dia ${account.closingDay}`}
                          {account.closingDay && account.dueDay && ' · '}
                          {account.dueDay && `Vence dia ${account.dueDay}`}
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="text-[12.5px] text-faint">
                        {account.type === 'INVESTMENT' ? 'Total investido' : 'Saldo inicial'}
                      </p>
                      <p
                        className="tabular mt-0.5 font-display text-[26px] font-bold tracking-tight"
                        style={{ color: '#0F7A52' }}
                      >
                        {formatCurrency(account.openingBalanceCents)}
                      </p>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      <Modal isOpen={isModalOpen} onClose={closeModal} title={editing ? 'Editar conta' : 'Nova conta'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nome da conta"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Ex: Nubank, Bradesco, Dinheiro..."
            required
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
        title="Excluir conta"
        description={`Excluir "${deleteTarget?.name ?? ''}"? Todas as transações associadas também serão removidas.`}
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
