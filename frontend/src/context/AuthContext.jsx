import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getMe, logout as apiLogout } from '../api/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(() => {
    try { return JSON.parse(localStorage.getItem('fems_user')); } catch { return null; }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('fems_token');
    if (!token) { setLoading(false); return; }
    getMe()
      .then(r => { setUser(r.data.user); localStorage.setItem('fems_user', JSON.stringify(r.data.user)); })
      .catch(() => { localStorage.removeItem('fems_token'); localStorage.removeItem('fems_user'); setUser(null); })
      .finally(() => setLoading(false));
  }, []);

  // Listen for 401 responses from any API call (dispatched by client.js interceptor)
  useEffect(() => {
    function handleUnauthorized() {
      setUser(null);
    }
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  const login = useCallback((token, userData) => {
    localStorage.setItem('fems_token', token);
    localStorage.setItem('fems_user', JSON.stringify(userData));
    setUser(userData);
  }, []);

  const logout = useCallback(async () => {
    try { await apiLogout(); } catch (_) {}
    localStorage.removeItem('fems_token');
    localStorage.removeItem('fems_user');
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const r = await getMe();
    setUser(r.data.user);
    localStorage.setItem('fems_user', JSON.stringify(r.data.user));
    return r.data.user;
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser, isAdmin: user?.role === 'admin', isInspector: user?.role === 'inspector' }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
