import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import Sidebar from './Sidebar';
import { renderWithProviders } from '@/test/test-utils';
import { mockAlertStatus } from '@/test/fixtures';

const check = vi.fn();

vi.mock('@/services/api', () => ({
  alertsApi: {
    check: () => check(),
  },
}));

describe('Sidebar', () => {
  beforeEach(() => {
    check.mockReset();
  });

  it('renders nav links', async () => {
    check.mockResolvedValue([]);
    renderWithProviders(<Sidebar />, { routerProps: { initialEntries: ['/'] } });

    expect(screen.getAllByText('Saldo Claro').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Visão geral').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Transações').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Alertas').length).toBeGreaterThan(0);
  });

  it('shows attention badge on alerts when triggered/warning', async () => {
    check.mockResolvedValue([
      mockAlertStatus,
      { ...mockAlertStatus, id: 'a2', isTriggered: true, isWarning: false },
      { ...mockAlertStatus, id: 'a3', isTriggered: false, isWarning: false },
    ]);
    renderWithProviders(<Sidebar />, { routerProps: { initialEntries: ['/alerts'] } });

    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  it('hides badge when no attention alerts', async () => {
    check.mockResolvedValue([{ ...mockAlertStatus, isTriggered: false, isWarning: false }]);
    renderWithProviders(<Sidebar />);
    await waitFor(() => expect(check).toHaveBeenCalled());
    expect(screen.queryByText('1')).not.toBeInTheDocument();
  });
});
