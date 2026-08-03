import SummaryCards from '../components/Dashboard/SummaryCards';
import MonthlyChart from '../components/Dashboard/MonthlyChart';
import CategoryChart from '../components/Dashboard/CategoryChart';
import AlertsWidget from '../components/Dashboard/AlertsWidget';
import AccountSummaryWidget from '../components/Dashboard/AccountSummaryWidget';
import ActiveInstallmentsWidget from '../components/Dashboard/ActiveInstallmentsWidget';
import { useDate } from '../context/DateContext';
import { formatMonthYear } from '../utils/formatters';

export default function Dashboard() {
  const { month, year } = useDate();

  return (
    <div className="space-y-5">
      <div className="mb-6">
        <h1 className="font-display text-display-lg tracking-tight text-ink">Olá! 👋</h1>
        <p className="mt-1 text-[13.5px] text-muted">
          Aqui está o resumo de <span className="capitalize">{formatMonthYear(month, year)}</span>.
        </p>
      </div>

      <SummaryCards />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.55fr_1fr]">
        <MonthlyChart />
        <CategoryChart />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <AccountSummaryWidget />
        <ActiveInstallmentsWidget />
      </div>

      <AlertsWidget />
    </div>
  );
}
