import { ButtonHTMLAttributes, ReactNode } from 'react';
import { clsx } from 'clsx';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'accent';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  children: ReactNode;
}

export default function Button({
  variant = 'primary',
  size = 'md',
  type = 'button',
  loading,
  children,
  className,
  disabled,
  ...props
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-2 font-semibold rounded-control ' +
    'transition-all duration-150 active:scale-[0.98] ' +
    'focus-visible:outline-none focus-visible:shadow-focus-forest ' +
    'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100';

  const variants = {
    primary: 'bg-forest hover:bg-forest-hover text-white shadow-card',
    secondary: 'bg-white hover:bg-chip text-ink border border-border shadow-card',
    danger: 'bg-expense/10 hover:bg-expense/20 text-expense',
    ghost: 'hover:bg-chip text-muted',
    accent: 'bg-lime hover:bg-lime-strong text-forest shadow-card',
  };

  const sizes = {
    sm: 'h-8 px-3 text-xs',
    md: 'h-10 px-4 text-[13.5px]',
    lg: 'h-11 px-5 text-sm',
  };

  return (
    <button
      type={type}
      className={clsx(base, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 size={14} className="animate-spin" />}
      {children}
    </button>
  );
}
