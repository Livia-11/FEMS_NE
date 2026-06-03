import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Eye, Pencil, Trash2, X, ChevronLeft, ChevronRight, ClipboardList } from 'lucide-react';
import toast from 'react-hot-toast';

import Badge from '../components/Badge';
import LoadingSpinner from '../components/LoadingSpinner';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import { useAuth } from '../context/AuthContext';

import {
  listExtinguishers,
  getExtinguisher,
  createExtinguisher,
  updateExtinguisher,
  deleteExtinguisher,
} from '../api/extinguishers';
import { createInspection } from '../api/inspections';

const TYPES = ['Water', 'CO2', 'Foam', 'Dry Chemical', 'Wet Chemical', 'Clean Agent'];
const SIZES = ['1.5 lb', '2 lb', '2.5 lb', '5 lb', '6 lb', '9 lb', '10 lb', '12 lb', '20 lb'];
const STATUSES = ['active', 'inactive', 'expired', 'maintenance', 'decommissioned'];
const PAGE_SIZE = 10;

const EMPTY_FORM = {
  serial_number: '',
  location: '',
  building: '',
  floor: '',
  type: '',
  size: '',
  installation_date: '',
  expiry_date: '',
  next_inspection: '',
  status: 'active',
  notes: '',
};

function formatDate(val) {
  if (!val) return '—';
  return String(val).slice(0, 10);
}

