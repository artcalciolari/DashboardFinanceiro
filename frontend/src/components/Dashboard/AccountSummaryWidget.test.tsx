import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import AccountSummaryWidget from './AccountSummaryWidget';
import { renderWithProviders } from '@/test/test-utils';
import { mockAccountSummaries } from '@/test/fixtures';

const getAccounts = vi.fn();

vi.mock('@/services/api', () => ({
  summaryApi: {
    getAccounts: (...a: unknown[]) => getAccounts(...a),
  },
}));

describe('AccountSummaryWidget', () => {
  beforeEach(() => getAccounts.mockReset());

  it('renders accounts with movement', async () => {
    getAccounts.mockResolvedValue(mockAccountSummaries);
    renderWithProviders(<AccountSummaryWidget />);
    expect(screen.getByText('Suas contas')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Nubank')).toBeInTheDocument());
    expect(screen.getByText('Cartão XP')).toBeInTheDocument();
    expect(screen.getByText(/fatura/)).toBeInTheDocument();
    expect(screen.getByText(/a receber/)).toBeInTheDocument();
  });

  it('shows empty and loading', async () => {
    getAccounts.mockResolvedValue([]);
    renderWithProviders(<AccountSummaryWidget />);
    await waitFor(() =>
      expect(screen.getByText('Nenhuma movimentação por conta neste mês')).toBeInTheDocument()
    );
  });

  it('filters accounts without movement and handles single-word initials', async () => {
    getAccounts.mockResolvedValue([
      {
        account: { id: 'a', name: 'XP', type: 'BANK_ACCOUNT', openingBalanceCents: 0, color: '#000', createdAt: '', updatedAt: '' },
        incomeCents: 0,
        expensesCents: 0,
        invoiceExpensesCents: 0,
        thirdPartyExpensesCents: 0,
        receivableCents: 0,
        netCents: 0,
      },
      {
        account: { id: 'b', name: 'Banco Inter', type: 'BANK_ACCOUNT', openingBalanceCents: 0, color: '#111', createdAt: '', updatedAt: '' },
        incomeCents: 100,
        expensesCents: 0,
        invoiceExpensesCents: 0,
        thirdPartyExpensesCents: 0,
        receivableCents: 0,
        netCents: 100,
      },
    ]);
    renderWithProviders(<AccountSummaryWidget />);
    await waitFor(() => expect(screen.getByText('Banco Inter')).toBeInTheDocument());
    expect(screen.queryByText('XP')).not.toBeInTheDocument();
    expect(screen.getByText('BI')).toBeInTheDocument();
  });
});
