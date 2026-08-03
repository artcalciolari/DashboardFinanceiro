import { ReactNode } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import TransactionFormModal from '../Transactions/TransactionFormModal';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-paper">
      <Sidebar />

      {/* Main content area, offset by sidebar on desktop */}
      <div className="md:ml-[260px] flex flex-col min-h-screen">
        <Header />
        <main className="flex-1 p-4 pb-24 sm:p-6 md:p-8 md:pb-14 animate-sc-rise">
          <div className="mx-auto w-full max-w-[1280px]">{children}</div>
        </main>
      </div>

      <TransactionFormModal />
    </div>
  );
}
