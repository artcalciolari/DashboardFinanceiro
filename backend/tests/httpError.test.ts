import { describe, expect, it } from 'vitest';
import { HttpError } from '../src/utils/httpError';

describe('HttpError', () => {
  it('stores status, code, message and optional details', () => {
    const error = new HttpError(404, 'missing', 'NOT_FOUND', { id: '1' });
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('HttpError');
    expect(error.status).toBe(404);
    expect(error.code).toBe('NOT_FOUND');
    expect(error.message).toBe('missing');
    expect(error.details).toEqual({ id: '1' });
  });

  it('defaults the code when omitted', () => {
    const error = new HttpError(400, 'bad');
    expect(error.code).toBe('REQUEST_ERROR');
    expect(error.details).toBeUndefined();
  });
});
