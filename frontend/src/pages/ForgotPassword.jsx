import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, toastError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { ArrowLeft, AlertCircle, Mail, CheckCircle2, RefreshCw, Send, Lock, Eye, EyeOff, KeyRound } from 'lucide-react';
import { scrollToAndFocus, ERROR_INPUT_CLASS } from '@/lib/formValidation';
import ThemeToggle from '@/components/ThemeToggle';

export default function ForgotPassword() {
  const navigate = useNavigate();

  // Flow: 'email' → 'verify' → 'password' → 'success'
  const [flowState, setFlowState] = useState('email');
  const [email, setEmail] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [userId, setUserId] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Verification code state
  const [verificationCode, setVerificationCode] = useState(['', '', '', '', '', '']);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState('');
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const inputRefs = useRef([]);

  // New password state
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) { clearInterval(timer); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Step 1: Send reset code
  const handleSendCode = async () => {
    setError('');
    if (!email.trim()) {
      setFieldErrors({ email: 'Email Address is required.' });
      toast.error('Please enter your email address.');
      scrollToAndFocus('email');
      return;
    }
    setFieldErrors({});
    setLoading(true);
    try {
      const res = await api.post('/auth/forgot-password', { email: email.trim() });
      if (res.data?.code_sent) {
        setUserId(res.data.user_id);
        setMaskedEmail(res.data.email);
        setFlowState('verify');
        setCooldown(60);
        toast.success('Reset code sent to your email.');
      } else {
        // No code_sent means email not found, but we still show generic message
        toast.info(res.data?.message || 'If an account with that email exists, a reset code has been sent.');
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to send reset code. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Code input handlers
  const handleCodeChange = (index, value) => {
    if (verifyError) setVerifyError('');
    if (!/^\d*$/.test(value)) return;
    const newCode = [...verificationCode];
    
    if (value.length > 1) {
      // Handle paste
      const digits = value.replace(/\D/g, '').slice(0, 6).split('');
      digits.forEach((d, i) => { if (i + index < 6) newCode[i + index] = d; });
      setVerificationCode(newCode);
      const nextIdx = Math.min(index + digits.length, 5);
      inputRefs.current[nextIdx]?.focus();
      return;
    }

    newCode[index] = value;
    setVerificationCode(newCode);
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleCodeKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !verificationCode[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // Step 2: Verify code + set new password
  const handleResetPassword = async () => {
    setVerifyError('');
    const code = verificationCode.join('');
    const errs = {};
    
    if (code.length !== 6) {
      setVerifyError('Please enter the full 6-digit code.');
      inputRefs.current[code.length]?.focus();
      return;
    }

    if (!password) {
      errs.password = 'New Password is required.';
    } else if (password.length < 8) {
      errs.password = 'Password must be at least 8 characters.';
    }

    if (!confirmPassword) {
      errs.confirmPassword = 'Confirm Password is required.';
    } else if (password !== confirmPassword) {
      errs.confirmPassword = 'Passwords do not match.';
    }

    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      toast.error('Please complete all required fields.');
      scrollToAndFocus(Object.keys(errs)[0]);
      return;
    }
    setFieldErrors({});

    setVerifying(true);
    try {
      const res = await api.post('/auth/reset-password', {
        user_id: userId,
        code,
        password,
      });
      if (res.data?.success) {
        setFlowState('success');
        toast.success('Password reset successfully!');
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to reset password. Please try again.';
      setVerifyError(msg);
      if (err.response?.data?.expired) {
        setVerifyError('Code has expired. Please request a new one.');
      }
    } finally {
      setVerifying(false);
    }
  };

  // Resend code
  const handleResend = async () => {
    if (cooldown > 0 || resending) return;
    setResending(true);
    setVerifyError('');
    try {
      const res = await api.post('/auth/reset-code/resend', { user_id: userId });
      setCooldown(res.data?.cooldown_seconds || 60);
      setMaskedEmail(res.data?.email || maskedEmail);
      setVerificationCode(['', '', '', '', '', '']);
      toast.success('A new reset code has been sent.');
    } catch (err) {
      const msg = err.response?.data?.message || 'Could not resend code.';
      if (err.response?.data?.cooldown_seconds) {
        setCooldown(err.response.data.cooldown_seconds);
      }
      setVerifyError(msg);
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-surface-muted via-background to-background px-4 py-12">
      <div className="w-full max-w-md">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-6">
          <Link to="/login" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-primary transition-colors touch-manipulation min-h-[40px]">
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to Sign In
          </Link>
          <ThemeToggle />
        </div>

        <div className="card-pop rounded-3xl border-2 border-border/60 bg-card p-8 shadow-xl">
          
          {/* ── Email Input Step ──────────────────────── */}
          {flowState === 'email' && (
            <>
              <div className="text-center mb-8">
                <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <KeyRound className="h-7 w-7 text-primary" />
                </div>
                <h1 className="text-2xl font-bold text-foreground">Forgot Password?</h1>
                <p className="text-sm text-muted-foreground mt-2">
                  Enter the email address associated with your account and we'll send you a verification code to reset your password.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="email" className={fieldErrors.email ? 'text-destructive font-medium' : ''}>
                    Email Address <span className="text-destructive font-bold">*</span>
                  </Label>
                  <div className="relative mt-1.5">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setError('');
                        setFieldErrors(prev => { const c = { ...prev }; delete c.email; return c; });
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendCode()}
                      placeholder="your.email@example.com"
                      className={`pl-10 ${fieldErrors.email ? ERROR_INPUT_CLASS : ''}`}
                      autoFocus
                    />
                  </div>
                  {fieldErrors.email && (
                    <p className="text-xs text-destructive font-medium flex items-center gap-1 mt-1 animate-in fade-in">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />{fieldErrors.email}
                    </p>
                  )}
                </div>

                {error && (
                  <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <Button onClick={handleSendCode} disabled={loading} className="w-full gap-2 h-11">
                  {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {loading ? 'Sending...' : 'Send Reset Code'}
                </Button>
              </div>
            </>
          )}

          {/* ── Verification + New Password Step ────── */}
          {flowState === 'verify' && (
            <>
              <div className="text-center mb-6">
                <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Mail className="h-7 w-7 text-primary" />
                </div>
                <h1 className="text-2xl font-bold text-foreground">Reset Your Password</h1>
                <p className="text-sm text-muted-foreground mt-2">
                  Enter the 6-digit code sent to <span className="font-semibold text-foreground">{maskedEmail}</span> and set your new password.
                </p>
              </div>

              <div className="space-y-5">
                {/* Code inputs */}
                <div>
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Verification Code <span className="text-destructive font-bold">*</span>
                  </Label>
                  <div className="flex gap-2 justify-center mt-2">
                    {verificationCode.map((digit, i) => (
                      <Input
                        key={i}
                        ref={(el) => { inputRefs.current[i] = el; }}
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={digit}
                        onChange={(e) => handleCodeChange(i, e.target.value)}
                        onKeyDown={(e) => handleCodeKeyDown(i, e)}
                        onPaste={(e) => {
                          e.preventDefault();
                          const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
                          if (text) handleCodeChange(0, text);
                        }}
                        className="w-11 h-12 text-center text-lg font-bold rounded-xl border-2 focus:border-primary"
                        autoFocus={i === 0}
                      />
                    ))}
                  </div>
                </div>

                {/* New password */}
                <div>
                  <Label htmlFor="new-password" className={fieldErrors.password ? 'text-destructive font-medium' : ''}>
                    New Password <span className="text-destructive font-bold">*</span>
                  </Label>
                  <div className="relative mt-1.5">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="new-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setFieldErrors(prev => { const c = { ...prev }; delete c.password; return c; });
                      }}
                      placeholder="Min. 8 characters"
                      className={`pl-10 pr-10 ${fieldErrors.password ? ERROR_INPUT_CLASS : ''}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {fieldErrors.password && (
                    <p className="text-xs text-destructive font-medium flex items-center gap-1 mt-1 animate-in fade-in">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />{fieldErrors.password}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="confirm-password" className={fieldErrors.confirmPassword ? 'text-destructive font-medium' : ''}>
                    Confirm Password <span className="text-destructive font-bold">*</span>
                  </Label>
                  <div className="relative mt-1.5">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="confirm-password"
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        setFieldErrors(prev => { const c = { ...prev }; delete c.confirmPassword; return c; });
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && handleResetPassword()}
                      placeholder="Re-enter new password"
                      className={`pl-10 ${fieldErrors.confirmPassword ? ERROR_INPUT_CLASS : ''}`}
                    />
                  </div>
                  {fieldErrors.confirmPassword && (
                    <p className="text-xs text-destructive font-medium flex items-center gap-1 mt-1 animate-in fade-in">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />{fieldErrors.confirmPassword}
                    </p>
                  )}
                </div>

                {verifyError && (
                  <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>{verifyError}</span>
                  </div>
                )}

                <Button onClick={handleResetPassword} disabled={verifying} className="w-full gap-2 h-11">
                  {verifying ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                  {verifying ? 'Resetting...' : 'Reset Password'}
                </Button>

                {/* Resend code */}
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">
                    Didn't receive the code?{' '}
                    {cooldown > 0 ? (
                      <span className="text-muted-foreground font-medium">Resend in {cooldown}s</span>
                    ) : (
                      <button
                        onClick={handleResend}
                        disabled={resending}
                        className="text-primary font-medium hover:underline disabled:opacity-50"
                      >
                        {resending ? 'Sending...' : 'Resend Code'}
                      </button>
                    )}
                  </p>
                </div>
              </div>
            </>
          )}

          {/* ── Success Step ──────────────────────────── */}
          {flowState === 'success' && (
            <div className="text-center py-4">
              <div className="h-16 w-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-5">
                <CheckCircle2 className="h-8 w-8 text-success" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-2">Password Reset!</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Your password has been reset successfully. You can now sign in with your new password.
              </p>
              <Button onClick={() => navigate('/login')} className="w-full gap-2 h-11">
                <ArrowLeft className="h-4 w-4" /> Sign In
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
