import { useState, useEffect, useCallback } from 'react';
import {
  Bell, Trash2, CheckCheck, Check, Info,
  AlertTriangle, CheckCircle2, XCircle, Send, ClipboardList,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { listNotifications, markRead, markAllRead, deleteNotification, sendNotification } from '../api/notifications';
import { listUsers } from '../api/users';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import ConfirmDialog from '../components/ConfirmDialog';
import Modal from '../components/Modal';

/* ── helpers ───────────────────────────────────────────────────── */
function timeAgo(dateString) {
  if (!dateString) return '';
  const diffMs  = Date.now() - new Date(dateString).getTime();
  if (diffMs < 0) return 'just now';
  const sec  = Math.floor(diffMs / 1000);
  if (sec  < 60)  return 'just now';
  const min  = Math.floor(sec  / 60);
  if (min  < 60)  return `${min}m ago`;
  const hr   = Math.floor(min  / 60);
  if (hr   < 24)  return `${hr}h ago`;
  const day  = Math.floor(hr   / 24);
  if (day  < 30)  return `${day}d ago`;
  const mon  = Math.floor(day  / 30);
  if (mon  < 12)  return `${mon} month${mon !== 1 ? 's' : ''} ago`;
  return `${Math.floor(mon / 12)} year${Math.floor(mon / 12) !== 1 ? 's' : ''} ago`;
}

const TYPE_CONFIG = {
  info:                 { icon: Info,          bg: 'bg-blue-100',   text: 'text-blue-600'   },
  warning:              { icon: AlertTriangle,  bg: 'bg-amber-100',  text: 'text-amber-600'  },
  success:              { icon: CheckCircle2,   bg: 'bg-green-100',  text: 'text-green-600'  },
  error:                { icon: XCircle,        bg: 'bg-red-100',    text: 'text-red-600'    },
  inspection_scheduled: { icon: ClipboardList,  bg: 'bg-blue-100',   text: 'text-blue-600'   },
  general:              { icon: Bell,           bg: 'bg-slate-100',  text: 'text-slate-500'  },
};

function getTypeConfig(type) {
  if (!type) return TYPE_CONFIG.info;
  if (TYPE_CONFIG[type]) return TYPE_CONFIG[type];
  if (type.includes('error') || type.includes('fail'))                           return TYPE_CONFIG.error;
  if (type.includes('warn'))                                                     return TYPE_CONFIG.warning;
  if (type.includes('success') || type.includes('complet') || type.includes('pass')) return TYPE_CONFIG.success;
  if (type.includes('inspect'))                                                  return TYPE_CONFIG.inspection_scheduled;
  return TYPE_CONFIG.info;
}

const EMPTY_SEND = { recipient_id: '', type: 'general', title: '', message: '' };

/* ── component ─────────────────────────────────────────────────── */
export default function NotificationsPage() {
  const { isAdmin } = useAuth();

  const [notifications,  setNotifications]  = useState([]);
  const [total,          setTotal]          = useState(0);
  const [unreadCount,    setUnreadCount]    = useState(0);
  const [loading,        setLoading]        = useState(true);
  const [markAllLoading, setMarkAllLoading] = useState(false);
  const [filter,         setFilter]         = useState('all');
  const [page,           setPage]           = useState(1);
  const limit = 15;

  // Delete
  const [deleteOpen,    setDeleteOpen]    = useState(false);
  const [selectedNotif, setSelectedNotif] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Send notification (admin)
  const [sendOpen,    setSendOpen]    = useState(false);
  const [sendForm,    setSendForm]    = useState(EMPTY_SEND);
  const [sendErrors,  setSendErrors]  = useState({});
  const [sendLoading, setSendLoading] = useState(false);
  const [usersList,   setUsersList]   = useState([]);

  /* ── fetch ───────────────────────────────────────────────────── */
  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit };
      if (filter === 'unread') params.unread_only = true;
      const res = await listNotifications(params);
      const items = res.data?.data ?? [];
      setNotifications(items);
      setTotal(res.data?.pagination?.total ?? 0);
      setUnreadCount(items.filter(n => !n.is_read).length);
    } catch (err) {
      toast.error(err.message || 'Failed to load notifications.');
    } finally {
      setLoading(false);
    }
  }, [filter, page]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  // Load users list for admin send modal
  useEffect(() => {
    if (!isAdmin) return;
    listUsers({ limit: 100 })
      .then(r => setUsersList(r.data?.data ?? []))
      .catch(() => {});
  }, [isAdmin]);

  /* ── actions ─────────────────────────────────────────────────── */
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
      toast.error(err.message || 'Failed.');
    } finally {
      setMarkAllLoading(false);
    }
  }

  async function handleDelete() {
    setDeleteLoading(true);
    try {
      await deleteNotification(selectedNotif.id);
      toast.success('Notification deleted.');
      setDeleteOpen(false);
      fetchNotifications();
    } catch (err) {
      toast.error(err.message || 'Failed to delete.');
    } finally {
      setDeleteLoading(false);
    }
  }

  function openSendModal() {
    setSendForm(EMPTY_SEND);
    setSendErrors({});
    setSendOpen(true);
  }

  function validateSend() {
    const errs = {};
    if (!sendForm.title.trim())   errs.title   = 'Title is required';
    if (!sendForm.message.trim()) errs.message = 'Message is required';
    return errs;
  }

  async function handleSend(e) {
    e.preventDefault();
    const errs = validateSend();
    if (Object.keys(errs).length) { setSendErrors(errs); return; }
    setSendLoading(true);
    try {
      const payload = {
        title:   sendForm.title.trim(),
        message: sendForm.message.trim(),
        type:    sendForm.type || 'general',
      };
      if (sendForm.recipient_id) payload.recipient_id = parseInt(sendForm.recipient_id);
      await sendNotification(payload);
      toast.success('Notification sent successfully!');
      setSendOpen(false);
      fetchNotifications();
    } catch (err) {
      toast.error(err.message || 'Failed to send notification.');
    } finally {
      setSendLoading(false);
    }
  }

  const totalPages = Math.ceil(total / limit) || 1;

  /* ── render ──────────────────────────────────────────────────── */
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-800">Notifications</h1>
          {unreadCount > 0 && (
            <span className="inline-flex items-center justify-center h-6 min-w-[1.5rem] px-1.5 rounded-full bg-fire-600 text-white text-xs font-bold">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              className="btn-primary flex items-center gap-2"
              onClick={openSendModal}
            >
              <Send className="w-4 h-4" />
              Send Notification
            </button>
          )}
          <button
            className="btn-secondary flex items-center gap-2"
            onClick={handleMarkAllRead}
            disabled={unreadCount === 0 || markAllLoading}
          >
            <CheckCheck className="w-4 h-4" />
            {markAllLoading ? 'Marking…' : 'Mark All Read'}
          </button>
        </div>
      </div>

      {/* Filter toggle */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        {['all', 'unread'].map(f => (
          <button
            key={f}
            onClick={() => { setFilter(f); setPage(1); }}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors capitalize flex items-center gap-2 ${
              filter === f ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {f}
            {f === 'unread' && unreadCount > 0 && (
              <span className="inline-flex items-center justify-center h-4 min-w-[1rem] px-1 rounded-full bg-fire-600 text-white text-[10px] font-bold">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Notification list */}
      {loading ? (
        <LoadingSpinner />
      ) : notifications.length === 0 ? (
        <div className="card p-16 flex flex-col items-center text-slate-400 gap-3">
          <Bell className="w-12 h-12 opacity-30" />
          <p className="text-lg font-medium">No notifications</p>
          <p className="text-sm">
            {filter === 'unread' ? "You're all caught up!" : 'Nothing here yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map(notif => {
            const cfg  = getTypeConfig(notif.type);
            const Icon = cfg.icon;
            return (
              <div
                key={notif.id}
                className={`flex items-start gap-4 px-5 py-4 rounded-2xl border transition-colors ${
                  notif.is_read
                    ? 'bg-white border-slate-200 hover:bg-slate-50'
                    : 'bg-blue-50 border-blue-200'
                }`}
              >
                {/* Type icon */}
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${cfg.bg}`}>
                  <Icon className={`w-5 h-5 ${cfg.text}`} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={`text-sm leading-snug ${notif.is_read ? 'text-slate-700' : 'font-semibold text-slate-900'}`}>
                      {notif.title}
                    </p>
                    {!notif.is_read && (
                      <span className="inline-block w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                    )}
                  </div>
                  {notif.message && (
                    <p className="text-sm text-slate-500 mt-1 leading-relaxed">{notif.message}</p>
                  )}
                  <p className="text-xs text-slate-400 mt-1.5">{timeAgo(notif.created_at)}</p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0 pt-0.5">
                  {!notif.is_read && (
                    <button
                      className="p-2 rounded-lg hover:bg-blue-100 text-blue-500 hover:text-blue-700 transition-colors"
                      title="Mark as read"
                      onClick={() => handleMarkRead(notif)}
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
                    title="Delete"
                    onClick={() => { setSelectedNotif(notif); setDeleteOpen(true); }}
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
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>Page {page} of {totalPages} · {total} total</span>
          <div className="flex gap-2">
            <button className="btn-secondary" disabled={page === 1}          onClick={() => setPage(p => p - 1)}>Previous</button>
            <button className="btn-secondary" disabled={page >= totalPages}  onClick={() => setPage(p => p + 1)}>Next</button>
          </div>
        </div>
      )}

      {/* ── Send Notification Modal (Admin only) ─────────────── */}
      <Modal isOpen={sendOpen} onClose={() => setSendOpen(false)} title="Send Notification" size="md">
        <form onSubmit={handleSend} className="space-y-5">
          {/* Recipient */}
          <div className="space-y-1.5">
            <label className="label">Recipient</label>
            <select
              className="input"
              value={sendForm.recipient_id}
              onChange={e => setSendForm(f => ({ ...f, recipient_id: e.target.value }))}
            >
              <option value="">All Users (Broadcast)</option>
              {usersList.map(u => (
                <option key={u.id} value={u.id}>
                  {u.first_name} {u.last_name} — {u.role} ({u.email})
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-400">Leave blank to send to all users</p>
          </div>

          {/* Type */}
          <div className="space-y-1.5">
            <label className="label">Type</label>
            <select
              className="input"
              value={sendForm.type}
              onChange={e => setSendForm(f => ({ ...f, type: e.target.value }))}
            >
              <option value="general">General</option>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="success">Success</option>
              <option value="error">Error / Alert</option>
            </select>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <label className="label">Title <span className="text-red-500">*</span></label>
            <input
              type="text"
              className={`input ${sendErrors.title ? 'border-red-400' : ''}`}
              placeholder="e.g. Inspection Reminder"
              value={sendForm.title}
              onChange={e => { setSendForm(f => ({ ...f, title: e.target.value })); setSendErrors(er => ({ ...er, title: '' })); }}
            />
            {sendErrors.title && <p className="text-xs text-red-500">{sendErrors.title}</p>}
          </div>

          {/* Message */}
          <div className="space-y-1.5">
            <label className="label">Message <span className="text-red-500">*</span></label>
            <textarea
              rows={4}
              className={`input resize-none ${sendErrors.message ? 'border-red-400' : ''}`}
              placeholder="Write your notification message here…"
              value={sendForm.message}
              onChange={e => { setSendForm(f => ({ ...f, message: e.target.value })); setSendErrors(er => ({ ...er, message: '' })); }}
            />
            {sendErrors.message && <p className="text-xs text-red-500">{sendErrors.message}</p>}
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <button type="button" className="btn-secondary" onClick={() => setSendOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary flex items-center gap-2" disabled={sendLoading}>
              <Send className="w-4 h-4" />
              {sendLoading ? 'Sending…' : 'Send Notification'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Delete Confirm ──────────────────────────────────── */}
      <ConfirmDialog
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete Notification"
        message="Are you sure you want to delete this notification?"
        confirmLabel="Delete"
        loading={deleteLoading}
      />
    </div>
  );
}
