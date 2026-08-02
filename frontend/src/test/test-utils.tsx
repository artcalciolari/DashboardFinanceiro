import { ReactElement, ReactNode } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, MemoryRouterProps } from 'react-router-dom';
import { DateProvider } from '@/context/DateContext';
import { SearchProvider } from '@/context/SearchContext';
import { TransactionModalProvider } from '@/context/TransactionModalContext';
import { vi } from 'vitest';

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
}

interface ProvidersProps {
  children: ReactNode;
  queryClient?: QueryClient;
  routerProps?: MemoryRouterProps;
  withDate?: boolean;
  withSearch?: boolean;
  withTransactionModal?: boolean;
  initialMonth?: number;
  initialYear?: number;
}

export function AllProviders({
  children,
  queryClient = createTestQueryClient(),
  routerProps,
  withDate = true,
  withSearch = true,
  withTransactionModal = true,
  initialMonth,
  initialYear,
}: ProvidersProps) {
  let tree: ReactNode = children;

  if (withTransactionModal) {
    tree = <TransactionModalProvider>{tree}</TransactionModalProvider>;
  }
  if (withSearch) {
    tree = <SearchProvider>{tree}</SearchProvider>;
  }
  if (withDate) {
    tree = (
      <DateProvider initialMonth={initialMonth} initialYear={initialYear}>
        {tree}
      </DateProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter {...routerProps}>{tree}</MemoryRouter>
    </QueryClientProvider>
  );
}

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  queryClient?: QueryClient;
  routerProps?: MemoryRouterProps;
  withDate?: boolean;
  withSearch?: boolean;
  withTransactionModal?: boolean;
  initialMonth?: number;
  initialYear?: number;
}

export function renderWithProviders(ui: ReactElement, options: CustomRenderOptions = {}) {
  const {
    queryClient = createTestQueryClient(),
    routerProps,
    withDate = true,
    withSearch = true,
    withTransactionModal = true,
    initialMonth,
    initialYear,
    ...renderOptions
  } = options;

  return {
    queryClient,
    ...render(ui, {
      wrapper: ({ children }) => (
        <AllProviders
          queryClient={queryClient}
          routerProps={routerProps}
          withDate={withDate}
          withSearch={withSearch}
          withTransactionModal={withTransactionModal}
          initialMonth={initialMonth}
          initialYear={initialYear}
        >
          {children}
        </AllProviders>
      ),
      ...renderOptions,
    }),
  };
}

export function mockApiDefaults() {
  return {
    accountsApi: {
      getAll: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    categoriesApi: {
      getAll: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
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
      delete: vi.fn(),
    },
    installmentsApi: {
      getPage: vi.fn().mockResolvedValue({
        items: [],
        pagination: { page: 1, pageSize: 25, total: 0, totalPages: 0 },
      }),
      create: vi.fn(),
      delete: vi.fn(),
      updatePaymentDate: vi.fn(),
    },
    subscriptionsApi: {
      getPage: vi.fn().mockResolvedValue({
        items: [],
        summary: { activeCount: 0, monthlyTotalCents: 0, thirdPartyTotalCents: 0 },
        pagination: { page: 1, pageSize: 25, total: 0, totalPages: 0 },
      }),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
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
    alertsApi: {
      getAll: vi.fn().mockResolvedValue([]),
      check: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    exportApi: {
      getCSVUrl: vi.fn((month?: number, year?: number) =>
        month && year ? `/api/export/csv?month=${month}&year=${year}` : '/api/export/csv'
      ),
    },
    getApiErrorMessage: vi.fn((error: unknown) => {
      if (error && typeof error === 'object' && 'message' in error) {
        return String((error as { message: unknown }).message);
      }
      return 'Não foi possível concluir a operação. Tente novamente.';
    }),
  };
}
