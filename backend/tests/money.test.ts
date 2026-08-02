import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
  MoneyCents,
  PositiveMoneyCents,
  formatCentsForCsv,
  splitInstallmentCents,
} from '../src/utils/money';

describe('money helpers', () => {
  it('splits cents exactly and leaves the remainder in the final installment', () => {
    const parts = splitInstallmentCents(10_000, 3);
    expect(parts).toEqual([3333, 3333, 3334]);
    expect(parts.reduce((sum, value) => sum + value, 0)).toBe(10_000);
  });

  it('rejects zero-cent installments', () => {
    expect(() => splitInstallmentCents(1, 2)).toThrow(/one cent/i);
  });

  it('rejects non-positive totals and low installment counts', () => {
    expect(() => splitInstallmentCents(0, 2)).toThrow(/Total must be positive/);
    expect(() => splitInstallmentCents(1.5, 2)).toThrow(/Total must be positive/);
    expect(() => splitInstallmentCents(100, 1)).toThrow(/at least two/);
  });

  it('formats cents for Brazilian CSV without floating point arithmetic', () => {
    expect(formatCentsForCsv(123_456)).toBe('1234,56');
    expect(formatCentsForCsv(-1)).toBe('-0,01');
    expect(formatCentsForCsv(0)).toBe('0,00');
  });

  it('validates money schemas', () => {
    expect(PositiveMoneyCents.parse(1)).toBe(1);
    expect(MoneyCents.parse(0)).toBe(0);
    expect(MoneyCents.parse(-10)).toBe(-10);
    expect(() => PositiveMoneyCents.parse(0)).toThrow(ZodError);
    expect(() => PositiveMoneyCents.parse(1.5)).toThrow(ZodError);
    expect(() => MoneyCents.parse(2_147_483_648)).toThrow(ZodError);
  });
});
