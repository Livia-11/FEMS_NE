import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import {
  ClipboardList, Plus, AlertTriangle, Eye, Pencil, Trash2,
  ChevronLeft, ChevronRight, Search,
} from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import Badge from '../components/Badge';
import StatCard from '../components/StatCard';
import LoadingSpinner from '../components/LoadingSpinner';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';

import {
  listInspections, createInspection, updateInspection,
  deleteInspection, markOverdue,
} from '../api/inspections';
import { listExtinguishers } from '../api/extinguishers';
import { listInspectors } from '../api/users';

const PAGE_SIZE = 15;

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'cancelled', label: 'Cancelled' },
];

const RESULT_OPTIONS = [
  { value: '', label: '— Select Result —' },
  { value: 'pass', label: 'Pass' },
  { value: 'fail', label: 'Fail' },
  { value: 'needs_maintenance', label: 'Needs Maintenance' },
];

const EDITABLE_STATUS_OPTIONS = [
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'overdue', label: 'Overdue' },
];

const INITIAL_SCHEDULE_FORM = {
  extinguisher_id: '',
  scheduled_date: '',
  scheduled_time: '',
  inspector_id: '',
  inspector_name: '',
  notes: '',
};

const INITIAL_UPDATE_FORM = {
  status: 'completed',
  result: '',
  actual_date: '',
  pressure_ok: false,
  seal_intact: false,
  label_readable: false,
  pin_in_place: false,
  notes: '',
};

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

