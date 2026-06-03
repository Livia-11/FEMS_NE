import { useState, useEffect, useCallback } from 'react';
import { Search, Plus, Eye, Pencil, Trash2, UserCheck, UserX } from 'lucide-react';
import toast from 'react-hot-toast';
import { listUsers, createUser, updateUser, deleteUser, activateUser, deactivateUser } from '../api/users';
import { useAuth } from '../context/AuthContext';
import Badge from '../components/Badge';
import LoadingSpinner from '../components/LoadingSpinner';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';

const ROLE_BADGE = {
  admin: 'purple',
  inspector: 'blue',
  user: 'teal',
};

const ROLE_AVATAR_BG = {
  admin: 'bg-purple-100 text-purple-700',
  inspector: 'bg-blue-100 text-blue-700',
  user: 'bg-teal-100 text-teal-700',
};

function getInitials(firstName, lastName) {
  return `${(firstName || '').charAt(0)}${(lastName || '').charAt(0)}`.toUpperCase();
}

function validatePassword(password) {
  if (!password || password.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Z]/.test(password)) return 'Password must contain an uppercase letter.';
  if (!/[a-z]/.test(password)) return 'Password must contain a lowercase letter.';
  if (!/[0-9]/.test(password)) return 'Password must contain a number.';
  return null;
}

