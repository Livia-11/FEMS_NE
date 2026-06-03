import { useState, useEffect } from 'react';
import { KeyRound, User } from 'lucide-react';
import toast from 'react-hot-toast';
import { updateProfile } from '../api/users';
import { changePassword, getMe } from '../api/auth';
import { useAuth } from '../context/AuthContext';
import Badge from '../components/Badge';
import LoadingSpinner from '../components/LoadingSpinner';

const ROLE_BADGE = {
  admin: 'purple',
  inspector: 'blue',
  user: 'teal',
};

function getInitials(firstName, lastName) {
  return `${(firstName || '').charAt(0)}${(lastName || '').charAt(0)}`.toUpperCase();
}

function formatDate(dateString) {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

function validateNewPassword(password) {
  if (!password || password.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Z]/.test(password)) return 'Password must contain an uppercase letter.';
  if (!/[a-z]/.test(password)) return 'Password must contain a lowercase letter.';
  if (!/[0-9]/.test(password)) return 'Password must contain a number.';
  return null;
}

const EMPTY_PW = { current_password: '', new_password: '', confirm_new_password: '' };

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();

  const [profileForm, setProfileForm] = useState({ first_name: '', last_name: '' });
  const [profileErrors, setProfileErrors] = useState({});
  const [profileLoading, setProfileLoading] = useState(false);

  const [pwForm, setPwForm] = useState(EMPTY_PW);
  const [pwErrors, setPwErrors] = useState({});
  const [pwLoading, setPwLoading] = useState(false);

  const [accountInfo, setAccountInfo] = useState(null);
  const [infoLoading, setInfoLoading] = useState(true);

  useEffect(() => {
    if (user) {
      setProfileForm({ first_name: user.first_name || '', last_name: user.last_name || '' });
    }
  }, [user]);

  useEffect(() => {
    async function fetchMe() {
      setInfoLoading(true);
      try {
        const data = await getMe();
        setAccountInfo(data.data?.user ?? data.data);
      } catch {
        setAccountInfo(user);
      } finally {
        setInfoLoading(false);
      }
    }
    fetchMe();
  }, [user]);

  // --- Profile Update ---
  function validateProfile() {
    const errors = {};
    if (!profileForm.first_name.trim()) errors.first_name = 'First name is required.';
    if (!profileForm.last_name.trim()) errors.last_name = 'Last name is required.';
    return errors;
  }

  async function handleProfileSubmit(e) {
    e.preventDefault();
    const errors = validateProfile();
    if (Object.keys(errors).length) { setProfileErrors(errors); return; }
    setProfileLoading(true);
    try {
      await updateProfile({ first_name: profileForm.first_name.trim(), last_name: profileForm.last_name.trim() });
      await refreshUser();
      toast.success('Profile updated.');
    } catch (err) {
      toast.error(err.message || 'Failed to update profile.');
    } finally {
      setProfileLoading(false);
    }
  }

  // --- Change Password ---
  function validatePw() {
    const errors = {};
    if (!pwForm.current_password) errors.current_password = 'Current password is required.';
    const newPwErr = validateNewPassword(pwForm.new_password);
    if (newPwErr) {
      errors.new_password = newPwErr;
    } else if (pwForm.new_password === pwForm.current_password) {
      errors.new_password = 'New password must differ from current password.';
    }
    if (!pwForm.confirm_new_password) {
      errors.confirm_new_password = 'Please confirm your new password.';
    } else if (pwForm.new_password !== pwForm.confirm_new_password) {
      errors.confirm_new_password = 'Passwords do not match.';
    }
    return errors;
  }

  async function handlePwSubmit(e) {
    e.preventDefault();
    const errors = validatePw();
    if (Object.keys(errors).length) { setPwErrors(errors); return; }
    setPwLoading(true);
    try {
      await changePassword({ current_password: pwForm.current_password, new_password: pwForm.new_password });
      toast.success('Password changed successfully.');
      setPwForm(EMPTY_PW);
      setPwErrors({});
    } catch (err) {
      toast.error(err.message || 'Failed to change password.');
    } finally {
      setPwLoading(false);
    }
  }

  const displayUser = accountInfo || user;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-navy-900">My Profile</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Section 1: Profile Information */}
        <div className="card space-y-5">
          <div className="flex items-center gap-3 border-b pb-4">
            <User className="w-5 h-5 text-fire-600" />
            <h2 className="text-lg font-semibold text-slate-800">Profile Information</h2>
          </div>

          {/* Avatar + identity */}
          <div className="flex flex-col items-center gap-3 py-2">
            <div className="w-20 h-20 rounded-full bg-fire-100 text-fire-700 flex items-center justify-center font-bold text-2xl select-none">
              {getInitials(displayUser?.first_name, displayUser?.last_name)}
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-slate-800">{displayUser?.first_name} {displayUser?.last_name}</p>
              <p className="text-slate-500 text-sm mt-0.5">{displayUser?.email}</p>
              <div className="mt-2 flex justify-center">
                <Badge status={ROLE_BADGE[displayUser?.role] || 'default'}>{displayUser?.role}</Badge>
              </div>
            </div>
          </div>

          {/* Edit form */}
          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <div>
              <label className="label">First Name *</label>
              <input
                className={`input w-full ${profileErrors.first_name ? 'border-red-400' : ''}`}
                value={profileForm.first_name}
                onChange={e => setProfileForm(f => ({ ...f, first_name: e.target.value }))}
                placeholder="First name"
              />
              {profileErrors.first_name && <p className="text-red-500 text-xs mt-1">{profileErrors.first_name}</p>}
            </div>
            <div>
              <label className="label">Last Name *</label>
              <input
                className={`input w-full ${profileErrors.last_name ? 'border-red-400' : ''}`}
                value={profileForm.last_name}
                onChange={e => setProfileForm(f => ({ ...f, last_name: e.target.value }))}
                placeholder="Last name"
              />
              {profileErrors.last_name && <p className="text-red-500 text-xs mt-1">{profileErrors.last_name}</p>}
            </div>
            <div>
              <label className="label">Email</label>
              <input
                className="input w-full bg-slate-50 text-slate-400 cursor-not-allowed"
                value={displayUser?.email || ''}
                readOnly
                disabled
              />
              <p className="text-xs text-slate-400 mt-1">Email cannot be changed here.</p>
            </div>
            <div className="flex justify-end">
              <button type="submit" className="btn-primary" disabled={profileLoading}>
                {profileLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>

        {/* Section 2: Change Password */}
        <div className="card space-y-5">
          <div className="flex items-center gap-3 border-b pb-4">
            <KeyRound className="w-5 h-5 text-fire-600" />
            <h2 className="text-lg font-semibold text-slate-800">Change Password</h2>
          </div>

          <form onSubmit={handlePwSubmit} className="space-y-4">
            <div>
              <label className="label">Current Password *</label>
              <input
                className={`input w-full ${pwErrors.current_password ? 'border-red-400' : ''}`}
                type="password"
                value={pwForm.current_password}
                onChange={e => setPwForm(f => ({ ...f, current_password: e.target.value }))}
                placeholder="Your current password"
                autoComplete="current-password"
              />
              {pwErrors.current_password && <p className="text-red-500 text-xs mt-1">{pwErrors.current_password}</p>}
            </div>
            <div>
              <label className="label">New Password *</label>
              <input
                className={`input w-full ${pwErrors.new_password ? 'border-red-400' : ''}`}
                type="password"
                value={pwForm.new_password}
                onChange={e => setPwForm(f => ({ ...f, new_password: e.target.value }))}
                placeholder="Min 8 chars, upper, lower, number"
                autoComplete="new-password"
              />
              {pwErrors.new_password && <p className="text-red-500 text-xs mt-1">{pwErrors.new_password}</p>}
            </div>
            <div>
              <label className="label">Confirm New Password *</label>
              <input
                className={`input w-full ${pwErrors.confirm_new_password ? 'border-red-400' : ''}`}
                type="password"
                value={pwForm.confirm_new_password}
                onChange={e => setPwForm(f => ({ ...f, confirm_new_password: e.target.value }))}
                placeholder="Repeat new password"
                autoComplete="new-password"
              />
              {pwErrors.confirm_new_password && <p className="text-red-500 text-xs mt-1">{pwErrors.confirm_new_password}</p>}
            </div>
            <p className="text-xs text-slate-400">
              Password must be at least 8 characters and include uppercase, lowercase, and a number.
            </p>
            <div className="flex justify-end">
              <button type="submit" className="btn-primary" disabled={pwLoading}>
                {pwLoading ? 'Updating...' : 'Change Password'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Account Information */}
      <div className="card space-y-4">
        <h2 className="text-lg font-semibold text-slate-800 border-b pb-4">Account Information</h2>
        {infoLoading ? (
          <div className="flex justify-center py-6">
            <LoadingSpinner />
          </div>
        ) : (
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <dt className="text-xs font-medium text-slate-400 uppercase tracking-wide">Account ID</dt>
              <dd className="mt-1 text-sm font-mono text-slate-700">{displayUser?.id || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-400 uppercase tracking-wide">Role</dt>
              <dd className="mt-1">
                <Badge status={ROLE_BADGE[displayUser?.role] || 'default'}>{displayUser?.role}</Badge>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-400 uppercase tracking-wide">Email</dt>
              <dd className="mt-1 text-sm text-slate-700 flex items-center gap-1.5">
                {displayUser?.email}
                {displayUser?.email_verified && (
                  <span className="text-xs text-green-600 font-medium">(verified)</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-400 uppercase tracking-wide">Member Since</dt>
              <dd className="mt-1 text-sm text-slate-700">{formatDate(displayUser?.created_at)}</dd>
            </div>
            {displayUser?.last_login && (
              <div>
                <dt className="text-xs font-medium text-slate-400 uppercase tracking-wide">Last Login</dt>
                <dd className="mt-1 text-sm text-slate-700">{formatDate(displayUser.last_login)}</dd>
              </div>
            )}
          </dl>
        )}
      </div>
    </div>
  );
}
