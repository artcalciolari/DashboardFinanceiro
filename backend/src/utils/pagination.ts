import { z } from 'zod';
import { HttpError } from './httpError';

const PageSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export function parsePageQuery(query: { page?: unknown; pageSize?: unknown }) {
  const result = PageSchema.parse({ page: query.page, pageSize: query.pageSize });
  return { ...result, skip: (result.page - 1) * result.pageSize };
}

export interface DateCursor {
  effectiveDate: string;
  id: string;
}

export function encodeDateCursor(cursor: DateCursor) {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url');
}

export function decodeDateCursor(value: unknown): DateCursor | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new HttpError(422, 'Cursor inválido', 'INVALID_CURSOR');

  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as DateCursor;
    if (!parsed.id || Number.isNaN(new Date(parsed.effectiveDate).getTime())) throw new Error();
    return parsed;
  } catch {
    throw new HttpError(422, 'Cursor inválido', 'INVALID_CURSOR');
  }
}

export function parseLimit(value: unknown, defaultValue = 50) {
  return z.coerce.number().int().min(1).max(100).default(defaultValue).parse(value);
}
