import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import AgroConnect from './pages/AgroConnect';
import WasteMarket from './pages/WasteMarket';
import CarbonCash from './pages/CarbonCash';
import ViabilityScanner from './pages/ViabilityScanner';
import SilageBank from './pages/SilageBank';
import ClaimRocket from './pages/ClaimRocket';
import IntercropWizard from './pages/IntercropWizard';
import AIAssistant from './pages/AIAssistant';
import Profile from './pages/Profile';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/agro-connect" element={<AgroConnect />} />
        <Route path="/waste-market" element={<WasteMarket />} />
        <Route path="/carbon-cash" element={<CarbonCash />} />
        <Route path="/viability-scanner" element={<ViabilityScanner />} />
        <Route path="/silage-bank" element={<SilageBank />} />
        <Route path="/claim-rocket" element={<ClaimRocket />} />
        <Route path="/intercrop-wizard" element={<IntercropWizard />} />
        <Route path="/ai-assistant" element={<AIAssistant />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="*" element={<PageNotFound />} />
      </Route>
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App