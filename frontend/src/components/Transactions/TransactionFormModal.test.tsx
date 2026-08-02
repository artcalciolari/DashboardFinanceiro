import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TransactionFormModal from './TransactionFormModal';
import { renderWithProviders } from '@/test/test-utils';
import { useTransactionModal } from '@/context/TransactionModalContext';
import { useEffect } from 'react';
import {
  mockAccount,
  mockCreditCard,
  mockExpenseCategory,
  mockIncomeCategory,
  mockTransaction,
} from '@/test/fixtures';

const create = vi.fn();
const update = vi.fn();
const getAllAccounts = vi.fn();
const getAllCategories = vi.fn();

vi.mock('@/services/api', () => ({
  accountsApi: { getAll: () => getAllAccounts() },
  categoriesApi: { getAll: () => getAllCategories() },
  transactionsApi: {
    create: (...a: unknown[]) => create(...a),
    update: (...a: unknown[]) => update(...a),
  },
  getApiErrorMessage: () => 'Erro ao salvar',
}));

function OpenCreate() {
  const { openCreate } = useTransactionModal();
  useEffect(() => {
    openCreate();
  }, [openCreate]);
  return null;
}

function OpenEdit() {
  const { openEdit } = useTransactionModal();
  useEffect(() => {
    openEdit({
      ...mockTransaction,
      notes: 'nota',
      isThirdParty: true,
      thirdPartyName: 'Ana',
      isReimbursed: true,
    });
  }, [openEdit]);
  return null;
}

