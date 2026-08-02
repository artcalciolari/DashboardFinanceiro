import { describe, it, expect, vi } from 'vitest';
import {
  formatCurrency,
  formatDate,
  parseCurrencyBR,
  centsToInput,
  getLocalDateInput,
  formatMonthYear,
  formatMonthShort,
  capitalize,
  ACCOUNT_TYPE_LABELS,
  CATEGORY_TYPE_LABELS,
  PRESET_COLORS,
  installmentPreviewCents,
  sparkChartRange,
  sparkChartX,
  formatSummaryAmount,
} from './formatters';

describe('formatCurrency', () => {
  it('formats cents as BRL', () => {
    expect(formatCurrency(123456)).toMatch(/1\.234,56/);
    expect(formatCurrency(0)).toMatch(/0,00/);
    expect(formatCurrency(-500)).toMatch(/-.*5,00/);
  });
});

describe('formatDate', () => {
  it('formats ISO date as dd/MM/yyyy', () => {
    expect(formatDate('2024-06-15T12:00:00.000Z')).toBe('15/06/2024');
  });
});

describe('parseCurrencyBR', () => {
  it('returns NaN for empty/whitespace', () => {
    expect(parseCurrencyBR('')).toBeNaN();
    expect(parseCurrencyBR('   ')).toBeNaN();
    expect(parseCurrencyBR('abc')).toBeNaN();
  });

  it('parses pt-BR format with comma as decimal', () => {
    expect(parseCurrencyBR('1.234,56')).toBe(123456);
    expect(parseCurrencyBR('10,5')).toBe(1050);
    // 10,567 -> 10.567 -> cents from first 2 digits + round on 3rd => 1057
    expect(parseCurrencyBR('10,567')).toBe(1057);
  });

  it('parses canonical/dot decimal format', () => {
    expect(parseCurrencyBR('1234.56')).toBe(123456);
    expect(parseCurrencyBR('10.5')).toBe(1050);
  });

  it('parses integers without separators', () => {
    expect(parseCurrencyBR('100')).toBe(10000);
  });

  it('handles negative values', () => {
    expect(parseCurrencyBR('-10,50')).toBe(-1050);
    expect(parseCurrencyBR('-10.50')).toBe(-1050);
  });

  it('strips currency symbols and spaces', () => {
    expect(parseCurrencyBR('R$ 1.234,56')).toBe(123456);
  });

  it('returns NaN for invalid decimal shapes', () => {
    // last comma wins: "1,,2" -> intPart cleans commas/dots -> "1" + ".2" => 120
    expect(parseCurrencyBR('1,,2')).toBe(120);
    // "12.34.56" keeps dots; regex fails on multi-dot => NaN
    expect(parseCurrencyBR('1.2.3,')).toBeNaN();
    expect(parseCurrencyBR('--1')).toBeNaN();
  });

  it('rounds half-up on third fractional digit', () => {
    expect(parseCurrencyBR('1.005')).toBe(101); // 1.005 -> cents round up
    expect(parseCurrencyBR('1,004')).toBe(100);
  });
});

describe('centsToInput', () => {
  it('converts cents to input string', () => {
    expect(centsToInput(12345)).toBe('123.45');
    expect(centsToInput(5)).toBe('0.05');
    expect(centsToInput(-1050)).toBe('-10.50');
  });

  it('returns empty for null/undefined', () => {
    expect(centsToInput(null)).toBe('');
    expect(centsToInput(undefined)).toBe('');
  });
});

describe('getLocalDateInput', () => {
  it('returns YYYY-MM-DD in local timezone', () => {
    const date = new Date(2024, 5, 15, 12, 0, 0);
    expect(getLocalDateInput(date)).toBe('2024-06-15');
  });

  it('defaults to now', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 0, 5, 15, 0, 0));
    expect(getLocalDateInput()).toBe('2024-01-05');
    vi.useRealTimers();
  });
});

describe('formatMonthYear / formatMonthShort / capitalize', () => {
  it('formats month year capitalized', () => {
    const result = formatMonthYear(6, 2024);
    expect(result).toMatch(/Junho 2024/i);
    expect(result.charAt(0)).toBe(result.charAt(0).toUpperCase());
  });

  it('formats short month', () => {
    expect(formatMonthShort(6, 2024)).toMatch(/jun\/24/i);
  });

  it('capitalizes string', () => {
    expect(capitalize('junho')).toBe('Junho');
    expect(capitalize('')).toBe('');
  });
});

describe('labels and presets', () => {
  it('exposes account and category labels', () => {
    expect(ACCOUNT_TYPE_LABELS.BANK_ACCOUNT).toBe('Conta Bancária');
    expect(ACCOUNT_TYPE_LABELS.CREDIT_CARD).toBe('Cartão de Crédito');
    expect(CATEGORY_TYPE_LABELS.INCOME).toBe('Receita');
    expect(CATEGORY_TYPE_LABELS.EXPENSE).toBe('Despesa');
  });

  it('exposes preset colors', () => {
    expect(PRESET_COLORS.length).toBeGreaterThan(0);
    expect(PRESET_COLORS[0]).toMatch(/^#/);
  });
});

describe('installmentPreviewCents', () => {
  it('falls back when amount is invalid or count is zero', () => {
    expect(installmentPreviewCents('-', '0')).toBe(0);
    expect(installmentPreviewCents('100', '0')).toBe(10000);
    expect(installmentPreviewCents('10,00', '2')).toBe(500);
  });
});

describe('sparkChartRange / sparkChartX / formatSummaryAmount', () => {
  it('covers flat and non-flat spark ranges', () => {
    expect(sparkChartRange(0, 0)).toBe(1);
    expect(sparkChartRange(-10, 40)).toBe(50);
  });

  it('covers single and multi point spark X', () => {
    expect(sparkChartX(0, 1)).toBe(0);
    expect(sparkChartX(0, 0)).toBe(0);
    expect(sparkChartX(1, 3)).toBe(130);
  });

  it('formats summary amounts for loading and missing cents', () => {
    expect(formatSummaryAmount(true, 100)).toBe('—');
    expect(formatSummaryAmount(false, undefined)).toMatch(/0,00/);
    expect(formatSummaryAmount(false, 250)).toMatch(/2,50/);
  });
});
