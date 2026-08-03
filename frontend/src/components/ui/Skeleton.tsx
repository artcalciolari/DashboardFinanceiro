import { clsx } from 'clsx';

export default function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={clsx('skeleton', className)} />;
}
