import { describe, expect, it } from 'vitest';
import { alertWeekRange, futureCutoff } from '../src/utils/businessTime';

describe('business time boundaries', () => {
  it('uses the beginning of the local day as the future-deletion cutoff', () => {
    expect(futureCutoff(new Date(2026, 7, 2, 18, 30))).toEqual(new Date(2026, 7, 2, 0, 0, 0, 0));
  });

  it('uses Monday through Sunday for weekly alerts', () => {
    const range = alertWeekRange(new Date(2026, 7, 5, 12));
    expect(range.startDate).toEqual(new Date(2026, 7, 3, 0, 0, 0, 0));
    expect(range.endDate).toEqual(new Date(2026, 7, 9, 23, 59, 59, 999));
  });
});
