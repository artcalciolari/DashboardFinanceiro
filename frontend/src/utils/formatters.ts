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

export function formatMonthYear(month: number, year: number): string {
  const date = new Date(year, month - 1, 1);
  return format(date, "MMMM 'de' yyyy", { locale: ptBR });
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
