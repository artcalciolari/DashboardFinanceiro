import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { DateProvider } from './context/DateContext';
import Layout from './components/Layout/Layout';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Accounts from './pages/Accounts';
import Categories from './pages/Categories';
import Installments from './pages/Installments';
import Subscriptions from './pages/Subscriptions';
import Alerts from './pages/Alerts';

export default function App() {
  return (
    <BrowserRouter>
      <DateProvider>
        <Layout>
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
        </Layout>
      </DateProvider>
    </BrowserRouter>
  );
}
