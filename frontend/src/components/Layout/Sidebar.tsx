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
      <aside className="hidden md:flex flex-col w-[260px] min-h-screen fixed top-0 left-0 z-40 bg-gradient-to-b from-forest to-forest-deep">
        <div className="flex items-center gap-3 px-6 pt-6 pb-6">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-lime shadow-[0_4px_12px_rgba(200,241,105,0.25)]">
            <TrendingUp size={19} className="text-forest" strokeWidth={2.5} />
          </div>
          <div className="leading-tight">
            <div className="font-display text-[16.5px] font-bold tracking-tight text-white">Saldo Claro</div>
            <div className="text-[11px] font-medium text-[#6E9584]">Finanças pessoais</div>
          </div>
        </div>

        <div className="px-6 pb-2 text-eyebrow uppercase text-[#5E7F70]">Menu</div>

        <nav className="flex flex-1 flex-col gap-0.5 px-3">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                clsx(
                  'group relative flex items-center gap-3 rounded-control px-3 py-2.5 text-[13.5px] transition-colors duration-150',
                  isActive
                    ? 'bg-white/10 font-semibold text-white'
                    : 'font-medium text-[#9DBBAD] hover:bg-white/5 hover:text-white'
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-lime" />
                  )}
                  <Icon size={18} strokeWidth={2.1} className={isActive ? 'text-lime' : ''} />
                  <span className="flex-1">{label}</span>
                  {to === '/alerts' && attentionCount > 0 && (
                    <span className="ml-auto flex h-[18px] min-w-[18px] items-center justify-center rounded-pill bg-lime px-1.5 text-[11px] font-bold text-forest">
                      {attentionCount}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Mobile bottom navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex overflow-x-auto border-t border-border bg-white/90 backdrop-blur-md pb-[env(safe-area-inset-bottom)]">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              clsx(
                'min-w-[64px] flex-1 flex flex-col items-center justify-center py-2.5 text-[10.5px] transition-colors',
                isActive ? 'font-semibold text-forest' : 'font-medium text-faint'
              )
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={clsx(
                    'flex h-8 w-14 items-center justify-center rounded-pill',
                    isActive ? 'bg-forest-soft' : ''
                  )}
                >
                  <Icon size={18} />
                </span>
                <span className="mt-1 w-full truncate px-0.5 text-center leading-tight">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </>
  );
}
