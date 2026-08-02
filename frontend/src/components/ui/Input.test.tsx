import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createRef } from 'react';
import Input from './Input';

describe('Input', () => {
  it('renders label and binds htmlFor', () => {
    render(<Input label="Nome" id="nome" />);
    expect(screen.getByLabelText('Nome')).toHaveAttribute('id', 'nome');
  });

  it('generates id when not provided', () => {
    render(<Input label="Email" />);
    const input = screen.getByLabelText('Email');
    expect(input.id).toBeTruthy();
  });

  it('shows error state', () => {
    render(<Input label="Valor" error="Obrigatório" id="valor" />);
    const input = screen.getByLabelText('Valor');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Obrigatório')).toHaveAttribute('id', 'valor-error');
    expect(input).toHaveAttribute('aria-describedby', 'valor-error');
  });

  it('forwards ref', () => {
    const ref = createRef<HTMLInputElement>();
    render(<Input ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });
});
