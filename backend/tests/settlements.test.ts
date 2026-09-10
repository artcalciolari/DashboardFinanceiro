import { beforeEach, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createPrismaMock } from './helpers/prismaMock';
const prisma = createPrismaMock();
vi.mock('../src/lib/prisma', () => ({ default: prisma }));
beforeEach(() => { vi.clearAllMocks(); });

it('records a partial reimbursement on a generated occurrence without editing its source', async () => {
  const { createApp } = await import('../src/app');
  prisma.transaction.findUniqueOrThrow.mockResolvedValue({ id: 't', type: 'EXPENSE', isThirdParty: true, amountCents: 1000, subscriptionId: 's' });
  prisma.transaction.update.mockImplementation(async ({ data }) => ({ id: 't', ...data }));
  const response = await request(createApp()).patch('/api/transactions/t/reimbursement')
    .send({ reimbursedAmountCents: 400, reimbursedAt: '2026-09-01T12:00:00.000Z' });
  expect(response.status).toBe(200);
  expect(response.body).toMatchObject({ reimbursedAmountCents: 400, isReimbursed: false });
});

it('records actual payment independently of the due date', async () => {
  const { createApp } = await import('../src/app');
  prisma.transaction.update.mockImplementation(async ({ data }) => ({ id: 't', ...data }));
  const response = await request(createApp()).patch('/api/transactions/t/settlement')
    .send({ paidAt: '2026-09-01T12:00:00.000Z' });
  expect(response.status).toBe(200);
  expect(response.body.paidAt).toBe('2026-09-01T12:00:00.000Z');
  expect(prisma.transaction.update).toHaveBeenCalledWith(expect.objectContaining({ data: { paidAt: new Date('2026-09-01T12:00:00.000Z') } }));
});

it('validates reimbursements, supports full receipt and reversal, and rejects unknown fields', async () => {
  const { createApp } = await import('../src/app');
  const app = createApp();
  const endpoint = '/api/transactions/t/reimbursement';
  const receipt = { reimbursedAmountCents: 100, reimbursedAt: '2026-09-01T12:00:00.000Z' };
  prisma.transaction.findUniqueOrThrow.mockResolvedValue({ id: 't', type: 'INCOME', isThirdParty: true, amountCents: 100 });
  expect((await request(app).patch(endpoint).send(receipt)).status).toBe(422);
  prisma.transaction.findUniqueOrThrow.mockResolvedValue({ id: 't', type: 'EXPENSE', isThirdParty: false, amountCents: 100 });
  expect((await request(app).patch(endpoint).send(receipt)).status).toBe(422);
  prisma.transaction.findUniqueOrThrow.mockResolvedValue({ id: 't', type: 'EXPENSE', isThirdParty: true, amountCents: 100 });
  expect((await request(app).patch(endpoint).send({ ...receipt, reimbursedAmountCents: 101 })).status).toBe(422);
  expect((await request(app).patch(endpoint).send({ ...receipt, reimbursedAt: null })).status).toBe(422);
  expect((await request(app).patch(endpoint).send({ ...receipt, reimbursedAmountCents: -1 })).status).toBe(422);
  expect((await request(app).patch(endpoint).send({ ...receipt, reimbursedAt: '2999-01-01T12:00:00Z' })).status).toBe(422);
  expect((await request(app).patch(endpoint).send({ ...receipt, amountCents: 200 })).status).toBe(422);
  prisma.transaction.update.mockImplementation(async ({ data }) => ({ id: 't', ...data }));
  expect((await request(app).patch(endpoint).send(receipt)).body.isReimbursed).toBe(true);
  expect((await request(app).patch(endpoint).send({ reimbursedAmountCents: 0, reimbursedAt: null })).body).toMatchObject({ isReimbursed: false, reimbursedAmountCents: 0, reimbursedAt: null });
  expect((await request(app).patch('/api/transactions/t/settlement').send({ paidAt: null })).body.paidAt).toBeNull();
  expect((await request(app).patch('/api/transactions/t/settlement').send({ paidAt: 'invalid' })).status).toBe(422);
});
