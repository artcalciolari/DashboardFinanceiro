import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Installments from './Installments';
import { renderWithProviders } from '@/test/test-utils';
import {
  makeInstallmentsPage,
  mockAccount,
  mockCreditCard,
  mockExpenseCategory,
  mockInstallmentGroup,
} from '@/test/fixtures';

const getPage = vi.fn();
const create = vi.fn();
const remove = vi.fn();
const updatePaymentDate = vi.fn();
const getAccounts = vi.fn();
const getCategories = vi.fn();

vi.mock('@/services/api', () => ({
  installmentsApi: {
    getPage: (...a: unknown[]) => getPage(...a),
    create: (...a: unknown[]) => create(...a),
    delete: (...a: unknown[]) => remove(...a),
    updatePaymentDate: (...a: unknown[]) => updatePaymentDate(...a),
  },
  accountsApi: { getAll: () => getAccounts() },
  categoriesApi: { getAll: () => getCategories() },
  getApiErrorMessage: () => 'Erro parcela',
}));

const finished = {
  ...mockInstallmentGroup,
  id: 'fin',
  description: 'Finalizado',
  paidCount: 10,
  remainingAmountCents: 0,
  nextTransaction: null,
  lastTransaction: mockInstallmentGroup.lastTransaction,
  isCancelled: false,
};

const cancelled = {
  ...mockInstallmentGroup,
  id: 'can',
  description: 'Cancelado grupo',
  isCancelled: true,
  cancelledAt: '2024-05-01T12:00:00.000Z',
  paidCount: 2,
};

const cancelledNoDate = {
  ...mockInstallmentGroup,
  id: 'can2',
  description: 'Cancelado sem data',
  isCancelled: true,
  cancelledAt: null,
  paidCount: 1,
};

const finishedNoLast = {
  ...mockInstallmentGroup,
  id: 'fin2',
  description: 'Finalizado sem last',
  paidCount: 10,
  lastTransaction: null,
  nextTransaction: null,
};

const thirdParty = {
  ...mockInstallmentGroup,
  id: 'tp',
  description: 'Terceiro',
  isThirdParty: true,
  thirdPartyName: 'Ana',
  isReimbursed: true,
};

