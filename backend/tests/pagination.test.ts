import { describe, expect, it } from 'vitest';
import {
  decodeDateCursor,
  encodeDateCursor,
  parseLimit,
  parsePageQuery,
} from '../src/utils/pagination';
import { HttpError } from '../src/utils/httpError';

describe('date cursor', () => {
  it('round-trips an opaque cursor', () => {
    const value = { effectiveDate: '2026-08-02T12:00:00.000Z', id: 'tx_123' };
    expect(decodeDateCursor(encodeDateCursor(value))).toEqual(value);
  });

  it('returns undefined for missing cursor', () => {
    expect(decodeDateCursor(undefined)).toBeUndefined();
  });

  it('rejects malformed cursors', () => {
    expect(() => decodeDateCursor('not-a-cursor')).toThrow(/Cursor inválido/);
    expect(() => decodeDateCursor(12)).toThrow(HttpError);
    expect(() => decodeDateCursor(encodeDateCursor({ effectiveDate: 'bad', id: 'x' }))).toThrow(
      /Cursor inválido/
    );
  });
});

describe('page query helpers', () => {
  it('parses page and pageSize with skip', () => {
    expect(parsePageQuery({ page: '2', pageSize: '10' })).toEqual({
      page: 2,
      pageSize: 10,
      skip: 10,
    });
    expect(parsePageQuery({})).toEqual({ page: 1, pageSize: 25, skip: 0 });
  });

  it('parses limit with defaults and bounds', () => {
    expect(parseLimit(undefined)).toBe(50);
    expect(parseLimit('25')).toBe(25);
    expect(parseLimit(undefined, 10)).toBe(10);
  });
});
