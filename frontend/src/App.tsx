import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { DateProvider } from './context/DateContext';
import { SearchProvider } from './context/SearchContext';
import { TransactionModalProvider } from './context/TransactionModalContext';
import Layout from './components/Layout/Layout';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Transactions = lazy(() => import('./pages/Transactions'));
const Accounts = lazy(() => import('./pages/Accounts'));
const Categories = lazy(() => import('./pages/Categories'));
const Installments = lazy(() => import('./pages/Installments'));
const Subscriptions = lazy(() => import('./pages/Subscriptions'));
const Alerts = lazy(() => import('./pages/Alerts'));

export default function App() {
  return (
    <BrowserRouter>
      <DateProvider>
        <SearchProvider>
          <TransactionModalProvider>
            <Layout>
              <Suspense fallback={<div className="card py-8 text-center text-faint">Carregando...</div>}>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/transactions" element={<Transactions />} />
                  <Route path="/accounts" element={<Accounts />} />
                  <Route path="/categories" element={<Categories />} />
                  <Route path="/installments" element={<Installments />} />
                  <Route path="/subscriptions" element={<Subscriptions />} />
                  <Route path="/alerts" element={<Alerts />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
            </Layout>
          </TransactionModalProvider>
        </SearchProvider>
      </DateProvider>
    </BrowserRouter>
  );
}
