import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { transactionsApi, accountsApi, categoriesApi } from '../../services/api';
import { useTransactionModal } from '../../context/TransactionModalContext';
import type { Transaction } from '../../types';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import FormError from '../ui/FormError';
import { centsToInput, getLocalDateInput, parseCurrencyBR } from '../../utils/formatters';

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

function createEmptyForm(): FormState {
  return {
    description: '',
    amount: '',
    type: 'EXPENSE',
    date: getLocalDateInput(),
    accountId: '',
    categoryId: '',
    isThirdParty: false,
    thirdPartyName: '',
    isReimbursed: false,
    notes: '',
  };
}

function formFromTransaction(t: Transaction): FormState {
  return {
    description: t.description,
    amount: centsToInput(t.amountCents),
    type: t.type,
    date: t.date.slice(0, 10),
    accountId: t.accountId,
    categoryId: t.categoryId,
    isThirdParty: t.isThirdParty ?? false,
    thirdPartyName: t.thirdPartyName ?? '',
    isReimbursed: t.isReimbursed ?? false,
    notes: t.notes ?? '',
  };
}

export default function TransactionFormModal() {
  const { isOpen, editing, close } = useTransactionModal();
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(createEmptyForm);

  useEffect(() => {
    setForm(editing ? formFromTransaction(editing) : createEmptyForm());
  }, [editing, isOpen]);

  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: accountsApi.getAll });
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: categoriesApi.getAll });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['transactions'] });
    qc.invalidateQueries({ queryKey: ['summary'] });
  };

  const createMutation = useMutation({
    mutationFn: transactionsApi.create,
    onSuccess: () => { invalidate(); close(); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Transaction> }) =>
      transactionsApi.update(id, data),
    onSuccess: () => { invalidate(); close(); },
  });
  const mutationError = createMutation.error ?? updateMutation.error;

  function handleClose() {
    createMutation.reset();
    updateMutation.reset();
    close();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      description: form.description,
      amountCents: parseCurrencyBR(form.amount),
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
  const selectedAccount = accounts.find((a) => a.id === form.accountId);

  const segBase = 'flex-1 py-2 rounded-[9px] font-semibold text-[13.5px] transition-colors';

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={editing ? 'Editar transação' : 'Nova transação'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="inline-flex w-full gap-0.5 rounded-xl bg-[#EDEAE0] p-1">
          <button
            type="button"
            onClick={() =>
              setForm({
                ...form,
                type: 'EXPENSE',
                categoryId: '',
                isThirdParty: form.isThirdParty,
              })
            }
            className={clsx(
              segBase,
              form.type === 'EXPENSE'
                ? 'bg-white text-forest shadow-sm'
                : 'bg-transparent text-muted'
            )}
          >
            Despesa
          </button>
          <button
            type="button"
            onClick={() =>
              setForm({
                ...form,
                type: 'INCOME',
                categoryId: '',
                isThirdParty: false,
                thirdPartyName: '',
                isReimbursed: false,
              })
            }
            className={clsx(
              segBase,
              form.type === 'INCOME'
                ? 'bg-white text-forest shadow-sm'
                : 'bg-transparent text-muted'
            )}
          >
            Receita
          </button>
        </div>

        <div>
          <label className="label">Valor</label>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-display font-semibold text-faint">
              R$
            </span>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="0,00"
              required
              className="tabular w-full rounded-[13px] border border-border py-3 pl-11 pr-4 font-display text-[22px] font-bold text-ink outline-none focus:border-forest focus:shadow-focus-forest"
            />
          </div>
        </div>

        <Input
          label="Descrição"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Ex: Mercado, salário…"
          required
        />
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Conta / cartão"
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
          label={form.type === 'INCOME' ? 'Data do recebimento' : 'Data da compra'}
          type="date"
          value={form.date}
          onChange={(e) => setForm({ ...form, date: e.target.value })}
          required
        />
        {form.type === 'EXPENSE' && (
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
              Compra de terceiro
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
        )}
        <Input
          label="Observações (opcional)"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          placeholder="Notas adicionais..."
        />
        <FormError error={mutationError} />
        {selectedAccount?.type === 'CREDIT_CARD' && (
          <div className="rounded-xl bg-[#E9F0EC] p-2.5 text-xs text-forest">
            {selectedAccount.closingDay
              ? `Fechamento no dia ${selectedAccount.closingDay}. A data efetiva será calculada automaticamente.`
              : 'Configure o dia de fechamento da conta para cálculo automático da data efetiva.'}
          </div>
        )}
        <div className="flex gap-2 pt-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={handleClose}>
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
  );
}
