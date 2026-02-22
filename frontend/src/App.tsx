import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import { useAuthStore } from '@/store/useAuthStore';
// Import pages
import Login from '@/pages/Auth/Login';
import Register from '@/pages/Auth/Register';
import VerifyEmail from '@/pages/Auth/VerifyEmail';
import ForgotPassword from '@/pages/Auth/ForgotPassword';
import ResetPassword from '@/pages/Auth/ResetPassword';
import Dashboard from '@/pages/Dashboard/Dashboard';
import CampaignList from '@/pages/Campaigns/CampaignList';
import CampaignCreate from '@/pages/Campaigns/CampaignCreate';
import CampaignDetail from '@/pages/Campaigns/CampaignDetail';
import SurveyPage from '@/pages/Bot/SurveyPage';
import SessionsPage from '@/pages/Sessions/SessionsPage';
import AnalyticsPage from '@/pages/Analytics/AnalyticsPage';
import ExportsPage from '@/pages/Exports/ExportsPage';
import ProfilePage from '@/pages/Profile/ProfilePage';
import SettingsPage from '@/pages/Settings/SettingsPage';
import LogsPage from '@/pages/Logs/LogsPage';
import UsersPage from '@/pages/Admin/UsersPage';
import QRCodesPage from '@/pages/QRCodes/QRCodesPage';
import NotFound from '@/pages/NotFound';

/**
 * PrivateRoute ensures that only authenticated users can access certain
 * routes. If the user is not authenticated, they are redirected to the
 * login page.
 */
const PrivateRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { accessToken } = useAuthStore();
  return accessToken ? children : <Navigate to="/login" />;
};

/**
 * AdminRoute ensures only admins can access certain routes.
 */
const AdminRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { accessToken, user } = useAuthStore();
  if (!accessToken) return <Navigate to="/login" />;
  return user?.role === 'admin' ? children : <Navigate to="/" />;
};


/**
 * Root application component that defines all routes. Public routes such
 * as authentication and the survey page are outside of the main layout,
 * while private routes are nested under the Layout component.
 */
const App: React.FC = () => {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/verify" element={<VerifyEmail />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/survey/:token" element={<SurveyPage />} />
      {/* Private routes */}
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="campaigns" element={<CampaignList />} />
        <Route path="campaigns/create" element={<CampaignCreate />} />
        <Route path="campaigns/:id" element={<CampaignDetail />} />
        <Route path="campaigns/:id/sessions" element={<SessionsPage />} />
        <Route path="campaigns/:id/analytics" element={<AnalyticsPage />} />
        <Route path="campaigns/:id/exports" element={<ExportsPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="logs" element={<AdminRoute><LogsPage /></AdminRoute>} />
        <Route path="admin/users" element={<AdminRoute><UsersPage /></AdminRoute>} />
        <Route path="qr-codes" element={<QRCodesPage />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export default App;