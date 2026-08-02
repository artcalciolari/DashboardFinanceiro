import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Subscriptions from './Subscriptions';
import { renderWithProviders } from '@/test/test-utils';
import {
  makeSubscriptionsPage,
  mockAccount,
  mockCreditCard,
  mockExpenseCategory,
  mockSubscription,
} from '@/test/fixtures';

const getPage = vi.fn();
const create = vi.fn();
const update = vi.fn();
const remove = vi.fn();
const getAccounts = vi.fn();
const getCategories = vi.fn();

vi.mock('@/services/api', () => ({
  subscriptionsApi: {
    getPage: (...a: unknown[]) => getPage(...a),
    create: (...a: unknown[]) => create(...a),
    update: (...a: unknown[]) => update(...a),
    delete: (...a: unknown[]) => remove(...a),
  },
  accountsApi: { getAll: () => getAccounts() },
  categoriesApi: { getAll: () => getCategories() },
  getApiErrorMessage: () => 'Erro sub',
}));

describe('Subscriptions', () => {
  beforeEach(() => {
    getPage.mockReset();
    create.mockReset().mockResolvedValue({});
    update.mockReset().mockResolvedValue({});
    remove.mockReset().mockResolvedValue({});
    getAccounts.mockResolvedValue([
      mockAccount,
      mockCreditCard,
      { ...mockCreditCard, id: 'cc2', closingDay: null, dueDay: null, name: 'CC incompleto' },
    ]);
    getCategories.mockResolvedValue([mockExpenseCategory]);
  });

  it('empty state and create with third party', async () => {
    const user = userEvent.setup();
    getPage.mockResolvedValue(makeSubscriptionsPage([], { activeCount: 0, monthlyTotalCents: 0, thirdPartyTotalCents: 0 }));
    renderWithProviders(<Subscriptions />);
    await waitFor(() => expect(screen.getByText('Nenhuma assinatura cadastrada')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Registrar assinatura' }));

    await user.type(screen.getByLabelText('Nome da assinatura'), 'Netflix');
    await user.type(screen.getByLabelText('Valor mensal (R$)'), '39.90');
    await user.selectOptions(screen.getByLabelText('Conta / Cartão'), mockCreditCard.id);
    expect(screen.getByText(/Fechamento dia 10/)).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Conta / Cartão'), 'cc2');
    expect(screen.getByText(/Complete fechamento e vencimento/)).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Conta / Cartão'), mockAccount.id);
    await user.selectOptions(screen.getByLabelText('Categoria'), mockExpenseCategory.id);
    await user.click(screen.getByLabelText('Assinatura de terceiro'));
    await user.type(screen.getByLabelText('Responsável'), 'Lia');
    await user.click(screen.getByLabelText('Já foi reembolsado'));
    await user.type(screen.getByLabelText('Observações (opcional)'), 'ok');
    await user.type(screen.getByLabelText('Fim (opcional)'), '2025-12-31');
    await user.click(screen.getByRole('button', { name: 'Adicionar' }));
    await waitFor(() => expect(create).toHaveBeenCalled());
  });

  it('lists, edits, deletes, pagination and badges', async () => {
    const user = userEvent.setup();
    const inactive = {
      ...mockSubscription,
      id: 'sub-2',
      name: 'Inativa Sub',
      isActive: false,
      nextTransaction: null,
    };
    const third = {
      ...mockSubscription,
      id: 'sub-3',
      name: 'Terceiro Sub',
      isThirdParty: true,
      thirdPartyName: 'Max',
    };
    getPage.mockResolvedValue(
      makeSubscriptionsPage([mockSubscription, inactive, third], {
        activeCount: 2,
        monthlyTotalCents: 5000,
        thirdPartyTotalCents: 1000,
      }, { page: 1, pageSize: 25, total: 30, totalPages: 2 })
    );

    renderWithProviders(<Subscriptions />);
    await waitFor(() => expect(screen.getByText('Spotify Premium')).toBeInTheDocument());
    expect(screen.getByText(/terceiros/)).toBeInTheDocument();
    expect(screen.getByText('Inativa')).toBeInTheDocument();
    expect(screen.getByText(/Terceiro: Max/)).toBeInTheDocument();
    expect(screen.getByText(/dia 5/)).toBeInTheDocument(); // inactive without next

    await user.click(screen.getByLabelText('Editar Spotify Premium'));
    await waitFor(() => expect(screen.getByText('Editar assinatura')).toBeInTheDocument());
    await user.clear(screen.getByLabelText('Nome da assinatura'));
    await user.type(screen.getByLabelText('Nome da assinatura'), 'Spotify+');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(update).toHaveBeenCalled());

    await user.click(screen.getByLabelText('Encerrar Spotify Premium'));
    await user.click(screen.getByRole('button', { name: 'Encerrar' }));
    await waitFor(() => expect(remove).toHaveBeenCalledWith(mockSubscription.id, 'future'));

    await user.click(screen.getByRole('button', { name: 'Próxima' }));
    await user.click(screen.getByRole('button', { name: 'Anterior' }));
  });

  it('covers third party without name and empty name on submit', async () => {
    const user = userEvent.setup();
    const nameless = {
      ...mockSubscription,
      id: 'sub-nn',
      name: 'SemNome',
      isThirdParty: true,
      thirdPartyName: null,
    };
    getPage.mockResolvedValue(makeSubscriptionsPage([nameless]));
    renderWithProviders(<Subscriptions />);
    await waitFor(() => expect(screen.getByText('SemNome')).toBeInTheDocument());
    expect(screen.getByText('Terceiro')).toBeInTheDocument();

    await user.click(screen.getByLabelText('Editar SemNome'));
    await waitFor(() => expect(screen.getByText('Editar assinatura')).toBeInTheDocument());
    const third = screen.getByLabelText('Assinatura de terceiro');
    if (!(third as HTMLInputElement).checked) await user.click(third);
    const nameField = screen.getByLabelText('Responsável');
    await user.clear(nameField);
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(update).toHaveBeenCalled());
    expect(update.mock.calls.at(-1)?.[1]).toMatchObject({ thirdPartyName: null });
  });

  it('syncs billing day on start date change for create', async () => {
    const user = userEvent.setup();
    getPage.mockResolvedValue(makeSubscriptionsPage([]));
    renderWithProviders(<Subscriptions />);
    await waitFor(() => expect(screen.getByText('Assinaturas')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Nova assinatura' }));

    const start = screen.getByLabelText('Início');
    await user.clear(start);
    await user.type(start, '2024-03-20');
    expect(screen.getByLabelText('Dia da cobrança')).toHaveValue(20);

    // change billing day manually then start date should not sync
    await user.clear(screen.getByLabelText('Dia da cobrança'));
    await user.type(screen.getByLabelText('Dia da cobrança'), '7');
    await user.clear(start);
    await user.type(start, '2024-04-10');
    expect(screen.getByLabelText('Dia da cobrança')).toHaveValue(7);
  });

  it('shows error and cancel delete', async () => {
    const user = userEvent.setup();
    create.mockRejectedValue(new Error('x'));
    getPage.mockResolvedValue(makeSubscriptionsPage([mockSubscription]));
    renderWithProviders(<Subscriptions />);
    await waitFor(() => expect(screen.getByText('Spotify Premium')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Nova assinatura' }));
    await user.type(screen.getByLabelText('Nome da assinatura'), 'X');
    await user.type(screen.getByLabelText('Valor mensal (R$)'), '1');
    await user.selectOptions(screen.getByLabelText('Conta / Cartão'), mockAccount.id);
    await user.selectOptions(screen.getByLabelText('Categoria'), mockExpenseCategory.id);
    await user.click(screen.getByRole('button', { name: 'Adicionar' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Erro sub'));
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    await user.click(screen.getByLabelText('Encerrar Spotify Premium'));
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
  });

  it('keeps end dialog open while mutation is pending', async () => {
    const user = userEvent.setup();
    let resolveDelete!: () => void;
    remove.mockReturnValue(new Promise<void>((r) => { resolveDelete = r; }));
    getPage.mockResolvedValue(makeSubscriptionsPage([mockSubscription]));
    renderWithProviders(<Subscriptions />);
    await waitFor(() => expect(screen.getByText('Spotify Premium')).toBeInTheDocument());
    await user.click(screen.getByLabelText('Encerrar Spotify Premium'));
    await user.click(screen.getByRole('button', { name: 'Encerrar' }));
    await user.keyboard('{Escape}');
    expect(screen.getByText('Encerrar assinatura')).toBeInTheDocument();
    resolveDelete();
    await waitFor(() => expect(screen.queryByText('Encerrar assinatura')).not.toBeInTheDocument());
  });

  it('unchecks third party and toggles active', async () => {
    const user = userEvent.setup();
    getPage.mockResolvedValue(makeSubscriptionsPage([]));
    renderWithProviders(<Subscriptions />);
    await user.click(await screen.findByRole('button', { name: 'Nova assinatura' }));
    const third = screen.getByLabelText('Assinatura de terceiro');
    await user.click(third);
    await user.click(third);
    await user.click(screen.getByLabelText('Assinatura ativa'));
  });

  it('creates without notes and endDate', async () => {
    const user = userEvent.setup();
    getPage.mockResolvedValue(makeSubscriptionsPage([]));
    renderWithProviders(<Subscriptions />);
    await user.click(await screen.findByRole('button', { name: 'Nova assinatura' }));
    await user.type(screen.getByLabelText('Nome da assinatura'), 'Bare');
    await user.type(screen.getByLabelText('Valor mensal (R$)'), '10');
    await user.selectOptions(screen.getByLabelText('Conta / Cartão'), mockAccount.id);
    await user.selectOptions(screen.getByLabelText('Categoria'), mockExpenseCategory.id);
    await user.click(screen.getByRole('button', { name: 'Adicionar' }));
    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(create.mock.calls.at(-1)?.[0]).toMatchObject({
      notes: undefined,
      endDate: null,
      isThirdParty: false,
    });
  });
});
