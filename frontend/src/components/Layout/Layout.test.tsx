import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import Layout from './Layout';
import { renderWithProviders } from '@/test/test-utils';

vi.mock('@/services/api', () => ({
  alertsApi: { check: vi.fn().mockResolvedValue([]) },
  accountsApi: { getAll: vi.fn().mockResolvedValue([]) },
  categoriesApi: { getAll: vi.fn().mockResolvedValue([]) },
  transactionsApi: {
    getPage: vi.fn().mockResolvedValue({ items: [], nextCursor: null, totalCount: 0, totals: { incomeCents: 0, expenseCents: 0 } }),
    create: vi.fn(),
    update: vi.fn(),
  },
  exportApi: { getCSVUrl: vi.fn(() => '/api/export/csv') },
}));

describe('Layout', () => {
  it('renders sidebar, header and children', () => {
    renderWithProviders(
      <Layout>
        <div>Conteúdo da página</div>
      </Layout>
    );
    expect(screen.getByText('Conteúdo da página')).toBeInTheDocument();
    expect(screen.getAllByText('Saldo Claro').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /Nova transação/i })).toBeInTheDocument();
  });
});
