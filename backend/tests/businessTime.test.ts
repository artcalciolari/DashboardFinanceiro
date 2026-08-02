import { describe, expect, it, vi } from 'vitest';
import {
  alertWeekRange,
  businessEndOfDay,
  futureCutoff,
  mutablePeriodStart,
  BUSINESS_TIME_ZONE,
} from '../src/utils/businessTime';

describe('business time boundaries', () => {
  it('exports the configured business time zone', () => {
    expect(BUSINESS_TIME_ZONE).toBe('America/Sao_Paulo');
  });

  it('falls back to America/Sao_Paulo when BUSINESS_TIME_ZONE is unset', async () => {
    vi.resetModules();
    const previous = process.env.BUSINESS_TIME_ZONE;
    delete process.env.BUSINESS_TIME_ZONE;
    const mod = await import('../src/utils/businessTime');
    expect(mod.BUSINESS_TIME_ZONE).toBe('America/Sao_Paulo');
    if (previous === undefined) delete process.env.BUSINESS_TIME_ZONE;
    else process.env.BUSINESS_TIME_ZONE = previous;
    vi.resetModules();
  });

  it('uses the beginning of the local day as the future-deletion cutoff', () => {
    expect(futureCutoff(new Date(2026, 7, 2, 18, 30))).toEqual(new Date(2026, 7, 2, 0, 0, 0, 0));
  });

  it('uses the first day of the month as the mutable period start', () => {
    expect(mutablePeriodStart(new Date(2026, 7, 15, 18))).toEqual(new Date(2026, 7, 1, 0, 0, 0, 0));
  });

  it('returns end of day for a business date', () => {
    expect(businessEndOfDay(new Date(2026, 7, 2, 8))).toEqual(new Date(2026, 7, 2, 23, 59, 59, 999));
  });

  it('uses Monday through Sunday for weekly alerts', () => {
    const range = alertWeekRange(new Date(2026, 7, 5, 12));
    expect(range.startDate).toEqual(new Date(2026, 7, 3, 0, 0, 0, 0));
    expect(range.endDate).toEqual(new Date(2026, 7, 9, 23, 59, 59, 999));
  });
});
