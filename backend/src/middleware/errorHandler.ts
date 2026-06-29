import { Request, Response, NextFunction } from 'express';

interface ZodLike extends Error {
  errors: unknown[];
}

function isZodError(err: unknown): err is ZodLike {
  return err instanceof Error && 'errors' in err && Array.isArray((err as ZodLike).errors);
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (isZodError(err)) {
    return res.status(400).json({ error: 'Dados inválidos', details: err.errors });
  }
  console.error(err.stack);
  res.status(500).json({ error: err.message || 'Erro interno do servidor' });
}
