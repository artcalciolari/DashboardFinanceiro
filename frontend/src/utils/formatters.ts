import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { AccountType, CategoryType } from '../types';

export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

export function formatDate(dateStr: string): string {
  return format(parseISO(dateStr), 'dd/MM/yyyy', { locale: ptBR });
}

/**
 * Converte valores digitados/colados em número, aceitando tanto o formato
 * pt-BR ("1.234,56") quanto o canônico dos inputs numéricos ("1234.56").
 * O separador decimal é o que aparece por último; os demais são milhar.
 */
export function parseCurrencyBR(value: string): number {
  const cleaned = value.trim().replace(/[^\d.,-]/g, '');
  if (!cleaned) return NaN;

  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');

  if (lastComma > lastDot) {
    const intPart = cleaned.slice(0, lastComma).replace(/[.,]/g, '');
    return decimalStringToCents(`${intPart}.${cleaned.slice(lastComma + 1)}`);
  }

  return decimalStringToCents(cleaned.replace(/,/g, ''));
}

function decimalStringToCents(value: string): number {
  if (!/^-?\d+(?:\.\d+)?$/.test(value)) return NaN;
  const negative = value.startsWith('-');
  const normalized = negative ? value.slice(1) : value;
  const [integer, fraction = ''] = normalized.split('.');
  const rounded = Number(fraction.padEnd(3, '0').slice(0, 3));
  let cents = Number(integer) * 100 + Number(fraction.padEnd(2, '0').slice(0, 2));
  if (rounded % 10 >= 5) cents += 1;
  return negative ? -cents : cents;
}

export function centsToInput(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return '';
  const sign = cents < 0 ? '-' : '';
  const absolute = Math.abs(cents);
  return `${sign}${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, '0')}`;
}

export function getLocalDateInput(date = new Date()): string {
  const timezoneOffsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - timezoneOffsetMs).toISOString().slice(0, 10);
}

export function formatMonthYear(month: number, year: number): string {
  const date = new Date(year, month - 1, 1);
  return capitalize(format(date, 'MMMM yyyy', { locale: ptBR }));
}

export function formatMonthShort(month: number, year: number): string {
  const date = new Date(year, month - 1, 1);
  return format(date, 'MMM/yy', { locale: ptBR });
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/** Valor da parcela para preview do formulário (centavos → BRL via formatCurrency). */
export function installmentPreviewCents(totalAmount: string, installmentCount: string): number {
  return (parseCurrencyBR(totalAmount) || 0) / (parseInt(installmentCount, 10) || 1);
}

/** Amplitude do sparkline (evita divisão por zero quando a série é plana). */
export function sparkChartRange(sparkMin: number, sparkMax: number): number {
  const range = sparkMax - sparkMin;
  return range === 0 ? 1 : range;
}

/** Coordenada X do sparkline (ponto único fica em x=0). */
export function sparkChartX(index: number, count: number): number {
  if (count <= 1) return 0;
  return (index / (count - 1)) * 260;
}

/** Valor KPI do resumo mensal. */
export function formatSummaryAmount(isLoading: boolean, cents: number | undefined): string {
  if (isLoading) return '—';
  return formatCurrency(cents ?? 0);
}

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  BANK_ACCOUNT: 'Conta Bancária',
  CREDIT_CARD: 'Cartão de Crédito',
  CASH: 'Dinheiro',
  INVESTMENT: 'Investimento',
};

export const CATEGORY_TYPE_LABELS: Record<CategoryType, string> = {
  INCOME: 'Receita',
  EXPENSE: 'Despesa',
};

export const PRESET_COLORS = [
  '#EF4444', '#F97316', '#F59E0B', '#EAB308',
  '#84CC16', '#22C55E', '#10B981', '#14B8A6',
  '#06B6D4', '#3B82F6', '#6366F1', '#8B5CF6',
  '#A855F7', '#EC4899', '#F43F5E', '#6B7280',
];
