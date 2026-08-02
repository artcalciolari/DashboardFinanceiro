import { describe, expect, it } from 'vitest';
import { formatCentsForCsv, splitInstallmentCents } from '../src/utils/money';

describe('money helpers', () => {
  it('splits cents exactly and leaves the remainder in the final installment', () => {
    const parts = splitInstallmentCents(10_000, 3);
    expect(parts).toEqual([3333, 3333, 3334]);
    expect(parts.reduce((sum, value) => sum + value, 0)).toBe(10_000);
  });

  it('rejects zero-cent installments', () => {
    expect(() => splitInstallmentCents(1, 2)).toThrow(/one cent/i);
  });

  it('formats cents for Brazilian CSV without floating point arithmetic', () => {
    expect(formatCentsForCsv(123_456)).toBe('1234,56');
    expect(formatCentsForCsv(-1)).toBe('-0,01');
  });
});
