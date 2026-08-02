import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Button from './Button';
import Input from './Input';
import Select from './Select';
import FormError from './FormError';
import ColorPicker from './ColorPicker';
import ConfirmDialog from './ConfirmDialog';
import Modal from './Modal';

describe('ui primitives', () => {
  it('renders Button variants sizes and loading state', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const { rerender } = render(
      <Button onClick={onClick} variant="primary" size="sm">
        Salvar
      </Button>
    );
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(onClick).toHaveBeenCalled();
    rerender(
      <Button variant="secondary" size="md">
        Sec
      </Button>
    );
    rerender(
      <Button variant="danger" size="lg">
        Del
      </Button>
    );
    rerender(<Button variant="ghost">Ghost</Button>);
    rerender(
      <Button loading disabled>
        Load
      </Button>
    );
    expect(screen.getByRole('button', { name: /Load/ })).toBeDisabled();
  });

  it('renders Input Select FormError ColorPicker', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    const { rerender } = render(<Input label="Nome" value="x" onChange={onChange} error="ops" />);
    expect(screen.getByText('Nome')).toBeInTheDocument();
    expect(screen.getByText('ops')).toBeInTheDocument();

    rerender(
      <Select label="Tipo" value="A" onChange={onChange} error="err">
        <option value="A">A</option>
      </Select>
    );
    expect(screen.getByText('Tipo')).toBeInTheDocument();

    rerender(<FormError error={null} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    rerender(<FormError error={new Error('ignored')} />);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Não foi possível concluir a operação. Tente novamente.'
    );

    rerender(<ColorPicker label="Cor" value="#EF4444" onChange={onChange} />);
    await user.click(screen.getByLabelText('Selecionar cor #F97316'));
    expect(onChange).toHaveBeenCalledWith('#F97316');
  });

  it('opens Modal and ConfirmDialog interactions', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onConfirm = vi.fn();

    const { rerender } = render(
      <Modal isOpen onClose={onClose} title="Titulo" size="md">
        <p>conteudo</p>
      </Modal>
    );
    expect(screen.getByText('Titulo')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();

    rerender(
      <Modal isOpen={false} onClose={onClose} title="Hidden">
        hidden
      </Modal>
    );
    expect(screen.queryByText('Hidden')).not.toBeInTheDocument();

    rerender(
      <ConfirmDialog
        isOpen
        title="Confirmar"
        description="Tem certeza?"
        onConfirm={onConfirm}
        onClose={onClose}
      />
    );
    await user.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(onConfirm).toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onClose).toHaveBeenCalled();
  });
});
