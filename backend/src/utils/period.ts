import { z } from 'zod';

const PeriodSchema = z.object({
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(2000).max(2200).optional(),
}).superRefine(({ month, year }, ctx) => {
  if ((month === undefined) !== (year === undefined)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Mês e ano devem ser informados juntos',
    });
  }
});

function singleQueryValue(value: unknown) {
  if (Array.isArray(value)) return value.length === 1 ? value[0] : '__invalid__';
  return typeof value === 'string' ? value : undefined;
}

export function parsePeriodQuery(query: { month?: unknown; year?: unknown }) {
  return PeriodSchema.parse({
    month: singleQueryValue(query.month),
    year: singleQueryValue(query.year),
  });
}
