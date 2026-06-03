import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Flame, Eye, EyeOff, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { resetPassword } from '../../api/auth';

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [form, setForm] = useState({ password: '', confirm_password: '' });
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  function validate() {
    const errs = {};
    if (!form.password) {
      errs.password = 'Password is required.';
    } else if (!PASSWORD_REGEX.test(form.password)) {
      errs.password = 'Password must be at least 8 characters and include uppercase, lowercase, and a number.';
    }
    if (!form.confirm_password) {
      errs.confirm_password = 'Please confirm your password.';
    } else if (form.password !== form.confirm_password) {
      errs.confirm_password = 'Passwords do not match.';
    }
    return errs;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setLoading(true);
    try {
      await resetPassword({ token, password: form.password });
      toast.success('Password reset successfully!');
      navigate('/login');
    } catch (err) {
      toast.error(err.message || 'Failed to reset password.');
    } finally {
      setLoading(false);
    }
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined }));
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-navy-900 to-slate-800 px-4">
      <div className="card w-full max-w-md p-8">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-fire-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
            <Flame className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">TZW LTD</h1>
          <p className="text-gray-500 text-sm mt-1">Fire Extinguisher Management</p>
        </div>

        {!token ? (
          <div className="flex flex-col items-center text-center">
            <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="w-6 h-6 text-red-500" />
            </div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Invalid Reset Link</h2>
            <p className="text-sm text-gray-500 mb-6">This password reset link is invalid or has expired. Please request a new one.</p>
            <Link to="/forgot-password" className="btn-primary w-full text-center">Request New Link</Link>
          </div>
        ) : (
          <>
            <h2 className="text-xl font-semibold text-gray-800 mb-2 text-center">Set new password</h2>
            <p className="text-sm text-gray-500 mb-6 text-center">Choose a strong password for your account.</p>

            <form onSubmit={handleSubmit} noValidate className="space-y-5">
              <div>
                <label className="label" htmlFor="rp-password">New password</label>
                <div className="relative">
                  <input
                    id="rp-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={form.password}
                    onChange={handleChange}
                    className="input pr-10"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password}</p>}
                {!errors.password && <p className="mt-1 text-xs text-gray-400">Min 8 chars, uppercase, lowercase, and number.</p>}
              </div>

              <div>
                <label className="label" htmlFor="rp-confirm">Confirm new password</label>
                <div className="relative">
                  <input
                    id="rp-confirm"
                    name="confirm_password"
                    type={showConfirm ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={form.confirm_password}
                    onChange={handleChange}
                    className="input pr-10"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600"
                    tabIndex={-1}
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.confirm_password && <p className="mt-1 text-xs text-red-600">{errors.confirm_password}</p>}
              </div>

              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? 'Resetting...' : 'Reset Password'}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-gray-500">
              Remember your password?{' '}
              <Link to="/login" className="text-fire-600 hover:text-fire-700 font-medium">Sign In</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