function formatDate(dateString) {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

const EMPTY_CREATE = { first_name: '', last_name: '', email: '', role: 'inspector', password: '', confirm_password: '' };
const EMPTY_EDIT = { first_name: '', last_name: '', email: '', role: 'user' };

export default function UsersPage() {
  const { isAdmin } = useAuth();

  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [filters, setFilters] = useState({ search: '', role: '', is_active: '' });
  const [page, setPage] = useState(1);
  const limit = 10;

  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [toggleOpen, setToggleOpen] = useState(false);

  const [selectedUser, setSelectedUser] = useState(null);
  const [addForm, setAddForm] = useState(EMPTY_CREATE);
  const [editForm, setEditForm] = useState(EMPTY_EDIT);
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit };
      if (filters.search) params.search = filters.search;
      if (filters.role) params.role = filters.role;
      if (filters.is_active !== '') params.is_active = filters.is_active;
      const data = await listUsers(params);
      setUsers(data.data?.data ?? []);
      setTotal(data.data?.pagination?.total ?? 0);
    } catch (err) {
      toast.error(err.message || 'Failed to load users.');
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  function handleFilterChange(key, value) {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  }

  // --- Add User ---
  function openAdd() {
    setAddForm(EMPTY_CREATE);
    setFormErrors({});
    setAddOpen(true);
  }

  function validateAddForm() {
    const errors = {};
    if (!addForm.first_name.trim()) errors.first_name = 'First name is required.';
    if (!addForm.last_name.trim()) errors.last_name = 'Last name is required.';
    if (!addForm.email.trim()) errors.email = 'Email is required.';
    if (!addForm.role) errors.role = 'Role is required.';
    const pwErr = validatePassword(addForm.password);
    if (pwErr) errors.password = pwErr;
    if (!addForm.confirm_password) {
      errors.confirm_password = 'Please confirm the password.';
    } else if (addForm.password !== addForm.confirm_password) {
      errors.confirm_password = 'Passwords do not match.';
    }
    return errors;
  }

  async function handleAddSubmit(e) {
    e.preventDefault();
    const errors = validateAddForm();
    if (Object.keys(errors).length) { setFormErrors(errors); return; }
    setSubmitting(true);
    try {
      await createUser({
        first_name: addForm.first_name.trim(),
        last_name: addForm.last_name.trim(),
        email: addForm.email.trim(),
        role: addForm.role,
        password: addForm.password,
      });
      toast.success('User created successfully.');
      setAddOpen(false);
      fetchUsers();
    } catch (err) {
      toast.error(err.message || 'Failed to create user.');
    } finally {
      setSubmitting(false);
    }
  }

  // --- Edit User ---
  function openEdit(user) {
    setSelectedUser(user);
    setEditForm({ first_name: user.first_name || '', last_name: user.last_name || '', email: user.email || '', role: user.role || 'user' });
    setFormErrors({});
    setEditOpen(true);
  }

  function validateEditForm() {
    const errors = {};
    if (!editForm.first_name.trim()) errors.first_name = 'First name is required.';
    if (!editForm.last_name.trim()) errors.last_name = 'Last name is required.';
    if (!editForm.email.trim()) errors.email = 'Email is required.';
    return errors;
  }

  async function handleEditSubmit(e) {
    e.preventDefault();
    const errors = validateEditForm();
    if (Object.keys(errors).length) { setFormErrors(errors); return; }
    setSubmitting(true);
    try {
      await updateUser(selectedUser.id, {
        first_name: editForm.first_name.trim(),
        last_name: editForm.last_name.trim(),
        email: editForm.email.trim(),
        role: editForm.role,
      });
      toast.success('User updated successfully.');
      setEditOpen(false);
      fetchUsers();
    } catch (err) {
      toast.error(err.message || 'Failed to update user.');
    } finally {
      setSubmitting(false);
    }
  }

  // --- View User ---
  function openView(user) {
    setSelectedUser(user);
    setViewOpen(true);
  }

  // --- Delete ---
  function openDelete(user) {
    setSelectedUser(user);
    setDeleteOpen(true);
  }

  async function handleDelete() {
    setActionLoading(true);
    try {
      await deleteUser(selectedUser.id);
      toast.success('User deleted.');
      setDeleteOpen(false);
      fetchUsers();
    } catch (err) {
      toast.error(err.message || 'Failed to delete user.');
    } finally {
      setActionLoading(false);
    }
  }

  // --- Activate / Deactivate ---
  function openToggle(user) {
    setSelectedUser(user);
    setToggleOpen(true);
  }

  async function handleToggle() {
    setActionLoading(true);
    try {
      if (selectedUser.is_active) {
        await deactivateUser(selectedUser.id);
        toast.success('User deactivated.');
      } else {
        await activateUser(selectedUser.id);
        toast.success('User activated.');
      }
      setToggleOpen(false);
      fetchUsers();
    } catch (err) {
      toast.error(err.message || 'Failed to update user status.');
    } finally {
      setActionLoading(false);
    }
  }

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-navy-900">User Management</h1>
        {isAdmin && (
          <button className="btn-primary flex items-center gap-2" onClick={openAdd}>
            <Plus className="w-4 h-4" />
            Add User
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="card flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            className="input pl-9 w-full"
            placeholder="Search by name or email..."
            value={filters.search}
            onChange={e => handleFilterChange('search', e.target.value)}
          />
        </div>
        <select
          className="input w-40"
          value={filters.role}
          onChange={e => handleFilterChange('role', e.target.value)}
        >
          <option value="">All Roles</option>
          <option value="admin">Admin</option>
          <option value="inspector">Inspector</option>
          <option value="user">User</option>
        </select>
        <select
          className="input w-40"
          value={filters.is_active}
          onChange={e => handleFilterChange('is_active', e.target.value)}
        >
          <option value="">All Status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-x-auto p-0">
        {loading ? (
          <div className="flex justify-center py-16">
            <LoadingSpinner />
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-th">User</th>
                <th className="table-th">Email</th>
                <th className="table-th">Role</th>
                <th className="table-th">Status</th>
                <th className="table-th">Created</th>
                <th className="table-th">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="table-td text-center text-slate-400 py-12">No users found.</td>
                </tr>
              ) : users.map(user => (
                <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                  <td className="table-td">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${ROLE_AVATAR_BG[user.role] || 'bg-slate-100 text-slate-600'}`}>
                        {getInitials(user.first_name, user.last_name)}
                      </div>
                      <span className="font-medium text-slate-800">{user.first_name} {user.last_name}</span>
                    </div>
                  </td>
                  <td className="table-td text-slate-600">{user.email}</td>
                  <td className="table-td">
                    <Badge status={ROLE_BADGE[user.role] || 'default'}>{user.role}</Badge>
                  </td>
                  <td className="table-td">
                    <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${user.is_active ? 'text-green-700' : 'text-slate-500'}`}>
                      <span className={`w-2 h-2 rounded-full ${user.is_active ? 'bg-green-500' : 'bg-slate-400'}`} />
                      {user.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="table-td text-slate-500 text-sm">{formatDate(user.created_at)}</td>
                  <td className="table-td">
                    <div className="flex items-center gap-1">
                      <button
                        className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors"
                        title="View"
                        onClick={() => openView(user)}
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {isAdmin && (
                        <>
                          <button
                            className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors"
                            title="Edit"
                            onClick={() => openEdit(user)}
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            className={`p-1.5 rounded transition-colors ${user.is_active ? 'hover:bg-amber-50 text-amber-500 hover:text-amber-700' : 'hover:bg-green-50 text-green-500 hover:text-green-700'}`}
                            title={user.is_active ? 'Deactivate' : 'Activate'}
                            onClick={() => openToggle(user)}
                          >
                            {user.is_active ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                          </button>
                          <button
                            className="p-1.5 rounded hover:bg-red-50 text-slate-500 hover:text-red-600 transition-colors"
                            title="Delete"
                            onClick={() => openDelete(user)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
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

      {/* Add User Modal */}
      <Modal isOpen={addOpen} onClose={() => setAddOpen(false)} title="Add User" size="md">
        <form onSubmit={handleAddSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">First Name *</label>
              <input
                className={`input w-full ${formErrors.first_name ? 'border-red-400' : ''}`}
                value={addForm.first_name}
                onChange={e => setAddForm(f => ({ ...f, first_name: e.target.value }))}
                placeholder="First name"
              />
              {formErrors.first_name && <p className="text-red-500 text-xs mt-1">{formErrors.first_name}</p>}
            </div>
            <div>
              <label className="label">Last Name *</label>
              <input
                className={`input w-full ${formErrors.last_name ? 'border-red-400' : ''}`}
                value={addForm.last_name}
                onChange={e => setAddForm(f => ({ ...f, last_name: e.target.value }))}
                placeholder="Last name"
              />
              {formErrors.last_name && <p className="text-red-500 text-xs mt-1">{formErrors.last_name}</p>}
            </div>
          </div>
          <div>
            <label className="label">Email *</label>
            <input
              className={`input w-full ${formErrors.email ? 'border-red-400' : ''}`}
              type="email"
              value={addForm.email}
              onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))}
              placeholder="Email address"
            />
            {formErrors.email && <p className="text-red-500 text-xs mt-1">{formErrors.email}</p>}
          </div>
          <div>
            <label className="label">Role *</label>
            <select
              className={`input w-full ${formErrors.role ? 'border-red-400' : ''}`}
              value={addForm.role}
              onChange={e => setAddForm(f => ({ ...f, role: e.target.value }))}
            >
              <option value="inspector">Inspector</option>
              <option value="admin">Admin</option>
            </select>
            {formErrors.role && <p className="text-red-500 text-xs mt-1">{formErrors.role}</p>}
          </div>
          <div>
            <label className="label">Password *</label>
            <input
              className={`input w-full ${formErrors.password ? 'border-red-400' : ''}`}
              type="password"
              value={addForm.password}
              onChange={e => setAddForm(f => ({ ...f, password: e.target.value }))}
              placeholder="Min 8 chars, upper, lower, number"
            />
            {formErrors.password && <p className="text-red-500 text-xs mt-1">{formErrors.password}</p>}
          </div>
          <div>
            <label className="label">Confirm Password *</label>
            <input
              className={`input w-full ${formErrors.confirm_password ? 'border-red-400' : ''}`}
              type="password"
              value={addForm.confirm_password}
              onChange={e => setAddForm(f => ({ ...f, confirm_password: e.target.value }))}
              placeholder="Repeat password"
            />
            {formErrors.confirm_password && <p className="text-red-500 text-xs mt-1">{formErrors.confirm_password}</p>}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setAddOpen(false)} disabled={submitting}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit User Modal */}
      <Modal isOpen={editOpen} onClose={() => setEditOpen(false)} title="Edit User" size="md">
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">First Name *</label>
              <input
                className={`input w-full ${formErrors.first_name ? 'border-red-400' : ''}`}
                value={editForm.first_name}
                onChange={e => setEditForm(f => ({ ...f, first_name: e.target.value }))}
              />
              {formErrors.first_name && <p className="text-red-500 text-xs mt-1">{formErrors.first_name}</p>}
            </div>
            <div>
              <label className="label">Last Name *</label>
              <input
                className={`input w-full ${formErrors.last_name ? 'border-red-400' : ''}`}
                value={editForm.last_name}
                onChange={e => setEditForm(f => ({ ...f, last_name: e.target.value }))}
              />
              {formErrors.last_name && <p className="text-red-500 text-xs mt-1">{formErrors.last_name}</p>}
            </div>
          </div>
          <div>
            <label className="label">Email *</label>
            <input
              className={`input w-full ${formErrors.email ? 'border-red-400' : ''}`}
              type="email"
              value={editForm.email}
              onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
            />
            {formErrors.email && <p className="text-red-500 text-xs mt-1">{formErrors.email}</p>}
          </div>
          <div>
            <label className="label">Role</label>
            <select
              className="input w-full"
              value={editForm.role}
              onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))}
            >
              <option value="user">User</option>
              <option value="inspector">Inspector</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setEditOpen(false)} disabled={submitting}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* View User Modal */}
      <Modal isOpen={viewOpen} onClose={() => setViewOpen(false)} title="User Details" size="md">
        {selectedUser && (
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold flex-shrink-0 ${ROLE_AVATAR_BG[selectedUser.role] || 'bg-slate-100 text-slate-600'}`}>
                {getInitials(selectedUser.first_name, selectedUser.last_name)}
              </div>
              <div>
                <p className="text-lg font-bold text-slate-800">{selectedUser.first_name} {selectedUser.last_name}</p>
                <p className="text-slate-500 text-sm">{selectedUser.email}</p>
                <div className="mt-1">
                  <Badge status={ROLE_BADGE[selectedUser.role] || 'default'}>{selectedUser.role}</Badge>
                </div>
              </div>
            </div>
            <div className="border-t pt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-slate-400 text-xs font-medium uppercase tracking-wide">Status</p>
                <span className={`inline-flex items-center gap-1.5 font-medium mt-0.5 ${selectedUser.is_active ? 'text-green-700' : 'text-slate-500'}`}>
                  <span className={`w-2 h-2 rounded-full ${selectedUser.is_active ? 'bg-green-500' : 'bg-slate-400'}`} />
                  {selectedUser.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div>
                <p className="text-slate-400 text-xs font-medium uppercase tracking-wide">Member Since</p>
                <p className="mt-0.5 text-slate-700">{formatDate(selectedUser.created_at)}</p>
              </div>
              {selectedUser.last_login && (
                <div>
                  <p className="text-slate-400 text-xs font-medium uppercase tracking-wide">Last Login</p>
                  <p className="mt-0.5 text-slate-700">{formatDate(selectedUser.last_login)}</p>
                </div>
              )}
            </div>
            <div className="flex justify-end">
              <button className="btn-secondary" onClick={() => setViewOpen(false)}>Close</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete User"
        message={selectedUser ? `Are you sure you want to delete ${selectedUser.first_name} ${selectedUser.last_name}? This action cannot be undone.` : ''}
        confirmLabel="Delete"
        loading={actionLoading}
      />

      {/* Deactivate Confirm */}
      <ConfirmDialog
        isOpen={toggleOpen}
        onClose={() => setToggleOpen(false)}
        onConfirm={handleToggle}
        title={selectedUser?.is_active ? 'Deactivate User' : 'Activate User'}
        message={
          selectedUser
            ? selectedUser.is_active
              ? `Are you sure you want to deactivate ${selectedUser.first_name} ${selectedUser.last_name}'s account?`
              : `Are you sure you want to activate ${selectedUser.first_name} ${selectedUser.last_name}'s account?`
            : ''
        }
        confirmLabel={selectedUser?.is_active ? 'Deactivate' : 'Activate'}
        loading={actionLoading}
      />
    </div>
  );
}
