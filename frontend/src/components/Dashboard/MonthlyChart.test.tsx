import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import MonthlyChart from './MonthlyChart';
import { renderWithProviders } from '@/test/test-utils';
import { mockEvolution } from '@/test/fixtures';

const getEvolution = vi.fn();

vi.mock('@/services/api', () => ({
  getApiErrorMessage: () => 'offline',
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
    Area: () => null,
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

  it('shows an error and retries successfully', async () => {
    getEvolution.mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce(mockEvolution);
    renderWithProviders(<MonthlyChart />);
    await waitFor(() => expect(screen.getByText('Não foi possível carregar o gráfico')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    await waitFor(() => expect(screen.getByTestId('chart')).toBeInTheDocument());
  });

  it('warns when cached data refresh fails', async () => {
    getEvolution.mockResolvedValueOnce(mockEvolution).mockRejectedValueOnce(new Error('down'));
    const { queryClient } = renderWithProviders(<MonthlyChart />);
    await waitFor(() => expect(screen.getByTestId('chart')).toBeInTheDocument());
    await queryClient.invalidateQueries({ queryKey: ['summary', 'evolution'] });
    await waitFor(() => expect(screen.getByText(/Exibindo dados salvos/)).toBeInTheDocument());
  });

});
