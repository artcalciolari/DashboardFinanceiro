import { ChevronLeft, ChevronRight, Download, Search, Plus } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useDate } from '../../context/DateContext';
import { useSearch } from '../../context/SearchContext';
import { useTransactionModal } from '../../context/TransactionModalContext';
import { formatMonthYear } from '../../utils/formatters';
import { exportApi } from '../../services/api';

export default function Header() {
  const { pathname } = useLocation();
  const { month, year, setMonth, setYear } = useDate();
  const { search, setSearch } = useSearch();
  const { openCreate } = useTransactionModal();
  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentYear = today.getFullYear();
  const isCurrentMonth = month === currentMonth && year === currentYear;
  const showsPeriod = ['/', '/transactions', '/installments', '/subscriptions'].includes(pathname);
  const showsSearch = pathname === '/transactions';
  const showsExport = pathname === '/' || pathname === '/transactions';

  function prevMonth() {
    if (month === 1) {
      setMonth(12);
      setYear(year - 1);
    } else {
      setMonth(month - 1);
    }
  }

  function nextMonth() {
    if (month === 12) {
      setMonth(1);
      setYear(year + 1);
    } else {
      setMonth(month + 1);
    }
  }

  function handleExportCSV() {
    window.open(exportApi.getCSVUrl(month, year), '_blank');
  }

  function goToCurrentMonth() {
    setMonth(currentMonth);
    setYear(currentYear);
  }

  return (
    <header className="sticky top-0 z-30 flex flex-wrap items-center gap-2 border-b border-border bg-[rgba(244,242,236,0.85)] px-4 py-3 backdrop-blur-md sm:gap-3 md:flex-nowrap md:px-8 md:py-3.5">
      {showsPeriod && <div className="flex items-center gap-1.5 rounded-control border border-border bg-white p-1">
        <button
          type="button"
          onClick={prevMonth}
          className="flex h-[30px] w-[30px] items-center justify-center rounded-lg text-muted transition-colors hover:bg-chip"
          aria-label="Mês anterior"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="min-w-[132px] text-center text-[13.5px] font-semibold capitalize text-ink">
          {formatMonthYear(month, year)}
        </span>
        <button
          type="button"
          onClick={nextMonth}
          className="flex h-[30px] w-[30px] items-center justify-center rounded-lg text-muted transition-colors hover:bg-chip"
          aria-label="Próximo mês"
        >
          <ChevronRight size={16} />
        </button>
      </div>}

      {showsPeriod && !isCurrentMonth && (
        <button
          type="button"
          onClick={goToCurrentMonth}
          className="hidden h-[38px] flex-shrink-0 items-center rounded-control border border-border bg-white px-3.5 text-[13px] font-semibold text-forest transition-colors hover:bg-chip sm:inline-flex"
        >
          Hoje
        </button>
      )}

      <div className="hidden flex-1 md:block" />

      {showsSearch && <div className="relative hidden w-[280px] max-w-[34vw] md:block">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
        <input
          type="text"
          placeholder="Buscar transações…"
          aria-label="Buscar transações"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-10 w-full rounded-control border border-border bg-white pl-9 pr-3 text-[13.5px] text-ink outline-none transition-shadow focus:border-forest focus:shadow-focus-forest"
        />
      </div>}

      <div className="ml-auto flex w-full items-center justify-end gap-2 md:ml-0 md:w-auto">
      {showsExport && <button
        type="button"
        onClick={handleExportCSV}
        className="flex h-10 flex-shrink-0 items-center gap-1.5 rounded-control border border-border bg-white px-3.5 text-[13.5px] font-semibold text-ink transition-colors hover:bg-chip"
      >
        <Download size={16} />
        <span className="hidden sm:inline">Exportar</span>
      </button>}

      <button
        type="button"
        onClick={openCreate}
        className="flex h-10 flex-shrink-0 items-center gap-1.5 rounded-control bg-forest px-4 text-[13.5px] font-semibold text-white transition-colors hover:bg-forest-hover"
      >
        <Plus size={17} />
        <span className="hidden sm:inline">Nova transação</span>
      </button>
      </div>
    </header>
  );
}
