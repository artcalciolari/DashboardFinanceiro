import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Header from './Header';
import { renderWithProviders } from '@/test/test-utils';
import { useDate } from '@/context/DateContext';
import { useEffect } from 'react';

const getCSVUrl = vi.fn((month?: number, year?: number) =>
  month && year ? `/api/export/csv?month=${month}&year=${year}` : '/api/export/csv'
);

vi.mock('@/services/api', () => ({
  exportApi: { getCSVUrl: (...args: unknown[]) => getCSVUrl(...(args as [number?, number?])) },
  alertsApi: { check: vi.fn().mockResolvedValue([]) },
  accountsApi: { getAll: vi.fn().mockResolvedValue([]) },
  categoriesApi: { getAll: vi.fn().mockResolvedValue([]) },
  transactionsApi: {
    getPage: vi.fn().mockResolvedValue({ items: [], nextCursor: null, totalCount: 0, totals: { incomeCents: 0, expenseCents: 0 } }),
    create: vi.fn(),
    update: vi.fn(),
  },
}));

function SeedDate({ month, year }: { month: number; year: number }) {
  const { setMonth, setYear } = useDate();
  useEffect(() => {
    setMonth(month);
    setYear(year);
  }, [month, year, setMonth, setYear]);
  return null;
}

describe('Header', () => {
  beforeEach(() => {
    getCSVUrl.mockClear();
    vi.stubGlobal('open', vi.fn());
  });

  it('navigates months including year boundaries and Hoje', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <>
        <SeedDate month={1} year={2024} />
        <Header />
      </>,
      { routerProps: { initialEntries: ['/'] } }
    );

    await waitFor(() => expect(screen.getByLabelText('Mês anterior')).toBeInTheDocument());

    await user.click(screen.getByLabelText('Mês anterior'));
    // Jan -> Dec previous year
    expect(screen.getByText(/Dezembro 2023/i)).toBeInTheDocument();

    await user.click(screen.getByLabelText('Próximo mês'));
    expect(screen.getByText(/Janeiro 2024/i)).toBeInTheDocument();

    // mid-year prev hits setMonth(month - 1)
    await user.click(screen.getByLabelText('Próximo mês'));
    expect(screen.getByText(/Fevereiro 2024/i)).toBeInTheDocument();
    await user.click(screen.getByLabelText('Mês anterior'));
    expect(screen.getByText(/Janeiro 2024/i)).toBeInTheDocument();

    // go to December then next -> Jan next year
    for (let i = 0; i < 11; i++) {
      await user.click(screen.getByLabelText('Próximo mês'));
    }
    expect(screen.getByText(/Dezembro 2024/i)).toBeInTheDocument();
    await user.click(screen.getByLabelText('Próximo mês'));
    expect(screen.getByText(/Janeiro 2025/i)).toBeInTheDocument();

    const hoje = screen.queryByRole('button', { name: 'Hoje' });
    if (hoje) {
      await user.click(hoje);
      const now = new Date();
      // formatMonthYear will show current month
      expect(screen.getByText(new RegExp(String(now.getFullYear())))).toBeInTheDocument();
    }
  });

  it('shows search on transactions and exports CSV', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Header />, { routerProps: { initialEntries: ['/transactions'] } });

    const search = screen.getByLabelText('Buscar transações');
    await user.type(search, 'mercado');
    expect(search).toHaveValue('mercado');

    await user.click(screen.getByRole('button', { name: /Exportar/i }));
    expect(window.open).toHaveBeenCalled();
    expect(getCSVUrl).toHaveBeenCalled();
  });

  it('focuses search with Ctrl+K or Cmd+K, ignores other keys', () => {
    renderWithProviders(<Header />, { routerProps: { initialEntries: ['/transactions'] } });
    const search = screen.getByLabelText('Buscar transações');

    fireEvent.keyDown(window, { key: 'k' });
    expect(search).not.toHaveFocus();

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(search).toHaveFocus();
    search.blur();

    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    expect(search).toHaveFocus();
  });

  it('hides period/search/export on accounts page', () => {
    renderWithProviders(<Header />, { routerProps: { initialEntries: ['/accounts'] } });
    expect(screen.queryByLabelText('Mês anterior')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Buscar transações')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Exportar/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Nova transação/i })).toBeInTheDocument();
  });

  it('prevMonth when not January', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Header />, {
      routerProps: { initialEntries: ['/'] },
      initialMonth: 3,
      initialYear: 2024,
    });
    await waitFor(() => expect(screen.getByText(/Março 2024/i)).toBeInTheDocument());
    await user.click(screen.getByLabelText('Mês anterior'));
    expect(screen.getByText(/Fevereiro 2024/i)).toBeInTheDocument();
  });
});
