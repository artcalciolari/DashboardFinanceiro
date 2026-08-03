import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Search } from 'lucide-react';
import EmptyState from './EmptyState';

describe('EmptyState', () => {
  it('renders title without description or action', () => {
    render(<EmptyState icon={Search} title="Vazio" />);
    expect(screen.getByText('Vazio')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders description when provided', () => {
    render(<EmptyState icon={Search} title="Vazio" description="Nada aqui" />);
    expect(screen.getByText('Nada aqui')).toBeInTheDocument();
  });

  it('renders action and calls onAction', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(
      <EmptyState
        icon={Search}
        title="Vazio"
        actionLabel="Limpar filtros"
        onAction={onAction}
      />
    );
    await user.click(screen.getByRole('button', { name: 'Limpar filtros' }));
    expect(onAction).toHaveBeenCalled();
  });

  it('omits action when only actionLabel is set', () => {
    render(<EmptyState icon={Search} title="Vazio" actionLabel="Limpar filtros" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('omits action when only onAction is set', () => {
    render(<EmptyState icon={Search} title="Vazio" onAction={() => undefined} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
