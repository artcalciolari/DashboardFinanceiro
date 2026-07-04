import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Calendar, Pencil } from 'lucide-react';
import { installmentsApi, accountsApi, categoriesApi } from '../services/api';
import { formatCurrency, formatDate } from '../utils/formatters';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import { clsx } from 'clsx';
import type { InstallmentGroup } from '../types';
import { useDate } from '../context/DateContext';

interface FormState {
  description: string;
  totalAmount: string;
  installmentCount: string;
  startDate: string;
  accountId: string;
  categoryId: string;
  isThirdParty: boolean;
  thirdPartyName: string;
  isReimbursed: boolean;
  notes: string;
}

interface InstallmentView {
  group: InstallmentGroup;
  paid: number;
  total: number;
  pct: number;
  installmentAmount: number;
  next?: InstallmentGroup['transactions'][number];
  last?: InstallmentGroup['transactions'][number];
  isFinished: boolean;
}

const emptyForm: FormState = {
  description: '',
  totalAmount: '',
  installmentCount: '2',
  startDate: new Date().toISOString().slice(0, 10),
  accountId: '',
  categoryId: '',
  isThirdParty: false,
  thirdPartyName: '',
  isReimbursed: false,
  notes: '',
};

function isoDateToBr(date: string) {
  const [year, month, day] = date.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
}

function formatBrDateInput(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 8);

  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function brDateToIso(value: string) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return null;

  const [, day, month, year] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day), 12);

  if (
    date.getFullYear() !== Number(year) ||
    date.getMonth() !== Number(month) - 1 ||
    date.getDate() !== Number(day)
  ) {
    return null;
  }

  return `${year}-${month}-${day}`;
}

function buildInstallmentView(group: InstallmentGroup, periodEnd: Date): InstallmentView {
  const installments = group.transactions.slice().sort((a, b) => {
    const dateDiff = new Date(a.effectiveDate).getTime() - new Date(b.effectiveDate).getTime();
    return dateDiff || (a.installmentNumber ?? 0) - (b.installmentNumber ?? 0);
  });
  const paid = installments.filter((t) => new Date(t.effectiveDate) <= periodEnd).length;
  const total = group.installmentCount;
  const pct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;

  return {
    group,
    paid,
    total,
    pct,
    installmentAmount: total > 0 ? group.totalAmount / total : 0,
    next: installments.find((t) => new Date(t.effectiveDate) > periodEnd),
    last: installments[installments.length - 1],
    isFinished: total > 0 && paid >= total,
  };
}

