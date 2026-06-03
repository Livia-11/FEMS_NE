import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import {
  Wrench, Plus, Eye, Pencil, Trash2,
  ChevronLeft, ChevronRight, Search, DollarSign,
} from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import Badge from '../components/Badge';
import LoadingSpinner from '../components/LoadingSpinner';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';

import {
  listMaintenance, createMaintenance, updateMaintenance, deleteMaintenance,
} from '../api/maintenance';
import { listExtinguishers } from '../api/extinguishers';
import { listInspectors } from '../api/users';

const PAGE_SIZE = 15;

const INITIAL_FORM = {
  extinguisher_id:      '',
  action_taken:         '',
  date_of_maintenance:  '',
  inspector_id:         '',
  inspector_name:       '',
  issues_identified:    '',
  parts_replaced:       '',
  cost:                 '',
  next_service_date:    '',
  notes:                '',
};

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function formatCurrency(val) {
  if (val === null || val === undefined || val === '') return '—';
  return `$${Number(val).toFixed(2)}`;
}

function truncate(str, max = 60) {
  if (!str) return '—';
  return str.length > max ? str.slice(0, max) + '…' : str;
}

export default function MaintenancePage() {
  const { isAdmin, isInspector } = useAuth();
  const canWrite  = isAdmin || isInspector;
  const canDelete = isAdmin;

  // ── list state ──────────────────────────────────────────────────────────
  const [records, setRecords] = useState([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(1);
  const [loading, setLoading] = useState(true);

  // ── filters ─────────────────────────────────────────────────────────────
  const [filterFrom, setFilterFrom]     = useState('');
  const [filterTo, setFilterTo]         = useState('');
  const [filterSerial, setFilterSerial] = useState('');

  // ── dropdown data ───────────────────────────────────────────────────────
  const [extinguishers, setExtinguishers] = useState([]);
  const [inspectors, setInspectors]       = useState([]);

  // ── modal state ─────────────────────────────────────────────────────────
  const [formOpen, setFormOpen]     = useState(false);
  const [viewOpen, setViewOpen]     = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const [selected, setSelected]   = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState(INITIAL_FORM);

  // ── fetch ────────────────────────────────────────────────────────────────
  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: PAGE_SIZE,
        ...(filterFrom   && { from_date: filterFrom }),
        ...(filterTo     && { to_date: filterTo }),
        ...(filterSerial && { serial_number: filterSerial }),
      };
      const res = await listMaintenance(params);
      setRecords(res.data?.data ?? []);
      setTotal(res.data?.pagination?.total ?? 0);
    } catch (err) {
      toast.error(err.message ?? 'Failed to load maintenance logs');
    } finally {
      setLoading(false);
    }
  }, [page, filterFrom, filterTo, filterSerial]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  // ── fetch dropdowns ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!canWrite) return;
    listExtinguishers({ limit: 100 })
      .then(r => setExtinguishers(r.data?.data ?? []))
      .catch(() => {});
    listInspectors()
      .then(r => setInspectors(r.data?.data ?? []))
      .catch(() => {});
  }, [canWrite]);

  // ── reset page on filter change ──────────────────────────────────────────
  useEffect(() => { setPage(1); }, [filterFrom, filterTo, filterSerial]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // ── field helpers ─────────────────────────────────────────────────────────
  function setField(key, value) {
    setForm(f => ({ ...f, [key]: value }));
  }

  function extinguisherLabel(ext) {
    if (!ext) return '—';
    const loc = ext.location ? ` — ${ext.location}` : '';
    return `${ext.serial_number}${loc}`;
  }

  // ── add / edit ─────────────────────────────────────────────────────────────
  function openAdd() {
    setIsEditing(false);
    setSelected(null);
    setForm(INITIAL_FORM);
    setFormOpen(true);
  }

  function openEdit(rec) {
    setIsEditing(true);
    setSelected(rec);
    setForm({
      extinguisher_id:      rec.extinguisher_id              ?? '',
      action_taken:         rec.action_taken                 ?? '',
      date_of_maintenance:  rec.date_of_maintenance
                              ? rec.date_of_maintenance.slice(0, 10) : '',
      inspector_id:         rec.inspector_id                 ?? '',
      inspector_name:       rec.inspector_name               ?? '',
      issues_identified:    rec.issues_identified            ?? '',
      parts_replaced:       rec.parts_replaced               ?? '',
      cost:                 rec.cost !== null && rec.cost !== undefined ? String(rec.cost) : '',
      next_service_date:    rec.next_service_date
                              ? rec.next_service_date.slice(0, 10) : '',
      notes:                rec.notes                        ?? '',
    });
    setFormOpen(true);
  }

  async function handleFormSubmit(e) {
    e.preventDefault();
    if (!form.extinguisher_id)     return toast.error('Select an extinguisher');
    if (!form.action_taken.trim()) return toast.error('Action taken is required');
    if (!form.date_of_maintenance) return toast.error('Date of maintenance is required');

    setSubmitting(true);
    try {
      const payload = {
        extinguisher_id:     form.extinguisher_id,
        action_taken:        form.action_taken.trim(),
        date_of_maintenance: form.date_of_maintenance,
        ...(form.inspector_id        && { inspector_id:     form.inspector_id }),
        ...(form.inspector_name      && { inspector_name:   form.inspector_name }),
        ...(form.issues_identified   && { issues_identified: form.issues_identified }),
        ...(form.parts_replaced      && { parts_replaced:   form.parts_replaced }),
        ...(form.cost !== ''         && { cost:             parseFloat(form.cost) }),
        ...(form.next_service_date   && { next_service_date: form.next_service_date }),
        ...(form.notes               && { notes:            form.notes }),
      };

      if (isEditing && selected) {
        await updateMaintenance(selected.id, payload);
        toast.success('Maintenance log updated');
      } else {
        await createMaintenance(payload);
        toast.success('Maintenance log added');
      }
      setFormOpen(false);
      fetchRecords();
    } catch (err) {
      toast.error(err.message ?? 'Failed to save maintenance log');
    } finally {
      setSubmitting(false);
    }
  }

  // ── view ────────────────────────────────────────────────────────────────────
  function openView(rec) {
    setSelected(rec);
    setViewOpen(true);
  }

  // ── delete ──────────────────────────────────────────────────────────────────
  function openDelete(rec) {
    setSelected(rec);
    setDeleteOpen(true);
  }

  async function handleDelete() {
    if (!selected) return;
    setSubmitting(true);
    try {
      await deleteMaintenance(selected.id);
      toast.success('Maintenance log deleted');
      setDeleteOpen(false);
      fetchRecords();
    } catch (err) {
      toast.error(err.message ?? 'Failed to delete maintenance log');
    } finally {
      setSubmitting(false);
    }
  }

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-900 flex items-center gap-2">
            <Wrench className="h-7 w-7 text-fire-600" />
            Maintenance
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Track maintenance activities and service history</p>
        </div>
        {canWrite && (
          <button
            onClick={openAdd}
            className="btn-primary flex items-center gap-2 text-sm self-start sm:self-auto"
          >
            <Plus className="h-4 w-4" />
            Log Maintenance
          </button>
        )}
      </div>

      {/* Filter bar */}
      <div className="card">
        <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              className="input pl-9 w-full"
              placeholder="Search serial number…"
              value={filterSerial}
              onChange={e => setFilterSerial(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              className="input"
              value={filterFrom}
              onChange={e => setFilterFrom(e.target.value)}
              title="From date"
            />
            <span className="text-gray-400 text-sm">to</span>
            <input
              type="date"
              className="input"
              value={filterTo}
              onChange={e => setFilterTo(e.target.value)}
              title="To date"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <LoadingSpinner />
          </div>
        ) : records.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-2">
            <Wrench className="h-12 w-12 opacity-30" />
            <p className="font-medium">No maintenance logs found</p>
            <p className="text-sm">Try adjusting filters or log a new maintenance activity.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="table-th">Date</th>
                  <th className="table-th">Serial / Location</th>
                  <th className="table-th">Action Taken</th>
                  <th className="table-th">Inspector</th>
                  <th className="table-th">Cost</th>
                  <th className="table-th text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {records.map(rec => (
                  <tr key={rec.id} className="hover:bg-gray-50 transition-colors">
                    <td className="table-td whitespace-nowrap">{formatDate(rec.date_of_maintenance)}</td>
                    <td className="table-td">
                      <p className="font-medium text-gray-900">{rec.serial_number ?? '—'}</p>
                      <p className="text-xs text-gray-400">{rec.location ?? ''}</p>
                    </td>
                    <td className="table-td max-w-[240px]">
                      <span title={rec.action_taken}>{truncate(rec.action_taken)}</span>
                    </td>
                    <td className="table-td">
                      {rec.inspector?.name ?? rec.inspector_name ?? '—'}
                    </td>
                    <td className="table-td whitespace-nowrap font-medium">
                      {formatCurrency(rec.cost)}
                    </td>
                    <td className="table-td text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openView(rec)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title="View details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {canWrite && (
                          <button
                            onClick={() => openEdit(rec)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors"
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => openDelete(rec)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && records.length > 0 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100 bg-gray-50">
            <p className="text-sm text-gray-500">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm text-gray-600 px-2">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Modal A: Add / Edit ──────────────────────────────────────────────── */}
      <Modal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={isEditing ? 'Edit Maintenance Log' : 'Log Maintenance'}
        size="xl"
      >
        <form onSubmit={handleFormSubmit} className="space-y-4">
          {/* Row 1 */}
          <div>
            <label className="label">Extinguisher <span className="text-red-500">*</span></label>
            <select
              className="input w-full"
              value={form.extinguisher_id}
              onChange={e => setField('extinguisher_id', e.target.value)}
              required
            >
              <option value="">— Select Extinguisher —</option>
              {extinguishers.map(ext => (
                <option key={ext.id} value={ext.id}>{extinguisherLabel(ext)}</option>
              ))}
            </select>
          </div>

          {/* Row 2 */}
          <div>
            <label className="label">Action Taken <span className="text-red-500">*</span></label>
            <input
              type="text"
              className="input w-full"
              placeholder="Describe the maintenance action…"
              value={form.action_taken}
              onChange={e => setField('action_taken', e.target.value)}
              required
            />
          </div>

          {/* Row 3 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Date of Maintenance <span className="text-red-500">*</span></label>
              <input
                type="date"
                className="input w-full"
                value={form.date_of_maintenance}
                onChange={e => setField('date_of_maintenance', e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label">Next Service Date</label>
              <input
                type="date"
                className="input w-full"
                value={form.next_service_date}
                onChange={e => setField('next_service_date', e.target.value)}
              />
            </div>
          </div>

          {/* Row 4 — Inspector */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Inspector</label>
              <select
                className="input w-full"
                value={form.inspector_id}
                onChange={e => setField('inspector_id', e.target.value)}
              >
                <option value="">— Select inspector —</option>
                {inspectors.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
            {!form.inspector_id && (
              <div>
                <label className="label">Inspector Name (manual)</label>
                <input
                  type="text"
                  className="input w-full"
                  placeholder="Enter name"
                  value={form.inspector_name}
                  onChange={e => setField('inspector_name', e.target.value)}
                />
              </div>
            )}
          </div>

          {/* Row 5 — Cost + Parts */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Cost</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="input w-full pl-9"
                  placeholder="0.00"
                  value={form.cost}
                  onChange={e => setField('cost', e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="label">Parts Replaced</label>
              <input
                type="text"
                className="input w-full"
                placeholder="e.g. valve, hose, pin…"
                value={form.parts_replaced}
                onChange={e => setField('parts_replaced', e.target.value)}
              />
            </div>
          </div>

          {/* Row 6 — Issues */}
          <div>
            <label className="label">Issues Identified</label>
            <textarea
              className="input w-full min-h-[80px] resize-none"
              placeholder="Describe any issues found…"
              value={form.issues_identified}
              onChange={e => setField('issues_identified', e.target.value)}
            />
          </div>

          {/* Row 7 — Notes */}
          <div>
            <label className="label">Notes</label>
            <textarea
              className="input w-full min-h-[70px] resize-none"
              placeholder="Additional notes…"
              value={form.notes}
              onChange={e => setField('notes', e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setFormOpen(false)} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? 'Saving…' : isEditing ? 'Save Changes' : 'Log Maintenance'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Modal B: View Details ────────────────────────────────────────────── */}
      <Modal isOpen={viewOpen} onClose={() => setViewOpen(false)} title="Maintenance Details" size="lg">
        {selected && (
          <div className="space-y-5 text-sm">
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Extinguisher</p>
                <p className="font-medium text-gray-900 mt-0.5">{selected.serial_number ?? '—'}</p>
                <p className="text-gray-500 text-xs">{selected.location ?? ''}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Inspector</p>
                <p className="font-medium text-gray-900 mt-0.5">
                  {selected.inspector?.name ?? selected.inspector_name ?? '—'}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Date of Maintenance</p>
                <p className="font-medium text-gray-900 mt-0.5">{formatDate(selected.date_of_maintenance)}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Next Service Date</p>
                <p className="font-medium text-gray-900 mt-0.5">{formatDate(selected.next_service_date)}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Cost</p>
                <p className="font-medium text-gray-900 mt-0.5">{formatCurrency(selected.cost)}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Parts Replaced</p>
                <p className="font-medium text-gray-900 mt-0.5">{selected.parts_replaced || '—'}</p>
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Action Taken</p>
              <p className="text-gray-700 bg-gray-50 rounded-lg p-3">{selected.action_taken || '—'}</p>
            </div>

            {selected.issues_identified && (
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Issues Identified</p>
                <p className="text-gray-700 bg-orange-50 rounded-lg p-3 border border-orange-100">
                  {selected.issues_identified}
                </p>
              </div>
            )}

            {selected.notes && (
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Notes</p>
                <p className="text-gray-700 bg-gray-50 rounded-lg p-3">{selected.notes}</p>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              {canWrite && (
                <button
                  onClick={() => { setViewOpen(false); openEdit(selected); }}
                  className="btn-secondary flex items-center gap-1.5"
                >
                  <Pencil className="h-4 w-4" />
                  Edit
                </button>
              )}
              <button onClick={() => setViewOpen(false)} className="btn-primary">Close</button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Delete Confirm ────────────────────────────────────────────────────── */}
      <ConfirmDialog
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete Maintenance Log"
        message="Delete this maintenance log? This action cannot be undone."
        confirmLabel="Delete"
        loading={submitting}
      />
    </div>
  );
}
