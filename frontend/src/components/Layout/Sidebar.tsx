import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  ArrowLeftRight,
  CreditCard,
  Tag,
  Calendar,
  RefreshCw,
  Bell,
} from 'lucide-react';
import { clsx } from 'clsx';
import logo from '../../assets/saldo-claro.svg';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/transactions', label: 'Transações', icon: ArrowLeftRight },
  { to: '/accounts', label: 'Contas', icon: CreditCard },
  { to: '/categories', label: 'Categorias', icon: Tag },
  { to: '/installments', label: 'Parcelamentos', icon: Calendar },
  { to: '/subscriptions', label: 'Assinaturas', icon: RefreshCw },
  { to: '/alerts', label: 'Alertas', icon: Bell },
];

export default function Sidebar() {
  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-60 bg-slate-800 min-h-screen fixed top-0 left-0 z-30">
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-700">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white">
            <img src={logo} alt="Logo Saldo Claro" className="h-8 w-8 object-contain" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Saldo</p>
            <p className="text-xs text-slate-400">Claro</p>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:bg-slate-700 hover:text-white'
                )
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Mobile bottom navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-30 flex">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              clsx(
                'flex-1 flex flex-col items-center justify-center py-2 text-xs transition-colors',
                isActive ? 'text-blue-600' : 'text-gray-500'
              )
            }
          >
            <Icon size={20} />
            <span className="mt-1 truncate w-full text-center">{label}</span>
          </NavLink>
        ))}
      </nav>
    </>
  );
}
