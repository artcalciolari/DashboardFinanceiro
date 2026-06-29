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
} from '../types';

const BASE_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

const api = axios.create({ baseURL: BASE_URL });

// ─── Accounts ────────────────────────────────────────────────────────────────

export const accountsApi = {
  getAll: () => api.get<Account[]>('/accounts').then((r) => r.data),
  create: (data: Partial<Account>) => api.post<Account>('/accounts', data).then((r) => r.data),
  update: (id: string, data: Partial<Account>) =>
    api.put<Account>(`/accounts/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/accounts/${id}`),
};

// ─── Categories ──────────────────────────────────────────────────────────────

export const categoriesApi = {
  getAll: () => api.get<Category[]>('/categories').then((r) => r.data),
  create: (data: Partial<Category>) =>
    api.post<Category>('/categories', data).then((r) => r.data),
  update: (id: string, data: Partial<Category>) =>
    api.put<Category>(`/categories/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/categories/${id}`),
};

// ─── Transactions ─────────────────────────────────────────────────────────────

export interface TransactionFilters {
  month?: number;
  year?: number;
  accountId?: string;
  categoryId?: string;
  type?: string;
}

export const transactionsApi = {
  getAll: (filters?: TransactionFilters) =>
    api.get<Transaction[]>('/transactions', { params: filters }).then((r) => r.data),
  create: (data: Partial<Transaction>) =>
    api.post<Transaction>('/transactions', data).then((r) => r.data),
  update: (id: string, data: Partial<Transaction>) =>
    api.put<Transaction>(`/transactions/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/transactions/${id}`),
};

// ─── Installments ────────────────────────────────────────────────────────────

export const installmentsApi = {
  getAll: () => api.get<InstallmentGroup[]>('/installments').then((r) => r.data),
  create: (data: {
    description: string;
    totalAmount: number;
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
  getAll: () => api.get<Subscription[]>('/subscriptions').then((r) => r.data),
  create: (data: Partial<Subscription>) =>
    api.post<Subscription>('/subscriptions', data).then((r) => r.data),
  update: (id: string, data: Partial<Subscription>) =>
    api.put<Subscription>(`/subscriptions/${id}`, data).then((r) => r.data),
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
    api.put<Alert>(`/alerts/${id}`, data).then((r) => r.data),
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
