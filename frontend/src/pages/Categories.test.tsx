import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Categories from './Categories';
import { renderWithProviders } from '@/test/test-utils';
import { mockExpenseCategory, mockIncomeCategory } from '@/test/fixtures';
import { PRESET_COLORS } from '@/utils/formatters';

const getAll = vi.fn();
const create = vi.fn();
const update = vi.fn();
const remove = vi.fn();

vi.mock('@/services/api', () => ({
  categoriesApi: {
    getAll: () => getAll(),
    create: (...a: unknown[]) => create(...a),
    update: (...a: unknown[]) => update(...a),
    delete: (...a: unknown[]) => remove(...a),
  },
  getApiErrorMessage: () => 'Erro cat',
}));

describe('Categories', () => {
  beforeEach(() => {
    getAll.mockReset();
    create.mockReset().mockResolvedValue({});
    update.mockReset().mockResolvedValue({});
    remove.mockReset().mockResolvedValue({});
  });

  it('shows empty columns then CRUD', async () => {
    const user = userEvent.setup();
    getAll.mockResolvedValue([]);
    renderWithProviders(<Categories />);
    await waitFor(() => expect(screen.getAllByText('Nenhuma categoria')).toHaveLength(2));

    await user.click(screen.getByRole('button', { name: 'Nova categoria' }));
    await user.type(screen.getByLabelText('Nome'), 'Lazer');
    await user.selectOptions(screen.getByLabelText('Tipo'), 'INCOME');
    await user.click(screen.getByLabelText(`Selecionar cor ${PRESET_COLORS[3]}`));
    await user.click(screen.getByRole('button', { name: 'Adicionar' }));
    await waitFor(() => expect(create).toHaveBeenCalled());
  });

  it('lists, edits and deletes', async () => {
    const user = userEvent.setup();
    getAll.mockResolvedValue([mockExpenseCategory, mockIncomeCategory]);
    renderWithProviders(<Categories />);
    await waitFor(() => expect(screen.getByText('Alimentação')).toBeInTheDocument());
    expect(screen.getByText('Salário')).toBeInTheDocument();

    await user.click(screen.getByLabelText('Editar Alimentação'));
    await waitFor(() => expect(screen.getByText('Editar categoria')).toBeInTheDocument());
    await user.clear(screen.getByLabelText('Nome'));
    await user.type(screen.getByLabelText('Nome'), 'Comida');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(update).toHaveBeenCalled());

    await user.click(screen.getByLabelText('Excluir Salário'));
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByText('Excluir categoria')).not.toBeInTheDocument());

    await user.click(screen.getByLabelText('Excluir Salário'));
    await user.click(screen.getByRole('button', { name: 'Excluir' }));
    await waitFor(() => expect(remove.mock.calls[0][0]).toBe(mockIncomeCategory.id));
  });

  it('shows create error and cancel', async () => {
    const user = userEvent.setup();
    create.mockRejectedValue(new Error('x'));
    getAll.mockResolvedValue([]);
    renderWithProviders(<Categories />);
    await waitFor(() => expect(screen.getByText('Categorias')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Nova categoria' }));
    await user.type(screen.getByLabelText('Nome'), 'X');
    await user.click(screen.getByRole('button', { name: 'Adicionar' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Erro cat'));
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
  });

  it('keeps delete dialog open while mutation is pending', async () => {
    const user = userEvent.setup();
    let resolveDelete!: () => void;
    remove.mockReturnValue(new Promise<void>((r) => { resolveDelete = r; }));
    getAll.mockResolvedValue([mockExpenseCategory]);
    renderWithProviders(<Categories />);
    await waitFor(() => expect(screen.getByText('Alimentação')).toBeInTheDocument());
    await user.click(screen.getByLabelText('Excluir Alimentação'));
    await user.click(screen.getByRole('button', { name: 'Excluir' }));
    // Cancel is disabled while loading — Escape still invokes onClose (pending guard)
    await user.keyboard('{Escape}');
    expect(screen.getByText('Excluir categoria')).toBeInTheDocument();
    resolveDelete();
    await waitFor(() => expect(screen.queryByText('Excluir categoria')).not.toBeInTheDocument());
  });
});
