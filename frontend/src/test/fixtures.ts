import type {
  Account,
  Alert,
  AlertStatus,
  Category,
  InstallmentGroup,
  MonthlyEvolution,
  MonthlySummary,
  CategorySummary,
  AccountSummary,
  Subscription,
  Transaction,
  TransactionPageResponse,
  PageResponse,
  SubscriptionPageResponse,
} from '../types';

export const mockAccount: Account = {
  id: 'acc-1',
  name: 'Nubank',
  type: 'BANK_ACCOUNT',
  openingBalanceCents: 150000,
  color: '#820AD1',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

export const mockCreditCard: Account = {
  id: 'acc-2',
  name: 'Cartão XP',
  type: 'CREDIT_CARD',
  openingBalanceCents: 0,
  color: '#111827',
  creditLimitCents: 500000,
  closingDay: 10,
  dueDay: 17,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

export const mockCashAccount: Account = {
  id: 'acc-3',
  name: 'Carteira',
  type: 'CASH',
  openingBalanceCents: 5000,
  color: '#22C55E',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

export const mockInvestment: Account = {
  id: 'acc-4',
  name: 'Tesouro',
  type: 'INVESTMENT',
  openingBalanceCents: 1000000,
  color: '#3B82F6',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

export const mockExpenseCategory: Category = {
  id: 'cat-1',
  name: 'Alimentação',
  type: 'EXPENSE',
  color: '#EF4444',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

export const mockIncomeCategory: Category = {
  id: 'cat-2',
  name: 'Salário',
  type: 'INCOME',
  color: '#22C55E',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

export const mockTransaction: Transaction = {
  id: 'tx-1',
  description: 'Mercado',
  amountCents: 12550,
  type: 'EXPENSE',
  date: '2024-06-15T12:00:00.000Z',
  effectiveDate: '2024-06-15T12:00:00.000Z',
  accountId: mockAccount.id,
  account: mockAccount,
  categoryId: mockExpenseCategory.id,
  category: mockExpenseCategory,
  isThirdParty: false,
  isReimbursed: false,
  createdAt: '2024-06-15T12:00:00.000Z',
  updatedAt: '2024-06-15T12:00:00.000Z',
};

export const mockIncomeTransaction: Transaction = {
  ...mockTransaction,
  id: 'tx-2',
  description: 'Salário junho',
  amountCents: 500000,
  type: 'INCOME',
  categoryId: mockIncomeCategory.id,
  category: mockIncomeCategory,
};

export const mockInstallmentTransaction: Transaction = {
  ...mockTransaction,
  id: 'tx-3',
  description: 'Notebook',
  installmentGroupId: 'inst-1',
  installmentNumber: 2,
  totalInstallments: 10,
  amountCents: 30000,
};

export const mockSubscriptionTransaction: Transaction = {
  ...mockTransaction,
  id: 'tx-4',
  description: 'Spotify',
  subscriptionId: 'sub-1',
  subscriptionYear: 2024,
  subscriptionMonth: 6,
  amountCents: 2190,
};

export const mockThirdPartyTransaction: Transaction = {
  ...mockTransaction,
  id: 'tx-5',
  description: 'Uber amigo',
  isThirdParty: true,
  thirdPartyName: 'Lucas',
  isReimbursed: false,
};

export function makeTransactionPage(
  items: Transaction[] = [mockTransaction],
  overrides: Partial<TransactionPageResponse> = {}
): TransactionPageResponse {
  return {
    items,
    nextCursor: null,
    totalCount: items.length,
    totals: {
      incomeCents: items.filter((t) => t.type === 'INCOME').reduce((s, t) => s + t.amountCents, 0),
      expenseCents: items.filter((t) => t.type === 'EXPENSE').reduce((s, t) => s + t.amountCents, 0),
    },
    ...overrides,
  };
}

export const mockInstallmentGroup: InstallmentGroup = {
  id: 'inst-1',
  description: 'Notebook',
  totalAmountCents: 300000,
  installmentCount: 10,
  startDate: '2024-01-10T12:00:00.000Z',
  isThirdParty: false,
  isReimbursed: false,
  isCancelled: false,
  accountId: mockCreditCard.id,
  account: mockCreditCard,
  categoryId: mockExpenseCategory.id,
  category: mockExpenseCategory,
  paidCount: 3,
  futureCount: 7,
  historicalCount: 3,
  deletableFutureCount: 7,
  remainingAmountCents: 210000,
  installmentAmountCents: 30000,
  firstTransaction: {
    ...mockInstallmentTransaction,
    id: 'tx-inst-1',
    installmentNumber: 1,
    effectiveDate: '2024-01-17T12:00:00.000Z',
  },
  nextTransaction: {
    ...mockInstallmentTransaction,
    id: 'tx-inst-4',
    installmentNumber: 4,
    effectiveDate: '2024-04-17T12:00:00.000Z',
  },
  lastTransaction: {
    ...mockInstallmentTransaction,
    id: 'tx-inst-10',
    installmentNumber: 10,
    effectiveDate: '2024-10-17T12:00:00.000Z',
  },
  createdAt: '2024-01-10T12:00:00.000Z',
  updatedAt: '2024-01-10T12:00:00.000Z',
};

export function makeInstallmentsPage(
  items: InstallmentGroup[] = [mockInstallmentGroup],
  pagination = { page: 1, pageSize: 25, total: items.length, totalPages: 1 }
): PageResponse<InstallmentGroup> {
  return { items, pagination };
}

export const mockSubscription: Subscription = {
  id: 'sub-1',
  name: 'Spotify Premium',
  amountCents: 2190,
  startDate: '2024-01-01T12:00:00.000Z',
  billingDay: 5,
  isActive: true,
  isThirdParty: false,
  isReimbursed: false,
  accountId: mockAccount.id,
  account: mockAccount,
  categoryId: mockExpenseCategory.id,
  category: mockExpenseCategory,
  nextTransaction: {
    ...mockSubscriptionTransaction,
    effectiveDate: '2024-07-05T12:00:00.000Z',
  },
  createdAt: '2024-01-01T12:00:00.000Z',
  updatedAt: '2024-01-01T12:00:00.000Z',
};

export function makeSubscriptionsPage(
  items: Subscription[] = [mockSubscription],
  summary = { activeCount: 1, monthlyTotalCents: 2190, thirdPartyTotalCents: 0 },
  pagination = { page: 1, pageSize: 25, total: items.length, totalPages: 1 }
): SubscriptionPageResponse {
  return { items, summary, pagination };
}

export const mockAlert: Alert = {
  id: 'alert-1',
  name: 'Limite alimentação',
  categoryId: mockExpenseCategory.id,
  category: mockExpenseCategory,
  limitAmountCents: 100000,
  period: 'MONTHLY',
  isActive: true,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

export const mockAlertStatus: AlertStatus = {
  ...mockAlert,
  currentAmountCents: 85000,
  percentage: 85,
  isTriggered: false,
  isWarning: true,
};

export const mockMonthlySummary: MonthlySummary = {
  totalIncomeCents: 500000,
  totalExpensesCents: 200000,
  invoiceExpensesCents: 80000,
  thirdPartyExpensesCents: 10000,
  receivableAmountCents: 5000,
  balanceCents: 300000,
  month: 6,
  year: 2024,
};

export const mockEvolution: MonthlyEvolution[] = [
  { month: 4, year: 2024, label: 'Abr/24', incomeCents: 400000, expensesCents: 250000 },
  { month: 5, year: 2024, label: 'Mai/24', incomeCents: 450000, expensesCents: 300000 },
  { month: 6, year: 2024, label: 'Jun/24', incomeCents: 500000, expensesCents: 200000 },
];

export const mockCategorySummaries: CategorySummary[] = [
  { category: mockExpenseCategory, type: 'EXPENSE', totalCents: 120000 },
  { category: { ...mockExpenseCategory, id: 'cat-3', name: 'Transporte', color: '#3B82F6' }, type: 'EXPENSE', totalCents: 40000 },
  { category: mockIncomeCategory, type: 'INCOME', totalCents: 500000 },
];

export const mockAccountSummaries: AccountSummary[] = [
  {
    account: mockAccount,
    incomeCents: 500000,
    expensesCents: 100000,
    invoiceExpensesCents: 0,
    thirdPartyExpensesCents: 0,
    receivableCents: 0,
    netCents: 400000,
  },
  {
    account: mockCreditCard,
    incomeCents: 0,
    expensesCents: 50000,
    invoiceExpensesCents: 80000,
    thirdPartyExpensesCents: 10000,
    receivableCents: 5000,
    netCents: -50000,
  },
];