export default function InspectionsPage() {
  const { user, isAdmin, isInspector } = useAuth();
  const canSchedule = isAdmin || user?.role === 'user';
  const canUpdate = isAdmin || isInspector;
  const canDelete  = isAdmin;

  // ── list state ──────────────────────────────────────────────────────────
  const [inspections, setInspections] = useState([]);
  const [total, setTotal]             = useState(0);
  const [page, setPage]               = useState(1);
  const [loading, setLoading]         = useState(true);

  // ── filter state ────────────────────────────────────────────────────────
  const [filterStatus, setFilterStatus]     = useState('');
  const [filterFrom, setFilterFrom]         = useState('');
  const [filterTo, setFilterTo]             = useState('');
  const [filterSerial, setFilterSerial]     = useState('');

  // ── dropdown data ───────────────────────────────────────────────────────
  const [extinguishers, setExtinguishers] = useState([]);
  const [inspectors, setInspectors]       = useState([]);

  // ── modal state ─────────────────────────────────────────────────────────
  const [scheduleOpen, setScheduleOpen]           = useState(false);
  const [updateOpen, setUpdateOpen]               = useState(false);
  const [viewOpen, setViewOpen]                   = useState(false);
  const [deleteOpen, setDeleteOpen]               = useState(false);
  const [markOverdueOpen, setMarkOverdueOpen]     = useState(false);

  const [selected, setSelected]   = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [overdueLoading, setOverdueLoading] = useState(false);

  const [scheduleForm, setScheduleForm] = useState(INITIAL_SCHEDULE_FORM);
  const [updateForm, setUpdateForm]     = useState(INITIAL_UPDATE_FORM);

  // ── fetch list ───────────────────────────────────────────────────────────
  const fetchInspections = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: PAGE_SIZE,
        ...(filterStatus && { status: filterStatus }),
        ...(filterFrom   && { from_date: filterFrom }),
        ...(filterTo     && { to_date: filterTo }),
        ...(filterSerial && { serial_number: filterSerial }),
      };
      const res = await listInspections(params);
      setInspections(res.data?.data ?? []);
      setTotal(res.data?.pagination?.total ?? 0);
    } catch (err) {
      toast.error(err.message ?? 'Failed to load inspections');
    } finally {
      setLoading(false);
    }
  }, [page, filterStatus, filterFrom, filterTo, filterSerial]);

  useEffect(() => { fetchInspections(); }, [fetchInspections]);

  // ── fetch dropdown data ──────────────────────────────────────────────────
  useEffect(() => {
    if (!canSchedule && !canUpdate) return;
    listExtinguishers({ limit: 100 })
      .then(r => setExtinguishers(r.data?.data ?? []))
      .catch(() => {});
    if (isAdmin) {
      listInspectors()
        .then(r => setInspectors(r.data?.data ?? []))
        .catch(() => {});
    }
  }, [canSchedule, canUpdate, isAdmin]);

  // ── reset page on filter change ──────────────────────────────────────────
  useEffect(() => { setPage(1); }, [filterStatus, filterFrom, filterTo, filterSerial]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // ── schedule ─────────────────────────────────────────────────────────────
  function openSchedule() {
    setScheduleForm(INITIAL_SCHEDULE_FORM);
    setScheduleOpen(true);
  }

  async function handleScheduleSubmit(e) {
    e.preventDefault();
    if (!scheduleForm.extinguisher_id) return toast.error('Select an extinguisher');
    if (!scheduleForm.scheduled_date)   return toast.error('Select a scheduled date');
    if (isAdmin && !scheduleForm.inspector_id) return toast.error('Assign an inspector');
    setSubmitting(true);
    try {
      const payload = {
        extinguisher_id: scheduleForm.extinguisher_id,
        scheduled_date:  scheduleForm.scheduled_date,
        ...(scheduleForm.scheduled_time  && { scheduled_time:  scheduleForm.scheduled_time }),
        ...(isAdmin && scheduleForm.inspector_id && { inspector_id: scheduleForm.inspector_id }),
        ...(isAdmin && scheduleForm.inspector_name && { inspector_name: scheduleForm.inspector_name }),
        ...(scheduleForm.notes           && { notes:           scheduleForm.notes }),
      };
      await createInspection(payload);
      toast.success(isAdmin ? 'Inspection assigned to inspector' : 'Inspection request scheduled');
      setScheduleOpen(false);
      fetchInspections();
    } catch (err) {
      toast.error(err.message ?? 'Failed to schedule inspection');
    } finally {
      setSubmitting(false);
    }
  }

  // ── update results ────────────────────────────────────────────────────────
  function openUpdate(insp) {
    setSelected(insp);
    setUpdateForm({
      status:          insp.status        ?? 'completed',
      result:          insp.result        ?? '',
      actual_date:     insp.actual_date   ? insp.actual_date.slice(0, 10) : '',
      pressure_ok:     !!insp.pressure_ok,
      seal_intact:     !!insp.seal_intact,
      label_readable:  !!insp.label_readable,
      pin_in_place:    !!insp.pin_in_place,
      notes:           insp.notes         ?? '',
    });
    setUpdateOpen(true);
  }

  function inspectorName(inspector) {
    return [inspector.first_name, inspector.last_name].filter(Boolean).join(' ') || inspector.email;
  }

  function canUpdateInspection(insp) {
    if (isAdmin) return true;
    return isInspector && insp.inspector_id === user?.id;
  }

  async function handleUpdateSubmit(e) {
    e.preventDefault();
    if (!selected) return;
    setSubmitting(true);
    try {
      await updateInspection(selected.id, updateForm);
      toast.success('Inspection updated');
      setUpdateOpen(false);
      fetchInspections();
    } catch (err) {
      toast.error(err.message ?? 'Failed to update inspection');
    } finally {
      setSubmitting(false);
    }
  }

  // ── view ──────────────────────────────────────────────────────────────────
  function openView(insp) {
    setSelected(insp);
    setViewOpen(true);
  }

  // ── delete ────────────────────────────────────────────────────────────────
  function openDelete(insp) {
    setSelected(insp);
    setDeleteOpen(true);
  }

  async function handleDelete() {
    if (!selected) return;
    setSubmitting(true);
    try {
      await deleteInspection(selected.id);
      toast.success('Inspection deleted');
      setDeleteOpen(false);
      fetchInspections();
    } catch (err) {
      toast.error(err.message ?? 'Failed to delete inspection');
    } finally {
      setSubmitting(false);
    }
  }

  // ── mark overdue ──────────────────────────────────────────────────────────
  async function handleMarkOverdue() {
    setOverdueLoading(true);
    try {
      const res = await markOverdue();
      toast.success(`${res.data.updated ?? 0} inspection(s) marked overdue`);
      setMarkOverdueOpen(false);
      fetchInspections();
    } catch (err) {
      toast.error(err.message ?? 'Failed to mark overdue');
    } finally {
      setOverdueLoading(false);
    }
  }

  // ── helpers ───────────────────────────────────────────────────────────────
  function extinguisherLabel(ext) {
    if (!ext) return '—';
    const loc = ext.location ? ` — ${ext.location}` : '';
    return `${ext.serial_number}${loc}`;
  }

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-900 flex items-center gap-2">
            <ClipboardList className="h-7 w-7 text-fire-600" />
            Inspections
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Schedule and track fire extinguisher inspections</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={() => setMarkOverdueOpen(true)}
              className="btn-secondary flex items-center gap-2 text-sm"
            >
              <AlertTriangle className="h-4 w-4" />
              Mark Overdue
            </button>
          )}
          {canSchedule && (
            <button
              onClick={openSchedule}
              className="btn-primary flex items-center gap-2 text-sm"
            >
              <Plus className="h-4 w-4" />
              {isAdmin ? 'Assign Inspection' : 'Schedule Inspection'}
            </button>
          )}
        </div>
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
          <select
            className="input min-w-[150px]"
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
          >
            {STATUS_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
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
        ) : inspections.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-2">
            <ClipboardList className="h-12 w-12 opacity-30" />
            <p className="font-medium">No inspections found</p>
            <p className="text-sm">Try adjusting your filters or schedule a new inspection.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="table-th">Date</th>
                  <th className="table-th">Time</th>
                  <th className="table-th">Serial / Location</th>
                  <th className="table-th">Inspector</th>
                  <th className="table-th">Status</th>
                  <th className="table-th">Result</th>
                  <th className="table-th text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {inspections.map(insp => (
                  <tr key={insp.id} className="hover:bg-gray-50 transition-colors">
                    <td className="table-td whitespace-nowrap">{formatDate(insp.scheduled_date)}</td>
                    <td className="table-td whitespace-nowrap">{insp.scheduled_time ?? '—'}</td>
                    <td className="table-td">
                      <p className="font-medium text-gray-900">{insp.serial_number ?? '—'}</p>
                      <p className="text-xs text-gray-400">{insp.extinguisher?.location ?? ''}</p>
                    </td>
                    <td className="table-td">
                      {insp.inspector?.name ?? insp.inspector_name ?? '—'}
                    </td>
                    <td className="table-td">
                      <Badge status={insp.status} />
                    </td>
                    <td className="table-td">
                      {insp.result ? <Badge status={insp.result} /> : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="table-td text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openView(insp)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title="View details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {canUpdateInspection(insp) && (
                          <button
                            onClick={() => openUpdate(insp)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors"
                            title="Update results"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => openDelete(insp)}
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
        {!loading && inspections.length > 0 && (
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

      {/* ── Modal A: Schedule Inspection ────────────────────────────────────── */}
      <Modal isOpen={scheduleOpen} onClose={() => setScheduleOpen(false)} title={isAdmin ? 'Assign Inspection' : 'Schedule Inspection'} size="lg">
        <form onSubmit={handleScheduleSubmit} className="space-y-5">
          <div>
            <label className="label">Extinguisher <span className="text-red-500">*</span></label>
            <select
              className="input w-full"
              value={scheduleForm.extinguisher_id}
              onChange={e => setScheduleForm(f => ({ ...f, extinguisher_id: e.target.value }))}
              required
            >
              <option value="">— Select Extinguisher —</option>
              {extinguishers.map(ext => (
                <option key={ext.id} value={ext.id}>{extinguisherLabel(ext)}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Scheduled Date <span className="text-red-500">*</span></label>
              <input
                type="date"
                className="input w-full"
                value={scheduleForm.scheduled_date}
                onChange={e => setScheduleForm(f => ({ ...f, scheduled_date: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="label">Scheduled Time</label>
              <input
                type="time"
                className="input w-full"
                value={scheduleForm.scheduled_time}
                onChange={e => setScheduleForm(f => ({ ...f, scheduled_time: e.target.value }))}
              />
            </div>
          </div>

          {isAdmin && (
            <div>
              <label className="label">Assign Inspector <span className="text-red-500">*</span></label>
              <select
                className="input w-full"
                value={scheduleForm.inspector_id}
                onChange={e => {
                  const selectedInspector = inspectors.find(i => String(i.id) === e.target.value);
                  setScheduleForm(f => ({
                    ...f,
                    inspector_id: e.target.value,
                    inspector_name: selectedInspector ? inspectorName(selectedInspector) : '',
                  }));
                }}
                required
              >
                <option value="">— Select inspector —</option>
                {inspectors.map(u => (
                  <option key={u.id} value={u.id}>{inspectorName(u)}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="label">Notes</label>
            <textarea
              className="input w-full min-h-[80px] resize-none"
              placeholder="Optional notes…"
              value={scheduleForm.notes}
              onChange={e => setScheduleForm(f => ({ ...f, notes: e.target.value }))}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setScheduleOpen(false)} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? 'Scheduling…' : 'Schedule'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Modal B: Update Results ──────────────────────────────────────────── */}
      <Modal isOpen={updateOpen} onClose={() => setUpdateOpen(false)} title="Update Inspection Results" size="lg">
        <form onSubmit={handleUpdateSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Status</label>
              <select
                className="input w-full"
                value={updateForm.status}
                onChange={e => setUpdateForm(f => ({ ...f, status: e.target.value }))}
              >
                {EDITABLE_STATUS_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Result</label>
              <select
                className="input w-full"
                value={updateForm.result}
                onChange={e => setUpdateForm(f => ({ ...f, result: e.target.value }))}
              >
                {RESULT_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Actual Inspection Date</label>
            <input
              type="date"
              className="input w-full"
              value={updateForm.actual_date}
              onChange={e => setUpdateForm(f => ({ ...f, actual_date: e.target.value }))}
            />
          </div>

          {/* Checklist */}
          <div>
            <label className="label mb-2">Inspection Checklist</label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'pressure_ok',     label: 'Pressure OK' },
                { key: 'seal_intact',     label: 'Seal Intact' },
                { key: 'label_readable',  label: 'Label Readable' },
                { key: 'pin_in_place',    label: 'Pin In Place' },
              ].map(({ key, label }) => (
                <label
                  key={key}
                  className="flex items-center gap-2 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors select-none"
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-fire-600 focus:ring-fire-600"
                    checked={updateForm[key]}
                    onChange={e => setUpdateForm(f => ({ ...f, [key]: e.target.checked }))}
                  />
                  <span className="text-sm font-medium text-gray-700">{label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Notes</label>
            <textarea
              className="input w-full min-h-[80px] resize-none"
              placeholder="Inspection notes…"
              value={updateForm.notes}
              onChange={e => setUpdateForm(f => ({ ...f, notes: e.target.value }))}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setUpdateOpen(false)} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? 'Saving…' : 'Save Results'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Modal C: View Details ────────────────────────────────────────────── */}
      <Modal isOpen={viewOpen} onClose={() => setViewOpen(false)} title="Inspection Details" size="lg">
        {selected && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Extinguisher</p>
                <p className="font-medium text-gray-900">{selected.serial_number ?? '—'}</p>
                <p className="text-gray-500">{selected.location ?? ''}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Inspector</p>
                <p className="font-medium text-gray-900">
                  {selected.inspector?.name ?? selected.inspector_name ?? '—'}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Scheduled Date</p>
                <p className="font-medium text-gray-900">{formatDate(selected.scheduled_date)}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Scheduled Time</p>
                <p className="font-medium text-gray-900">{selected.scheduled_time ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Status</p>
                <div className="mt-0.5"><Badge status={selected.status} /></div>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Result</p>
                <div className="mt-0.5">
                  {selected.result ? <Badge status={selected.result} /> : <span className="text-gray-400">—</span>}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Actual Date</p>
                <p className="font-medium text-gray-900">{formatDate(selected.actual_date)}</p>
              </div>
            </div>

            {/* Checklist */}
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Inspection Checklist</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: 'pressure_ok',    label: 'Pressure OK' },
                  { key: 'seal_intact',    label: 'Seal Intact' },
                  { key: 'label_readable', label: 'Label Readable' },
                  { key: 'pin_in_place',   label: 'Pin In Place' },
                ].map(({ key, label }) => (
                  <div
                    key={key}
                    className={`flex items-center gap-2 p-2.5 rounded-lg text-sm font-medium border ${
                      selected[key]
                        ? 'bg-green-50 border-green-200 text-green-700'
                        : 'bg-red-50 border-red-200 text-red-600'
                    }`}
                  >
                    <span className="text-base">{selected[key] ? '✓' : '✗'}</span>
                    {label}
                  </div>
                ))}
              </div>
            </div>

            {selected.notes && (
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Notes</p>
                <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{selected.notes}</p>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button onClick={() => setViewOpen(false)} className="btn-secondary">Close</button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Delete Confirm ────────────────────────────────────────────────────── */}
      <ConfirmDialog
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete Inspection"
        message="Delete this inspection record? This action cannot be undone."
        confirmLabel="Delete"
        loading={submitting}
      />

      {/* ── Mark Overdue Confirm ─────────────────────────────────────────────── */}
      <ConfirmDialog
        isOpen={markOverdueOpen}
        onClose={() => setMarkOverdueOpen(false)}
        onConfirm={handleMarkOverdue}
        title="Mark Overdue Inspections"
        message="This will mark all past-due scheduled inspections as overdue. Continue?"
        confirmLabel="Mark Overdue"
        loading={overdueLoading}
      />
    </div>
  );
}
