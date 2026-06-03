import { Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';

import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import LoadingSpinner from './components/LoadingSpinner';

// Public pages
const LandingPage        = lazy(() => import('./pages/LandingPage'));
const LoginPage          = lazy(() => import('./pages/auth/LoginPage'));
const RegisterPage       = lazy(() => import('./pages/auth/RegisterPage'));
const VerifyEmailPage    = lazy(() => import('./pages/auth/VerifyEmailPage'));
const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPasswordPage'));
const ResetPasswordPage  = lazy(() => import('./pages/auth/ResetPasswordPage'));

// Protected pages
const DashboardPage     = lazy(() => import('./pages/DashboardPage'));
const ExtinguishersPage = lazy(() => import('./pages/ExtinguishersPage'));
const InspectionsPage   = lazy(() => import('./pages/InspectionsPage'));
const MaintenancePage   = lazy(() => import('./pages/MaintenancePage'));
const ReportsPage       = lazy(() => import('./pages/ReportsPage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const ProfilePage       = lazy(() => import('./pages/ProfilePage'));
const UsersPage         = lazy(() => import('./pages/UsersPage'));

export default function App() {
  return (
    <AuthProvider>
      <Suspense fallback={<LoadingSpinner fullScreen />}>
        <Routes>
          {/* Landing page — public */}
          <Route path="/" element={<LandingPage />} />

          {/* Public auth routes */}
          <Route path="/login"           element={<LoginPage />} />
          <Route path="/register"        element={<RegisterPage />} />
          <Route path="/verify-email"    element={<VerifyEmailPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password"  element={<ResetPasswordPage />} />

          {/* Protected routes inside Layout */}
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard"     element={<DashboardPage />} />
            <Route path="/extinguishers" element={<ExtinguishersPage />} />
            <Route path="/inspections"   element={<InspectionsPage />} />
            <Route path="/maintenance"   element={<MaintenancePage />} />
            <Route
              path="/reports"
              element={
                <ProtectedRoute roles={['admin', 'inspector']}>
                  <ReportsPage />
                </ProtectedRoute>
              }
            />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/profile"       element={<ProfilePage />} />
            <Route
              path="/users"
              element={
                <ProtectedRoute roles={['admin']}>
                  <UsersPage />
                </ProtectedRoute>
              }
            />
          </Route>

          {/* Catch-all → landing */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </AuthProvider>
  );
}
