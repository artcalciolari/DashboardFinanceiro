export type AccountType = 'BANK_ACCOUNT' | 'CREDIT_CARD' | 'CASH' | 'INVESTMENT';
export type CategoryType = 'INCOME' | 'EXPENSE';
export type TransactionType = 'INCOME' | 'EXPENSE';
export type AlertPeriod = 'MONTHLY' | 'WEEKLY';

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PageResponse<T> {
  items: T[];
  pagination: Pagination;
}

export interface SubscriptionPageResponse extends PageResponse<Subscription> {
  summary: { activeCount: number; monthlyTotalCents: number; thirdPartyTotalCents: number };
}

export interface CursorPageResponse<T> {
  items: T[];
  nextCursor: string | null;
}

export interface TransactionPageResponse extends CursorPageResponse<Transaction> {
  totalCount: number;
  totals: { incomeCents: number; expenseCents: number };
}

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  openingBalanceCents: number;
  color: string;
  creditLimitCents?: number | null;
  closingDay?: number | null;
  dueDay?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  type: CategoryType;
  color: string;
  icon?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  description: string;
  amountCents: number;
  type: TransactionType;
  date: string;
  effectiveDate: string;
  accountId: string;
  account: Account;
  categoryId: string;
  category: Category;
  installmentGroupId?: string | null;
  installmentNumber?: number | null;
  totalInstallments?: number | null;
  subscriptionId?: string | null;
  subscriptionYear?: number | null;
  subscriptionMonth?: number | null;
  subscription?: Subscription | null;
  isThirdParty: boolean;
  thirdPartyName?: string | null;
  isReimbursed: boolean;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InstallmentGroup {
  id: string;
  description: string;
  totalAmountCents: number;
  installmentCount: number;
  startDate: string;
  isThirdParty: boolean;
  thirdPartyName?: string | null;
  isReimbursed: boolean;
  isCancelled: boolean;
  cancelledAt?: string | null;
  accountId: string;
  account: Account;
  categoryId: string;
  category: Category;
  transactions?: Transaction[];
  paidCount?: number;
  futureCount?: number;
  historicalCount?: number;
  deletableFutureCount?: number;
  remainingAmountCents?: number;
  installmentAmountCents?: number;
  firstTransaction?: Transaction | null;
  nextTransaction?: Transaction | null;
  lastTransaction?: Transaction | null;
  createdAt: string;
  updatedAt: string;
}

export interface Subscription {
  id: string;
  name: string;
  amountCents: number;
  startDate: string;
  endDate?: string | null;
  billingDay: number;
  isActive: boolean;
  isThirdParty: boolean;
  thirdPartyName?: string | null;
  isReimbursed: boolean;
  notes?: string | null;
  accountId: string;
  account: Account;
  categoryId: string;
  category: Category;
  transactions?: Transaction[];
  occurrenceCount?: number;
  nextTransaction?: Transaction | null;
  createdAt: string;
  updatedAt: string;
}

export interface Alert {
  id: string;
  name: string;
  categoryId: string;
  category: Category;
  limitAmountCents: number;
  period: AlertPeriod;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AlertStatus extends Alert {
  currentAmountCents: number;
  percentage: number;
  isTriggered: boolean;
  isWarning: boolean;
}

export interface MonthlySummary {
  totalIncomeCents: number;
  totalExpensesCents: number;
  invoiceExpensesCents: number;
  thirdPartyExpensesCents: number;
  receivableAmountCents: number;
  balanceCents: number;
  month: number;
  year: number;
}

export interface CategorySummary {
  category: Category;
  type: TransactionType;
  totalCents: number;
}

export interface MonthlyEvolution {
  month: number;
  year: number;
  label: string;
  incomeCents: number;
  expensesCents: number;
}

export interface AccountSummary {
  account: Account;
  incomeCents: number;
  expensesCents: number;
  invoiceExpensesCents: number;
  thirdPartyExpensesCents: number;
  receivableCents: number;
  netCents: number;
}
