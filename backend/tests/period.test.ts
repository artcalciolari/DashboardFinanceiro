import { describe, expect, it } from 'vitest';
import { parsePeriodQuery } from '../src/utils/period';

describe('parsePeriodQuery', () => {
  it('accepts missing month and year', () => {
    expect(parsePeriodQuery({})).toEqual({});
  });

  it('parses month and year together', () => {
    expect(parsePeriodQuery({ month: '8', year: '2026' })).toEqual({ month: 8, year: 2026 });
  });

  it('rejects month without year and invalid arrays', () => {
    expect(() => parsePeriodQuery({ month: '8' })).toThrow();
    expect(() => parsePeriodQuery({ year: '2026' })).toThrow();
    expect(() => parsePeriodQuery({ month: ['8', '9'], year: '2026' })).toThrow();
  });

  it('accepts single-element arrays', () => {
    expect(parsePeriodQuery({ month: ['8'], year: ['2026'] })).toEqual({ month: 8, year: 2026 });
  });
});
