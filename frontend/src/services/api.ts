import axios from 'axios';
import type {
  Account,
  Category,
  Transaction,
  InstallmentGroup,
  Subscription,
  Alert,
  AlertStatus,
  MonthlySummary,
  CategorySummary,
  MonthlyEvolution,
  AccountSummary,
  PageResponse,
  TransactionPageResponse,
  SubscriptionPageResponse,
} from '../types';

const BASE_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

const api = axios.create({ baseURL: BASE_URL, timeout: 12_000 });

export function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message;
    if (typeof message === 'string') return message;
    if (error.code === 'ECONNABORTED') return 'A solicitação demorou demais. Tente novamente.';
    if (!error.response) return 'Não foi possível conectar ao servidor.';
  }

  return 'Não foi possível concluir a operação. Tente novamente.';
}

// ─── Accounts ────────────────────────────────────────────────────────────────

export const accountsApi = {
  getAll: () => api.get<Account[]>('/accounts').then((r) => r.data),
  create: (data: Partial<Account>) => api.post<Account>('/accounts', data).then((r) => r.data),
  update: (id: string, data: Partial<Account>) =>
    api.patch<Account>(`/accounts/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/accounts/${id}`),
};

// ─── Categories ──────────────────────────────────────────────────────────────

export const categoriesApi = {
  getAll: () => api.get<Category[]>('/categories').then((r) => r.data),
  create: (data: Partial<Category>) =>
    api.post<Category>('/categories', data).then((r) => r.data),
  update: (id: string, data: Partial<Category>) =>
    api.patch<Category>(`/categories/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/categories/${id}`),
};

// ─── Transactions ─────────────────────────────────────────────────────────────

export interface TransactionFilters {
  month?: number;
  year?: number;
  accountId?: string;
  categoryId?: string;
  type?: string;
  origin?: string;
  search?: string;
}

export const transactionsApi = {
  getPage: (filters?: TransactionFilters, cursor?: string | null, limit = 50) =>
    api.get<TransactionPageResponse>('/transactions', {
      params: { ...filters, cursor: cursor || undefined, limit },
    }).then((r) => r.data),
  create: (data: Partial<Transaction>) =>
    api.post<Transaction>('/transactions', data).then((r) => r.data),
  update: (id: string, data: Partial<Transaction>) =>
    api.patch<Transaction>(`/transactions/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/transactions/${id}`),
};

// ─── Installments ────────────────────────────────────────────────────────────

export const installmentsApi = {
  getPage: (page = 1, pageSize = 25, asOf?: string) =>
    api.get<PageResponse<InstallmentGroup>>('/installments', { params: { page, pageSize, asOf } }).then((r) => r.data),
  create: (data: {
    description: string;
    totalAmountCents: number;
    installmentCount: number;
    startDate: string;
    accountId: string;
    categoryId: string;
    isThirdParty?: boolean;
    thirdPartyName?: string | null;
    isReimbursed?: boolean;
    notes?: string;
  }) => api.post<InstallmentGroup>('/installments', data).then((r) => r.data),
  delete: (id: string, mode: 'future' | 'all' = 'future') =>
    api.delete(`/installments/${id}`, { params: { mode } }),
  updatePaymentDate: (id: string, firstPaymentDate: string) =>
    api.patch<InstallmentGroup>(`/installments/${id}/payment-date`, { firstPaymentDate }).then((r) => r.data),
};

// ─── Subscriptions ───────────────────────────────────────────────────────────

export const subscriptionsApi = {
  getPage: (page = 1, pageSize = 25, asOf?: string) =>
    api.get<SubscriptionPageResponse>('/subscriptions', { params: { page, pageSize, asOf } }).then((r) => r.data),
  create: (data: Partial<Subscription>) =>
    api.post<Subscription>('/subscriptions', data).then((r) => r.data),
  update: (id: string, data: Partial<Subscription>) =>
    api.patch<Subscription>(`/subscriptions/${id}`, data).then((r) => r.data),
  delete: (id: string, mode: 'future' | 'all' = 'future') =>
    api.delete(`/subscriptions/${id}`, { params: { mode } }),
};

// ─── Summary ─────────────────────────────────────────────────────────────────

export const summaryApi = {
  getMonthly: (month: number, year: number) =>
    api.get<MonthlySummary>('/summary/monthly', { params: { month, year } }).then((r) => r.data),
  getCategories: (month: number, year: number) =>
    api
      .get<CategorySummary[]>('/summary/categories', { params: { month, year } })
      .then((r) => r.data),
  getEvolution: () => api.get<MonthlyEvolution[]>('/summary/evolution').then((r) => r.data),
  getAccounts: (month: number, year: number) =>
    api
      .get<AccountSummary[]>('/summary/accounts', { params: { month, year } })
      .then((r) => r.data),
};

// ─── Alerts ──────────────────────────────────────────────────────────────────

export const alertsApi = {
  getAll: () => api.get<Alert[]>('/alerts').then((r) => r.data),
  check: () => api.get<AlertStatus[]>('/alerts/check').then((r) => r.data),
  create: (data: Partial<Alert>) => api.post<Alert>('/alerts', data).then((r) => r.data),
  update: (id: string, data: Partial<Alert>) =>
    api.patch<Alert>(`/alerts/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/alerts/${id}`),
};

// ─── Export ──────────────────────────────────────────────────────────────────

export const exportApi = {
  getCSVUrl: (month?: number, year?: number) => {
    const params = month && year ? `?month=${month}&year=${year}` : '';
    return `${BASE_URL}/export/csv${params}`;
  },
};

export default api;
