import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConfirmDialog from './ConfirmDialog';

vi.mock('../../services/api', () => ({
  getApiErrorMessage: (error: unknown) =>
    error && typeof error === 'object' && 'message' in error
      ? String((error as { message: string }).message)
      : 'Erro',
}));

describe('ConfirmDialog', () => {
  it('renders defaults and handles confirm/cancel', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onConfirm = vi.fn();

    render(
      <ConfirmDialog
        isOpen
        title="Excluir"
        description="Tem certeza?"
        onClose={onClose}
        onConfirm={onConfirm}
      />
    );

    expect(screen.getByText('Tem certeza?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onClose).toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(onConfirm).toHaveBeenCalled();
  });

  it('shows custom labels, loading and error', () => {
    render(
      <ConfirmDialog
        isOpen
        title="T"
        description="D"
        confirmLabel="Excluir"
        cancelLabel="Voltar"
        loading
        error={{ message: 'Falha' }}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /Excluir/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Voltar' })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('Falha');
  });
});
