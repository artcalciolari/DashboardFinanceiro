import { createContext, useContext, useState, ReactNode } from 'react';
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

  function openCreate() {
    setEditing(null);
    setIsOpen(true);
  }

  function openEdit(transaction: Transaction) {
    setEditing(transaction);
    setIsOpen(true);
  }

  function close() {
    setIsOpen(false);
    setEditing(null);
  }

  return (
    <TransactionModalContext.Provider value={{ isOpen, editing, openCreate, openEdit, close }}>
      {children}
    </TransactionModalContext.Provider>
  );
}

export function useTransactionModal() {
  return useContext(TransactionModalContext);
}
