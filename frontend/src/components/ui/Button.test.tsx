import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Button from './Button';

describe('Button', () => {
  it('renders children and handles click', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Salvar</Button>);
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(onClick).toHaveBeenCalled();
  });

  it('applies variants and sizes', () => {
    const { rerender } = render(<Button variant="secondary" size="sm">A</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-white');
    rerender(<Button variant="danger" size="lg">A</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-expense/10');
    rerender(<Button variant="ghost">A</Button>);
    expect(screen.getByRole('button')).toHaveClass('hover:bg-chip');
    rerender(<Button variant="accent">A</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-lime');
  });

  it('shows loading spinner and disables', () => {
    render(<Button loading>Carregando</Button>);
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
    expect(btn.querySelector('.animate-spin')).toBeTruthy();
  });

  it('respects disabled prop', () => {
    render(<Button disabled>X</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
