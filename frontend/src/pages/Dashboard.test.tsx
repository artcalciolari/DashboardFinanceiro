import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import Dashboard from './Dashboard';
import { renderWithProviders } from '@/test/test-utils';

vi.mock('@/services/api', () => ({
  summaryApi: {
    getMonthly: vi.fn().mockResolvedValue({
      totalIncomeCents: 0,
      totalExpensesCents: 0,
      invoiceExpensesCents: 0,
      thirdPartyExpensesCents: 0,
      receivableAmountCents: 0,
      balanceCents: 0,
      month: 1,
      year: 2024,
    }),
    getCategories: vi.fn().mockResolvedValue([]),
    getEvolution: vi.fn().mockResolvedValue([]),
    getAccounts: vi.fn().mockResolvedValue([]),
  },
  transactionsApi: {
    getPage: vi.fn().mockResolvedValue({
      items: [],
      nextCursor: null,
      totalCount: 0,
      totals: { incomeCents: 0, expenseCents: 0 },
    }),
  },
  installmentsApi: {
    getPage: vi.fn().mockResolvedValue({
      items: [],
      pagination: { page: 1, pageSize: 25, total: 0, totalPages: 0 },
    }),
  },
  alertsApi: { check: vi.fn().mockResolvedValue([]) },
}));

vi.mock('recharts', () => {
  const Stub = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    ResponsiveContainer: Stub,
    ComposedChart: Stub,
    Bar: () => null,
    Line: () => null,
    Area: () => null,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
    Legend: () => null,
  };
});

describe('Dashboard', () => {
  it('renders greeting and widgets', async () => {
    renderWithProviders(<Dashboard />);
    expect(screen.getByText(/Olá!/)).toBeInTheDocument();
    expect(screen.getByText(/Aqui está o resumo de/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Saldo do mês')).toBeInTheDocument());
    expect(screen.getByText('Fluxo & saldo acumulado')).toBeInTheDocument();
    expect(screen.getByText('Onde você gastou')).toBeInTheDocument();
    expect(screen.getByText('Suas contas')).toBeInTheDocument();
    expect(screen.getByText('Comprometido este mês')).toBeInTheDocument();
    expect(screen.getByText('Alertas de gastos')).toBeInTheDocument();
  });
});
