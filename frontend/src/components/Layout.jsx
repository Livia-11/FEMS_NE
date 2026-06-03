import { useState, useEffect, useCallback } from 'react';
import { Outlet, NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Flame, LayoutDashboard, ClipboardList, Wrench,
  BarChart2, Users, User, LogOut, Bell, Menu, X,
} from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { getUnreadCount } from '../api/notifications';
import Modal from './Modal';

/* ── Navigation definition ─────────────────────────────────────── */
const NAV_ITEMS = [
  { label: 'Dashboard',    to: '/dashboard',     icon: LayoutDashboard, roles: ['admin', 'inspector', 'user'] },
  { label: 'Extinguishers',to: '/extinguishers', icon: Flame,           roles: ['admin', 'inspector', 'user'] },
  { label: 'Inspections',  to: '/inspections',   icon: ClipboardList,   roles: ['admin', 'inspector', 'user'] },
  { label: 'Maintenance',  to: '/maintenance',   icon: Wrench,          roles: ['admin', 'inspector'] },
  { label: 'Reports',      to: '/reports',       icon: BarChart2,       roles: ['admin', 'inspector'] },
  { label: 'Users',        to: '/users',         icon: Users,           roles: ['admin'] },
];

/* ── Path → page name map ───────────────────────────────────────── */
const PAGE_NAMES = {
  '/dashboard':     'Dashboard',
  '/extinguishers': 'Extinguishers',
  '/inspections':   'Inspections',
  '/maintenance':   'Maintenance',
  '/reports':       'Reports',
  '/notifications': 'Notifications',
  '/profile':       'Profile',
  '/users':         'Users',
};

/* ── Role badge helper ──────────────────────────────────────────── */
function RoleBadge({ role }) {
  const styles = {
    admin:     'bg-purple-500/20 text-purple-300 border border-purple-500/30',
    inspector: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
    user:      'bg-green-500/20 text-green-300 border border-green-500/30',
  };
  const label = role.charAt(0).toUpperCase() + role.slice(1);
  return (
    <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full ${styles[role] ?? styles.user}`}>
      {label}
    </span>
  );
}

/* ── Sidebar component ──────────────────────────────────────────── */
function Sidebar({ open, onClose, onSignOutClick, user, isAdmin, isInspector }) {
  const role = user?.role ?? 'user';

  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(role));

  return (
    <>
      {/* Mobile overlay backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 z-30 h-full w-64 bg-navy-900 flex flex-col
          transition-transform duration-200 ease-in-out
          ${open ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 lg:static lg:z-auto
        `}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-6 border-b border-white/10 shrink-0">
          <div className="flex items-center justify-center w-9 h-9 bg-fire-600 rounded-lg">
            <Flame className="h-5 w-5 text-white" />
          </div>
          <div className="leading-tight">
            <p className="text-white font-bold text-base tracking-wide">TZW LTD</p>
            <p className="text-slate-400 text-xs">Fire Safety</p>
            <div className="mt-1.5">
              <RoleBadge role={role} />
            </div>
          </div>
          {/* Close button — mobile only */}
          <button
            className="ml-auto p-1 rounded text-slate-400 hover:text-white lg:hidden"
            onClick={onClose}
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest px-4 mt-2 mb-1">
            Navigation
          </p>
          {visibleItems.map(({ label, to, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onClose}
              className={({ isActive }) =>
                `sidebar-link${isActive ? ' active' : ''}`
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Bottom: profile + sign out */}
        <div className="px-3 pb-4 shrink-0">
          <div className="border-t border-white/10 pt-3">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest px-4 mb-1">
              Account
            </p>
            <div className="space-y-1">
              <NavLink
                to="/profile"
                onClick={onClose}
                className={({ isActive }) =>
                  `sidebar-link${isActive ? ' active' : ''}`
                }
              >
                <User className="h-4 w-4 shrink-0" />
                Profile
              </NavLink>
              <button
                onClick={onSignOutClick}
                className="sidebar-link w-full text-left"
              >
                <LogOut className="h-4 w-4 shrink-0" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

/* ── Layout ─────────────────────────────────────────────────────── */
export default function Layout() {
  const { user, logout, isAdmin, isInspector } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [sidebarOpen, setSidebarOpen]         = useState(false);
  const [signOutModal, setSignOutModal]        = useState(false);
  const [unreadCount, setUnreadCount]          = useState(0);

  /* Fetch unread notification count */
  const fetchUnread = useCallback(async () => {
    try {
      const res = await getUnreadCount();
      setUnreadCount(res.data?.unread_count ?? 0);
    } catch {
      // silently ignore — badge just won't show
    }
  }, []);

  useEffect(() => {
    fetchUnread();
    const id = setInterval(fetchUnread, 60_000);
    return () => clearInterval(id);
  }, [fetchUnread]);

  /* Sign out flow */
  const handleSignOut = async () => {
    setSignOutModal(false);
    await logout();
    navigate('/login', { replace: true });
  };

  /* User initials for avatar */
  const initials = user
    ? [user.first_name, user.last_name]
        .filter(Boolean)
        .map((n) => n[0].toUpperCase())
        .join('')
        .slice(0, 2) || user.email?.[0]?.toUpperCase() || '?'
    : '?';

  const displayName = user
    ? [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email
    : '';

  /* Current page name from path */
  const pageName = PAGE_NAMES[location.pathname] ?? '';

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Sidebar */}
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onSignOutClick={() => setSignOutModal(true)}
        user={user}
        isAdmin={isAdmin}
        isInspector={isInspector}
      />

      {/* Main column */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Top header */}
        <header className="shrink-0 h-16 bg-white border-b border-slate-100 flex items-center px-4 gap-3">
          {/* Hamburger — mobile */}
          <button
            className="p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 lg:hidden"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Page title */}
          {pageName && (
            <span className="text-sm font-semibold text-slate-700 hidden sm:block">
              {pageName}
            </span>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Notification bell */}
          <Link
            to="/notifications"
            className="relative p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[1.1rem] h-[1.1rem] flex items-center justify-center bg-fire-600 text-white text-[10px] font-bold rounded-full px-0.5 leading-none">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </Link>

          {/* User avatar + name */}
          <Link
            to="/profile"
            className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-fire-600/20 flex items-center justify-center shrink-0">
              <span className="text-fire-700 text-xs font-semibold">{initials}</span>
            </div>
            <span className="hidden sm:block text-sm font-medium text-slate-700 max-w-[10rem] truncate">
              {displayName}
            </span>
          </Link>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-6 md:p-8">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Sign-out confirm modal */}
      <Modal
        isOpen={signOutModal}
        onClose={() => setSignOutModal(false)}
        title="Sign Out"
        size="sm"
      >
        <p className="text-slate-600 text-sm mb-6">
          Are you sure you want to sign out?
        </p>
        <div className="flex justify-end gap-3">
          <button
            className="btn-secondary"
            onClick={() => setSignOutModal(false)}
          >
            Cancel
          </button>
          <button className="btn-danger" onClick={handleSignOut}>
            Sign Out
          </button>
        </div>
      </Modal>
    </div>
  );
}
