import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Flame, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { login as loginApi } from '../../api/auth';
import { useAuth } from '../../context/AuthContext';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  function validate() {
    const errs = {};
    if (!form.email.trim()) {
      errs.email = 'Email is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errs.email = 'Enter a valid email address.';
    }
    if (!form.password) {
      errs.password = 'Password is required.';
    }
    return errs;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      const res = await loginApi({ email: form.email, password: form.password });
      login(res.data.token, res.data.user);
      toast.success(`Welcome back, ${res.data.user.first_name}!`);
      navigate('/dashboard');
    } catch (err) {
      const msg = err.message || 'Login failed.';
      if (msg.toLowerCase().includes('verify') || msg.toLowerCase().includes('not verified')) {
        navigate('/verify-email', { state: { email: form.email } });
      } else {
        toast.error(msg);
      }
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
      <div className="card w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-fire-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
            <Flame className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">TZW LTD</h1>
          <p className="text-gray-500 text-sm mt-1">Fire Extinguisher Management</p>
        </div>

        <h2 className="text-xl font-semibold text-gray-800 mb-6 text-center">Sign in to your account</h2>

        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          {/* Email */}
          <div>
            <label className="label" htmlFor="email">Email address</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={handleChange}
              className={`input ${errors.email ? 'border-red-500 focus:ring-red-500' : ''}`}
              placeholder="you@example.com"
            />
            {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
          </div>

          {/* Password */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="label mb-0" htmlFor="password">Password</label>
              <Link
                to="/forgot-password"
                className="text-xs text-fire-600 hover:text-fire-700 font-medium"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={form.password}
                onChange={handleChange}
                className={`input pr-10 ${errors.password ? 'border-red-500 focus:ring-red-500' : ''}`}
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
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          Don't have an account?{' '}
          <Link to="/register" className="text-fire-600 hover:text-fire-700 font-medium">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}
