import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import CategoryChart from './CategoryChart';
import { renderWithProviders } from '@/test/test-utils';
import { mockCategorySummaries } from '@/test/fixtures';

const getCategories = vi.fn();

vi.mock('@/services/api', () => ({
  getApiErrorMessage: () => 'offline',
  summaryApi: {
    getCategories: (...a: unknown[]) => getCategories(...a),
  },
}));

describe('CategoryChart', () => {
  beforeEach(() => getCategories.mockReset());

  it('shows loading then expense bars', async () => {
    getCategories.mockResolvedValue(mockCategorySummaries);
    renderWithProviders(<CategoryChart />);
    expect(screen.getByText('Onde você gastou')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Alimentação')).toBeInTheDocument());
    expect(screen.getByText('Transporte')).toBeInTheDocument();
  });

  it('shows empty state', async () => {
    getCategories.mockResolvedValue([]);
    renderWithProviders(<CategoryChart />);
    await waitFor(() => expect(screen.getByText('Nenhuma despesa neste mês')).toBeInTheDocument());
  });

  it('filters zero expense totals', async () => {
    getCategories.mockResolvedValue([
      { category: { id: 'c', name: 'X', type: 'EXPENSE', color: '#000', createdAt: '', updatedAt: '' }, type: 'EXPENSE', totalCents: 0 },
    ]);
    renderWithProviders(<CategoryChart />);
    await waitFor(() => expect(screen.getByText('Nenhuma despesa neste mês')).toBeInTheDocument());
  });

  it('retries after a query error', async () => {
    getCategories.mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce(mockCategorySummaries);
    renderWithProviders(<CategoryChart />);
    await waitFor(() => expect(screen.getByText('Não foi possível carregar as categorias')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    await waitFor(() => expect(screen.getByText('Alimentação')).toBeInTheDocument());
  });

  it('warns when cached categories cannot refresh', async () => {
    getCategories.mockResolvedValueOnce(mockCategorySummaries).mockRejectedValueOnce(new Error('down'));
    const { queryClient } = renderWithProviders(<CategoryChart />, { initialMonth: 1, initialYear: 2024 });
    await waitFor(() => expect(screen.getByText('Alimentação')).toBeInTheDocument());
    await queryClient.invalidateQueries({ queryKey: ['summary', 'categories', 1, 2024] });
    await waitFor(() => expect(screen.getByText(/Exibindo dados salvos/)).toBeInTheDocument());
  });

});
