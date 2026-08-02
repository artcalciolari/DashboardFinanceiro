import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    // App wraps BrowserRouter; replace with passthrough so the outer MemoryRouter owns history.
    BrowserRouter: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

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
    create: vi.fn(),
    update: vi.fn(),
  },
  accountsApi: { getAll: vi.fn().mockResolvedValue([]) },
  categoriesApi: { getAll: vi.fn().mockResolvedValue([]) },
  installmentsApi: {
    getPage: vi.fn().mockResolvedValue({
      items: [],
      pagination: { page: 1, pageSize: 25, total: 0, totalPages: 0 },
    }),
  },
  subscriptionsApi: {
    getPage: vi.fn().mockResolvedValue({
      items: [],
      summary: { activeCount: 0, monthlyTotalCents: 0, thirdPartyTotalCents: 0 },
      pagination: { page: 1, pageSize: 25, total: 0, totalPages: 0 },
    }),
  },
  alertsApi: {
    getAll: vi.fn().mockResolvedValue([]),
    check: vi.fn().mockResolvedValue([]),
  },
  exportApi: { getCSVUrl: vi.fn(() => '/api/export/csv') },
}));

vi.mock('recharts', () => {
  const PassThrough = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
  return {
    ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    ComposedChart: PassThrough,
    Bar: () => null,
    Line: () => null,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
    Legend: () => null,
  };
});

import App from './App';

function renderApp(path = '/') {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dashboard with suspense fallback then content', async () => {
    renderApp('/');
    await waitFor(
      () => expect(screen.getByText(/Aqui está o resumo de/i)).toBeInTheDocument(),
      { timeout: 10000 }
    );
  });

  it('redirects unknown routes to dashboard', async () => {
    renderApp('/rota-inexistente');
    await waitFor(
      () => expect(screen.getByText(/Aqui está o resumo de/i)).toBeInTheDocument(),
      { timeout: 10000 }
    );
  });

  it('navigates between routes via sidebar', async () => {
    const user = userEvent.setup();
    renderApp('/');
    await waitFor(
      () => expect(screen.getByText(/Aqui está o resumo de/i)).toBeInTheDocument(),
      { timeout: 10000 }
    );

    await user.click(screen.getAllByText('Contas & cartões')[0]);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Contas & cartões' })).toBeInTheDocument());

    await user.click(screen.getAllByText('Categorias')[0]);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Categorias' })).toBeInTheDocument());

    await user.click(screen.getAllByText('Parcelamentos')[0]);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Parcelamentos' })).toBeInTheDocument());

    await user.click(screen.getAllByText('Assinaturas')[0]);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Assinaturas' })).toBeInTheDocument());

    await user.click(screen.getAllByText('Alertas')[0]);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Alertas' })).toBeInTheDocument());

    await user.click(screen.getAllByText('Transações')[0]);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Transações' })).toBeInTheDocument());

    await user.click(screen.getAllByText('Visão geral')[0]);
    await waitFor(() => expect(screen.getByText(/Aqui está o resumo de/i)).toBeInTheDocument());
  });
});