export default function Installments() {
  const qc = useQueryClient();
  const { month, year } = useDate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<InstallmentGroup | null>(null);
  const [paymentTarget, setPaymentTarget] = useState<InstallmentGroup | null>(null);
  const [firstPaymentDate, setFirstPaymentDate] = useState('');
  const [firstPaymentDateError, setFirstPaymentDateError] = useState('');
  const [form, setForm] = useState<FormState>(emptyForm);

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ['installments'],
    queryFn: installmentsApi.getAll,
  });
  const selectedPeriodEnd = new Date(year, month, 0, 23, 59, 59, 999);
  const today = new Date();

  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: accountsApi.getAll });
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: categoriesApi.getAll });

  const expenseCategories = categories.filter((c) => c.type === 'EXPENSE');
  const selectedAccount = accounts.find((account) => account.id === form.accountId);
  const installmentViews = groups.map((group) => buildInstallmentView(group, selectedPeriodEnd));
  const ongoingInstallments = installmentViews
    .filter((view) => !view.isFinished)
    .sort((a, b) => {
      const nextA = a.next ? new Date(a.next.effectiveDate).getTime() : Number.POSITIVE_INFINITY;
      const nextB = b.next ? new Date(b.next.effectiveDate).getTime() : Number.POSITIVE_INFINITY;

      return nextA - nextB || a.group.description.localeCompare(b.group.description);
    });
  const finishedInstallments = installmentViews
    .filter((view) => view.isFinished)
    .sort((a, b) => {
      const lastA = a.last ? new Date(a.last.effectiveDate).getTime() : 0;
      const lastB = b.last ? new Date(b.last.effectiveDate).getTime() : 0;

      return lastB - lastA || a.group.description.localeCompare(b.group.description);
    });

  const committedMonthly = ongoingInstallments.reduce((sum, view) => sum + view.installmentAmount, 0);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['installments'] });
    qc.invalidateQueries({ queryKey: ['transactions'] });
    qc.invalidateQueries({ queryKey: ['summary'] });
  };

  const createMutation = useMutation({
    mutationFn: installmentsApi.create,
    onSuccess: () => { invalidate(); closeModal(); },
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id, mode }: { id: string; mode: 'future' | 'all' }) =>
      installmentsApi.delete(id, mode),
    onSuccess: () => {
      invalidate();
      setDeleteTarget(null);
    },
  });

  const updatePaymentDateMutation = useMutation({
    mutationFn: ({ id, paymentDate }: { id: string; paymentDate: string }) =>
      installmentsApi.updatePaymentDate(id, paymentDate),
    onSuccess: () => {
      invalidate();
      setPaymentTarget(null);
      setFirstPaymentDate('');
    },
  });

  function closeModal() {
    setIsModalOpen(false);
    setForm(emptyForm);
  }

  function closeDeleteModal() {
    if (!deleteMutation.isPending) {
      setDeleteTarget(null);
    }
  }

  function removeInstallment(mode: 'future' | 'all') {
    if (!deleteTarget) return;
    deleteMutation.mutate({ id: deleteTarget.id, mode });
  }

  function openPaymentDateModal(group: InstallmentGroup) {
    const first = group.transactions
      .slice()
      .sort((a, b) => (a.installmentNumber ?? 0) - (b.installmentNumber ?? 0))[0];

    setPaymentTarget(group);
    setFirstPaymentDate(isoDateToBr(first ? first.effectiveDate : new Date().toISOString()));
    setFirstPaymentDateError('');
  }

  function closePaymentDateModal() {
    if (!updatePaymentDateMutation.isPending) {
      setPaymentTarget(null);
      setFirstPaymentDate('');
      setFirstPaymentDateError('');
    }
  }

  function submitPaymentDateUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!paymentTarget || !firstPaymentDate) return;

    const normalizedDate = brDateToIso(firstPaymentDate);
    if (!normalizedDate) {
      setFirstPaymentDateError('Informe uma data válida no formato dd/mm/aaaa');
      return;
    }

    updatePaymentDateMutation.mutate({
      id: paymentTarget.id,
      paymentDate: `${normalizedDate}T12:00:00.000Z`,
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    createMutation.mutate({
      description: form.description,
      totalAmount: parseFloat(form.totalAmount.replace(',', '.')),
      installmentCount: parseInt(form.installmentCount),
      startDate: new Date(form.startDate + 'T12:00:00').toISOString(),
      accountId: form.accountId,
      categoryId: form.categoryId,
      isThirdParty: form.isThirdParty,
      thirdPartyName: form.isThirdParty ? form.thirdPartyName || null : null,
      isReimbursed: form.isThirdParty ? form.isReimbursed : false,
      notes: form.notes || undefined,
    });
  }

  function renderInstallmentCard(view: InstallmentView) {
    const { group, paid, total, pct, installmentAmount, next, last, isFinished } = view;

    return (
      <div key={group.id} className="card">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-display text-base font-semibold text-ink">{group.description}</p>
              {group.isThirdParty && (
                <span className="rounded-pill bg-amber/10 px-2 py-0.5 text-[10px] font-semibold text-amber">
                  Terceiro{group.thirdPartyName ? `: ${group.thirdPartyName}` : ''}
                </span>
              )}
              {group.isThirdParty && group.isReimbursed && (
                <span className="rounded-pill bg-income/10 px-2 py-0.5 text-[10px] font-semibold text-income">
                  Reembolsado
                </span>
              )}
            </div>
            <p className="mt-0.5 text-[12.5px] text-faint">
              {group.account.name} · <span style={{ color: group.category.color }}>{group.category.name}</span>
            </p>
          </div>
          <div className="flex flex-shrink-0 items-center gap-1">
            <span
              className={clsx(
                'rounded-pill px-2.5 py-1 text-[11.5px] font-semibold',
                isFinished ? 'bg-income/10 text-income' : 'bg-[#E9F0EC] text-forest'
              )}
            >
              {isFinished ? 'Quitado' : 'Ativo'}
            </span>
            <button
              onClick={() => openPaymentDateModal(group)}
              className="rounded-lg p-1.5 text-faint transition-colors hover:bg-chip hover:text-forest"
              title="Alterar data de pagamento"
            >
              <Pencil size={14} />
            </button>
            <button
              onClick={() => setDeleteTarget(group)}
              className="rounded-lg p-1.5 text-faint transition-colors hover:bg-expense/10 hover:text-expense"
              title="Remover parcelamento"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        <div className="mb-1 mt-[18px] flex items-baseline gap-1.5">
          <span className="tabular font-display text-2xl font-bold text-ink">{formatCurrency(installmentAmount)}</span>
          <span className="text-[13px] text-faint">/mês</span>
        </div>
        <div className="mb-3.5 text-[12.5px] text-faint">
          Total {formatCurrency(group.totalAmount)} ·{' '}
          {isFinished
            ? last
              ? `finalizado em ${formatDate(last.effectiveDate)}`
              : 'finalizado'
            : `restam ${formatCurrency(installmentAmount * (total - paid))}`}
        </div>
        <div className="mb-2 h-2 overflow-hidden rounded-pill bg-chip">
          <div
            className={clsx('h-full rounded-pill transition-all', isFinished ? 'bg-income' : 'bg-forest')}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[12.5px] font-medium text-muted">
            Parcela {paid} de {total}
            {!isFinished && next && ` · próxima ${formatDate(next.effectiveDate)}`}
          </span>
          <span className="text-[12.5px] font-semibold text-muted">{pct}%</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="font-display text-[24px] font-bold tracking-tight text-ink">Parcelamentos</h1>
          <p className="mt-1 text-sm capitalize text-muted">
            {ongoingInstallments.length} ativo(s) · {formatCurrency(committedMonthly)} por mês comprometidos
          </p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} size="sm">
          <Plus size={16} />
          Novo parcelamento
        </Button>
      </div>

      {isLoading ? (
        <div className="card py-8 text-center text-faint">Carregando...</div>
      ) : groups.length === 0 ? (
        <div className="card py-8 text-center">
          <Calendar size={32} className="mx-auto mb-2 text-faint" />
          <p className="mb-3 text-sm text-faint">Nenhum parcelamento cadastrado</p>
          <Button variant="secondary" size="sm" onClick={() => setIsModalOpen(true)}>
            Registrar parcelamento
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {ongoingInstallments.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-ink">Em andamento</h2>
                <span className="text-xs font-medium text-faint">{ongoingInstallments.length} ativo(s)</span>
              </div>
              <div className="grid grid-cols-1 gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
                {ongoingInstallments.map((view) => renderInstallmentCard(view))}
              </div>
            </section>
          )}

          {finishedInstallments.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-ink">Finalizados</h2>
                <span className="text-xs font-medium text-faint">{finishedInstallments.length} completo(s)</span>
              </div>
              <div className="grid grid-cols-1 gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
                {finishedInstallments.map((view) => renderInstallmentCard(view))}
              </div>
            </section>
          )}

          {ongoingInstallments.length === 0 && finishedInstallments.length === 0 && (
            <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-faint">
              Nenhum parcelamento para a referência selecionada
            </div>
          )}
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={closeModal} title="Novo parcelamento">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Descrição"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Ex: Notebook, Geladeira..."
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Valor total (R$)"
              type="number"
              step="0.01"
              min="0.01"
              value={form.totalAmount}
              onChange={(e) => setForm({ ...form, totalAmount: e.target.value })}
              placeholder="0,00"
              required
            />
            <Input
              label="Nº de parcelas"
              type="number"
              min="2"
              max="120"
              value={form.installmentCount}
              onChange={(e) => setForm({ ...form, installmentCount: e.target.value })}
              required
            />
          </div>
          {form.totalAmount && form.installmentCount && (
            <p className="rounded-xl bg-[#E9F0EC] p-2.5 text-xs text-forest">
              {parseInt(form.installmentCount)}x de{' '}
              {formatCurrency(parseFloat(form.totalAmount.replace(',', '.') || '0') / parseInt(form.installmentCount || '1'))}
            </p>
          )}
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
              {expenseCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </div>
          {selectedAccount?.type === 'CREDIT_CARD' && (
            <p className="rounded-xl bg-[#E9F0EC] p-2.5 text-xs text-forest">
              {selectedAccount.closingDay && selectedAccount.dueDay
                ? `Fechamento dia ${selectedAccount.closingDay} · vencimento dia ${selectedAccount.dueDay}. A primeira parcela será calculada automaticamente.`
                : 'Complete fechamento e vencimento do cartão para calcular a primeira parcela automaticamente.'}
            </p>
          )}
          <Input
            label="Data da compra"
            type="date"
            value={form.startDate}
            onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            required
          />
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
              Parcelamento de terceiro
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
          <Input
            label="Observações (opcional)"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Notas adicionais..."
          />
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={closeModal}>Cancelar</Button>
            <Button type="submit" className="flex-1" loading={createMutation.isPending}>
              Criar parcelamento
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={deleteTarget !== null}
        onClose={closeDeleteModal}
        title="Remover parcelamento"
        size="sm"
      >
        {deleteTarget && (
          <div className="space-y-4">
            <div className="space-y-2 text-sm text-muted">
              <p>
                Escolha como remover <span className="font-semibold text-ink">{deleteTarget.description}</span>.
              </p>
              <p>
                Remover parcelas futuras mantém as parcelas já vencidas ou pagas. Remover tudo apaga o grupo inteiro,
                inclusive parcelas antigas, o que é útil quando a data inicial foi cadastrada errada.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-chip/60 p-3 text-sm text-ink">
              <p>
                {deleteTarget.transactions.filter((t) => new Date(t.effectiveDate) <= today).length} parcela(s) já registrada(s)
                e {deleteTarget.transactions.filter((t) => new Date(t.effectiveDate) > today).length} futura(s).
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Button
                type="button"
                variant="danger"
                onClick={() => removeInstallment('future')}
                loading={deleteMutation.isPending}
              >
                Remover parcelas futuras
              </Button>
              <Button
                type="button"
                className="bg-expense text-white hover:bg-expense/90"
                onClick={() => removeInstallment('all')}
                loading={deleteMutation.isPending}
              >
                Remover parcelamento completo
              </Button>
              <Button type="button" variant="secondary" onClick={closeDeleteModal} disabled={deleteMutation.isPending}>
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={paymentTarget !== null}
        onClose={closePaymentDateModal}
        title="Alterar data de pagamento"
        size="sm"
      >
        {paymentTarget && (
          <form onSubmit={submitPaymentDateUpdate} className="space-y-4">
            <p className="text-sm text-muted">
              Defina o vencimento da 1ª parcela de <span className="font-semibold text-ink">{paymentTarget.description}</span>.
              As demais parcelas serão ajustadas automaticamente mês a mês.
            </p>

            <Input
              label="Vencimento da 1ª parcela"
              type="text"
              inputMode="numeric"
              placeholder="dd/mm/aaaa"
              maxLength={10}
              value={firstPaymentDate}
              onChange={(e) => {
                setFirstPaymentDate(formatBrDateInput(e.target.value));
                setFirstPaymentDateError('');
              }}
              error={firstPaymentDateError}
              required
            />

            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={closePaymentDateModal}
                disabled={updatePaymentDateMutation.isPending}
              >
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" loading={updatePaymentDateMutation.isPending}>
                Salvar vencimento
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
