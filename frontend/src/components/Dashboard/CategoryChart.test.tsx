import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import CategoryChart from './CategoryChart';
import { renderWithProviders } from '@/test/test-utils';
import { mockCategorySummaries } from '@/test/fixtures';

const getCategories = vi.fn();

vi.mock('@/services/api', () => ({
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
});
