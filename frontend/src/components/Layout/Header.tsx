import { ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { useDate } from '../../context/DateContext';
import { formatMonthYear } from '../../utils/formatters';
import { exportApi } from '../../services/api';
import Button from '../ui/Button';

export default function Header() {
  const { month, year, setMonth, setYear } = useDate();
  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentYear = today.getFullYear();
  const isCurrentMonth = month === currentMonth && year === currentYear;

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
    <header className="bg-white border-b border-gray-100 px-4 md:px-6 py-3 flex items-center justify-between sticky top-0 z-20">
      {/* Month selector */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={prevMonth}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
          aria-label="Mês anterior"
        >
          <ChevronLeft size={18} />
        </button>
        <span className="text-sm font-semibold text-gray-800 min-w-[160px] text-center capitalize">
          {formatMonthYear(month, year)}
        </span>
        <button
          type="button"
          onClick={nextMonth}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
          aria-label="Próximo mês"
        >
          <ChevronRight size={18} />
        </button>
        {!isCurrentMonth && (
          <Button variant="ghost" size="sm" onClick={goToCurrentMonth} className="hidden sm:inline-flex">
            Hoje
          </Button>
        )}
      </div>

      {/* Actions */}
      <Button variant="secondary" size="sm" onClick={handleExportCSV}>
        <Download size={14} />
        <span className="hidden sm:inline">Exportar CSV</span>
      </Button>
    </header>
  );
}
