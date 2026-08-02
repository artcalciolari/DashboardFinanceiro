import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createPrismaMock } from './helpers/prismaMock';

const prisma = createPrismaMock();

vi.mock('../src/lib/prisma', () => ({ default: prisma }));
vi.mock('../src/services/subscriptionService', () => ({
  ensureSubscriptionTransactions: vi.fn().mockResolvedValue(undefined),
  getSubscriptionHorizon: vi.fn(() => new Date(2027, 7, 31, 23, 59, 59)),
  resetSubscriptionTransactionHorizon: vi.fn(),
}));

function tx(overrides: Record<string, unknown> = {}) {
  return {
    id: 't1',
    date: new Date(2026, 7, 2, 12),
    effectiveDate: new Date(2026, 7, 2, 12),
    description: '=1+1',
    amountCents: 1500,
    type: 'EXPENSE',
    installmentNumber: 1,
    totalInstallments: 3,
    isThirdParty: true,
    thirdPartyName: '+Danger',
    isReimbursed: false,
    notes: '@note',
    account: { name: '-Account' },
    category: { name: 'Food' },
    subscription: { name: '\tSub' },
    ...overrides,
  };
}

describe('export CSV', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('streams all transactions with formula-safe cells and pagination', async () => {
    const { createApp } = await import('../src/app');
    const app = createApp();

    const page = Array.from({ length: 500 }, (_, i) =>
      tx({
        id: `p${i}`,
        effectiveDate: new Date(2026, 0, 1 + (i % 28), 12),
        description: `row ${i}`,
        type: i % 2 === 0 ? 'EXPENSE' : 'INCOME',
        installmentNumber: null,
        totalInstallments: null,
        isThirdParty: false,
        thirdPartyName: null,
        isReimbursed: false,
        notes: null,
        subscription: null,
        account: { name: 'Bank' },
        category: { name: 'Cat' },
      })
    );
    const remainder = [tx({ id: 'last', description: '=HACK', isReimbursed: true })];

    prisma.transaction.findMany
      .mockResolvedValueOnce(page)
      .mockResolvedValueOnce(remainder);

    const response = await request(app).get('/api/export/csv');
    expect(response.status).toBe(200);
    expect(response.headers['content-disposition']).toContain('financeiro_todos.csv');
    expect(response.text).toContain("'=HACK");
    expect(response.text).toContain("'+Danger");
    expect(response.text).toContain('Receita');
    expect(prisma.transaction.findMany).toHaveBeenCalledTimes(2);
  });

  it('exports a single period and stops on an empty first page', async () => {
    const { createApp } = await import('../src/app');
    const app = createApp();

    prisma.transaction.findMany.mockResolvedValueOnce([]);
    const empty = await request(app).get('/api/export/csv?month=8&year=2026');
    expect(empty.status).toBe(200);
    expect(empty.headers['content-disposition']).toContain('financeiro_08_2026.csv');

    prisma.transaction.findMany.mockResolvedValueOnce([
      tx({ subscription: null, installmentNumber: null, notes: null, thirdPartyName: null, isThirdParty: false }),
    ]);
    const period = await request(app).get('/api/export/csv?month=8&year=2026');
    expect(period.status).toBe(200);
    expect(period.text).toContain('Não');
  });

  it('destroys the response when an error happens after headers are sent', async () => {
    const { exportCSV } = await import('../src/controllers/exportController');
    prisma.transaction.findMany.mockRejectedValue(new Error('stream fail'));

    const res = Object.assign(new EventEmitter(), {
      headersSent: true,
      setHeader: vi.fn(),
      write: vi.fn().mockReturnValue(true),
      end: vi.fn(),
      destroy: vi.fn(),
    });
    const next = vi.fn();

    await exportCSV({ query: {} } as never, res as never, next);
    expect(res.destroy).toHaveBeenCalledWith(expect.any(Error));
    expect(next).not.toHaveBeenCalled();

    prisma.transaction.findMany.mockRejectedValue('not-an-error');
    const res2 = Object.assign(new EventEmitter(), {
      headersSent: true,
      setHeader: vi.fn(),
      write: vi.fn().mockReturnValue(true),
      end: vi.fn(),
      destroy: vi.fn(),
    });
    await exportCSV({ query: {} } as never, res2 as never, vi.fn());
    expect(res2.destroy).toHaveBeenCalledWith(undefined);
  });
  it('waits for drain when the response buffer is full and forwards pre-header errors', async () => {
    const { exportCSV } = await import('../src/controllers/exportController');
    prisma.transaction.findMany.mockResolvedValueOnce([tx({ id: 'drain' })]);

    const res = Object.assign(new EventEmitter(), {
      headersSent: false,
      setHeader: vi.fn(),
      write: vi
        .fn()
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false),
      end: vi.fn(),
      destroy: vi.fn(),
    });
    const next = vi.fn();

    const pending = exportCSV({ query: {} } as never, res as never, next);
    setTimeout(() => res.emit('drain'), 0);
    await pending;
    expect(res.end).toHaveBeenCalled();

    prisma.transaction.findMany.mockRejectedValueOnce(new Error('before headers'));
    const res2 = Object.assign(new EventEmitter(), {
      headersSent: false,
      setHeader: vi.fn(),
      write: vi.fn(),
      end: vi.fn(),
      destroy: vi.fn(),
    });
    const next2 = vi.fn();
    await exportCSV({ query: { month: '8', year: '2026' } } as never, res2 as never, next2);
    expect(next2).toHaveBeenCalled();
  });
});
