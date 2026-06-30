import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute from './components/common/ProtectedRoute';
import RoleGuard from './components/common/RoleGuard';
import AppLayout from './components/layout/AppLayout';

// Pages
import Login from './pages/auth/Login';
import Dashboard from './pages/Dashboard';
import POS from './pages/POS';
import BillListing from './pages/BillListing';
import Inventory from './pages/Inventory';
import Purchases from './pages/Purchases';
import Customers from './pages/Customers';
import CreditLedger from './pages/CreditLedger';
import UserManagement from './pages/UserManagement';
import PurchaseLedger from './pages/PurchaseLedger';
import PurchaseLedgerDetail from './pages/PurchaseLedgerDetail';
import SalesLedger from './pages/SalesLedger';
import SalesLedgerDetail from './pages/SalesLedgerDetail';
import CashManagement from './pages/CashManagement';
import SaleReturnLedger from './pages/SaleReturnLedger';
import PurchaseReturnLedger from './pages/PurchaseReturnLedger';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <Routes>
              {/* Public Routes */}
              <Route path="/login" element={<Login />} />

              {/* Protected Routes inside AppLayout */}
              <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/pos" element={<POS />} />
                <Route path="/bills" element={<BillListing />} />
                
                {/* Manager & Admin Only */}
                <Route element={<RoleGuard allowedRoles={['ADMIN', 'MANAGER']} />}>
                  <Route path="/inventory" element={<Inventory />} />
                  <Route path="/purchases" element={<Purchases />} />
                  <Route path="/credits" element={<CreditLedger />} />
                  <Route path="/cash-management" element={<CashManagement />} />
                  <Route path="/purchase-ledger" element={<PurchaseLedger />} />
                  <Route path="/purchase-ledger/:productId" element={<PurchaseLedgerDetail />} />
                  <Route path="/sales-ledger" element={<SalesLedger />} />
                  <Route path="/sales-ledger/:productId" element={<SalesLedgerDetail />} />
                  <Route path="/sale-returns" element={<SaleReturnLedger />} />
                  <Route path="/purchase-returns" element={<PurchaseReturnLedger />} />
                </Route>

                {/* All Roles */}
                <Route path="/customers" element={<Customers />} />

                {/* Admin Only */}
                <Route element={<RoleGuard allowedRoles={['ADMIN']} />}>
                  <Route path="/users" element={<UserManagement />} />
                </Route>
              </Route>

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            <Toaster 
              position="top-right"
              toastOptions={{
                style: {
                  background: '#1e293b',
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px',
                },
                success: {
                  iconTheme: {
                    primary: '#10b981',
                    secondary: '#fff',
                  },
                },
              }}
            />
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
