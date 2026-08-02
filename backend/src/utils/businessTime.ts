import { endOfDay, endOfWeek, startOfDay, startOfMonth, startOfWeek } from 'date-fns';

export const BUSINESS_TIME_ZONE = process.env.BUSINESS_TIME_ZONE ?? 'America/Sao_Paulo';

export function futureCutoff(now = new Date()) {
  return startOfDay(now);
}

export function mutablePeriodStart(now = new Date()) {
  return startOfMonth(now);
}

export function businessEndOfDay(date: Date) {
  return endOfDay(date);
}

export function alertWeekRange(now = new Date()) {
  return {
    startDate: startOfWeek(now, { weekStartsOn: 1 }),
    endDate: endOfWeek(now, { weekStartsOn: 1 }),
  };
}
