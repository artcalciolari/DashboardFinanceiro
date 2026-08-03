import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ChartTooltip from './ChartTooltip';

describe('ChartTooltip', () => {
  it('returns null when inactive', () => {
    const { container } = render(<ChartTooltip active={false} payload={[{ name: 'A', value: 100 }]} />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when payload empty', () => {
    const { container } = render(<ChartTooltip active payload={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when payload missing', () => {
    const { container } = render(<ChartTooltip active />);
    expect(container.firstChild).toBeNull();
  });

  it('renders label and formatted rows', () => {
    render(
      <ChartTooltip
        active
        label="Jan"
        payload={[
          { name: 'Receitas', value: 150050, color: '#3E9E72' },
          { name: 'Despesas', value: 50000 },
        ]}
      />
    );
    expect(screen.getByText('Jan')).toBeInTheDocument();
    expect(screen.getByText('Receitas')).toBeInTheDocument();
    expect(screen.getByText('Despesas')).toBeInTheDocument();
  });

  it('falls back when value and color missing', () => {
    render(
      <ChartTooltip
        active
        payload={[{ name: 'Acumulado' }]}
      />
    );
    expect(screen.getByText('Acumulado')).toBeInTheDocument();
    expect(screen.queryByText('Jan')).not.toBeInTheDocument();
  });
});
