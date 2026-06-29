import SummaryCards from '../components/Dashboard/SummaryCards';
import MonthlyChart from '../components/Dashboard/MonthlyChart';
import CategoryChart from '../components/Dashboard/CategoryChart';
import AlertsWidget from '../components/Dashboard/AlertsWidget';
import AccountSummaryWidget from '../components/Dashboard/AccountSummaryWidget';
import { useDate } from '../context/DateContext';
import { formatMonthYear } from '../utils/formatters';

export default function Dashboard() {
  const { month, year } = useDate();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5 capitalize">
          Visão geral de {formatMonthYear(month, year)}
        </p>
      </div>

      <SummaryCards />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <MonthlyChart />
        <CategoryChart />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AccountSummaryWidget />
        <AlertsWidget />
      </div>
    </div>
  );
}
