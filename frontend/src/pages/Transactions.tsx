import { useDeferredValue, useMemo, useState } from 'react';
import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Pencil, Trash2, SlidersHorizontal, X, AlertCircle } from 'lucide-react';
import { transactionsApi, accountsApi, categoriesApi, getApiErrorMessage } from '../services/api';
import { useDate } from '../context/DateContext';
import { useSearch } from '../context/SearchContext';
import { useTransactionModal } from '../context/TransactionModalContext';
import { formatCurrency, formatDate, formatMonthYear } from '../utils/formatters';
import type { Transaction } from '../types';
import Button from '../components/ui/Button';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import EmptyState from '../components/ui/EmptyState';
import Skeleton from '../components/ui/Skeleton';
import { clsx } from 'clsx';

type TypeFilter = 'all' | 'INCOME' | 'EXPENSE';
type OriginFilter = 'all' | 'single' | 'installment' | 'subscription' | 'thirdParty';

const originOptions: { key: OriginFilter; label: string }[] = [
  { key: 'all', label: 'Todas as origens' },
  { key: 'single', label: 'Lançamentos avulsos' },
  { key: 'installment', label: 'Parcelas' },
  { key: 'subscription', label: 'Assinaturas' },
  { key: 'thirdParty', label: 'De terceiros' },
];

