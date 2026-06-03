import { useState, useEffect, useCallback } from 'react';
import { Bell, Trash2, CheckCheck, Check, Info, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { listNotifications, markRead, markAllRead, deleteNotification } from '../api/notifications';
import LoadingSpinner from '../components/LoadingSpinner';
import ConfirmDialog from '../components/ConfirmDialog';

function timeAgo(dateString) {
  if (!dateString) return '';
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const diffMs = now - then;
  if (diffMs < 0) return 'just now';
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr !== 1 ? 's' : ''} ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay} day${diffDay !== 1 ? 's' : ''} ago`;
  const diffMonth = Math.floor(diffDay / 30);
  if (diffMonth < 12) return `${diffMonth} month${diffMonth !== 1 ? 's' : ''} ago`;
  const diffYear = Math.floor(diffMonth / 12);
  return `${diffYear} year${diffYear !== 1 ? 's' : ''} ago`;
}

const TYPE_CONFIG = {
  info: { icon: Info, bg: 'bg-blue-100', text: 'text-blue-600' },
  warning: { icon: AlertTriangle, bg: 'bg-amber-100', text: 'text-amber-600' },
  success: { icon: CheckCircle2, bg: 'bg-green-100', text: 'text-green-600' },
  error: { icon: XCircle, bg: 'bg-red-100', text: 'text-red-600' },
};

function getTypeConfig(type) {
  if (!type) return TYPE_CONFIG.info;
  const key = type.includes('error') || type.includes('fail') ? 'error'
    : type.includes('warn') ? 'warning'
    : type.includes('success') || type.includes('complet') || type.includes('approv') ? 'success'
    : 'info';
  return TYPE_CONFIG[key];
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [markAllLoading, setMarkAllLoading] = useState(false);

  const [filter, setFilter] = useState('all'); // 'all' | 'unread'
  const [page, setPage] = useState(1);
  const limit = 15;

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedNotif, setSelectedNotif] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit };
      if (filter === 'unread') params.unread_only = true;
      const data = await listNotifications(params);
      const items = data.data?.data ?? [];
      setNotifications(items);
      setTotal(data.data?.pagination?.total ?? 0);
      setUnreadCount(items.filter(n => !n.is_read).length);
    } catch (err) {
      toast.error(err.message || 'Failed to load notifications.');
    } finally {
      setLoading(false);
    }
  }, [filter, page]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  function handleFilterChange(value) {
    setFilter(value);
    setPage(1);
  }

  async function handleMarkRead(notif) {
    try {
      await markRead(notif.id);
      fetchNotifications();
    } catch (err) {
      toast.error(err.message || 'Failed to mark as read.');
    }
  }

  async function handleMarkAllRead() {
    setMarkAllLoading(true);
    try {
      await markAllRead();
      toast.success('All notifications marked as read.');
      fetchNotifications();
    } catch (err) {
      toast.error(err.message || 'Failed to mark all as read.');
    } finally {
      setMarkAllLoading(false);
    }
  }

  function openDelete(notif) {
    setSelectedNotif(notif);
    setDeleteOpen(true);
  }

  async function handleDelete() {
    setDeleteLoading(true);
    try {
      await deleteNotification(selectedNotif.id);
      toast.success('Notification deleted.');
      setDeleteOpen(false);
      fetchNotifications();
    } catch (err) {
      toast.error(err.message || 'Failed to delete notification.');
    } finally {
      setDeleteLoading(false);
    }
  }

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-navy-900">Notifications</h1>
          {unreadCount > 0 && (
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-fire-600 text-white text-xs font-bold">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
        <button
          className="btn-secondary flex items-center gap-2 disabled:opacity-40"
          onClick={handleMarkAllRead}
          disabled={unreadCount === 0 || markAllLoading}
        >
          <CheckCheck className="w-4 h-4" />
          {markAllLoading ? 'Marking...' : 'Mark All Read'}
        </button>
      </div>

      {/* Filter toggle */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        <button
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${filter === 'all' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          onClick={() => handleFilterChange('all')}
        >
          All
        </button>
        <button
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${filter === 'unread' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          onClick={() => handleFilterChange('unread')}
        >
          Unread
          {unreadCount > 0 && (
            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-fire-600 text-white text-xs font-bold">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <LoadingSpinner />
        </div>
      ) : notifications.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
          <Bell className="w-12 h-12 opacity-30" />
          <p className="text-lg font-medium">No notifications</p>
          <p className="text-sm">
            {filter === 'unread' ? "You're all caught up!" : "Nothing here yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map(notif => {
            const cfg = getTypeConfig(notif.type);
            const Icon = cfg.icon;
            return (
              <div
                key={notif.id}
                className={`flex items-start gap-4 p-4 rounded-xl border transition-colors ${notif.is_read ? 'bg-white border-slate-200' : 'bg-blue-50 border-blue-100'}`}
              >
                {/* Icon */}
                <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${cfg.bg}`}>
                  <Icon className={`w-4 h-4 ${cfg.text}`} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${notif.is_read ? 'font-normal text-slate-700' : 'font-semibold text-slate-900'}`}>
                    {notif.title}
                  </p>
                  {notif.message && (
                    <p className="text-sm text-slate-500 mt-0.5 leading-relaxed">{notif.message}</p>
                  )}
                  <p className="text-xs text-slate-400 mt-1">{timeAgo(notif.created_at)}</p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  {!notif.is_read && (
                    <button
                      className="p-1.5 rounded hover:bg-blue-100 text-blue-500 hover:text-blue-700 transition-colors"
                      title="Mark as read"
                      onClick={() => handleMarkRead(notif)}
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
                    title="Delete"
                    onClick={() => openDelete(notif)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-600">
          <span>Page {page} of {totalPages} ({total} total)</span>
          <div className="flex gap-2">
            <button
              className="btn-secondary px-3 py-1 disabled:opacity-40"
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
            >
              Previous
            </button>
            <button
              className="btn-secondary px-3 py-1 disabled:opacity-40"
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      <ConfirmDialog
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete Notification"
        message="Delete this notification?"
        confirmLabel="Delete"
        loading={deleteLoading}
      />
    </div>
  );
}
