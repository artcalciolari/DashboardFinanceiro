import { addMonths } from 'date-fns';

function clampDayOfMonth(date: Date, day: number): Date {
  const year = date.getFullYear();
  const month = date.getMonth();
  const maxDay = new Date(year, month + 1, 0).getDate();
  const safeDay = Math.min(Math.max(day, 1), maxDay);

  return new Date(year, month, safeDay, 12, 0, 0);
}

/**
 * Calculates the invoice due date for credit card purchases.
 *
 * Purchase day <= closing day stays in the current cycle; purchases after the
 * closing day move to the next cycle. Cards whose due day is before their
 * closing day are due in the month after the cycle closes (for example,
 * Sicredi 26/10); the others are due in the same month as the closing.
 */
export function calculateEffectiveDate(
  purchaseDate: Date,
  accountType: string,
  closingDay?: number | null,
  dueDay?: number | null
): Date {
  if (accountType !== 'CREDIT_CARD') {
    return purchaseDate;
  }

  if (!closingDay) {
    if (!dueDay) {
      return purchaseDate;
    }

    const dueDate = clampDayOfMonth(purchaseDate, dueDay);
    return dueDate >= purchaseDate ? dueDate : clampDayOfMonth(addMonths(purchaseDate, 1), dueDay);
  }

  const purchaseDay = purchaseDate.getDate();
  const closesNextCycle = purchaseDay > closingDay;
  const closingDate = clampDayOfMonth(addMonths(purchaseDate, closesNextCycle ? 1 : 0), closingDay);

  if (!dueDay) {
    return closingDate;
  }

  const dueMonthOffset = dueDay < closingDay ? 1 : 0;
  return clampDayOfMonth(addMonths(closingDate, dueMonthOffset), dueDay);
}
