import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Transactions from './Transactions';
import { renderWithProviders } from '@/test/test-utils';
import {
  makeTransactionPage,
  mockAccount,
  mockExpenseCategory,
  mockIncomeCategory,
  mockIncomeTransaction,
  mockInstallmentTransaction,
  mockSubscriptionTransaction,
  mockThirdPartyTransaction,
  mockTransaction,
} from '@/test/fixtures';

const getPage = vi.fn();
const getAccounts = vi.fn();
const getCategories = vi.fn();
const deleteTx = vi.fn();
const settleTx = vi.fn();
const reimburseTx = vi.fn();

vi.mock('@/services/api', () => ({
  transactionsApi: {
    getPage: (...a: unknown[]) => getPage(...a),
    delete: (...a: unknown[]) => deleteTx(...a),
    settle: (...a: unknown[]) => settleTx(...a),
    reimburse: (...a: unknown[]) => reimburseTx(...a),
  },
  accountsApi: { getAll: () => getAccounts() },
  categoriesApi: { getAll: () => getCategories() },
  getApiErrorMessage: () => 'Falha ao carregar',
}));

describe('Transactions', () => {
  beforeEach(() => {
    getPage.mockReset();
    getAccounts.mockResolvedValue([mockAccount]);
    getCategories.mockResolvedValue([mockExpenseCategory, mockIncomeCategory]);
    deleteTx.mockReset().mockResolvedValue({});
    settleTx.mockReset().mockResolvedValue({});
    reimburseTx.mockReset().mockResolvedValue({});
  });

  it('renders list with badges and delete', async () => {
    const user = userEvent.setup();
    getPage.mockResolvedValue(
      makeTransactionPage(
        [
          mockTransaction,
          mockIncomeTransaction,
          mockInstallmentTransaction,
          mockSubscriptionTransaction,
          mockThirdPartyTransaction,
          { ...mockThirdPartyTransaction, id: 'tx-6', isReimbursed: true, thirdPartyName: null },
          { ...mockThirdPartyTransaction, id: 'tx-7', reimbursedAmountCents: 1000, thirdPartyName: 'Parcial' },
        ],
        { nextCursor: 'next', totalCount: 6 }
      )
    );

    renderWithProviders(<Transactions />, { routerProps: { initialEntries: ['/transactions'] } });

    await waitFor(() => expect(screen.getByText('Mercado')).toBeInTheDocument());
    expect(screen.getByText('Parcela 2/10')).toBeInTheDocument();
    expect(screen.getByText('Assinatura')).toBeInTheDocument();
    expect(screen.getByText(/A receber: Lucas/)).toBeInTheDocument();
    expect(screen.getByText('Reembolsado')).toBeInTheDocument();

    await user.click(screen.getByLabelText('Excluir Mercado'));
    expect(screen.getByText('Excluir transação')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Excluir' }));
    await waitFor(() => expect(deleteTx.mock.calls[0][0]).toBe(mockTransaction.id));
    await user.click(screen.getAllByRole('button', { name: 'Registrar reembolso' }).at(-2)!);
    expect(screen.getByLabelText('Valor reembolsado')).toHaveValue('125,5');
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
  });

  it('shows empty states and filters', async () => {
    const user = userEvent.setup();
    getPage.mockResolvedValue(makeTransactionPage([], { totalCount: 0 }));

    renderWithProviders(<Transactions />);
    await waitFor(() => expect(screen.getByText('Nenhuma transação encontrada')).toBeInTheDocument());
    expect(screen.getByText('Nenhum lançamento neste mês.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Filtros' }));
    await user.selectOptions(screen.getByLabelText('Conta'), mockAccount.id);
    await waitFor(() => expect(screen.getByText('Tente ajustar a busca ou os filtros aplicados.')).toBeInTheDocument());
    const clearButtons = screen.getAllByRole('button', { name: 'Limpar filtros' });
    await user.click(clearButtons[0]);
  });

  it('type filter clears incompatible category and shows optgroups', async () => {
    const user = userEvent.setup();
    getPage.mockResolvedValue(makeTransactionPage([]));
    renderWithProviders(<Transactions />);
    await waitFor(() => expect(screen.getByText('Transações')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Filtros' }));
    await user.selectOptions(screen.getByLabelText('Categoria'), mockExpenseCategory.id);
    await user.click(screen.getByRole('button', { name: 'Receitas' }));
    // category should reset because expense cat incompatible with income
    expect(screen.getByLabelText('Categoria')).toHaveValue('all');

    await user.click(screen.getByRole('button', { name: 'Todas' }));
    expect(screen.getByRole('group', { name: 'Receitas' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Despesas' })).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Origem'), 'installment');
    expect(screen.getByText('1')).toBeInTheDocument(); // filter badge
  });

  it('loads more and handles error', async () => {
    const user = userEvent.setup();
    getPage
      .mockResolvedValueOnce(makeTransactionPage([mockTransaction], { nextCursor: 'c2', totalCount: 2 }))
      .mockResolvedValueOnce(makeTransactionPage([mockIncomeTransaction], { nextCursor: null, totalCount: 2 }));

    renderWithProviders(<Transactions />);
    await waitFor(() => expect(screen.getByText('Mercado')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Carregar mais' }));
    await waitFor(() => expect(getPage).toHaveBeenCalledTimes(2));
  });

  it('shows error state with retry', async () => {
    const user = userEvent.setup();
    getPage.mockRejectedValueOnce(new Error('boom')).mockResolvedValue(makeTransactionPage([]));
    renderWithProviders(<Transactions />);
    await waitFor(() => expect(screen.getByText('Não foi possível carregar as transações')).toBeInTheDocument());
    expect(screen.getByText('Falha ao carregar')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    await waitFor(() => expect(getPage.mock.calls.length).toBeGreaterThan(1));
  });

  it('edits single transaction and plural count', async () => {
    const user = userEvent.setup();
    getPage.mockResolvedValue(makeTransactionPage([mockTransaction, mockIncomeTransaction], { totalCount: 2 }));
    renderWithProviders(<Transactions />);
    await waitFor(() => expect(screen.getByText(/2 lançamentos/)).toBeInTheDocument());
    await user.click(screen.getByLabelText('Editar Mercado'));
  });

  it('closes delete dialog without confirming', async () => {
    const user = userEvent.setup();
    getPage.mockResolvedValue(makeTransactionPage([mockTransaction]));
    renderWithProviders(<Transactions />);
    await waitFor(() => expect(screen.getByText('Mercado')).toBeInTheDocument());
    await user.click(screen.getByLabelText('Excluir Mercado'));
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByText('Excluir transação')).not.toBeInTheDocument());
  });

  it('keeps delete dialog open while mutation is pending', async () => {
    const user = userEvent.setup();
    let resolveDelete!: () => void;
    deleteTx.mockReturnValue(new Promise<void>((r) => { resolveDelete = r; }));
    getPage.mockResolvedValue(makeTransactionPage([mockTransaction]));
    renderWithProviders(<Transactions />);
    await waitFor(() => expect(screen.getByText('Mercado')).toBeInTheDocument());
    await user.click(screen.getByLabelText('Excluir Mercado'));
    await user.click(screen.getByRole('button', { name: 'Excluir' }));
    await user.keyboard('{Escape}');
    expect(screen.getByText('Excluir transação')).toBeInTheDocument();
    resolveDelete();
    await waitFor(() => expect(screen.queryByText('Excluir transação')).not.toBeInTheDocument());
  });

  it('keeps category filter when type matches and resets unknown category id', async () => {
    const user = userEvent.setup();
    getPage.mockResolvedValue(makeTransactionPage([]));
    getCategories.mockResolvedValue([mockExpenseCategory]);
    renderWithProviders(<Transactions />);
    await waitFor(() => expect(screen.getByText('Transações')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Filtros' }));
    await user.selectOptions(screen.getByLabelText('Categoria'), mockExpenseCategory.id);
    await user.click(screen.getByRole('button', { name: 'Despesas' }));
    expect(screen.getByLabelText('Categoria')).toHaveValue(mockExpenseCategory.id);
  });

  it('validates reimbursement date and reverses an existing payment', async () => {
    const user = userEvent.setup();
    const thirdParty = { ...mockThirdPartyTransaction, paidAt: '2024-06-10T12:00:00.000Z', reimbursedAmountCents: 0, reimbursedAt: '2024-06-09T12:00:00.000Z' };
    getPage.mockResolvedValue(makeTransactionPage([thirdParty]));
    renderWithProviders(<Transactions />);
    await waitFor(() => expect(screen.getByText('A receber: Lucas')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Registrar reembolso' }));
    await user.clear(screen.getByLabelText('Valor reembolsado'));
    await user.type(screen.getByLabelText('Valor reembolsado'), '10');
    await user.clear(screen.getByLabelText('Data do reembolso'));
    await user.click(screen.getAllByRole('button', { name: 'Salvar' }).at(-1)!);
    expect(screen.getByText('Informe a data do reembolso.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    await user.click(screen.getByRole('button', { name: /Pago em/ }));
    await user.click(screen.getByRole('button', { name: 'Estornar pagamento' }));
    await waitFor(() => expect(settleTx).toHaveBeenCalledWith(thirdParty.id, null));
    await waitFor(() => expect(screen.queryByLabelText('Data do pagamento')).not.toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Registrar reembolso' }));
    await user.clear(screen.getByLabelText('Valor reembolsado'));
    await user.type(screen.getByLabelText('Valor reembolsado'), '10');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(reimburseTx).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByLabelText('Valor reembolsado')).not.toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /Pago em/ }));
    await user.clear(screen.getByLabelText('Data do pagamento'));
    await user.click(screen.getAllByRole('button', { name: 'Salvar' }).at(-1)!);
    expect(screen.getByText('Informe a data do pagamento.')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Data do pagamento'), '2999-01-01');
    await user.click(screen.getAllByRole('button', { name: 'Salvar' }).at(-1)!);
    expect(screen.getByText('A data do pagamento deve ser válida e não pode ser futura.')).toBeInTheDocument();

  });

  it('rejects reimbursement above the expense total', async () => {
    const user = userEvent.setup();
    getPage.mockResolvedValue(makeTransactionPage([mockThirdPartyTransaction]));
    renderWithProviders(<Transactions />);
    await waitFor(() => expect(screen.getByText('A receber: Lucas')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Registrar reembolso' }));
    await user.clear(screen.getByLabelText('Valor reembolsado'));
    await user.type(screen.getByLabelText('Valor reembolsado'), '99999999');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(screen.getByText('Informe um valor entre zero e o total da despesa.')).toBeInTheDocument();

    await user.clear(screen.getByLabelText('Valor reembolsado'));
    await user.type(screen.getByLabelText('Valor reembolsado'), '10');
    fireEvent.change(screen.getByLabelText('Data do reembolso'), { target: { value: '2999-01-01' } });
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(screen.getByText('A data do reembolso deve ser válida e não pode ser futura.')).toBeInTheDocument();
  });

  it('shows reimbursement mutation pending and error states', async () => {
    const user = userEvent.setup();
    let resolveReimbursement!: () => void;
    reimburseTx.mockReturnValueOnce(new Promise<void>((resolve) => { resolveReimbursement = resolve; }));
    getPage.mockResolvedValue(makeTransactionPage([mockThirdPartyTransaction]));
    renderWithProviders(<Transactions />);
    await waitFor(() => expect(screen.getByText('A receber: Lucas')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Registrar reembolso' }));
    await user.clear(screen.getByLabelText('Valor reembolsado'));
    await user.type(screen.getByLabelText('Valor reembolsado'), '10');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(screen.getByRole('button', { name: 'Salvando…' })).toBeDisabled();
    resolveReimbursement();
    await waitFor(() => expect(screen.queryByLabelText('Valor reembolsado')).not.toBeInTheDocument());

    reimburseTx.mockRejectedValueOnce(new Error('failed'));
    await user.click(screen.getByRole('button', { name: 'Registrar reembolso' }));
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(screen.getByText('Falha ao carregar')).toBeInTheDocument());
  });

  it('shows payment mutation pending and error states', async () => {
    const user = userEvent.setup();
    let resolveSettlement!: () => void;
    settleTx.mockReturnValueOnce(new Promise<void>((resolve) => { resolveSettlement = resolve; }));
    getPage.mockResolvedValue(makeTransactionPage([mockTransaction]));
    renderWithProviders(<Transactions />);
    await waitFor(() => expect(screen.getByText('Mercado')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Registrar pagamento' }));
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(screen.getByRole('button', { name: 'Salvando…' })).toBeDisabled();
    resolveSettlement();
    await waitFor(() => expect(screen.queryByLabelText('Data do pagamento')).not.toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Registrar pagamento' }));
    fireEvent.change(screen.getByLabelText('Data do pagamento'), { target: { value: '2024-01-01' } });
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(screen.queryByLabelText('Data do pagamento')).not.toBeInTheDocument());

    settleTx.mockRejectedValueOnce(new Error('failed'));
    await user.click(screen.getByRole('button', { name: 'Registrar pagamento' }));
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(screen.getByText('Falha ao carregar')).toBeInTheDocument());
  });
});
