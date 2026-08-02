import { describe, expect, it } from 'vitest';
import { decodeDateCursor, encodeDateCursor } from '../src/utils/pagination';

describe('date cursor', () => {
  it('round-trips an opaque cursor', () => {
    const value = { effectiveDate: '2026-08-02T12:00:00.000Z', id: 'tx_123' };
    expect(decodeDateCursor(encodeDateCursor(value))).toEqual(value);
  });

  it('rejects malformed cursors', () => {
    expect(() => decodeDateCursor('not-a-cursor')).toThrow(/Cursor inválido/);
  });
});
