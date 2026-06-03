import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Flame, ArrowLeft, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { forgotPassword } from '../../api/auth';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  function validate() {
    if (!email.trim()) return 'Email is required.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Enter a valid email address.';
    return '';
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const err = validate();
    if (err) { setEmailError(err); return; }
    setEmailError('');
    setLoading(true);
    try {
      await forgotPassword({ email });
      setSent(true);
    } catch (err) {
      toast.error(err.message || 'Failed to send reset email.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-navy-900 to-slate-800 px-4">
      <div className="card w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-fire-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
            <Flame className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">TZW LTD</h1>
          <p className="text-gray-500 text-sm mt-1">Fire Extinguisher Management</p>
        </div>

        {sent ? (
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Email Sent</h2>
            <p className="text-sm text-gray-500 mb-6">
              We've sent password reset instructions to{' '}
              <span className="font-medium text-gray-700">{email}</span>.
              Check your inbox and follow the link to reset your password.
            </p>
            <p className="text-xs text-gray-400 mb-6">Didn't receive it? Check your spam folder or try again.</p>
            <button
              onClick={() => { setSent(false); }}
              className="btn-secondary w-full mb-3"
            >
              Try a different email
            </button>
            <Link to="/login" className="flex items-center gap-1.5 text-sm text-fire-600 hover:text-fire-700 font-medium">
              <ArrowLeft className="w-4 h-4" /> Back to Login
            </Link>
          </div>
        ) : (
          <>
            <h2 className="text-xl font-semibold text-gray-800 mb-2 text-center">Forgot your password?</h2>
            <p className="text-sm text-gray-500 mb-6 text-center">Enter your email and we'll send you a reset link.</p>

            <form onSubmit={handleSubmit} noValidate className="space-y-5">
              <div>
                <label className="label" htmlFor="fp-email">Email address</label>
                <input
                  id="fp-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); if (emailError) setEmailError(''); }}
                  className={input }
                  placeholder="you@example.com"
                />
                {emailError && <p className="mt-1 text-xs text-red-600">{emailError}</p>}
              </div>

              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>

            <div className="mt-6 text-center">
              <Link to="/login" className="flex items-center justify-center gap-1.5 text-sm text-fire-600 hover:text-fire-700 font-medium">
                <ArrowLeft className="w-4 h-4" /> Back to Login
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
