import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Accounts from './Accounts';
import { renderWithProviders } from '@/test/test-utils';
import {
  mockAccount,
  mockCashAccount,
  mockCreditCard,
  mockInvestment,
} from '@/test/fixtures';
import { PRESET_COLORS } from '@/utils/formatters';

const getAll = vi.fn();
const create = vi.fn();
const update = vi.fn();
const remove = vi.fn();

vi.mock('@/services/api', () => ({
  accountsApi: {
    getAll: () => getAll(),
    create: (...a: unknown[]) => create(...a),
    update: (...a: unknown[]) => update(...a),
    delete: (...a: unknown[]) => remove(...a),
  },
  getApiErrorMessage: () => 'Erro conta',
}));

describe('Accounts', () => {
  beforeEach(() => {
    getAll.mockReset();
    create.mockReset().mockResolvedValue({});
    update.mockReset().mockResolvedValue({});
    remove.mockReset().mockResolvedValue({});
  });

  it('shows empty state and opens create modal', async () => {
    const user = userEvent.setup();
    getAll.mockResolvedValue([]);
    renderWithProviders(<Accounts />);
    await waitFor(() => expect(screen.getByText('Nenhuma conta cadastrada')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Adicionar conta' }));
    expect(screen.getByRole('heading', { name: 'Nova conta' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('lists accounts and CRUD flows', async () => {
    const user = userEvent.setup();
    getAll.mockResolvedValue([
      mockAccount,
      mockCreditCard,
      { ...mockCreditCard, id: 'cc-empty', creditLimitCents: null, closingDay: null, dueDay: 20, name: 'Só vencimento' },
      mockCashAccount,
      mockInvestment,
    ]);

    renderWithProviders(<Accounts />);
    await waitFor(() => expect(screen.getByText('Nubank')).toBeInTheDocument());
    expect(screen.getByText('Não informado')).toBeInTheDocument();
    expect(screen.getByText(/Fecha dia 10/)).toBeInTheDocument();
    expect(screen.getByText('Total investido')).toBeInTheDocument();
    expect(screen.getAllByText('Saldo inicial').length).toBeGreaterThan(0);
    expect(screen.getByText(/Vence dia 20/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Nova conta/i }));
    await user.type(screen.getByLabelText('Nome da conta'), 'Itaú');
    await user.selectOptions(screen.getByLabelText('Tipo'), 'CREDIT_CARD');
    await user.type(screen.getByLabelText('Limite total (opcional)'), '1000');
    await user.type(screen.getByLabelText('Dia de fechamento'), '5');
    await user.type(screen.getByLabelText('Dia de vencimento'), '15');
    await user.click(screen.getByLabelText(`Selecionar cor ${PRESET_COLORS[0]}`));
    await user.click(screen.getByRole('button', { name: 'Adicionar' }));
    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(create.mock.calls[0][0]).toMatchObject({ type: 'CREDIT_CARD', openingBalanceCents: 0 });

    await user.click(screen.getAllByTitle('Editar conta')[0]);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Editar conta' })).toBeInTheDocument());
    const nameInput = screen.getByLabelText('Nome da conta');
    await user.clear(nameInput);
    await user.type(nameInput, 'Nubank 2');
    const balanceInput = screen.getByLabelText('Saldo inicial (R$)');
    await user.clear(balanceInput);
    await user.type(balanceInput, '50');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(update).toHaveBeenCalled());

    await user.click(screen.getByText('Cartão XP').closest('.card')!.querySelector('[title="Editar conta"]')!);
    await waitFor(() => expect(screen.getByLabelText('Nome da conta')).toHaveValue('Cartão XP'));
    expect((screen.getByLabelText('Dia de fechamento') as HTMLInputElement).value).toBe('10');
    expect((screen.getByLabelText('Dia de vencimento') as HTMLInputElement).value).toBe('17');
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    await user.click(screen.getAllByTitle('Excluir conta')[0]);
    await user.click(screen.getByRole('button', { name: 'Excluir' }));
    await waitFor(() => expect(remove).toHaveBeenCalled());
  });

  it('switches type away from credit card and shows create error', async () => {
    const user = userEvent.setup();
    create.mockRejectedValue(new Error('x'));
    getAll.mockResolvedValue([]);
    renderWithProviders(<Accounts />);
    await waitFor(() => expect(screen.getByText('Nenhuma conta cadastrada')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Nova conta' }));
    await user.type(screen.getByLabelText('Nome da conta'), 'X');
    await user.selectOptions(screen.getByLabelText('Tipo'), 'CREDIT_CARD');
    await user.selectOptions(screen.getByLabelText('Tipo'), 'BANK_ACCOUNT');
    expect(screen.getByLabelText('Saldo inicial (R$)')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Adicionar' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Erro conta'));
  });

  it('cancels delete dialog', async () => {
    const user = userEvent.setup();
    getAll.mockResolvedValue([mockAccount]);
    renderWithProviders(<Accounts />);
    await waitFor(() => expect(screen.getByText('Nubank')).toBeInTheDocument());
    await user.click(screen.getByTitle('Excluir conta'));
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
  });

  it('keeps delete dialog open while mutation is pending', async () => {
    const user = userEvent.setup();
    let resolveDelete!: () => void;
    remove.mockReturnValue(new Promise<void>((r) => { resolveDelete = r; }));
    getAll.mockResolvedValue([mockAccount]);
    renderWithProviders(<Accounts />);
    await waitFor(() => expect(screen.getByText('Nubank')).toBeInTheDocument());
    await user.click(screen.getByTitle('Excluir conta'));
    await user.click(screen.getByRole('button', { name: 'Excluir' }));
    await user.keyboard('{Escape}');
    expect(screen.getByText('Excluir conta')).toBeInTheDocument();
    resolveDelete();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('edits credit card with closing and due days', async () => {
    const user = userEvent.setup();
    getAll.mockResolvedValue([mockCreditCard]);
    renderWithProviders(<Accounts />);
    await waitFor(() => expect(screen.getByText('Cartão XP')).toBeInTheDocument());
    await user.click(screen.getByTitle('Editar conta'));
    await waitFor(() => expect(screen.getByLabelText('Nome da conta')).toHaveValue('Cartão XP'));
    expect((screen.getByLabelText('Dia de fechamento') as HTMLInputElement).value).toBe('10');
    expect((screen.getByLabelText('Dia de vencimento') as HTMLInputElement).value).toBe('17');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(update).toHaveBeenCalled());
  });
});
