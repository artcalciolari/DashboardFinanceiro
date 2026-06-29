export type AccountType = 'BANK_ACCOUNT' | 'CREDIT_CARD' | 'CASH' | 'INVESTMENT';
export type CategoryType = 'INCOME' | 'EXPENSE';
export type TransactionType = 'INCOME' | 'EXPENSE';
export type AlertPeriod = 'MONTHLY' | 'WEEKLY';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
  color: string;
  creditLimit?: number | null;
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
  amount: number;
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
  totalAmount: number;
  installmentCount: number;
  startDate: string;
  isThirdParty: boolean;
  thirdPartyName?: string | null;
  isReimbursed: boolean;
  accountId: string;
  account: Account;
  categoryId: string;
  category: Category;
  transactions: Transaction[];
  createdAt: string;
  updatedAt: string;
}

export interface Subscription {
  id: string;
  name: string;
  amount: number;
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
  transactions: Transaction[];
  createdAt: string;
  updatedAt: string;
}

export interface Alert {
  id: string;
  name: string;
  categoryId: string;
  category: Category;
  limitAmount: number;
  period: AlertPeriod;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AlertStatus extends Alert {
  currentAmount: number;
  percentage: number;
  isTriggered: boolean;
  isWarning: boolean;
}

export interface MonthlySummary {
  totalIncome: number;
  totalExpenses: number;
  invoiceExpenses: number;
  thirdPartyExpenses: number;
  receivableAmount: number;
  balance: number;
  month: number;
  year: number;
}

export interface CategorySummary {
  category: Category;
  type: TransactionType;
  total: number;
}

export interface MonthlyEvolution {
  month: number;
  year: number;
  label: string;
  income: number;
  expenses: number;
}

export interface AccountSummary {
  account: Account;
  income: number;
  expenses: number;
  invoiceExpenses: number;
  thirdPartyExpenses: number;
  receivableAmount: number;
  net: number;
}
