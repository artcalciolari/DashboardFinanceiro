import { NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard,
  ArrowLeftRight,
  CreditCard,
  Tag,
  Calendar,
  RefreshCw,
  Bell,
  TrendingUp,
  Settings,
} from 'lucide-react';
import { clsx } from 'clsx';
import { alertsApi } from '../../services/api';

const navItems = [
  { to: '/', label: 'Visão geral', icon: LayoutDashboard, end: true },
  { to: '/transactions', label: 'Transações', icon: ArrowLeftRight },
  { to: '/accounts', label: 'Contas & cartões', icon: CreditCard },
  { to: '/categories', label: 'Categorias', icon: Tag },
  { to: '/installments', label: 'Parcelamentos', icon: Calendar },
  { to: '/subscriptions', label: 'Assinaturas', icon: RefreshCw },
  { to: '/alerts', label: 'Alertas', icon: Bell },
];

export default function Sidebar() {
  const { data: alertStatuses = [] } = useQuery({
    queryKey: ['alerts', 'check'],
    queryFn: alertsApi.check,
    refetchInterval: 1000 * 60 * 5,
  });
  const attentionCount = alertStatuses.filter((s) => s.isTriggered || s.isWarning).length;

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-[250px] bg-forest min-h-screen fixed top-0 left-0 z-40">
        <div className="flex items-center gap-3 px-[22px] pt-[22px] pb-5">
          <div className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-[11px] bg-lime">
            <TrendingUp size={20} className="text-forest" strokeWidth={2.4} />
          </div>
          <div className="leading-tight">
            <div className="font-display text-[17px] font-bold tracking-tight text-white">Saldo Claro</div>
            <div className="text-[11.5px] font-medium text-[#7FA593]">Finanças pessoais</div>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-[3px] px-3 py-1.5">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 rounded-[11px] px-3 py-2.5 text-[13.5px] transition-colors',
                  isActive
                    ? 'bg-lime/[0.14] font-semibold text-white'
                    : 'font-medium text-[#8FB3A2] hover:bg-white/5 hover:text-white'
                )
              }
            >
              <Icon size={19} />
              <span className="flex-1">{label}</span>
              {to === '/alerts' && attentionCount > 0 && (
                <span className="ml-auto flex h-[18px] min-w-[18px] items-center justify-center rounded-pill bg-lime px-1.5 text-[11px] font-bold text-forest">
                  {attentionCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="m-3 flex items-center gap-[11px] rounded-2xl bg-white/5 px-4 py-3.5">
          <div className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-full bg-[#1E5C46] font-display text-sm font-bold text-lime">
            SC
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold text-white">Saldo Claro</div>
            <div className="text-[11.5px] text-[#7FA593]">Uso pessoal</div>
          </div>
          <Settings size={16} className="text-[#7FA593]" />
        </div>
      </aside>

      {/* Mobile bottom navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border z-40 flex">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              clsx(
                'flex-1 min-w-0 flex flex-col items-center justify-center py-2 text-[10px] transition-colors',
                isActive ? 'text-forest' : 'text-faint'
              )
            }
          >
            <Icon size={18} />
            <span className="mt-1 w-full truncate px-0.5 text-center leading-tight">{label}</span>
          </NavLink>
        ))}
      </nav>
    </>
  );
}
