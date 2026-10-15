import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { api, toastError, clearAuthSession } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { LogIn, Eye, EyeOff, ArrowLeft, AlertCircle, Mail } from 'lucide-react';
import { scrollToAndFocus, ERROR_INPUT_CLASS } from '@/lib/formValidation';

import ThemeToggle from '@/components/ThemeToggle';

export default function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [unverifiedInfo, setUnverifiedInfo] = useState(null); // { email, user_id }
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const errorParam = params.get('error');
    if (errorParam) {
      const errorMap = {
        'google_auth_failed': 'Google authentication was cancelled or failed.',
        'no_code': 'No authorization code received from Google.',
        'token_exchange_failed': 'Failed to exchange Google token. Please try again.',
        'invalid_token': 'Invalid token received from Google.',
        'account_inactive': 'Your account is inactive. Please contact support.',
        'google_auth_exception': 'An unexpected error occurred during Google authentication. Please try again.'
      };
      setError(errorMap[errorParam] || 'Google authentication failed.');

      // Clean up the URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [location.search]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setFieldErrors(prev => {
      const copy = { ...prev };
      delete copy[e.target.name];
      return copy;
    });
    if (error) setError('');
    if (unverifiedInfo) setUnverifiedInfo(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setUnverifiedInfo(null);

    const errs = {};
    if (!form.email?.trim()) errs.email = 'Email or Mobile Number is required.';
    if (!form.password) errs.password = 'Password is required.';

    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      toast.error('Please enter all required fields.');
      scrollToAndFocus(Object.keys(errs)[0]);
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/login', {
        email: form.email.trim(),
        password: form.password,
      });
      clearAuthSession();
      localStorage.setItem('token', res.data.access_token);

      const userData = res.data.user?.data || res.data.user;
      localStorage.setItem('user', JSON.stringify(userData));

      toast.success(`Welcome back, ${userData.full_name?.split(' ')[0] || 'there'}! 👋`);

      if (userData.role === 'applicant') {
        window.location.href = '/portal/dashboard';
      } else {
        window.location.href = '/admin';
      }
    } catch (err) {
      const status = err.response?.status;
      const data = err.response?.data;
      const detail = data?.detail || data?.message || '';

      if (!err.response) {
        setError('Cannot connect to the server. Please check your internet connection.');
      } else if (status === 403 && data?.email_not_verified) {
        // Account exists but email not verified
        setUnverifiedInfo({ email: data.email, user_id: data.user_id });
        setError('Please verify your email address before signing in. Check your inbox for the verification code.');
      } else if (status === 401 || /invalid (email|credentials|password)/i.test(detail)) {
        setError('The email/mobile number or password you entered is incorrect. Please try again, or create a new account if you don\'t have one.');
      } else if (status === 429 || /too many|locked/i.test(detail)) {
        setError(detail || 'Too many failed attempts. Your account is temporarily throttled for security. Please try again in a few moments.');
      } else if (status === 403 || /deactivated|disabled/i.test(detail)) {
        setError('This account has been deactivated. Please contact the CSWDD office at (085) 342-5620 for assistance.');
      } else if (status === 404 || /not found/i.test(detail)) {
        setError('No account found with that email or mobile number. Please check your credentials or register for a new account.');
      } else {
        toastError(err);
      }
    } finally {
      setLoading(false);
    }
  };

  // ─── Resend verification from login page ─────────────────────────
  const handleResendFromLogin = async () => {
    if (!unverifiedInfo) return;
    try {
      await api.post('/auth/email/resend', { user_id: unverifiedInfo.user_id });
      toast.success('Verification code sent! Check your email.');
      // Navigate to register page with verification step
      navigate('/register', { state: { verifyUserId: unverifiedInfo.user_id, verifyEmail: unverifiedInfo.email } });
    } catch (err) {
      toastError(err, 'Failed to resend verification code.');
    }
  };

  // ─── Google Sign-In ──────────────────────────────────────────────
  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const res = await api.get('/google/redirect');
      if (res.data.url) {
        window.location.href = res.data.url;
      }
    } catch (err) {
      setGoogleLoading(false);
      toastError(err, 'Failed to connect to Google. Please try again.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-muted/40 via-background to-muted/30 px-4 py-8 sm:py-12">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-between mb-6">
          <Link to="/" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-primary transition-colors touch-manipulation min-h-[40px]">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
          </Link>
          <ThemeToggle />
        </div>

        <div className="card-pop rounded-3xl border border-border/80 bg-card p-4 sm:p-8 shadow-xl space-y-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex -space-x-2">
                <img src="/images/seal.gif" alt="Butuan Seal" className="h-10 w-10 rounded-full border-2 border-card shadow-xs object-cover" />
                <img src="/images/cswdd.jpg" alt="CSWDD Logo" className="h-10 w-10 rounded-full border-2 border-card shadow-xs object-cover bg-white" />
              </div>
              <span className="font-bold text-lg text-[#0e4b65] dark:text-cyan-400" style={{ fontFamily: 'Outfit, sans-serif' }}>
                Solo Parent Portal
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Sign in to your account</h1>
            <p className="text-sm text-muted-foreground">Enter your credentials to access the portal.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className={fieldErrors.email ? 'text-destructive font-medium' : ''}>
                Email or Mobile Number <span className="text-destructive font-bold">*</span>
              </Label>
              <Input
                id="email"
                name="email"
                type="text"
                inputMode="email"
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="username"
                placeholder="Email or Mobile Number (e.g. 09171234567)"
                value={form.email}
                onChange={handleChange}
                data-testid="login-email-input"
                className={`h-11 ${fieldErrors.email ? ERROR_INPUT_CLASS : ''}`}
              />
              {fieldErrors.email && (
                <p className="text-xs text-destructive font-medium flex items-center gap-1 mt-1 animate-in fade-in">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />{fieldErrors.email}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className={fieldErrors.password ? 'text-destructive font-medium' : ''}>
                Password <span className="text-destructive font-bold">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={handleChange}
                  data-testid="login-password-input"
                  className={`h-11 pr-10 ${fieldErrors.password ? ERROR_INPUT_CLASS : ''}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-0 top-0 bottom-0 px-3.5 flex items-center justify-center min-w-[44px] text-muted-foreground hover:text-foreground touch-manipulation cursor-pointer"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {fieldErrors.password && (
                <p className="text-xs text-destructive font-medium flex items-center gap-1 mt-1 animate-in fade-in">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />{fieldErrors.password}
                </p>
              )}
              <div className="flex justify-end mt-1">
                <Link to="/forgot-password" className="text-sm font-medium text-primary hover:underline">
                  Forgot Password?
                </Link>
              </div>
            </div>

            {/* Inline error alert */}
            {error && (
              <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <div className="space-y-2">
                  <span>{error}</span>
                  {unverifiedInfo && (
                    <button
                      type="button"
                      onClick={handleResendFromLogin}
                      className="block text-primary hover:underline font-medium text-sm cursor-pointer"
                    >
                      <Mail className="inline h-3 w-3 mr-1" />
                      Resend verification code
                    </button>
                  )}
                </div>
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-11 text-base font-semibold"
              disabled={loading}
              data-testid="login-submit-button"
            >
              {loading ? 'Signing in…' : (
                <><LogIn className="mr-2 h-4 w-4" /> Sign In</>
              )}
            </Button>
          </form>

          {/* ──────── OR Divider ──────── */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-3 text-muted-foreground font-medium">Or</span>
            </div>
          </div>

          {/* ──────── Google Sign-In Button ──────── */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading}
            data-testid="google-signin-button"
            className="w-full h-11 flex items-center justify-center gap-3 rounded-md border border-border
              bg-white hover:bg-gray-50 active:bg-gray-100
              text-gray-700 font-medium text-sm
              transition-colors duration-150
              disabled:opacity-60 disabled:cursor-not-allowed
              focus:outline-none focus:ring-2 focus:ring-primary/20 focus:ring-offset-1
              shadow-sm cursor-pointer"
          >
            {googleLoading ? (
              <div className="h-5 w-5 border-2 border-gray-300 border-t-primary rounded-full animate-spin" />
            ) : (
              <svg className="h-5 w-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
            )}
            <span>{googleLoading ? 'Connecting…' : 'Continue with Google'}</span>
          </button>

          <p className="text-center text-sm text-muted-foreground">
            Don't have an account?{' '}
            <Link to="/register" className="text-primary font-medium hover:underline">
              Register here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
