import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Alerts from './Alerts';
import { renderWithProviders } from '@/test/test-utils';
import { mockAlert, mockAlertStatus, mockExpenseCategory } from '@/test/fixtures';

const getAll = vi.fn();
const check = vi.fn();
const getCategories = vi.fn();
const create = vi.fn();
const update = vi.fn();
const remove = vi.fn();

vi.mock('@/services/api', () => ({
  alertsApi: {
    getAll: () => getAll(),
    check: () => check(),
    create: (...a: unknown[]) => create(...a),
    update: (...a: unknown[]) => update(...a),
    delete: (...a: unknown[]) => remove(...a),
  },
  categoriesApi: { getAll: () => getCategories() },
  getApiErrorMessage: () => 'Erro alerta',
}));

describe('Alerts', () => {
  beforeEach(() => {
    getAll.mockReset();
    check.mockReset();
    getCategories.mockResolvedValue([mockExpenseCategory]);
    create.mockReset().mockResolvedValue({});
    update.mockReset().mockResolvedValue({});
    remove.mockReset().mockResolvedValue({});
  });

  it('empty state and create', async () => {
    const user = userEvent.setup();
    getAll.mockResolvedValue([]);
    check.mockResolvedValue([]);
    renderWithProviders(<Alerts />);
    await waitFor(() => expect(screen.getByText('Nenhum alerta configurado')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Criar alerta' }));
    expect(screen.getByRole('heading', { name: 'Novo alerta' })).toBeInTheDocument();
    await user.type(screen.getByLabelText('Nome do alerta'), 'Limite');
    await user.selectOptions(screen.getByLabelText('Categoria'), mockExpenseCategory.id);
    await user.type(screen.getByLabelText('Limite (R$)'), '500');
    await user.selectOptions(screen.getByLabelText('Período'), 'WEEKLY');
    const submitCreate = screen.getAllByRole('button', { name: 'Criar alerta' }).find(
      (btn) => (btn as HTMLButtonElement).type === 'submit'
    );
    expect(submitCreate).toBeTruthy();
    await user.click(submitCreate!);
    await waitFor(() => expect(create).toHaveBeenCalled());
  });

  it('lists statuses sorting and toggle/edit/delete', async () => {
    const user = userEvent.setup();
    const inactive = { ...mockAlert, id: 'a2', name: 'Inativo Alert', isActive: false };
    const triggered = { ...mockAlert, id: 'a3', name: 'Estourado' };
    const ok = { ...mockAlert, id: 'a4', name: 'Ok' };
    const weekly = { ...mockAlert, id: 'a5', name: 'Alerta Semanal', period: 'WEEKLY' as const };

    getAll.mockResolvedValue([inactive, mockAlert, triggered, ok, weekly]);
    check.mockResolvedValue([
      mockAlertStatus,
      { ...mockAlertStatus, id: 'a3', name: 'Estourado', isTriggered: true, isWarning: false, percentage: 110 },
      { ...mockAlertStatus, id: 'a4', name: 'Ok', isTriggered: false, isWarning: false, percentage: 10 },
      { ...mockAlertStatus, id: 'a5', isTriggered: false, isWarning: false },
    ]);

    renderWithProviders(<Alerts />);
    await waitFor(() => expect(screen.getByText('Limite alimentação')).toBeInTheDocument());
    expect(screen.getByText(/quase no limite/)).toBeInTheDocument();
    expect(screen.getByText(/limite ultrapassado/)).toBeInTheDocument();
    expect(screen.getAllByText('Inativo').length).toBeGreaterThan(0);
    expect(screen.getByText('Alerta Semanal')).toBeInTheDocument();
    expect(screen.getAllByText('Mensal').length).toBeGreaterThan(0);

    await user.click(screen.getAllByTitle('Desativar')[0]);
    await waitFor(() => expect(update).toHaveBeenCalled());

    await user.click(screen.getByTitle('Ativar'));
    await waitFor(() => expect(update.mock.calls.length).toBeGreaterThan(1));

    await user.click(screen.getAllByTitle('Editar alerta')[0]);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Editar alerta' })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(update.mock.calls.length).toBeGreaterThan(2));

    await user.click(screen.getAllByTitle('Excluir alerta')[0]);
    await user.click(screen.getByRole('button', { name: 'Excluir' }));
    await waitFor(() => expect(remove).toHaveBeenCalled());
  });

  it('shows create error and cancels', async () => {
    const user = userEvent.setup();
    create.mockRejectedValue(new Error('x'));
    getAll.mockResolvedValue([mockAlert]);
    check.mockResolvedValue([mockAlertStatus]);
    renderWithProviders(<Alerts />);
    await waitFor(() => expect(screen.getByText('Limite alimentação')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Novo alerta' }));
    await user.type(screen.getByLabelText('Nome do alerta'), 'X');
    await user.selectOptions(screen.getByLabelText('Categoria'), mockExpenseCategory.id);
    await user.type(screen.getByLabelText('Limite (R$)'), '1');
    await user.click(screen.getByRole('button', { name: 'Criar alerta' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Erro alerta'));
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    await user.click(screen.getByTitle('Excluir alerta'));
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
  });

  it('keeps delete dialog open while mutation is pending', async () => {
    const user = userEvent.setup();
    let resolveDelete!: () => void;
    remove.mockReturnValue(new Promise<void>((r) => { resolveDelete = r; }));
    getAll.mockResolvedValue([mockAlert]);
    check.mockResolvedValue([mockAlertStatus]);
    renderWithProviders(<Alerts />);
    await waitFor(() => expect(screen.getByText('Limite alimentação')).toBeInTheDocument());
    await user.click(screen.getByTitle('Excluir alerta'));
    await user.click(screen.getByRole('button', { name: 'Excluir' }));
    await user.keyboard('{Escape}');
    expect(screen.getByText('Excluir alerta')).toBeInTheDocument();
    resolveDelete();
    await waitFor(() => expect(screen.queryByText(/Excluir "/)).not.toBeInTheDocument());
  });
});
