import { z } from 'zod';

export const MAX_MONEY_CENTS = 2_147_483_647;

export const PositiveMoneyCents = z
  .number()
  .int('Valor deve ser informado em centavos inteiros')
  .positive('Valor deve ser positivo')
  .max(MAX_MONEY_CENTS, 'Valor excede o limite suportado');

export const MoneyCents = z
  .number()
  .int('Valor deve ser informado em centavos inteiros')
  .min(-MAX_MONEY_CENTS)
  .max(MAX_MONEY_CENTS);

export function formatCentsForCsv(cents: number) {
  const sign = cents < 0 ? '-' : '';
  const absolute = Math.abs(cents);
  return `${sign}${Math.floor(absolute / 100)},${String(absolute % 100).padStart(2, '0')}`;
}

export function splitInstallmentCents(totalCents: number, count: number) {
  if (!Number.isInteger(totalCents) || totalCents <= 0) throw new Error('Total must be positive integer cents');
  if (!Number.isInteger(count) || count < 2) throw new Error('Installment count must be at least two');
  if (totalCents < count) throw new Error('Each installment must contain at least one cent');
  const base = Math.floor(totalCents / count);
  const remainder = totalCents - base * count;
  return Array.from({ length: count }, (_, index) => base + (index === count - 1 ? remainder : 0));
}
