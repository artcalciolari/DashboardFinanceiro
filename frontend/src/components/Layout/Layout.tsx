import { ReactNode } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import TransactionFormModal from '../Transactions/TransactionFormModal';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-paper">
      <Sidebar />

      {/* Main content area, offset by sidebar on desktop */}
      <div className="md:ml-[250px] flex flex-col min-h-screen">
        <Header />
        <main className="flex-1 p-7 pb-24 md:pb-12 animate-[sc-rise_.4s_ease_both]">{children}</main>
      </div>

      <TransactionFormModal />
    </div>
  );
}
