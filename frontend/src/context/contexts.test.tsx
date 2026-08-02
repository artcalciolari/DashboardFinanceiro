import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DateProvider, useDate } from './DateContext';
import { SearchProvider, useSearch } from './SearchContext';
import { TransactionModalProvider, useTransactionModal } from './TransactionModalContext';
import { mockTransaction } from '@/test/fixtures';

function DateProbe() {
  const { month, year, setMonth, setYear } = useDate();
  return (
    <div>
      <span data-testid="month">{month}</span>
      <span data-testid="year">{year}</span>
      <button type="button" onClick={() => setMonth(3)}>setMonth</button>
      <button type="button" onClick={() => setYear(2020)}>setYear</button>
    </div>
  );
}

function SearchProbe() {
  const { search, setSearch } = useSearch();
  return (
    <div>
      <span data-testid="search">{search}</span>
      <button type="button" onClick={() => setSearch('abc')}>set</button>
    </div>
  );
}

function ModalProbe() {
  const { isOpen, editing, openCreate, openEdit, close } = useTransactionModal();
  return (
    <div>
      <span data-testid="open">{String(isOpen)}</span>
      <span data-testid="editing">{editing?.id ?? 'none'}</span>
      <button type="button" onClick={openCreate}>create</button>
      <button type="button" onClick={() => openEdit(mockTransaction)}>edit</button>
      <button type="button" onClick={close}>close</button>
    </div>
  );
}

describe('DateContext', () => {
  it('provides current month/year and setters', async () => {
    const user = userEvent.setup();
    const now = new Date();
    render(
      <DateProvider>
        <DateProbe />
      </DateProvider>
    );
    expect(screen.getByTestId('month')).toHaveTextContent(String(now.getMonth() + 1));
    expect(screen.getByTestId('year')).toHaveTextContent(String(now.getFullYear()));
    await user.click(screen.getByText('setMonth'));
    expect(screen.getByTestId('month')).toHaveTextContent('3');
    await user.click(screen.getByText('setYear'));
    expect(screen.getByTestId('year')).toHaveTextContent('2020');
  });

  it('default context noop setters are callable', async () => {
    const user = userEvent.setup();
    render(<DateProbe />);
    await user.click(screen.getByText('setMonth'));
    await user.click(screen.getByText('setYear'));
    expect(screen.getByTestId('month')).toBeInTheDocument();
  });
});

describe('SearchContext', () => {
  it('stores search string', async () => {
    const user = userEvent.setup();
    render(
      <SearchProvider>
        <SearchProbe />
      </SearchProvider>
    );
    expect(screen.getByTestId('search')).toHaveTextContent('');
    await user.click(screen.getByText('set'));
    expect(screen.getByTestId('search')).toHaveTextContent('abc');
  });

  it('default context works', async () => {
    const user = userEvent.setup();
    render(<SearchProbe />);
    await user.click(screen.getByText('set'));
    expect(screen.getByTestId('search')).toHaveTextContent('');
  });
});

describe('TransactionModalContext', () => {
  it('opens create/edit and closes', async () => {
    const user = userEvent.setup();
    render(
      <TransactionModalProvider>
        <ModalProbe />
      </TransactionModalProvider>
    );

    expect(screen.getByTestId('open')).toHaveTextContent('false');
    await user.click(screen.getByText('create'));
    expect(screen.getByTestId('open')).toHaveTextContent('true');
    expect(screen.getByTestId('editing')).toHaveTextContent('none');

    await user.click(screen.getByText('edit'));
    expect(screen.getByTestId('editing')).toHaveTextContent(mockTransaction.id);

    await user.click(screen.getByText('close'));
    expect(screen.getByTestId('open')).toHaveTextContent('false');
    expect(screen.getByTestId('editing')).toHaveTextContent('none');
  });

  it('default context works', async () => {
    const user = userEvent.setup();
    render(<ModalProbe />);
    await user.click(screen.getByText('create'));
    await user.click(screen.getByText('edit'));
    await user.click(screen.getByText('close'));
    expect(screen.getByTestId('open')).toHaveTextContent('false');
  });
});
