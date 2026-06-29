import { ReactNode } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />

      {/* Main content area, offset by sidebar on desktop */}
      <div className="md:ml-60 flex flex-col min-h-screen">
        <Header />
        <main className="flex-1 p-4 md:p-6 pb-20 md:pb-6">{children}</main>
      </div>
    </div>
  );
}
