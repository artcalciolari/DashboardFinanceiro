import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import AlertsWidget from './AlertsWidget';
import { renderWithProviders } from '@/test/test-utils';
import { mockAlertStatus } from '@/test/fixtures';

const check = vi.fn();

vi.mock('@/services/api', () => ({
  getApiErrorMessage: () => 'offline',
  alertsApi: {
    check: () => check(),
  },
}));

describe('AlertsWidget', () => {
  beforeEach(() => check.mockReset());

  it('shows warning and triggered alerts', async () => {
    check.mockResolvedValue([
      mockAlertStatus,
      { ...mockAlertStatus, id: 't', name: 'Estourado', isTriggered: true, isWarning: false, percentage: 120 },
    ]);
    renderWithProviders(<AlertsWidget />);
    expect(screen.getByText('Alertas de gastos')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Limite alimentação')).toBeInTheDocument());
    expect(screen.getByText('Estourado')).toBeInTheDocument();
  });

  it('empty configured', async () => {
    check.mockResolvedValue([]);
    renderWithProviders(<AlertsWidget />);
    await waitFor(() => expect(screen.getByText('Nenhum alerta configurado')).toBeInTheDocument());
  });

  it('none near limit', async () => {
    check.mockResolvedValue([{ ...mockAlertStatus, isTriggered: false, isWarning: false }]);
    renderWithProviders(<AlertsWidget />);
    await waitFor(() => expect(screen.getByText('Nenhum alerta próximo do limite')).toBeInTheDocument());
  });

  it('retries after a query error', async () => {
    check.mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce([mockAlertStatus]);
    renderWithProviders(<AlertsWidget />);
    await waitFor(() => expect(screen.getByText('Não foi possível carregar os alertas')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    await waitFor(() => expect(screen.getByText('Limite alimentação')).toBeInTheDocument());
  });

  it('warns when cached alerts cannot refresh', async () => {
    check.mockResolvedValueOnce([mockAlertStatus]).mockRejectedValueOnce(new Error('down'));
    const { queryClient } = renderWithProviders(<AlertsWidget />);
    await waitFor(() => expect(screen.getByText('Limite alimentação')).toBeInTheDocument());
    await queryClient.invalidateQueries({ queryKey: ['alerts', 'check'] });
    await waitFor(() => expect(screen.getByText(/Exibindo dados salvos/)).toBeInTheDocument());
  });

});