describe('Installments', () => {
  beforeEach(() => {
    getPage.mockReset();
    create.mockReset().mockResolvedValue({});
    remove.mockReset().mockResolvedValue({});
    updatePaymentDate.mockReset().mockResolvedValue({});
    getAccounts.mockResolvedValue([
      mockAccount,
      mockCreditCard,
      { ...mockCreditCard, id: 'cc-incomplete', name: 'Incompleto', closingDay: null, dueDay: null },
    ]);
    getCategories.mockResolvedValue([mockExpenseCategory]);
  });

  it('empty state and create with third party + credit card tips', async () => {
    const user = userEvent.setup();
    getPage.mockResolvedValue(makeInstallmentsPage([]));
    renderWithProviders(<Installments />);
    await waitFor(() => expect(screen.getByText('Nenhum parcelamento cadastrado')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Registrar parcelamento' }));

    await user.type(screen.getByLabelText('Descrição'), 'TV');
    await user.type(screen.getByLabelText('Valor total (R$)'), '1200');
    await user.clear(screen.getByLabelText('Nº de parcelas'));
    await user.type(screen.getByLabelText('Nº de parcelas'), '12');
    expect(screen.getByText(/12x de/)).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Conta / Cartão'), mockCreditCard.id);
    expect(screen.getByText(/Fechamento dia 10/)).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Conta / Cartão'), 'cc-incomplete');
    expect(screen.getByText(/Complete fechamento e vencimento/)).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Conta / Cartão'), mockAccount.id);
    await user.selectOptions(screen.getByLabelText('Categoria'), mockExpenseCategory.id);
    await user.click(screen.getByLabelText('Parcelamento de terceiro'));
    await user.type(screen.getByLabelText('Responsável'), 'Bob');
    await user.click(screen.getByLabelText('Já foi reembolsado'));
    await user.type(screen.getByLabelText('Observações (opcional)'), 'nota');
    await user.click(screen.getByRole('button', { name: 'Criar parcelamento' }));
    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(create.mock.calls[0][0]).toMatchObject({
      description: 'TV',
      isThirdParty: true,
      thirdPartyName: 'Bob',
      isReimbursed: true,
    });
  });

  it('renders sections, pagination, delete modes and payment date', async () => {
    const user = userEvent.setup();
    getPage.mockResolvedValue(
      makeInstallmentsPage(
        [mockInstallmentGroup, finished, cancelled, cancelledNoDate, finishedNoLast, thirdParty],
        { page: 1, pageSize: 25, total: 30, totalPages: 2 }
      )
    );

    renderWithProviders(<Installments />);
    await waitFor(() => expect(screen.getByText('Em andamento')).toBeInTheDocument());
    expect(screen.getByText('Finalizados')).toBeInTheDocument();
    expect(screen.getByText('Cancelados')).toBeInTheDocument();
    expect(screen.getByText(/Terceiro: Ana/)).toBeInTheDocument();
    expect(screen.getByText('Reembolsado')).toBeInTheDocument();
    expect(screen.getByText(/cancelado em/)).toBeInTheDocument();
    expect(screen.getByText('Cancelado sem data')).toBeInTheDocument();
    expect(screen.getByText(/finalizado em/)).toBeInTheDocument();
    expect(screen.getByText('Finalizado sem last')).toBeInTheDocument();
    expect(document.body.textContent).toMatch(/· cancelado(?! em)/);
    expect(document.body.textContent).toMatch(/· finalizado(?! em)/);

    await user.click(screen.getByRole('button', { name: 'Próxima' }));
    await waitFor(() => expect(getPage).toHaveBeenCalled());

    await user.click(screen.getByLabelText('Remover Notebook'));
    expect(screen.getByText('Remover parcelamento')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remover parcelas futuras' }));
    await waitFor(() => {
      expect(remove.mock.calls.some((c) => c[0] === 'inst-1' && c[1] === 'future')).toBe(true);
    });

    await user.click(screen.getByLabelText('Remover Notebook'));
    await user.click(screen.getByRole('button', { name: 'Remover parcelamento completo' }));
    await waitFor(() => {
      expect(remove.mock.calls.some((c) => c[0] === 'inst-1' && c[1] === 'all')).toBe(true);
    });
  });

  it('updates payment date with validation', async () => {
    const user = userEvent.setup();
    getPage.mockResolvedValue(makeInstallmentsPage([mockInstallmentGroup]));
    renderWithProviders(<Installments />);
    await waitFor(() => expect(screen.getByText('Notebook')).toBeInTheDocument());

    await user.click(screen.getByLabelText('Alterar vencimento de Notebook'));
    expect(screen.getByText('Alterar vencimento')).toBeInTheDocument();

    const input = screen.getByLabelText('Vencimento da 1ª parcela');
    fireEvent.change(input, { target: { value: '99999999' } });
    expect(input).toHaveValue('99/99/9999');
    await user.click(screen.getByRole('button', { name: 'Salvar vencimento' }));
    await waitFor(() =>
      expect(screen.getByText('Informe uma data válida no formato dd/mm/aaaa')).toBeInTheDocument()
    );

    fireEvent.change(input, { target: { value: '15042024' } });
    expect(input).toHaveValue('15/04/2024');
    await user.click(screen.getByRole('button', { name: 'Salvar vencimento' }));
    await waitFor(() => expect(updatePaymentDate).toHaveBeenCalled());
  });

  it('handles zero-count groups as empty sections and cancel create', async () => {
    const user = userEvent.setup();
    getPage.mockResolvedValue(
      makeInstallmentsPage([
        {
          ...mockInstallmentGroup,
          id: 'zero',
          description: 'Zero',
          installmentCount: 0,
          paidCount: 0,
          isCancelled: false,
        },
      ])
    );
    renderWithProviders(<Installments />);
    await waitFor(() =>
      expect(screen.getByText('Nenhum parcelamento para a referência selecionada')).toBeInTheDocument()
    );
    await user.click(screen.getByRole('button', { name: 'Novo parcelamento' }));
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
  });

  it('shows create error and cancels delete/payment modals', async () => {
    const user = userEvent.setup();
    create.mockRejectedValue(new Error('x'));
    getPage.mockResolvedValue(makeInstallmentsPage([mockInstallmentGroup]));
    renderWithProviders(<Installments />);
    await waitFor(() => expect(screen.getByText('Notebook')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Novo parcelamento' }));
    await user.type(screen.getByLabelText('Descrição'), 'X');
    await user.type(screen.getByLabelText('Valor total (R$)'), '10');
    await user.selectOptions(screen.getByLabelText('Conta / Cartão'), mockAccount.id);
    await user.selectOptions(screen.getByLabelText('Categoria'), mockExpenseCategory.id);
    await user.click(screen.getByRole('button', { name: 'Criar parcelamento' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Erro parcela'));

    await user.click(screen.getByLabelText('Fechar modal'));
    await user.click(screen.getByLabelText('Remover Notebook'));
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    await user.click(screen.getByLabelText('Alterar vencimento de Notebook'));
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
  });

  it('formats short br date inputs and opens payment without firstTransaction', async () => {
    const user = userEvent.setup();
    getPage.mockResolvedValue(
      makeInstallmentsPage([
        { ...mockInstallmentGroup, id: 'nofirst', firstTransaction: null, description: 'Sem first' },
      ])
    );
    renderWithProviders(<Installments />);
    await waitFor(() => expect(screen.getByText('Sem first')).toBeInTheDocument());
    await user.click(screen.getByLabelText('Alterar vencimento de Sem first'));
    const input = screen.getByLabelText('Vencimento da 1ª parcela');
    await user.clear(input);
    await user.type(input, '1');
    expect(input).toHaveValue('1');
    await user.type(input, '5');
    expect(input).toHaveValue('15');
    await user.type(input, '0');
    expect(input).toHaveValue('15/0');
  });

  it('unchecks third party on create form', async () => {
    const user = userEvent.setup();
    getPage.mockResolvedValue(makeInstallmentsPage([]));
    renderWithProviders(<Installments />);
    await waitFor(() => expect(screen.getByText('Parcelamentos')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Novo parcelamento' }));
    const cb = screen.getByLabelText('Parcelamento de terceiro');
    await user.click(cb);
    expect(screen.getByLabelText('Responsável')).toBeInTheDocument();
    await user.click(cb);
    expect(screen.queryByLabelText('Responsável')).not.toBeInTheDocument();
  });

  it('paginates previous', async () => {
    const user = userEvent.setup();
    getPage.mockResolvedValue(
      makeInstallmentsPage([mockInstallmentGroup], { page: 1, pageSize: 25, total: 50, totalPages: 2 })
    );
    renderWithProviders(<Installments />);
    await waitFor(() => expect(screen.getByText('Notebook')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Próxima' }));
    await user.click(screen.getByRole('button', { name: 'Anterior' }));
  });

  it('covers nullish fields, invalid calendar date, sorts and empty third party name', async () => {
    const user = userEvent.setup();
    const sparse = {
      ...mockInstallmentGroup,
      id: 'sparse',
      description: 'Sparse',
      paidCount: undefined,
      installmentCount: 2,
      installmentAmountCents: undefined,
      remainingAmountCents: undefined,
      nextTransaction: null,
      lastTransaction: null,
      historicalCount: undefined,
      deletableFutureCount: undefined,
    };
    const finishedA = {
      ...mockInstallmentGroup,
      id: 'fa',
      description: 'Z fin',
      paidCount: 10,
      lastTransaction: {
        ...mockInstallmentGroup.lastTransaction!,
        id: 'fin-a-last',
        effectiveDate: '2024-06-01T12:00:00.000Z',
      },
      nextTransaction: null,
      isCancelled: false,
    };
    const finishedB = {
      ...finishedA,
      id: 'fb',
      description: 'A fin',
      lastTransaction: {
        ...mockInstallmentGroup.lastTransaction!,
        id: 'fin-b-last',
        effectiveDate: '2024-06-01T12:00:00.000Z',
      },
    };
    const finishedC = {
      ...finishedA,
      id: 'fc',
      description: 'No last',
      lastTransaction: null,
    };
    const cancelledA = {
      ...mockInstallmentGroup,
      id: 'ca',
      description: 'Z can',
      isCancelled: true,
      cancelledAt: '2024-05-01T12:00:00.000Z',
    };
    const cancelledB = {
      ...cancelledA,
      id: 'cb',
      description: 'A can',
      cancelledAt: '2024-05-01T12:00:00.000Z',
    };
    const cancelledC = {
      ...cancelledA,
      id: 'cc',
      description: 'Null can',
      cancelledAt: null,
    };
    const noNameThird = {
      ...mockInstallmentGroup,
      id: 'nn',
      description: 'Sem nome',
      isThirdParty: true,
      thirdPartyName: null,
      nextTransaction: null,
    };

    getPage.mockResolvedValue(
      makeInstallmentsPage(
        [sparse, finishedA, finishedB, finishedC, cancelledA, cancelledB, cancelledC, noNameThird],
        {
          page: 1,
          pageSize: 25,
          total: 8,
          totalPages: 1,
        }
      )
    );

    renderWithProviders(<Installments />);
    await waitFor(() => expect(screen.getByText('Sem nome')).toBeInTheDocument());
    expect(screen.getByText('Terceiro')).toBeInTheDocument();

    await user.click(screen.getByLabelText('Remover Sparse'));
    expect(screen.getByText(/0 parcela\(s\) no histórico/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    await user.click(screen.getByLabelText('Alterar vencimento de Sparse'));
    const input = screen.getByLabelText('Vencimento da 1ª parcela');
    fireEvent.change(input, { target: { value: '31022024' } });
    expect(input).toHaveValue('31/02/2024');
    await user.click(screen.getByRole('button', { name: 'Salvar vencimento' }));
    await waitFor(() =>
      expect(screen.getByText('Informe uma data válida no formato dd/mm/aaaa')).toBeInTheDocument()
    );
    // Incomplete BR date → regex miss in brDateToIso
    fireEvent.change(input, { target: { value: '1504' } });
    expect(input).toHaveValue('15/04');
    await user.click(screen.getByRole('button', { name: 'Salvar vencimento' }));
    await waitFor(() =>
      expect(screen.getByText('Informe uma data válida no formato dd/mm/aaaa')).toBeInTheDocument()
    );
    fireEvent.change(input, { target: { value: '' } });
    await user.click(screen.getByRole('button', { name: 'Salvar vencimento' }));
    await waitFor(() =>
      expect(screen.getByText('Informe uma data válida no formato dd/mm/aaaa')).toBeInTheDocument()
    );
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
  });

  it('creates third party with empty name and changes start date', async () => {
    const user = userEvent.setup();
    getPage.mockResolvedValue(makeInstallmentsPage([]));
    renderWithProviders(<Installments />);
    await waitFor(() => expect(screen.getByText('Nenhum parcelamento cadastrado')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Registrar parcelamento' }));

    await user.type(screen.getByLabelText('Descrição'), 'X');
    await user.type(screen.getByLabelText('Valor total (R$)'), '100');
    await user.selectOptions(screen.getByLabelText('Conta / Cartão'), mockAccount.id);
    await user.selectOptions(screen.getByLabelText('Categoria'), mockExpenseCategory.id);
    const start = screen.getByLabelText('Data da compra');
    await user.clear(start);
    await user.type(start, '2024-06-15');
    await user.click(screen.getByLabelText('Parcelamento de terceiro'));
    await user.click(screen.getByRole('button', { name: 'Criar parcelamento' }));
    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(create.mock.calls[0][0]).toMatchObject({ isThirdParty: true, thirdPartyName: null });
  });

  it('shows installment preview when amount and count are set', async () => {
    const user = userEvent.setup();
    getPage.mockResolvedValue(makeInstallmentsPage([]));
    renderWithProviders(<Installments />);
    await waitFor(() => expect(screen.getByText('Nenhum parcelamento cadastrado')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Registrar parcelamento' }));
    fireEvent.change(screen.getByLabelText('Valor total (R$)'), { target: { value: '100' } });
    await waitFor(() => expect(screen.getByText(/2x de/)).toBeInTheDocument());
  });

  it('disables next page on last page', async () => {
    const user = userEvent.setup();
    getPage.mockResolvedValue(
      makeInstallmentsPage([mockInstallmentGroup], { page: 1, pageSize: 25, total: 50, totalPages: 2 })
    );
    renderWithProviders(<Installments />);
    await waitFor(() => expect(screen.getByText('Notebook')).toBeInTheDocument());
    const next = screen.getByRole('button', { name: 'Próxima' });
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();
    await user.click(next);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Próxima' })).toBeDisabled());
  });

  it('keeps payment modal open while update is pending', async () => {
    const user = userEvent.setup();
    let resolveUpdate!: (v: unknown) => void;
    updatePaymentDate.mockReturnValue(new Promise((r) => { resolveUpdate = r; }));
    getPage.mockResolvedValue(makeInstallmentsPage([mockInstallmentGroup]));
    renderWithProviders(<Installments />);
    await waitFor(() => expect(screen.getByText('Notebook')).toBeInTheDocument());

    await user.click(screen.getByLabelText('Alterar vencimento de Notebook'));
    fireEvent.change(screen.getByLabelText('Vencimento da 1ª parcela'), { target: { value: '15042024' } });
    await user.click(screen.getByRole('button', { name: 'Salvar vencimento' }));
    await waitFor(() => expect(updatePaymentDate).toHaveBeenCalled());

    await user.keyboard('{Escape}');
    expect(screen.getByText('Alterar vencimento')).toBeInTheDocument();

    resolveUpdate({});
    await waitFor(() => expect(screen.queryByText('Alterar vencimento')).not.toBeInTheDocument());
  });

  it('rejects incomplete payment date and blocks delete close while pending', async () => {
    const user = userEvent.setup();
    let resolveDelete!: () => void;
    remove.mockReturnValue(new Promise<void>((r) => { resolveDelete = r; }));
    const finishedWithLast = {
      ...mockInstallmentGroup,
      id: 'fin-a',
      description: 'Fin A',
      paidCount: 10,
      remainingAmountCents: 0,
      nextTransaction: null,
      isCancelled: false,
    };
    const finishedWithLaterLast = {
      ...finishedWithLast,
      id: 'fin-b',
      description: 'Fin B',
      lastTransaction: {
        ...mockInstallmentGroup.lastTransaction!,
        id: 'lt-b',
        effectiveDate: '2024-12-01T12:00:00.000Z',
      },
    };
    const cancelledDated = {
      ...mockInstallmentGroup,
      id: 'can-a',
      description: 'Can A',
      isCancelled: true,
      cancelledAt: '2024-08-01T12:00:00.000Z',
    };
    const cancelledDated2 = {
      ...cancelledDated,
      id: 'can-b',
      description: 'Can B',
      cancelledAt: '2024-09-01T12:00:00.000Z',
    };
    getPage.mockResolvedValue(
      makeInstallmentsPage([finishedWithLast, finishedWithLaterLast, cancelledDated, cancelledDated2, mockInstallmentGroup])
    );
    renderWithProviders(<Installments />);
    await waitFor(() => expect(screen.getByText('Fin A')).toBeInTheDocument());

    await user.click(screen.getByLabelText('Alterar vencimento de Notebook'));
    fireEvent.change(screen.getByLabelText('Vencimento da 1ª parcela'), { target: { value: '1504' } });
    await user.click(screen.getByRole('button', { name: 'Salvar vencimento' }));
    await waitFor(() =>
      expect(screen.getByText('Informe uma data válida no formato dd/mm/aaaa')).toBeInTheDocument()
    );
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    await user.click(screen.getByLabelText('Remover Notebook'));
    await user.click(screen.getByRole('button', { name: 'Remover parcelas futuras' }));
    await user.keyboard('{Escape}');
    expect(screen.getByText('Remover parcelamento')).toBeInTheDocument();
    resolveDelete();
    await waitFor(() => expect(screen.queryByText('Remover parcelamento')).not.toBeInTheDocument());
  });

  it('creates without notes', async () => {
    const user = userEvent.setup();
    getPage.mockResolvedValue(makeInstallmentsPage([]));
    renderWithProviders(<Installments />);
    await waitFor(() => expect(screen.getByText('Nenhum parcelamento cadastrado')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Registrar parcelamento' }));
    await user.type(screen.getByLabelText('Descrição'), 'Sem nota');
    await user.type(screen.getByLabelText('Valor total (R$)'), '50');
    await user.selectOptions(screen.getByLabelText('Conta / Cartão'), mockAccount.id);
    await user.selectOptions(screen.getByLabelText('Categoria'), mockExpenseCategory.id);
    await user.click(screen.getByRole('button', { name: 'Criar parcelamento' }));
    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(create.mock.calls.at(-1)?.[0]).toMatchObject({ notes: undefined });
  });
});