export default function Transactions() {
  const { month, year } = useDate();
  const { search, setSearch } = useSearch();
  const { openEdit } = useTransactionModal();
  const qc = useQueryClient();

  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [accountFilter, setAccountFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [originFilter, setOriginFilter] = useState<OriginFilter>('all');
  const [showFilters, setShowFilters] = useState(false);

  const deferredSearch = useDeferredValue(search.trim());
  const transactionQuery = useInfiniteQuery({
    queryKey: [
      'transactions', month, year, typeFilter, accountFilter, categoryFilter, originFilter, deferredSearch,
    ],
    queryFn: ({ pageParam }) => transactionsApi.getPage({
      month,
      year,
      type: typeFilter === 'all' ? undefined : typeFilter,
      accountId: accountFilter === 'all' ? undefined : accountFilter,
      categoryId: categoryFilter === 'all' ? undefined : categoryFilter,
      origin: originFilter === 'all' ? undefined : originFilter,
      search: deferredSearch || undefined,
    }, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
  const { isLoading, isError, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = transactionQuery;
  const transactions = useMemo(
    () => transactionQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [transactionQuery.data]
  );

  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: accountsApi.getAll });
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: categoriesApi.getAll });

  const deleteMutation = useMutation({
    mutationFn: transactionsApi.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['summary'] });
      setDeleteTarget(null);
    },
  });

  const filtered = transactions;

  const firstPage = transactionQuery.data?.pages[0];
  const sumIncome = firstPage?.totals.incomeCents ?? 0;
  const sumExpense = firstPage?.totals.expenseCents ?? 0;
  const totalCount = firstPage?.totalCount ?? 0;
  const advancedFilterCount =
    (accountFilter !== 'all' ? 1 : 0) + (categoryFilter !== 'all' ? 1 : 0) + (originFilter !== 'all' ? 1 : 0);
  const hasActiveFilters = typeFilter !== 'all' || deferredSearch.length > 0 || advancedFilterCount > 0;

  function resetFilters() {
    setTypeFilter('all');
    setAccountFilter('all');
    setCategoryFilter('all');
    setOriginFilter('all');
    setSearch('');
  }

  function selectType(type: TypeFilter) {
    setTypeFilter(type);
    // categoria de tipo oposto nunca teria resultados — solta o filtro
    if (type !== 'all' && categoryFilter !== 'all') {
      const selected = categories.find((c) => c.id === categoryFilter);
      if (selected && selected.type !== type) setCategoryFilter('all');
    }
  }

  const visibleCategories = typeFilter === 'all' ? categories : categories.filter((c) => c.type === typeFilter);
  const incomeCategories = visibleCategories.filter((c) => c.type === 'INCOME');
  const expenseCategories = visibleCategories.filter((c) => c.type === 'EXPENSE');

  const selectClass =
    'h-10 rounded-control border border-border bg-white px-3 pr-8 text-[13px] font-medium text-ink outline-none transition-shadow focus:border-forest focus:shadow-focus-forest';

  const segments: { key: TypeFilter; label: string }[] = [
    { key: 'all', label: 'Todas' },
    { key: 'INCOME', label: 'Receitas' },
    { key: 'EXPENSE', label: 'Despesas' },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-display-lg tracking-tight text-ink">Transações</h1>
        <p className="mt-1 text-[13.5px] text-muted">
          {totalCount} lançamento{totalCount === 1 ? '' : 's'} · <span className="capitalize">{formatMonthYear(month, year)}</span>
        </p>
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex gap-0.5 rounded-[12px] bg-chip p-1">
            {segments.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => selectType(s.key)}
                className={clsx(
                  'rounded-[9px] px-4 py-1.5 text-[13px] transition-all duration-150',
                  typeFilter === s.key
                    ? 'bg-white text-forest font-semibold shadow-card'
                    : 'text-muted font-medium hover:text-ink'
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            aria-expanded={showFilters}
            aria-controls="transaction-filters"
            className={clsx(
              'inline-flex h-[38px] items-center gap-2 rounded-control border px-3.5 text-[13px] font-semibold transition-colors',
              showFilters || advancedFilterCount > 0
                ? 'border-forest/25 bg-white text-forest shadow-card'
                : 'border-transparent bg-chip text-muted hover:text-ink'
            )}
          >
            <SlidersHorizontal size={14} />
            Filtros
            {advancedFilterCount > 0 && (
              <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-forest px-1 text-[11px] font-bold text-white">
                {advancedFilterCount}
              </span>
            )}
          </button>
        </div>
        <div className="flex items-center gap-6 rounded-card border border-border bg-card px-5 py-3 shadow-card">
          <div>
            <div className="eyebrow">Entradas</div>
            <div className="tabular font-display text-[15px] font-bold text-income">{formatCurrency(sumIncome)}</div>
          </div>
          <div className="h-8 w-px bg-border-faint" />
          <div>
            <div className="eyebrow">Saídas</div>
            <div className="tabular font-display text-[15px] font-bold text-expense">{formatCurrency(sumExpense)}</div>
          </div>
          <div className="h-8 w-px bg-border-faint" />
          <div>
            <div className="eyebrow">Saldo</div>
            <div className="tabular font-display text-[15px] font-bold text-ink">{formatCurrency(sumIncome - sumExpense)}</div>
          </div>
        </div>
      </div>

      {showFilters && (
        <div
          id="transaction-filters"
          className="mb-5 flex flex-wrap items-end gap-3 rounded-card border border-border bg-card px-5 py-4 shadow-card animate-sc-fade"
        >
          <div className="flex min-w-[180px] flex-1 flex-col gap-1.5 sm:max-w-[240px]">
            <label htmlFor="filter-account" className="text-[11.5px] font-semibold text-muted">
              Conta
            </label>
            <select
              id="filter-account"
              value={accountFilter}
              onChange={(e) => setAccountFilter(e.target.value)}
              className={selectClass}
            >
              <option value="all">Todas as contas</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex min-w-[180px] flex-1 flex-col gap-1.5 sm:max-w-[240px]">
            <label htmlFor="filter-category" className="text-[11.5px] font-semibold text-muted">
              Categoria
            </label>
            <select
              id="filter-category"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className={selectClass}
            >
              <option value="all">Todas as categorias</option>
              {typeFilter === 'all' ? (
                <>
                  <optgroup label="Receitas">
                    {incomeCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Despesas">
                    {expenseCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </optgroup>
                </>
              ) : (
                visibleCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))
              )}
            </select>
          </div>
          <div className="flex min-w-[180px] flex-1 flex-col gap-1.5 sm:max-w-[240px]">
            <label htmlFor="filter-origin" className="text-[11.5px] font-semibold text-muted">
              Origem
            </label>
            <select
              id="filter-origin"
              value={originFilter}
              onChange={(e) => setOriginFilter(e.target.value as OriginFilter)}
              className={selectClass}
            >
              {originOptions.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold text-muted transition-colors hover:bg-chip hover:text-ink"
            >
              <X size={14} />
              Limpar filtros
            </button>
          )}
        </div>
      )}

      <div className="overflow-hidden rounded-card border border-border bg-card shadow-card">
        {isError ? (
          <div className="flex flex-col items-center px-6 py-14 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-expense/10">
              <AlertCircle size={24} className="text-expense" strokeWidth={1.8} />
            </div>
            <h3 className="font-display text-[16px] font-semibold text-ink">Não foi possível carregar as transações</h3>
            <p className="mt-1.5 max-w-[320px] text-[13px] text-faint">{getApiErrorMessage(error)}</p>
            <Button variant="secondary" size="sm" className="mt-5" onClick={() => refetch()}>
              Tentar novamente
            </Button>
          </div>
        ) : isLoading ? (
          <div className="space-y-0 p-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="mb-1 h-[68px] w-full" />
            ))}
            <span className="sr-only">Carregando...</span>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Search}
            title="Nenhuma transação encontrada"
            description={hasActiveFilters ? 'Tente ajustar a busca ou os filtros aplicados.' : 'Nenhum lançamento neste mês.'}
            actionLabel={hasActiveFilters ? 'Limpar filtros' : undefined}
            onAction={hasActiveFilters ? resetFilters : undefined}
          />
        ) : (
          <div>
            {filtered.map((t) => (
              <div
                key={t.id}
                className="group flex items-center gap-4 border-b border-border-faint px-5 py-4 transition-colors duration-150 last:border-b-0 hover:bg-[#FAF9F5]"
              >
                <div
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[12px]"
                  style={{ backgroundColor: t.type === 'INCOME' ? '#E7F5EC' : '#FBEBE6' }}
                >
                  <span className="h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: t.category.color }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-semibold text-ink">{t.description}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-faint">{t.category.name}</span>
                    <span className="h-[3px] w-[3px] rounded-full bg-[#CFCABC]" />
                    <span className="text-xs text-faint">{t.account.name}</span>
                    {t.installmentNumber && (
                      <span className="rounded-pill bg-forest-soft px-2 py-0.5 text-[11px] font-semibold text-forest">
                        Parcela {t.installmentNumber}/{t.totalInstallments}
                      </span>
                    )}
                    {t.subscriptionId && (
                      <span className="rounded-pill bg-forest-soft px-2 py-0.5 text-[11px] font-semibold text-forest">
                        Assinatura
                      </span>
                    )}
                    {t.isThirdParty && (
                      <span className="rounded-pill bg-amber/10 px-2 py-0.5 text-[11px] font-semibold text-amber">
                        {t.isReimbursed ? 'Reembolsado' : 'A receber'}
                        {t.thirdPartyName ? `: ${t.thirdPartyName}` : ''}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex-shrink-0 text-right">
                  <div className={clsx('tabular font-display text-[15px] font-bold', t.type === 'INCOME' ? 'text-income' : 'text-expense')}>
                    {t.type === 'INCOME' ? '+ ' : '- '}{formatCurrency(t.amountCents)}
                  </div>
                  <div className="mt-0.5 text-[11.5px] text-faint">{formatDate(t.effectiveDate)}</div>
                </div>
                {!t.installmentGroupId && !t.subscriptionId && (
                <div className="flex flex-shrink-0 gap-1 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
                  <button
                    onClick={() => openEdit(t)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-faint transition-colors hover:bg-chip hover:text-forest"
                    title="Editar transação"
                    aria-label={`Editar ${t.description}`}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(t)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-faint transition-colors hover:bg-expense/10 hover:text-expense"
                    title="Excluir transação"
                    aria-label={`Excluir ${t.description}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                )}
              </div>
            ))}
            {hasNextPage && (
              <div className="flex justify-center p-4">
                <Button variant="secondary" size="sm" loading={isFetchingNextPage} onClick={() => fetchNextPage()}>
                  Carregar mais
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Excluir transação"
        description={`Excluir "${deleteTarget?.description ?? ''}"? Esta ação remove a movimentação deste mês.`}
        confirmLabel="Excluir"
        loading={deleteMutation.isPending}
        error={deleteMutation.error}
        onClose={() => {
          if (!deleteMutation.isPending) {
            setDeleteTarget(null);
            deleteMutation.reset();
          }
        }}
        onConfirm={() => {
          deleteMutation.mutate(deleteTarget!.id);
        }}
      />
    </div>
  );
}
