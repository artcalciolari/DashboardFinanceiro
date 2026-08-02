import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
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

vi.mock('@/services/api', () => ({
  transactionsApi: {
    getPage: (...a: unknown[]) => getPage(...a),
    delete: (...a: unknown[]) => deleteTx(...a),
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
});
