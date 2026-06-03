import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Flame, Mail } from 'lucide-react';
import toast from 'react-hot-toast';
import { verifyEmail, resendOtp } from '../../api/auth';
import { useAuth } from '../../context/AuthContext';

const OTP_LENGTH = 6;
const RESEND_COUNTDOWN = 60;

export default function VerifyEmailPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { login } = useAuth();
  const email = location.state?.email;
  const [digits, setDigits] = useState(Array(OTP_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(RESEND_COUNTDOWN);
  const [devOtp, setDevOtp] = useState(location.state?.devOtp ?? null);
  const inputRefs = useRef([]);

  useEffect(() => {
    if (!email) navigate('/login', { replace: true });
  }, [email, navigate]);

  useEffect(() => {
    if (countdown <= 0) return;
    const id = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(id);
  }, [countdown]);

  useEffect(() => { inputRefs.current[0]?.focus(); }, []);

  const handleDigitChange = useCallback((index, value) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);
    if (digit && index < OTP_LENGTH - 1) inputRefs.current[index + 1]?.focus();
  }, [digits]);

  function handleKeyDown(index, e) {
    if (e.key === 'Backspace') {
      if (digits[index]) {
        const next = [...digits]; next[index] = ''; setDigits(next);
      } else if (index > 0) {
        inputRefs.current[index - 1]?.focus();
        const next = [...digits]; next[index - 1] = ''; setDigits(next);
      }
    }
  }

  function handlePaste(e) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (!pasted) return;
    const next = Array(OTP_LENGTH).fill('');
    pasted.split('').forEach((ch, i) => { next[i] = ch; });
    setDigits(next);
    inputRefs.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const otp = digits.join('');
    if (otp.length < OTP_LENGTH) { toast.error('Please enter all 6 digits.'); return; }
    setLoading(true);
    try {
      const res = await verifyEmail({ email, otp });
      if (res.data?.token) {
        login(res.data.token, res.data.user);
        toast.success('Email verified! Welcome aboard.');
        navigate('/dashboard');
      } else {
        toast.success('Email verified! Please sign in.');
        navigate('/login');
      }
    } catch (err) {
      toast.error(err.message || 'Verification failed.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (countdown > 0) return;
    setResending(true);
    try {
      const res = await resendOtp({ email });
      setCountdown(RESEND_COUNTDOWN);
      setDigits(Array(OTP_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
      toast.success('A new OTP has been sent to your email.');
      const otp = res.data?.otp || res.data?.dev_otp;
      if (otp) setDevOtp(String(otp));
    } catch (err) {
      toast.error(err.message || 'Failed to resend OTP.');
    } finally {
      setResending(false);
    }
  }

  if (!email) return null;

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

        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mb-3">
            <Mail className="w-6 h-6 text-blue-500" />
          </div>
          <h2 className="text-xl font-semibold text-gray-800">Verify your email</h2>
          <p className="text-sm text-gray-500 mt-1 text-center">
            We sent a 6-digit code to{' '}
            <span className="font-medium text-gray-700">{email}</span>
          </p>
        </div>

        {devOtp && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800 text-center">
            Dev OTP: <span className="font-mono font-bold tracking-widest">{devOtp}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="flex justify-center gap-2 mb-6" onPaste={handlePaste}>
            {digits.map((digit, i) => (
              <input
                key={i}
                ref={(el) => (inputRefs.current[i] = el)}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleDigitChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                className={`w-11 h-12 text-center text-xl font-bold border-2 rounded-lg outline-none transition-colors focus:border-fire-500 focus:ring-2 focus:ring-fire-500/20 ${digit ? 'border-fire-500 bg-fire-50' : 'border-slate-300'}`}
              />
            ))}
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full mb-4">
            {loading ? 'Verifying...' : 'Verify Email'}
          </button>
        </form>

        <div className="text-center text-sm text-gray-500">
          Didn't receive a code?{' '}
          {countdown > 0 ? (
            <span className="text-gray-400">Resend in <span className="font-medium text-gray-600">{countdown}s</span></span>
          ) : (
            <button onClick={handleResend} disabled={resending} className="text-fire-600 hover:text-fire-700 font-medium disabled:opacity-50">
              {resending ? 'Sending...' : 'Resend OTP'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
