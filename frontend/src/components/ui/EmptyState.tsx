import type { LucideIcon } from 'lucide-react';
import Button from './Button';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({ icon: Icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-forest-soft">
        <Icon size={24} className="text-forest" strokeWidth={1.8} />
      </div>
      <h3 className="font-display text-[16px] font-semibold text-ink">{title}</h3>
      {description && <p className="mt-1.5 max-w-[320px] text-[13px] text-faint">{description}</p>}
      {actionLabel && onAction && (
        <Button variant="secondary" size="sm" className="mt-5" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
