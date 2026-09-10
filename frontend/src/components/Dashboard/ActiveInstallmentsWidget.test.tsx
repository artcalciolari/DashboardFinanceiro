import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import ActiveInstallmentsWidget from './ActiveInstallmentsWidget';
import { renderWithProviders } from '@/test/test-utils';
import { makeInstallmentsPage, mockInstallmentGroup } from '@/test/fixtures';

const getPage = vi.fn();

vi.mock('@/services/api', () => ({
  getApiErrorMessage: () => 'offline',
  installmentsApi: {
    getPage: (...a: unknown[]) => getPage(...a),
  },
}));

describe('ActiveInstallmentsWidget', () => {
  beforeEach(() => getPage.mockReset());

  it('renders active installments', async () => {
    getPage.mockResolvedValue(makeInstallmentsPage([mockInstallmentGroup]));
    renderWithProviders(<ActiveInstallmentsWidget />);
    expect(screen.getByText('Comprometido este mês')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Notebook')).toBeInTheDocument());
    expect(screen.getByText('Ver todos')).toBeInTheDocument();
  });

  it('shows empty state', async () => {
    getPage.mockResolvedValue(makeInstallmentsPage([]));
    renderWithProviders(<ActiveInstallmentsWidget />);
    await waitFor(() => expect(screen.getByText('Nenhum parcelamento ativo')).toBeInTheDocument());
  });

  it('shows ver mais when more than 5 and handles finished/no next', async () => {
    const many = Array.from({ length: 7 }, (_, i) => ({
      ...mockInstallmentGroup,
      id: `inst-${i}`,
      description: `Grupo ${i}`,
      paidCount: i === 6 ? 10 : i === 5 ? 8 : 2,
      installmentCount: 10,
      nextTransaction: i % 2 === 0 ? mockInstallmentGroup.nextTransaction : null,
      remainingAmountCents: 1000,
    }));
    getPage.mockResolvedValue(makeInstallmentsPage(many));
    renderWithProviders(<ActiveInstallmentsWidget />);
    await waitFor(() => expect(screen.getByText(/Ver mais/)).toBeInTheDocument());
  });

  it('handles zero installmentCount and missing paidCount', async () => {
    getPage.mockResolvedValue(
      makeInstallmentsPage([
        {
          ...mockInstallmentGroup,
          id: 'z',
          installmentCount: 0,
          paidCount: undefined,
          remainingAmountCents: undefined,
          nextTransaction: null,
        },
      ])
    );
    renderWithProviders(<ActiveInstallmentsWidget />);
    await waitFor(() => expect(screen.getByText('Nenhum parcelamento ativo')).toBeInTheDocument());
  });

  it('shows high progress bar style when pct >= 75', async () => {
    getPage.mockResolvedValue(
      makeInstallmentsPage([
        {
          ...mockInstallmentGroup,
          id: 'almost',
          description: 'Quase lá',
          paidCount: 8,
          installmentCount: 10,
          remainingAmountCents: 60000,
        },
      ])
    );
    renderWithProviders(<ActiveInstallmentsWidget />);
    await waitFor(() => expect(screen.getByText('Quase lá')).toBeInTheDocument());
    const bar = document.querySelector('.bg-income');
    expect(bar).toBeTruthy();
  });

  it('falls back to item totals when aggregate totals are absent', async () => {
    const page = makeInstallmentsPage([mockInstallmentGroup]);
    getPage.mockResolvedValue({ ...page, aggregates: {} });
    renderWithProviders(<ActiveInstallmentsWidget />);
    await waitFor(() => expect(screen.getByText(/restam/)).toHaveTextContent('R$ 2.100,00'));
    expect(screen.getByText(/1 parcelamento/)).toBeInTheDocument();
  });

  it('retries after a query error', async () => {
    getPage.mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce(makeInstallmentsPage([mockInstallmentGroup]));
    renderWithProviders(<ActiveInstallmentsWidget />);
    await waitFor(() => expect(screen.getByText('Não foi possível carregar os parcelamentos')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    await waitFor(() => expect(screen.getByText('Notebook')).toBeInTheDocument());
  });

  it('warns when cached installments cannot refresh', async () => {
    getPage.mockResolvedValueOnce(makeInstallmentsPage([mockInstallmentGroup])).mockRejectedValueOnce(new Error('down'));
    const { queryClient } = renderWithProviders(<ActiveInstallmentsWidget />, { initialMonth: 1, initialYear: 2024 });
    await waitFor(() => expect(screen.getByText('Notebook')).toBeInTheDocument());
    await queryClient.invalidateQueries({ queryKey: ['installments', 'dashboard', 1, 2024] });
    await waitFor(() => expect(screen.getByText(/Exibindo dados salvos/)).toBeInTheDocument());
  });

});
