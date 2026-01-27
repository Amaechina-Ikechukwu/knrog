import { ThemeProvider, CssBaseline } from '@mui/material';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import theme from './theme';
import { AuthProvider } from './context/AuthContext';
import LandingPage from './pages/LandingPage';
import RegisterPage from './pages/RegisterPage';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import DomainsPage from './pages/DomainsPage';
import LogsPage from './pages/LogsPage';
import VerifyPage from './pages/VerifyPage';
import PricingPage from './pages/PricingPage';
import BillingPage from './pages/BillingPage';

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/domains" element={<DomainsPage />} />
            <Route path="/logs" element={<LogsPage />} />
            <Route path="/verify" element={<VerifyPage />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/billing" element={<BillingPage />} />
            <Route path="/billing/callback" element={<BillingPage />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
