import { describe, expect, it, vi } from 'vitest';
import { ZodError, z } from 'zod';
import { Prisma } from '@prisma/client';
import { errorHandler } from '../src/middleware/errorHandler';
import { HttpError } from '../src/utils/httpError';

function mockRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res;
}

describe('errorHandler', () => {
  it('maps Zod errors to 422', () => {
    const res = mockRes();
    let zodError: ZodError;
    try {
      z.object({ name: z.string().min(1) }).parse({ name: '' });
      throw new Error('expected zod failure');
    } catch (error) {
      zodError = error as ZodError;
    }
    errorHandler(zodError!, {} as never, res as never, vi.fn());
    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'VALIDATION_ERROR', message: 'Dados inválidos' })
    );
  });

  it('maps HttpError including optional details', () => {
    const res = mockRes();
    errorHandler(new HttpError(403, 'denied', 'FORBIDDEN', { reason: 'x' }), {} as never, res as never, vi.fn());
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      code: 'FORBIDDEN',
      message: 'denied',
      details: { reason: 'x' },
    });

    const resNoDetails = mockRes();
    errorHandler(new HttpError(400, 'bad'), {} as never, resNoDetails as never, vi.fn());
    expect(resNoDetails.json).toHaveBeenCalledWith({ code: 'REQUEST_ERROR', message: 'bad' });
  });

  it('maps Prisma known request errors', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    for (const [code, status, message] of [
      ['P2025', 404, 'Registro não encontrado'],
      ['P2002', 409, 'A operação conflita com dados existentes ou relacionados'],
      ['P2003', 409, 'A operação conflita com dados existentes ou relacionados'],
      ['P9999', 500, 'Erro interno do servidor'],
    ] as const) {
      const res = mockRes();
      const err = new Prisma.PrismaClientKnownRequestError('fail', {
        code,
        clientVersion: 'test',
      });
      errorHandler(err, {} as never, res as never, vi.fn());
      expect(res.status).toHaveBeenCalledWith(status);
      expect(res.json).toHaveBeenCalledWith({ code, message });
    }
    consoleSpy.mockRestore();
  });

  it('maps unknown errors to 500', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const res = mockRes();
    errorHandler(new Error('boom'), {} as never, res as never, vi.fn());
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      code: 'INTERNAL_ERROR',
      message: 'Erro interno do servidor',
    });
    consoleSpy.mockRestore();
  });
});
