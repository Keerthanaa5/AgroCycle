import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { LanguageProvider } from '@/i18n';
import Layout from './components/Layout';
import RoleGuard from './components/RoleGuard';
import { ROLES } from './services/roleManager';
import Dashboard from './pages/Dashboard';
import AgroConnect from './pages/AgroConnect';
import WasteMarket from './pages/WasteMarket';
import CarbonCash from './pages/CarbonCash';
import ViabilityScanner from './pages/ViabilityScanner';
import SilageBank from './pages/SilageBank';
import ClaimRocket from './pages/ClaimRocket';
import IntercropWizard from './pages/IntercropWizard';
import MarketIntelligence from './pages/MarketIntelligence';
import AIAssistant from './pages/AIAssistant';
import Profile from './pages/Profile';
import Login from './pages/Login';
import ErrorBoundary from './components/ErrorBoundary';

import Payment from './pages/Payment';

const AuthenticatedApp = () => {
  const { user, isAuthenticated, isLoadingAuth } = useAuth();

  // Show loading spinner while checking auth
  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle unauthenticated state
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  // Render the main app with role-guarded routes
  return (
    <Routes>
      <Route element={<Layout />}>
        {/* Shared Dashboard (Adapts to Farmer or Buyer) */}
        <Route path="/" element={<Dashboard />} />

        {/* Farmer-Only Protected Routes */}
        <Route
          path="/viability-scanner"
          element={
            <RoleGuard allowedRoles={[ROLES.FARMER]}>
              <ViabilityScanner />
            </RoleGuard>
          }
        />
        <Route
          path="/claim-rocket"
          element={
            <RoleGuard allowedRoles={[ROLES.FARMER]}>
              <ClaimRocket />
            </RoleGuard>
          }
        />
        <Route
          path="/intercrop-wizard"
          element={
            <RoleGuard allowedRoles={[ROLES.FARMER]}>
              <IntercropWizard />
            </RoleGuard>
          }
        />

        {/* Multi-Role Marketplace & Community Routes */}
        <Route path="/market-intelligence" element={<MarketIntelligence />} />
        <Route path="/payment/:orderId" element={<Payment />} />
        <Route path="/agro-connect" element={<AgroConnect />} />
        <Route path="/waste-market" element={<WasteMarket />} />
        <Route path="/carbon-cash" element={<CarbonCash />} />
        <Route path="/silage-bank" element={<SilageBank />} />
        <Route path="/ai-assistant" element={<AIAssistant />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="*" element={<PageNotFound />} />
      </Route>
    </Routes>
  );
};


function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <QueryClientProvider client={queryClientInstance}>
          <ErrorBoundary>
            <Router>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/*" element={<AuthenticatedApp />} />
              </Routes>
            </Router>
            <Toaster />
          </ErrorBoundary>
        </QueryClientProvider>
      </AuthProvider>
    </LanguageProvider>
  )
}

export default App