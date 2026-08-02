import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import MonthlyChart from './MonthlyChart';
import { renderWithProviders } from '@/test/test-utils';
import { mockEvolution } from '@/test/fixtures';

const getEvolution = vi.fn();

vi.mock('@/services/api', () => ({
  summaryApi: {
    getEvolution: () => getEvolution(),
  },
}));

vi.mock('recharts', () => {
  const PassThrough = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
  return {
    ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => (
      <div data-testid="chart">{children}</div>
    ),
    ComposedChart: PassThrough,
    Bar: () => null,
    Line: () => null,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: ({ formatter }: { formatter?: (v: number) => string }) => {
      if (formatter) formatter(12345);
      return null;
    },
    Legend: () => null,
  };
});

describe('MonthlyChart', () => {
  beforeEach(() => getEvolution.mockReset());

  it('shows loading then chart', async () => {
    let resolve!: (v: unknown) => void;
    getEvolution.mockReturnValue(new Promise((r) => { resolve = r; }));

    renderWithProviders(<MonthlyChart />);
    expect(screen.getByText('Carregando...')).toBeInTheDocument();
    expect(screen.getByText('Fluxo & saldo acumulado')).toBeInTheDocument();

    resolve(mockEvolution);
    await waitFor(() => expect(screen.getByTestId('chart')).toBeInTheDocument());
  });
});
