import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { AccountType, CategoryType } from '../types';

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
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
    return parseFloat(`${intPart}.${cleaned.slice(lastComma + 1)}`);
  }

  return parseFloat(cleaned.replace(/,/g, ''));
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
