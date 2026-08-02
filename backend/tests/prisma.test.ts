import { describe, expect, it, vi } from 'vitest';

const PrismaClient = vi.fn(function PrismaClient(this: unknown) {
  return { tag: 'client' };
});

vi.mock('@prisma/client', () => ({ PrismaClient }));

describe('prisma client', () => {
  it('exports a PrismaClient instance', async () => {
    vi.resetModules();
    const mod = await import('../src/lib/prisma');
    expect(PrismaClient).toHaveBeenCalled();
    expect(mod.default).toEqual({ tag: 'client' });
  });
});
