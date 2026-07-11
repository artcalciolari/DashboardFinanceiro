import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { HttpError } from '../utils/httpError';

interface ZodLike extends Error {
  errors: unknown[];
}

function isZodError(err: unknown): err is ZodLike {
  return err instanceof Error && 'errors' in err && Array.isArray((err as ZodLike).errors);
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (isZodError(err)) {
    return res.status(422).json({
      code: 'VALIDATION_ERROR',
      message: 'Dados inválidos',
      details: err.errors,
    });
  }

  if (err instanceof HttpError) {
    return res.status(err.status).json({
      code: err.code,
      message: err.message,
      ...(err.details !== undefined && { details: err.details }),
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const status = err.code === 'P2025' ? 404 : err.code === 'P2002' || err.code === 'P2003' ? 409 : 500;
    const message =
      status === 404
        ? 'Registro não encontrado'
        : status === 409
          ? 'A operação conflita com dados existentes ou relacionados'
          : 'Erro interno do servidor';

    console.error(err);
    return res.status(status).json({ code: err.code, message });
  }

  console.error(err);
  res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' });
}