function isExpired(dateStr) {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

export default function ExtinguishersPage() {
  const { isAdmin, isInspector } = useAuth();

  // List state
  const [extinguishers, setExtinguishers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');

  // Modal state
  const [showAddEdit, setShowAddEdit] = useState(false);
  const [editTarget, setEditTarget] = useState(null); // null = add, object = edit
  const [showView, setShowView] = useState(false);
  const [viewTarget, setViewTarget] = useState(null);
  const [viewDetail, setViewDetail] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Form state
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [formLoading, setFormLoading] = useState(false);

  // Request Inspection (user role)
  const [showRequestInspection, setShowRequestInspection] = useState(false);
  const [requestForm, setRequestForm] = useState({ scheduled_date: '', notes: '' });
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestTarget, setRequestTarget] = useState(null);

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listExtinguishers({
        page,
        limit: PAGE_SIZE,
        search: search || undefined,
        status: filterStatus || undefined,
        type: filterType || undefined,
      });
      setExtinguishers(res.data?.data ?? []);
      setTotal(res.data?.pagination?.total ?? 0);
    } catch (err) {
      toast.error(err.message || 'Failed to load extinguishers');
    } finally {
      setLoading(false);
    }
  }, [page, search, filterStatus, filterType]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleSearchChange(e) {
    setSearch(e.target.value);
    setPage(1);
  }

  function handleStatusChange(e) {
    setFilterStatus(e.target.value);
    setPage(1);
  }

  function handleTypeChange(e) {
    setFilterType(e.target.value);
    setPage(1);
  }

  function handleClearFilters() {
    setSearch('');
    setFilterStatus('');
    setFilterType('');
    setPage(1);
  }

  // Add
  function openAdd() {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
    setShowAddEdit(true);
  }

  // Edit
  function openEdit(row) {
    setEditTarget(row);
    setForm({
      serial_number: row.serial_number ?? '',
      location: row.location ?? '',
      building: row.building ?? '',
      floor: row.floor ?? '',
      type: row.type ?? '',
      size: row.size ?? '',
      installation_date: formatDate(row.installation_date),
      expiry_date: formatDate(row.expiry_date),
      next_inspection: formatDate(row.next_inspection),
      status: row.status ?? 'active',
      notes: row.notes ?? '',
    });
    setFormErrors({});
    setShowAddEdit(true);
  }

  // View
  async function openView(row) {
    setViewTarget(row);
    setViewDetail(null);
    setShowView(true);
    setViewLoading(true);
    try {
      const res = await getExtinguisher(row.id);
      // Flatten: merge extinguisher fields with recent_inspections / recent_maintenance
      setViewDetail({
        ...res.data?.data,
        recent_inspections: res.data?.recent_inspections ?? [],
        recent_maintenance: res.data?.recent_maintenance ?? [],
      });
    } catch (err) {
      toast.error(err.message || 'Failed to load details');
    } finally {
      setViewLoading(false);
    }
  }

  // Delete
  function openDelete(row) {
    setDeleteTarget(row);
    setShowDelete(true);
  }

  async function handleRequestInspection(e) {
    e.preventDefault();
    if (!requestForm.scheduled_date) { toast.error('Please select an inspection date'); return; }
    if (!requestTarget) return;
    setRequestLoading(true);
    try {
      await createInspection({
        extinguisher_id: requestTarget.id,
        scheduled_date: requestForm.scheduled_date,
        notes: requestForm.notes || `Inspection requested by user for ${requestTarget.location}`,
      });
      toast.success('Inspection request submitted successfully!');
      setShowRequestInspection(false);
      setRequestForm({ scheduled_date: '', notes: '' });
    } catch (err) {
      toast.error(err.message || 'Failed to submit request');
    } finally {
      setRequestLoading(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await deleteExtinguisher(deleteTarget.id);
      toast.success('Extinguisher deleted');
      setShowDelete(false);
      setDeleteTarget(null);
      fetchList();
    } catch (err) {
      toast.error(err.message || 'Delete failed');
    } finally {
      setDeleteLoading(false);
    }
  }

  // Form field change
  function handleFormChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (formErrors[name]) {
      setFormErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  }

  // Validate
  function validateForm() {
    const errors = {};
    if (!form.serial_number.trim()) errors.serial_number = 'Serial number is required';
    if (!form.location.trim()) errors.location = 'Location is required';
    if (!form.type) errors.type = 'Type is required';
    if (!form.size) errors.size = 'Size is required';
    if (!form.installation_date) errors.installation_date = 'Installation date is required';
    if (!form.expiry_date) errors.expiry_date = 'Expiry date is required';
    if (
      form.installation_date &&
      form.expiry_date &&
      new Date(form.expiry_date) <= new Date(form.installation_date)
    ) {
      errors.expiry_date = 'Expiry date must be after installation date';
    }
    return errors;
  }

  // Submit add/edit
  async function handleFormSubmit(e) {
    e.preventDefault();
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setFormLoading(true);
    try {
      const payload = {
        ...form,
        building: form.building || undefined,
        floor: form.floor || undefined,
        next_inspection: form.next_inspection || undefined,
        notes: form.notes || undefined,
      };
      if (editTarget) {
        await updateExtinguisher(editTarget.id, payload);
        toast.success('Extinguisher updated');
      } else {
        await createExtinguisher(payload);
        toast.success('Extinguisher added');
      }
      setShowAddEdit(false);
      fetchList();
    } catch (err) {
      toast.error(err.message || 'Save failed');
    } finally {
      setFormLoading(false);
    }
  }

  // ── Pagination ─────────────────────────────────────────────────────────────

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, total);

  // ── Render helpers ─────────────────────────────────────────────────────────

  function FieldError({ name }) {
    return formErrors[name] ? (
      <p className="text-xs text-red-600 mt-1">{formErrors[name]}</p>
    ) : null;
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Fire Extinguishers</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage your fire extinguisher inventory
          </p>
        </div>
        {(isAdmin || isInspector) && (
          <button onClick={openAdd} className="btn-primary flex items-center gap-2">
            <Plus size={16} />
            Add Extinguisher
          </button>
        )}
      </div>

      {/* Filter bar */}
      <div className="card">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[180px]">
            <label className="label">Search</label>
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                className="input pl-9"
                placeholder="Serial number or location…"
                value={search}
                onChange={handleSearchChange}
              />
            </div>
          </div>

          <div className="min-w-[150px]">
            <label className="label">Status</label>
            <select className="input" value={filterStatus} onChange={handleStatusChange}>
              <option value="">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-[150px]">
            <label className="label">Type</label>
            <select className="input" value={filterType} onChange={handleTypeChange}>
              <option value="">All types</option>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {(search || filterStatus || filterType) && (
            <button
              onClick={handleClearFilters}
              className="btn-secondary flex items-center gap-1 self-end"
            >
              <X size={14} />
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden p-0">
        {loading ? (
          <div className="flex justify-center py-16">
            <LoadingSpinner />
          </div>
        ) : extinguishers.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-lg font-medium">No extinguishers found</p>
            <p className="text-sm mt-1">
              {search || filterStatus || filterType
                ? 'Try adjusting your filters'
                : 'Add your first extinguisher to get started'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="table-th">Serial Number</th>
                  <th className="table-th">Type</th>
                  <th className="table-th">Size</th>
                  <th className="table-th">Location</th>
                  <th className="table-th">Status</th>
                  <th className="table-th">Expiry Date</th>
                  <th className="table-th">Actions</th>
                </tr>
              </thead>
              <tbody>
                {extinguishers.map((ext) => {
                  const expired = isExpired(ext.expiry_date);
                  return (
                    <tr key={ext.id} className="hover:bg-gray-50">
                      <td className="table-td font-mono text-xs">{ext.serial_number}</td>
                      <td className="table-td">{ext.type}</td>
                      <td className="table-td">{ext.size}</td>
                      <td className="table-td">{ext.location}</td>
                      <td className="table-td">
                        <Badge status={ext.status} />
                      </td>
                      <td className={`table-td ${expired ? 'text-red-600 font-medium' : ''}`}>
                        {formatDate(ext.expiry_date)}
                      </td>
                      <td className="table-td">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openView(ext)}
                            className="p-1.5 rounded text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            title="View details"
                          >
                            <Eye size={15} />
                          </button>
                          {(isAdmin || isInspector) && (
                            <button
                              onClick={() => openEdit(ext)}
                              className="p-1.5 rounded text-gray-500 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                              title="Edit"
                            >
                              <Pencil size={15} />
                            </button>
                          )}
                          {isAdmin && (
                            <button
                              onClick={() => openDelete(ext)}
                              className="p-1.5 rounded text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                              title="Delete"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && total > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-sm text-gray-500">
              Showing {rangeStart}–{rangeEnd} of {total}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={15} />
              </button>
              <span className="text-sm text-gray-600">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Add / Edit Modal ─────────────────────────────────────────────────── */}
      <Modal
        isOpen={showAddEdit}
        onClose={() => setShowAddEdit(false)}
        title={editTarget ? 'Edit Extinguisher' : 'Add Extinguisher'}
        size="lg"
      >
        <form onSubmit={handleFormSubmit} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Serial Number */}
            <div>
              <label className="label">
                Serial Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="serial_number"
                className="input"
                value={form.serial_number}
                onChange={handleFormChange}
                disabled={!!editTarget}
                placeholder="e.g. EXT-001"
              />
              <FieldError name="serial_number" />
            </div>

            {/* Location */}
            <div>
              <label className="label">
                Location <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="location"
                className="input"
                value={form.location}
                onChange={handleFormChange}
                placeholder="e.g. Lobby, Floor 1"
              />
              <FieldError name="location" />
            </div>

            {/* Building */}
            <div>
              <label className="label">Building</label>
              <input
                type="text"
                name="building"
                className="input"
                value={form.building}
                onChange={handleFormChange}
                placeholder="Building name (optional)"
              />
            </div>

            {/* Floor */}
            <div>
              <label className="label">Floor</label>
              <input
                type="text"
                name="floor"
                className="input"
                value={form.floor}
                onChange={handleFormChange}
                placeholder="Floor number (optional)"
              />
            </div>

            {/* Type */}
            <div>
              <label className="label">
                Type <span className="text-red-500">*</span>
              </label>
              <select name="type" className="input" value={form.type} onChange={handleFormChange}>
                <option value="">Select type…</option>
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <FieldError name="type" />
            </div>

            {/* Size */}
            <div>
              <label className="label">
                Size <span className="text-red-500">*</span>
              </label>
              <select name="size" className="input" value={form.size} onChange={handleFormChange}>
                <option value="">Select size…</option>
                {SIZES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <FieldError name="size" />
            </div>

            {/* Installation Date */}
            <div>
              <label className="label">
                Installation Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                name="installation_date"
                className="input"
                value={form.installation_date}
                onChange={handleFormChange}
              />
              <FieldError name="installation_date" />
            </div>

            {/* Expiry Date */}
            <div>
              <label className="label">
                Expiry Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                name="expiry_date"
                className="input"
                value={form.expiry_date}
                onChange={handleFormChange}
              />
              <FieldError name="expiry_date" />
            </div>

            {/* Next Inspection */}
            <div>
              <label className="label">Next Inspection</label>
              <input
                type="date"
                name="next_inspection"
                className="input"
                value={form.next_inspection}
                onChange={handleFormChange}
              />
            </div>

            {/* Status */}
            <div>
              <label className="label">Status</label>
              <select
                name="status"
                className="input"
                value={form.status}
                onChange={handleFormChange}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="label">Notes</label>
            <textarea
              name="notes"
              className="input resize-none"
              rows={3}
              value={form.notes}
              onChange={handleFormChange}
              placeholder="Optional notes…"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setShowAddEdit(false)}
              disabled={formLoading}
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={formLoading}>
              {formLoading ? 'Saving…' : editTarget ? 'Save Changes' : 'Add Extinguisher'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── View Modal ───────────────────────────────────────────────────────── */}
      <Modal
        isOpen={showView}
        onClose={() => setShowView(false)}
        title={`Extinguisher — ${viewTarget?.serial_number ?? ''}`}
        size="lg"
      >
        {viewLoading ? (
          <div className="flex justify-center py-10">
            <LoadingSpinner />
          </div>
        ) : viewDetail ? (
          <div className="space-y-6">
            {/* Details grid */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              {[
                ['Serial Number', viewDetail.serial_number],
                ['Status', <Badge status={viewDetail.status} />],
                ['Type', viewDetail.type],
                ['Size', viewDetail.size],
                ['Location', viewDetail.location],
                ['Building', viewDetail.building || '—'],
                ['Floor', viewDetail.floor || '—'],
                ['Installation Date', formatDate(viewDetail.installation_date)],
                [
                  'Expiry Date',
                  <span className={isExpired(viewDetail.expiry_date) ? 'text-red-600 font-medium' : ''}>
                    {formatDate(viewDetail.expiry_date)}
                  </span>,
                ],
                ['Next Inspection', formatDate(viewDetail.next_inspection)],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
                  <p className="mt-0.5 font-medium text-navy-900">{value}</p>
                </div>
              ))}
              {viewDetail.notes && (
                <div className="col-span-2">
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Notes</p>
                  <p className="mt-0.5 text-gray-700">{viewDetail.notes}</p>
                </div>
              )}
            </div>

            {/* Recent Inspections */}
            {viewDetail.recent_inspections?.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-navy-900 mb-2">Recent Inspections</h3>
                <div className="overflow-x-auto rounded border border-gray-100">
                  <table className="w-full text-xs">
                    <thead>
                      <tr>
                        <th className="table-th">Scheduled</th>
                        <th className="table-th">Inspector</th>
                        <th className="table-th">Status</th>
                        <th className="table-th">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewDetail.recent_inspections.slice(0, 5).map((insp) => (
                        <tr key={insp.id} className="hover:bg-gray-50">
                          <td className="table-td">{formatDate(insp.scheduled_date)}</td>
                          <td className="table-td">{insp.inspector_name ?? '—'}</td>
                          <td className="table-td">
                            <Badge status={insp.status} />
                          </td>
                          <td className="table-td max-w-[160px] truncate">{insp.notes ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Recent Maintenance */}
            {viewDetail.recent_maintenance?.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-navy-900 mb-2">Recent Maintenance</h3>
                <div className="overflow-x-auto rounded border border-gray-100">
                  <table className="w-full text-xs">
                    <thead>
                      <tr>
                        <th className="table-th">Date</th>
                        <th className="table-th">Action Taken</th>
                        <th className="table-th">Technician</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewDetail.recent_maintenance.slice(0, 5).map((log) => (
                        <tr key={log.id} className="hover:bg-gray-50">
                          <td className="table-td">{formatDate(log.date_of_maintenance)}</td>
                          <td className="table-td max-w-[180px] truncate">{log.action_taken ?? '—'}</td>
                          <td className="table-td">{log.technician_name ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex justify-between items-center pt-2">
              {/* Users can request an inspection from the detail view */}
              {!isAdmin && !isInspector && (
                <button
                  className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-lg transition-colors"
                  onClick={() => {
                    setRequestTarget(viewDetail);
                    setRequestForm({ scheduled_date: '', notes: '' });
                    setShowView(false);
                    setShowRequestInspection(true);
                  }}
                >
                  <ClipboardList className="h-4 w-4" />
                  Request Inspection
                </button>
              )}
              <button className="btn-secondary ml-auto" onClick={() => setShowView(false)}>
                Close
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-10 text-gray-400">
            <p>Failed to load details.</p>
            <button className="btn-secondary mt-4" onClick={() => setShowView(false)}>
              Close
            </button>
          </div>
        )}
      </Modal>

      {/* ── Request Inspection Modal (User role) ────────────────────────────── */}
      <Modal
        isOpen={showRequestInspection}
        onClose={() => setShowRequestInspection(false)}
        title="Request Inspection"
        size="sm"
      >
        {requestTarget && (
          <form onSubmit={handleRequestInspection} className="space-y-4">
            <div className="bg-slate-50 rounded-lg p-3 text-sm">
              <p className="text-slate-500 text-xs uppercase tracking-wide font-semibold mb-1">Extinguisher</p>
              <p className="font-semibold text-slate-800">{requestTarget.serial_number}</p>
              <p className="text-slate-500">{requestTarget.location}</p>
            </div>
            <div>
              <label className="label">Preferred Inspection Date <span className="text-red-500">*</span></label>
              <input
                type="date"
                className="input"
                min={new Date().toISOString().split('T')[0]}
                value={requestForm.scheduled_date}
                onChange={e => setRequestForm(f => ({ ...f, scheduled_date: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="label">Reason / Notes</label>
              <textarea
                className="input resize-none"
                rows={3}
                placeholder="Describe the issue or reason for requesting this inspection…"
                value={requestForm.notes}
                onChange={e => setRequestForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>
            <div className="flex justify-end gap-3 pt-1">
              <button type="button" className="btn-secondary" onClick={() => setShowRequestInspection(false)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={requestLoading}>
                {requestLoading ? 'Submitting…' : 'Submit Request'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* ── Delete Confirm ───────────────────────────────────────────────────── */}
      <ConfirmDialog
        isOpen={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={handleDelete}
        title="Delete Extinguisher"
        message={
          deleteTarget
            ? `Are you sure you want to delete extinguisher ${deleteTarget.serial_number}? This cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        loading={deleteLoading}
      />
    </div>
  );
}
