import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createRef } from 'react';
import Select from './Select';

describe('Select', () => {
  it('renders label and options', () => {
    render(
      <Select label="Tipo" id="tipo">
        <option value="a">A</option>
      </Select>
    );
    expect(screen.getByLabelText('Tipo')).toHaveAttribute('id', 'tipo');
    expect(screen.getByRole('option', { name: 'A' })).toBeInTheDocument();
  });

  it('generates id and shows error', () => {
    render(
      <Select label="Conta" error="Selecione" id="conta">
        <option value="">—</option>
      </Select>
    );
    const select = screen.getByLabelText('Conta');
    expect(select).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Selecione')).toBeInTheDocument();
  });

  it('forwards ref without label', () => {
    const ref = createRef<HTMLSelectElement>();
    render(
      <Select ref={ref}>
        <option value="1">Um</option>
      </Select>
    );
    expect(ref.current).toBeInstanceOf(HTMLSelectElement);
  });
});
