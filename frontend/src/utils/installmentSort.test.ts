import { describe, it, expect } from 'vitest';
import {
  compareOngoingInstallments,
  compareFinishedInstallments,
  compareCancelledInstallments,
} from './installmentSort';

describe('installmentSort', () => {
  it('compareOngoingInstallments covers next dates and ties', () => {
    const withNext = (desc: string, date: string) => ({
      next: { effectiveDate: date },
      group: { description: desc },
    });
    const withoutNext = (desc: string) => ({
      group: { description: desc },
    });

    expect(compareOngoingInstallments(withNext('B', '2024-01-01'), withNext('A', '2024-02-01'))).toBeLessThan(0);
    expect(compareOngoingInstallments(withoutNext('B'), withoutNext('A'))).toBeGreaterThan(0);
    expect(compareOngoingInstallments(withNext('A', '2024-01-01'), withNext('B', '2024-01-01'))).toBeLessThan(0);
  });

  it('compareFinishedInstallments covers last dates and ties', () => {
    const withLast = (desc: string, date?: string) => ({
      last: date ? { effectiveDate: date } : undefined,
      group: { description: desc },
    });

    expect(compareFinishedInstallments(withLast('B', '2024-06-01'), withLast('A', '2024-05-01'))).toBeLessThan(0);
    expect(compareFinishedInstallments(withLast('B'), withLast('A'))).toBeGreaterThan(0);
    expect(compareFinishedInstallments(withLast('A', '2024-06-01'), withLast('B', '2024-06-01'))).toBeLessThan(0);
  });

  it('compareCancelledInstallments covers cancelledAt and ties', () => {
    const item = (desc: string, cancelledAt?: string | null) => ({
      group: { description: desc, cancelledAt },
    });

    expect(compareCancelledInstallments(item('B', '2024-06-01'), item('A', '2024-05-01'))).toBeLessThan(0);
    expect(compareCancelledInstallments(item('B', null), item('A', null))).toBeGreaterThan(0);
    expect(compareCancelledInstallments(item('A', '2024-05-01'), item('B', '2024-05-01'))).toBeLessThan(0);
  });
});
