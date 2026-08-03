import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Skeleton from './Skeleton';

describe('Skeleton', () => {
  it('renders with skeleton class and aria-hidden', () => {
    const { container } = render(<Skeleton />);
    const el = container.firstElementChild as HTMLElement;
    expect(el).toHaveClass('skeleton');
    expect(el).toHaveAttribute('aria-hidden', 'true');
  });

  it('merges className', () => {
    const { container } = render(<Skeleton className="h-10 w-full" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el).toHaveClass('skeleton');
    expect(el).toHaveClass('h-10');
    expect(el).toHaveClass('w-full');
  });
});
