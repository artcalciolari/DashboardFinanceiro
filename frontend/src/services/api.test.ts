import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AxiosInstance } from 'axios';

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPatch = vi.fn();
const mockDelete = vi.fn();
const mockIsAxiosError = vi.fn();

vi.mock('axios', () => {
  const create = vi.fn(() => ({
    get: mockGet,
    post: mockPost,
    patch: mockPatch,
    delete: mockDelete,
  }));
  return {
    default: {
      create,
      isAxiosError: (...args: unknown[]) => mockIsAxiosError(...args),
    },
  };
});

describe('api service', () => {
  beforeEach(() => {
    vi.resetModules();
    mockGet.mockReset();
    mockPost.mockReset();
    mockPatch.mockReset();
    mockDelete.mockReset();
    mockIsAxiosError.mockReset();
  });

  async function loadApi() {
    return import('./api');
  }

  describe('getApiErrorMessage', () => {
    it('returns server message from axios error', async () => {
      const { getApiErrorMessage } = await loadApi();
      mockIsAxiosError.mockReturnValue(true);
      expect(
        getApiErrorMessage({
          response: { data: { message: 'Conta não encontrada' } },
        })
      ).toBe('Conta não encontrada');
    });

    it('returns timeout message for ECONNABORTED', async () => {
      const { getApiErrorMessage } = await loadApi();
      mockIsAxiosError.mockReturnValue(true);
      expect(getApiErrorMessage({ code: 'ECONNABORTED' })).toBe(
        'A solicitação demorou demais. Tente novamente.'
      );
    });

    it('returns connection message when no response', async () => {
      const { getApiErrorMessage } = await loadApi();
      mockIsAxiosError.mockReturnValue(true);
      expect(getApiErrorMessage({ code: 'ERR_NETWORK' })).toBe(
        'Não foi possível conectar ao servidor.'
      );
    });

    it('returns generic message for non-axios errors', async () => {
      const { getApiErrorMessage } = await loadApi();
      mockIsAxiosError.mockReturnValue(false);
      expect(getApiErrorMessage(new Error('x'))).toBe(
        'Não foi possível concluir a operação. Tente novamente.'
      );
    });

    it('falls through when axios message is not a string', async () => {
      const { getApiErrorMessage } = await loadApi();
      mockIsAxiosError.mockReturnValue(true);
      expect(
        getApiErrorMessage({
          response: { data: { message: { nested: true } } },
        })
      ).toBe('Não foi possível concluir a operação. Tente novamente.');
    });
  });

  describe('API methods', () => {
    it('accountsApi methods', async () => {
      const { accountsApi } = await loadApi();
      mockGet.mockResolvedValue({ data: [{ id: '1' }] });
      mockPost.mockResolvedValue({ data: { id: '1' } });
      mockPatch.mockResolvedValue({ data: { id: '1' } });
      mockDelete.mockResolvedValue({});

      await expect(accountsApi.getAll()).resolves.toEqual([{ id: '1' }]);
      expect(mockGet).toHaveBeenCalledWith('/accounts');

      await accountsApi.create({ name: 'A' });
      expect(mockPost).toHaveBeenCalledWith('/accounts', { name: 'A' });

      await accountsApi.update('1', { name: 'B' });
      expect(mockPatch).toHaveBeenCalledWith('/accounts/1', { name: 'B' });

      await accountsApi.delete('1');
      expect(mockDelete).toHaveBeenCalledWith('/accounts/1');
    });

    it('categoriesApi methods', async () => {
      const { categoriesApi } = await loadApi();
      mockGet.mockResolvedValue({ data: [] });
      mockPost.mockResolvedValue({ data: {} });
      mockPatch.mockResolvedValue({ data: {} });
      mockDelete.mockResolvedValue({});

      await categoriesApi.getAll();
      await categoriesApi.create({ name: 'C' });
      await categoriesApi.update('1', { name: 'D' });
      await categoriesApi.delete('1');

      expect(mockGet).toHaveBeenCalledWith('/categories');
      expect(mockPost).toHaveBeenCalledWith('/categories', { name: 'C' });
      expect(mockPatch).toHaveBeenCalledWith('/categories/1', { name: 'D' });
      expect(mockDelete).toHaveBeenCalledWith('/categories/1');
    });

    it('transactionsApi methods', async () => {
      const { transactionsApi } = await loadApi();
      mockGet.mockResolvedValue({ data: { items: [] } });
      mockPost.mockResolvedValue({ data: {} });
      mockPatch.mockResolvedValue({ data: {} });
      mockDelete.mockResolvedValue({});

      await transactionsApi.getPage({ month: 6, year: 2024 }, null, 50);
      expect(mockGet).toHaveBeenCalledWith('/transactions', {
        params: { month: 6, year: 2024, cursor: undefined, limit: 50 },
      });

      await transactionsApi.getPage(undefined, 'cursor-1');
      expect(mockGet).toHaveBeenCalledWith('/transactions', {
        params: { cursor: 'cursor-1', limit: 50 },
      });

      await transactionsApi.create({ description: 'x' });
      await transactionsApi.update('1', { description: 'y' });
      await transactionsApi.delete('1');
      expect(mockPost).toHaveBeenCalled();
      expect(mockPatch).toHaveBeenCalledWith('/transactions/1', { description: 'y' });
      expect(mockDelete).toHaveBeenCalledWith('/transactions/1');
    });

    it('installmentsApi methods', async () => {
      const { installmentsApi } = await loadApi();
      mockGet.mockResolvedValue({ data: { items: [] } });
      mockPost.mockResolvedValue({ data: {} });
      mockPatch.mockResolvedValue({ data: {} });
      mockDelete.mockResolvedValue({});

      await installmentsApi.getPage(2, 10, '2024-06-30');
      expect(mockGet).toHaveBeenCalledWith('/installments', {
        params: { page: 2, pageSize: 10, asOf: '2024-06-30' },
      });

      await installmentsApi.getPage();
      expect(mockGet).toHaveBeenCalledWith('/installments', {
        params: { page: 1, pageSize: 25, asOf: undefined },
      });

      await installmentsApi.create({
        description: 'Notebook',
        totalAmountCents: 1000,
        installmentCount: 2,
        startDate: '2024-01-01',
        accountId: 'a',
        categoryId: 'c',
      });
      await installmentsApi.delete('1');
      expect(mockDelete).toHaveBeenCalledWith('/installments/1', { params: { mode: 'future' } });
      await installmentsApi.delete('1', 'all');
      expect(mockDelete).toHaveBeenCalledWith('/installments/1', { params: { mode: 'all' } });
      await installmentsApi.updatePaymentDate('1', '2024-02-01');
      expect(mockPatch).toHaveBeenCalledWith('/installments/1/payment-date', {
        firstPaymentDate: '2024-02-01',
      });
    });

    it('subscriptionsApi methods', async () => {
      const { subscriptionsApi } = await loadApi();
      mockGet.mockResolvedValue({ data: { items: [] } });
      mockPost.mockResolvedValue({ data: {} });
      mockPatch.mockResolvedValue({ data: {} });
      mockDelete.mockResolvedValue({});

      await subscriptionsApi.getPage();
      await subscriptionsApi.create({ name: 'Spotify' });
      await subscriptionsApi.update('1', { name: 'X' });
      await subscriptionsApi.delete('1');
      await subscriptionsApi.delete('1', 'all');

      expect(mockGet).toHaveBeenCalledWith('/subscriptions', {
        params: { page: 1, pageSize: 25, asOf: undefined },
      });
      expect(mockDelete).toHaveBeenCalledWith('/subscriptions/1', { params: { mode: 'all' } });
    });

    it('summaryApi methods', async () => {
      const { summaryApi } = await loadApi();
      mockGet.mockResolvedValue({ data: {} });

      await summaryApi.getMonthly(6, 2024);
      await summaryApi.getCategories(6, 2024);
      await summaryApi.getEvolution();
      await summaryApi.getAccounts(6, 2024);

      expect(mockGet).toHaveBeenCalledWith('/summary/monthly', { params: { month: 6, year: 2024 } });
      expect(mockGet).toHaveBeenCalledWith('/summary/categories', { params: { month: 6, year: 2024 } });
      expect(mockGet).toHaveBeenCalledWith('/summary/evolution');
      expect(mockGet).toHaveBeenCalledWith('/summary/accounts', { params: { month: 6, year: 2024 } });
    });

    it('alertsApi methods', async () => {
      const { alertsApi } = await loadApi();
      mockGet.mockResolvedValue({ data: [] });
      mockPost.mockResolvedValue({ data: {} });
      mockPatch.mockResolvedValue({ data: {} });
      mockDelete.mockResolvedValue({});

      await alertsApi.getAll();
      await alertsApi.check();
      await alertsApi.create({ name: 'A' });
      await alertsApi.update('1', { isActive: false });
      await alertsApi.delete('1');

      expect(mockGet).toHaveBeenCalledWith('/alerts');
      expect(mockGet).toHaveBeenCalledWith('/alerts/check');
    });

    it('exportApi.getCSVUrl with and without params', async () => {
      const { exportApi } = await loadApi();
      expect(exportApi.getCSVUrl()).toMatch(/\/export\/csv$/);
      expect(exportApi.getCSVUrl(6, 2024)).toMatch(/\/export\/csv\?month=6&year=2024$/);
      expect(exportApi.getCSVUrl(6)).toMatch(/\/export\/csv$/);
    });

    it('exports default axios instance', async () => {
      const mod = await loadApi();
      expect(mod.default).toBeTruthy();
      const instance = mod.default as AxiosInstance;
      expect(instance.get).toBe(mockGet);
    });

    it('uses VITE_API_URL when set', async () => {
      vi.stubEnv('VITE_API_URL', 'http://api.example.com');
      vi.resetModules();
      mockGet.mockReset();
      mockPost.mockReset();
      mockPatch.mockReset();
      mockDelete.mockReset();
      mockIsAxiosError.mockReset();

      const axios = await import('axios');
      const createMock = vi.mocked(axios.default.create);
      createMock.mockClear();
      await import('./api');
      expect(createMock).toHaveBeenCalledWith(
        expect.objectContaining({ baseURL: 'http://api.example.com/api' })
      );
      vi.unstubAllEnvs();
    });
  });
});
