import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import SummaryCards from './SummaryCards';
import { renderWithProviders } from '@/test/test-utils';
import { mockEvolution, mockMonthlySummary } from '@/test/fixtures';

const getMonthly = vi.fn();
const getEvolution = vi.fn();
const getPage = vi.fn();

vi.mock('@/services/api', () => ({
  summaryApi: {
    getMonthly: (...a: unknown[]) => getMonthly(...a),
    getEvolution: (...a: unknown[]) => getEvolution(...a),
  },
  transactionsApi: {
    getPage: (...a: unknown[]) => getPage(...a),
  },
}));

describe('SummaryCards', () => {
  beforeEach(() => {
    getMonthly.mockReset();
    getEvolution.mockReset();
    getPage.mockReset();
  });

  it('shows loading placeholders then values with positive pct', async () => {
    getMonthly.mockResolvedValue(mockMonthlySummary);
    getEvolution.mockResolvedValue(mockEvolution);
    getPage.mockResolvedValue({ items: [], nextCursor: null, totalCount: 1, totals: { incomeCents: 0, expenseCents: 0 } });

    renderWithProviders(<SummaryCards />, { initialMonth: 6, initialYear: 2024 });

    expect(screen.getByText('Saldo do mês')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('1 entrada no mês')).toBeInTheDocument());
    expect(screen.getByText('Receitas')).toBeInTheDocument();
    expect(screen.getByText('Despesas pessoais')).toBeInTheDocument();
  });

  it('handles empty evolution and plural entradas', async () => {
    getMonthly.mockResolvedValue({ ...mockMonthlySummary, balanceCents: -100 });
    getEvolution.mockResolvedValue([]);
    getPage.mockResolvedValue({ items: [], nextCursor: null, totalCount: 3, totals: { incomeCents: 0, expenseCents: 0 } });

    renderWithProviders(<SummaryCards />, { initialMonth: 6, initialYear: 2024 });

    await waitFor(() => expect(screen.getByText('3 entradas no mês')).toBeInTheDocument());
  });

  it('shows negative pct change branch', async () => {
    getMonthly.mockResolvedValue({ ...mockMonthlySummary, balanceCents: 10000 });
    getEvolution.mockResolvedValue([
      { month: 5, year: 2024, label: 'Mai', incomeCents: 500000, expensesCents: 100000 },
      { month: 6, year: 2024, label: 'Jun', incomeCents: 10000, expensesCents: 50000 },
    ]);
    getPage.mockResolvedValue({ items: [], nextCursor: null, totalCount: 0, totals: { incomeCents: 0, expenseCents: 0 } });

    renderWithProviders(<SummaryCards />, { initialMonth: 6, initialYear: 2024 });

    await waitFor(() => expect(screen.getByText(/em relação a/i)).toBeInTheDocument());
  });

  it('handles previous balance zero (no pct)', async () => {
    getMonthly.mockResolvedValue({ ...mockMonthlySummary, balanceCents: 100 });
    getEvolution.mockResolvedValue([
      { month: 5, year: 2024, label: 'Mai', incomeCents: 100, expensesCents: 100 },
      { month: 6, year: 2024, label: 'Jun', incomeCents: 200, expensesCents: 100 },
    ]);
    getPage.mockResolvedValue({ items: [], nextCursor: null, totalCount: 0, totals: { incomeCents: 0, expenseCents: 0 } });

    renderWithProviders(<SummaryCards />, { initialMonth: 6, initialYear: 2024 });

    await waitFor(() => expect(screen.getByText('Saldo do mês')).toBeInTheDocument());
    await waitFor(() => expect(screen.queryByText('—')).not.toBeInTheDocument());
  });

  it('covers single spark point and missing income/expense totals', async () => {
    getMonthly.mockResolvedValue({
      balanceCents: 10,
      invoiceExpensesCents: 0,
      thirdPartyExpensesCents: 0,
      receivableAmountCents: 0,
      month: 6,
      year: 2024,
    });
    getEvolution.mockResolvedValue([
      { month: 6, year: 2024, label: 'Jun', incomeCents: 0, expensesCents: 0 },
    ]);
    getPage.mockResolvedValue({ items: [], nextCursor: null, totalCount: 0, totals: { incomeCents: 0, expenseCents: 0 } });

    renderWithProviders(<SummaryCards />, { initialMonth: 6, initialYear: 2024 });
    await waitFor(() => expect(screen.getByText('0 entradas no mês')).toBeInTheDocument());
  });

  it('shows loading dashes while monthly summary pending', async () => {
    let resolveMonthly!: (v: unknown) => void;
    getMonthly.mockReturnValue(new Promise((r) => { resolveMonthly = r; }));
    getEvolution.mockResolvedValue([]);
    getPage.mockResolvedValue({ items: [], nextCursor: null, totalCount: 0, totals: { incomeCents: 0, expenseCents: 0 } });

    renderWithProviders(<SummaryCards />, { initialMonth: 6, initialYear: 2024 });
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(3);
    resolveMonthly(mockMonthlySummary);
    await waitFor(() => expect(screen.queryByText('—')).not.toBeInTheDocument());
  });

  it('covers flat spark range and query error fallbacks', async () => {
    getMonthly.mockRejectedValue(new Error('boom'));
    getEvolution.mockResolvedValue([
      { month: 5, year: 2024, label: 'Mai', incomeCents: 100, expensesCents: 100 },
      { month: 6, year: 2024, label: 'Jun', incomeCents: 50, expensesCents: 50 },
    ]);
    getPage.mockRejectedValue(new Error('income count failed'));

    renderWithProviders(<SummaryCards />, { initialMonth: 6, initialYear: 2024 });
    await waitFor(() => expect(screen.getByText('0 entradas no mês')).toBeInTheDocument());
    // balance/income/expense fall back to 0 when monthly query failed
    expect(screen.getAllByText(/R\$/).length).toBeGreaterThan(0);
  });
});
