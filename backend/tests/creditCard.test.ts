import { describe, expect, it } from 'vitest';
import { calculateEffectiveDate } from '../src/utils/creditCard';

function localDate(year: number, month: number, day: number) {
  return new Date(year, month - 1, day, 12, 0, 0);
}

describe('calculateEffectiveDate', () => {
  it('keeps the purchase date for non-card accounts', () => {
    const purchase = localDate(2026, 1, 15);
    expect(calculateEffectiveDate(purchase, 'BANK_ACCOUNT')).toEqual(purchase);
  });

  it('keeps purchases on the closing day in the current cycle', () => {
    expect(calculateEffectiveDate(localDate(2026, 1, 10), 'CREDIT_CARD', 10, 20)).toEqual(
      localDate(2026, 1, 20)
    );
  });

  it('moves purchases after closing to the next cycle', () => {
    expect(calculateEffectiveDate(localDate(2026, 1, 11), 'CREDIT_CARD', 10, 20)).toEqual(
      localDate(2026, 2, 20)
    );
  });

  it('moves due dates before closing into the following month', () => {
    expect(calculateEffectiveDate(localDate(2026, 1, 25), 'CREDIT_CARD', 26, 10)).toEqual(
      localDate(2026, 2, 10)
    );
    expect(calculateEffectiveDate(localDate(2026, 1, 27), 'CREDIT_CARD', 26, 10)).toEqual(
      localDate(2026, 3, 10)
    );
  });

  it('clamps invalid days to the end of short months', () => {
    expect(calculateEffectiveDate(localDate(2028, 2, 15), 'CREDIT_CARD', 31, 31)).toEqual(
      localDate(2028, 2, 29)
    );
  });

  it('uses due-only logic when closing day is missing', () => {
    expect(calculateEffectiveDate(localDate(2026, 1, 5), 'CREDIT_CARD', null, 10)).toEqual(
      localDate(2026, 1, 10)
    );
    expect(calculateEffectiveDate(localDate(2026, 1, 15), 'CREDIT_CARD', null, 10)).toEqual(
      localDate(2026, 2, 10)
    );
  });

  it('returns purchase date when card has neither closing nor due day', () => {
    const purchase = localDate(2026, 1, 15);
    expect(calculateEffectiveDate(purchase, 'CREDIT_CARD', null, null)).toEqual(purchase);
  });

  it('returns closing date when due day is missing', () => {
    expect(calculateEffectiveDate(localDate(2026, 1, 5), 'CREDIT_CARD', 10, null)).toEqual(
      localDate(2026, 1, 10)
    );
    expect(calculateEffectiveDate(localDate(2026, 1, 15), 'CREDIT_CARD', 10, null)).toEqual(
      localDate(2026, 2, 10)
    );
  });
});