describe('TransactionFormModal', () => {
  beforeEach(() => {
    create.mockReset().mockResolvedValue({});
    update.mockReset().mockResolvedValue({});
    getAllAccounts.mockResolvedValue([mockAccount, mockCreditCard, { ...mockCreditCard, id: 'cc2', closingDay: null, dueDay: null, name: 'Sem fechamento' }]);
    getAllCategories.mockResolvedValue([mockExpenseCategory, mockIncomeCategory]);
  });

  it('creates expense with third party', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <>
        <OpenCreate />
        <TransactionFormModal />
      </>
    );

    await waitFor(() => expect(screen.getByText('Nova transação')).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText('0,00'), { target: { value: '10.50' } });
    await user.type(screen.getByLabelText('Descrição'), 'Mercado');
    await user.selectOptions(screen.getByLabelText('Conta / cartão'), mockAccount.id);
    await user.selectOptions(screen.getByLabelText('Categoria'), mockExpenseCategory.id);
    await user.click(screen.getByLabelText('Compra de terceiro'));
    await user.type(screen.getByLabelText('Responsável'), 'Lucas');
    await user.click(screen.getByLabelText('Já foi reembolsado'));
    await user.type(screen.getByLabelText('Observações (opcional)'), 'obs');
    await user.click(screen.getByRole('button', { name: 'Adicionar' }));

    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(create.mock.calls[0][0]).toMatchObject({
      description: 'Mercado',
      type: 'EXPENSE',
      isThirdParty: true,
      thirdPartyName: 'Lucas',
      isReimbursed: true,
      notes: 'obs',
    });
  });

  it('switches to income and clears third party', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <>
        <OpenCreate />
        <TransactionFormModal />
      </>
    );
    await waitFor(() => expect(screen.getByText('Nova transação')).toBeInTheDocument());
    await user.click(screen.getByLabelText('Compra de terceiro'));
    await user.click(screen.getByRole('button', { name: 'Receita' }));
    expect(screen.queryByLabelText('Compra de terceiro')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Data do recebimento')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Despesa' }));
    expect(screen.getByLabelText('Data da compra')).toBeInTheDocument();
  });

  it('shows credit card tip with and without closing day', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <>
        <OpenCreate />
        <TransactionFormModal />
      </>
    );
    await waitFor(() => expect(screen.getByText('Nova transação')).toBeInTheDocument());
    await waitFor(() =>
      expect(screen.getByLabelText('Conta / cartão').querySelector(`option[value="${mockCreditCard.id}"]`)).toBeTruthy()
    );
    await user.selectOptions(screen.getByLabelText('Conta / cartão'), mockCreditCard.id);
    expect(screen.getByText(/Fechamento no dia 10/)).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Conta / cartão'), 'cc2');
    expect(screen.getByText(/Configure o dia de fechamento/)).toBeInTheDocument();
  });

  it('edits existing transaction', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <>
        <OpenEdit />
        <TransactionFormModal />
      </>
    );
    await waitFor(() => expect(screen.getByText('Editar transação')).toBeInTheDocument());
    await user.clear(screen.getByLabelText('Descrição'));
    await user.type(screen.getByLabelText('Descrição'), 'Atualizado');
    const date = screen.getByLabelText('Data da compra');
    await user.clear(date);
    await user.type(date, '2024-05-01');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(update).toHaveBeenCalled());
    expect(update.mock.calls[0][0]).toBe(mockTransaction.id);
  });

  it('edits transaction with nullish optional fields', async () => {
    function OpenSparseEdit() {
      const { openEdit } = useTransactionModal();
      useEffect(() => {
        openEdit({
          ...mockTransaction,
          notes: null as unknown as undefined,
          isThirdParty: undefined as unknown as boolean,
          thirdPartyName: undefined as unknown as string,
          isReimbursed: undefined as unknown as boolean,
        });
      }, [openEdit]);
      return null;
    }

    renderWithProviders(
      <>
        <OpenSparseEdit />
        <TransactionFormModal />
      </>
    );
    await waitFor(() => expect(screen.getByText('Editar transação')).toBeInTheDocument());
  });

  it('submits income without third party fields', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <>
        <OpenCreate />
        <TransactionFormModal />
      </>
    );
    await waitFor(() => expect(screen.getByText('Nova transação')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Receita' }));
    fireEvent.change(screen.getByPlaceholderText('0,00'), { target: { value: '100' } });
    await user.type(screen.getByLabelText('Descrição'), 'Salário');
    await user.selectOptions(screen.getByLabelText('Conta / cartão'), mockAccount.id);
    await user.selectOptions(screen.getByLabelText('Categoria'), mockIncomeCategory.id);
    await user.click(screen.getByRole('button', { name: 'Adicionar' }));
    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(create.mock.calls[0][0]).toMatchObject({
      type: 'INCOME',
      isThirdParty: false,
      thirdPartyName: null,
    });
  });

  it('submits expense third party with empty responsible name', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <>
        <OpenCreate />
        <TransactionFormModal />
      </>
    );
    await waitFor(() => expect(screen.getByText('Nova transação')).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText('0,00'), { target: { value: '10' } });
    await user.type(screen.getByLabelText('Descrição'), 'X');
    await user.selectOptions(screen.getByLabelText('Conta / cartão'), mockAccount.id);
    await user.selectOptions(screen.getByLabelText('Categoria'), mockExpenseCategory.id);
    await user.click(screen.getByLabelText('Compra de terceiro'));
    await user.click(screen.getByRole('button', { name: 'Adicionar' }));
    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(create.mock.calls[0][0]).toMatchObject({ thirdPartyName: null, isThirdParty: true });
  });

  it('cancels and resets', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <>
        <OpenCreate />
        <TransactionFormModal />
      </>
    );
    await waitFor(() => expect(screen.getByText('Nova transação')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByText('Nova transação')).not.toBeInTheDocument());
  });

  it('shows mutation error', async () => {
    create.mockRejectedValue(new Error('fail'));
    const user = userEvent.setup();
    renderWithProviders(
      <>
        <OpenCreate />
        <TransactionFormModal />
      </>
    );
    await waitFor(() => expect(screen.getByText('Nova transação')).toBeInTheDocument());
    await waitFor(() =>
      expect(screen.getByLabelText('Conta / cartão').querySelector(`option[value="${mockAccount.id}"]`)).toBeTruthy()
    );
    await user.type(screen.getByPlaceholderText('0,00'), '10');
    await user.type(screen.getByLabelText('Descrição'), 'X');
    await user.selectOptions(screen.getByLabelText('Conta / cartão'), mockAccount.id);
    await user.selectOptions(screen.getByLabelText('Categoria'), mockExpenseCategory.id);
    await user.click(screen.getByRole('button', { name: 'Adicionar' }));
    await waitFor(() => expect(create).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Erro ao salvar'));
  });

  it('unchecks third party clears fields', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <>
        <OpenCreate />
        <TransactionFormModal />
      </>
    );
    await waitFor(() => expect(screen.getByText('Nova transação')).toBeInTheDocument());
    const cb = screen.getByLabelText('Compra de terceiro');
    await user.click(cb);
    await user.type(screen.getByLabelText('Responsável'), 'X');
    await user.click(cb);
    expect(screen.queryByLabelText('Responsável')).not.toBeInTheDocument();
  });

  it('edits transaction with nullish optional fields', async () => {
    function OpenSparseEdit() {
      const { openEdit } = useTransactionModal();
      useEffect(() => {
        openEdit({
          ...mockTransaction,
          notes: null,
          isThirdParty: undefined as unknown as boolean,
          thirdPartyName: null,
          isReimbursed: undefined as unknown as boolean,
        });
      }, [openEdit]);
      return null;
    }

    const user = userEvent.setup();
    renderWithProviders(
      <>
        <OpenSparseEdit />
        <TransactionFormModal />
      </>
    );
    await waitFor(() => expect(screen.getByText('Editar transação')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(update).toHaveBeenCalled());
  });

  it('creates plain expense without notes', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <>
        <OpenCreate />
        <TransactionFormModal />
      </>
    );
    await waitFor(() => expect(screen.getByText('Nova transação')).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText('0,00'), { target: { value: '5' } });
    await user.type(screen.getByLabelText('Descrição'), 'Café');
    await user.selectOptions(screen.getByLabelText('Conta / cartão'), mockAccount.id);
    await user.selectOptions(screen.getByLabelText('Categoria'), mockExpenseCategory.id);
    await user.click(screen.getByRole('button', { name: 'Adicionar' }));
    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(create.mock.calls.at(-1)?.[0]).toMatchObject({
      isThirdParty: false,
      thirdPartyName: null,
      isReimbursed: false,
      notes: undefined,
    });
  });
});
