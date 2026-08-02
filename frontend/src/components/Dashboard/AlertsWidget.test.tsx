import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import AlertsWidget from './AlertsWidget';
import { renderWithProviders } from '@/test/test-utils';
import { mockAlertStatus } from '@/test/fixtures';

const check = vi.fn();

vi.mock('@/services/api', () => ({
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
});
