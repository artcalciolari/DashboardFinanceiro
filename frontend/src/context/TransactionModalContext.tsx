import { createContext, useCallback, useContext, useMemo, useState, ReactNode } from 'react';
import type { Transaction } from '../types';

interface TransactionModalContextType {
  isOpen: boolean;
  editing: Transaction | null;
  openCreate: () => void;
  openEdit: (transaction: Transaction) => void;
  close: () => void;
}

const TransactionModalContext = createContext<TransactionModalContextType>({
  isOpen: false,
  editing: null,
  openCreate: () => {},
  openEdit: () => {},
  close: () => {},
});

export function TransactionModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);

  const openCreate = useCallback(() => {
    setEditing(null);
    setIsOpen(true);
  }, []);

  const openEdit = useCallback((transaction: Transaction) => {
    setEditing(transaction);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setEditing(null);
  }, []);

  const value = useMemo(
    () => ({ isOpen, editing, openCreate, openEdit, close }),
    [isOpen, editing, openCreate, openEdit, close]
  );

  return (
    <TransactionModalContext.Provider value={value}>
      {children}
    </TransactionModalContext.Provider>
  );
}

export function useTransactionModal() {
  return useContext(TransactionModalContext);
}
