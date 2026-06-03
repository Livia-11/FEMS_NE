import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from './LoadingSpinner';

/**
 * ProtectedRoute
 *
 * - While auth is loading  → full-screen spinner
 * - No authenticated user  → redirect to /login
 * - `roles` prop supplied and user.role not in list → redirect to /dashboard
 * - Otherwise              → render children
 */
export default function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner fullScreen />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (roles && roles.length > 0 && !roles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
