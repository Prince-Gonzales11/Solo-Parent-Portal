import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, toastError, clearAuthSession } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { UserPlus, Eye, EyeOff, ArrowLeft, AlertCircle, Mail, CheckCircle2, RefreshCw, Send, Shield, Scale, FileText } from 'lucide-react';
import { scrollToAndFocus, ERROR_INPUT_CLASS } from '@/lib/formValidation';
import ThemeToggle from '@/components/ThemeToggle';

// Helper to test Philippine mobile number (e.g. 09171234567, +639171234567, 639171234567)
const isPhilippineMobile = (value) => {
  const cleaned = (value || '').replace(/[\s\-]/g, '');
  return /^(\+?63|0)?9\d{9}$/.test(cleaned);
};

// Helper to normalize Philippine mobile number to +639XXXXXXXXX
const normalizePhilippineMobile = (value) => {
  const cleaned = (value || '').replace(/[\s\-]/g, '');
  if (cleaned.startsWith('09')) {
    return '+63' + cleaned.slice(1);
  }
  if (cleaned.startsWith('639')) {
    return '+' + cleaned;
  }
  if (cleaned.startsWith('+639')) {
    return cleaned;
  }
  if (cleaned.startsWith('9') && cleaned.length === 10) {
    return '+63' + cleaned;
  }
  return cleaned;
};

// Helper to check valid email
const isValidEmail = (value) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((value || '').trim());
};

export default function Register() {
  const navigate = useNavigate();

  // Form state (includes honeypot website field)
  const [form, setForm] = useState({
    first_name: '',
    middle_name: '',
    last_name: '',
    email: '',
    password: '',
    confirmPassword: '',
    dpa_consent: false,
    website: '', // honeypot
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);

  // Security CAPTCHA state
  const [captcha, setCaptcha] = useState({ id: '', question: '' });
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [captchaLoading, setCaptchaLoading] = useState(false);

  // Legal Pop-up Modal state
  const [legalModalOpen, setLegalModalOpen] = useState(false);
  const [legalModalTab, setLegalModalTab] = useState('terms'); // 'terms' | 'privacy'

  // Flow states
  // 'email' -> user inputs email or mobile and clicks send code / continue
  // 'verify' -> code sent (for email), user inputs code
  // 'password' -> code verified (or skipped for mobile), user inputs password and creates account
  // 'success' -> account created successfully
  const [flowState, setFlowState] = useState('email');

  // Verification state
  const [userId, setUserId] = useState('');
  const [verificationCode, setVerificationCode] = useState(['', '', '', '', '', '']);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState('');
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const inputRefs = useRef([]);

  const fetchCaptcha = useCallback(async () => {
    setCaptchaLoading(true);
    try {
      const res = await api.get('/auth/captcha');
      if (res.data) {
        setCaptcha({ id: res.data.captcha_id, question: res.data.question });
        setCaptchaAnswer('');
      }
    } catch (err) {
      console.warn('Failed to fetch security puzzle:', err);
    } finally {
      setCaptchaLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCaptcha();
  }, [fetchCaptcha]);

  const openLegalModal = (tab = 'terms') => {
    setLegalModalTab(tab);
    setLegalModalOpen(true);
  };

  const handleConsentCheckboxChange = (e) => {
    if (!form.dpa_consent) {
      e.preventDefault();
      openLegalModal('terms');
    } else {
      setForm(prev => ({ ...prev, dpa_consent: false }));
    }
  };

  const handleConsentContainerClick = (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON' || e.target.tagName === 'A') {
      return;
    }
    if (!form.dpa_consent) {
      openLegalModal('terms');
    }
  };

  const handleAcceptLegal = () => {
    setForm(prev => ({ ...prev, dpa_consent: true }));
    setFieldErrors(prev => {
      const copy = { ...prev };
      delete copy.dpa_consent;
      return copy;
    });
    setLegalModalOpen(false);
    toast.success('Terms and Conditions and Privacy Notice accepted.');
  };

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    setFieldErrors(prev => {
      const copy = { ...prev };
      delete copy[name];
      return copy;
    });
    if (error) setError('');
  };

  // 1. Send verification code (email) or proceed directly to password creation (mobile)
  const handleSendCode = async () => {
    setError('');
    const errs = {};
    if (!form.first_name?.trim()) errs.first_name = 'First name is required.';
    if (!form.last_name?.trim()) errs.last_name = 'Last name is required.';

    const inputVal = form.email?.trim() || '';
    if (!inputVal) {
      errs.email = 'Email or mobile number is required.';
    } else if (!isValidEmail(inputVal) && !isPhilippineMobile(inputVal)) {
      errs.email = 'Please enter a valid email address or mobile number.';
    }

    if (!captchaAnswer?.trim()) {
      errs.captcha = 'Please solve the security calculation.';
    }

    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      toast.error(errs.first_name || errs.last_name || errs.email || errs.captcha || 'Please enter all required fields.');
      scrollToAndFocus(Object.keys(errs)[0]);
      return;
    }

    const isMobile = isPhilippineMobile(inputVal);
    const normalizedIdentifier = isMobile ? normalizePhilippineMobile(inputVal) : inputVal;
    const fullName = [form.first_name?.trim(), form.middle_name?.trim(), form.last_name?.trim()]
      .filter(Boolean)
      .join(' ');

    setLoading(true);
    try {
      const res = await api.post('/auth/register/start', {
        first_name: form.first_name?.trim(),
        middle_name: form.middle_name?.trim() || null,
        last_name: form.last_name?.trim(),
        full_name: fullName,
        email: normalizedIdentifier,
        identifier: normalizedIdentifier,
        captcha_id: captcha.id,
        captcha_answer: captchaAnswer.trim(),
        website: form.website || '', // honeypot
      });

      setUserId(res.data.user_id);

      if (res.data.requires_verification === false || isMobile) {
        // Mobile number flow: NO OTP, NO SMS, proceed directly to password creation
        setFlowState('password');
        toast.success('Mobile number accepted. Please create your password.');
      } else {
        // Email flow: Existing Gmail verification
        setFlowState('verify');
        setCooldown(60);
        toast.success('Verification code sent! Check your email.');
      }
    } catch (err) {
      const status = err.response?.status;
      const detail = err.response?.data?.message || '';

      // Refresh puzzle on verification error
      fetchCaptcha();

      if (status === 409) {
        setError(detail || (isMobile ? 'An account with this mobile number already exists. Please sign in instead.' : 'An account with this email address already exists. Please sign in instead.'));
      } else if (err.response?.data?.errors?.captcha) {
        setError(err.response.data.errors.captcha[0] || 'Security verification failed.');
        setFieldErrors(prev => ({ ...prev, captcha: err.response.data.errors.captcha[0] }));
      } else {
        setError(detail || 'Failed to proceed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // 2. Resend code
  const handleResend = async () => {
    setResending(true);
    setVerifyError('');
    try {
      const res = await api.post('/auth/email/resend', { user_id: userId });
      setCooldown(res.data.cooldown_seconds || 60);
      toast.success('A new verification code has been sent to your email.');
      setVerificationCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } catch (err) {
      setVerifyError(err.response?.data?.message || 'Failed to resend code. Please try again.');
    } finally {
      setResending(false);
    }
  };

  // Verification code input handlers
  const handleCodeChange = useCallback((index, value) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    setVerificationCode((prev) => {
      const next = [...prev];
      next[index] = digit;
      return next;
    });
    if (verifyError) setVerifyError('');

    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }, [verifyError]);

  const handleCodeKeyDown = useCallback((index, e) => {
    if (e.key === 'Backspace') {
      if (!verificationCode[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
        setVerificationCode((prev) => {
          const next = [...prev];
          next[index - 1] = '';
          return next;
        });
        e.preventDefault();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }, [verificationCode]);

  const handleCodePaste = useCallback((e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 0) return;

    const newCode = [...verificationCode];
    for (let i = 0; i < pasted.length && i < 6; i++) {
      newCode[i] = pasted[i];
    }
    setVerificationCode(newCode);
    if (verifyError) setVerifyError('');

    const focusIndex = Math.min(pasted.length, 5);
    inputRefs.current[focusIndex]?.focus();
  }, [verificationCode, verifyError]);

  // 3. Verify Code
  const handleVerify = async () => {
    const code = verificationCode.join('');
    if (code.length !== 6) {
      setVerifyError('Please enter the complete 6-digit verification code.');
      return;
    }

    setVerifying(true);
    setVerifyError('');
    try {
      const res = await api.post('/auth/email/verify', {
        user_id: userId,
        code,
      });

      if (res.data.verified || res.data.already_verified) {
        setFlowState('password');
        toast.success('Email verified successfully!');
      }
    } catch (err) {
      const data = err.response?.data;
      setVerifyError(data?.message || 'Verification failed. Please try again.');
      setVerificationCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setVerifying(false);
    }
  };

  useEffect(() => {
    const code = verificationCode.join('');
    if (code.length === 6 && flowState === 'verify' && !verifying) {
      handleVerify();
    }
  }, [verificationCode, flowState]);

  // 4. Complete Registration
  const handleSubmitFinal = async (e) => {
    e.preventDefault();
    setError('');
    const errs = {};

    if (!form.password) {
      errs.password = 'Password is required.';
    } else if (form.password.length < 8) {
      errs.password = 'Your password must be at least 8 characters long.';
    }

    if (!form.confirmPassword) {
      errs.confirmPassword = 'Confirm Password is required.';
    } else if (form.password !== form.confirmPassword) {
      errs.confirmPassword = 'The passwords you entered do not match.';
    }

    if (!form.dpa_consent) {
      errs.dpa_consent = 'You must accept the Data Privacy Act (RA 10173) consent to continue.';
    }

    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      toast.error('Please complete all required fields.');
      scrollToAndFocus(Object.keys(errs)[0]);
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/register', {
        user_id: userId,
        password: form.password,
        dpa_consent: true,
      });

      const userData = res.data.user?.data || res.data.user || {};
      if (!userData.first_name && form.first_name) userData.first_name = form.first_name.trim();
      if (!userData.middle_name && form.middle_name) userData.middle_name = form.middle_name.trim();
      if (!userData.last_name && form.last_name) userData.last_name = form.last_name.trim();
      if (!userData.phone_number && isPhilippineMobile(form.email)) {
        userData.phone_number = normalizePhilippineMobile(form.email);
      }

      clearAuthSession();
      localStorage.setItem('token', res.data.access_token);
      localStorage.setItem('user', JSON.stringify(userData));

      setFlowState('success');
      toast.success('Account created successfully!');

      // Fresh navigation ensures no previous account's memory/state leaks
      setTimeout(() => {
        window.location.href = '/portal/setup-profile';
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

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
      <div className="w-full max-w-lg">
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

            {flowState === 'success' ? (
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <CheckCircle2 className="h-6 w-6 text-success" />
                  </div>
                  <div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Account Created</h1>
                  </div>
                </div>
                <p className="text-muted-foreground">
                  Redirecting to your dashboard...
                </p>
              </div>
            ) : (
              <>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Create your account</h1>
                <p className="text-sm text-muted-foreground">Follow the steps to securely set up your account.</p>
              </>
            )}
          </div>

          {flowState !== 'success' && (
            <div className="space-y-6">
              {/* Step 1: Name and Email/Mobile */}
              <div className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="first_name" className={fieldErrors.first_name ? 'text-destructive font-medium' : ''}>
                      First Name <span className="text-destructive font-bold">*</span>
                    </Label>
                    <Input
                      id="first_name"
                      name="first_name"
                      type="text"
                      placeholder="Enter first name"
                      value={form.first_name}
                      onChange={handleChange}
                      disabled={flowState !== 'email'}
                      className={`h-11 disabled:bg-muted/50 disabled:text-muted-foreground ${fieldErrors.first_name ? ERROR_INPUT_CLASS : ''}`}
                    />
                    {fieldErrors.first_name && (
                      <p className="text-xs text-destructive font-medium flex items-center gap-1 mt-1 animate-in fade-in">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" />{fieldErrors.first_name}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="middle_name" className="text-foreground">
                      Middle Initial
                    </Label>
                    <Input
                      id="middle_name"
                      name="middle_name"
                      type="text"
                      placeholder="M.I. (optional)"
                      value={form.middle_name}
                      onChange={handleChange}
                      disabled={flowState !== 'email'}
                      className="h-11 disabled:bg-muted/50 disabled:text-muted-foreground"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="last_name" className={fieldErrors.last_name ? 'text-destructive font-medium' : ''}>
                      Last Name <span className="text-destructive font-bold">*</span>
                    </Label>
                    <Input
                      id="last_name"
                      name="last_name"
                      type="text"
                      placeholder="Enter last name"
                      value={form.last_name}
                      onChange={handleChange}
                      disabled={flowState !== 'email'}
                      className={`h-11 disabled:bg-muted/50 disabled:text-muted-foreground ${fieldErrors.last_name ? ERROR_INPUT_CLASS : ''}`}
                    />
                    {fieldErrors.last_name && (
                      <p className="text-xs text-destructive font-medium flex items-center gap-1 mt-1 animate-in fade-in">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" />{fieldErrors.last_name}
                      </p>
                    )}
                  </div>
                </div>

                {/* Honeypot field for bot trapping */}
                <input
                  type="text"
                  name="website"
                  value={form.website || ''}
                  onChange={handleChange}
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', height: 0, width: 0 }}
                />

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
                    placeholder="Email or Mobile Number (e.g. 09171234567)"
                    value={form.email}
                    onChange={handleChange}
                    disabled={flowState !== 'email'}
                    className={`h-11 disabled:bg-muted/50 disabled:text-muted-foreground ${fieldErrors.email ? ERROR_INPUT_CLASS : ''}`}
                  />
                  {fieldErrors.email && (
                    <p className="text-xs text-destructive font-medium flex items-center gap-1 mt-1 animate-in fade-in">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />{fieldErrors.email}
                    </p>
                  )}
                </div>

                {/* Security CAPTCHA Calculation */}
                {flowState === 'email' && (
                  <div className="p-3.5 rounded-2xl border border-border/80 bg-muted/20 space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                      <span className="flex items-center gap-1.5 text-foreground font-medium">
                        <Shield className="h-3.5 w-3.5 text-primary" /> Security Verification
                      </span>
                      <button
                        type="button"
                        onClick={fetchCaptcha}
                        disabled={captchaLoading}
                        className="inline-flex items-center gap-1 text-primary hover:underline text-[11px] cursor-pointer"
                      >
                        <RefreshCw className={`h-3 w-3 ${captchaLoading ? 'animate-spin' : ''}`} />
                        New Puzzle
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="px-3 py-2 rounded-xl bg-card border font-mono font-bold text-sm tracking-wide text-foreground shadow-2xs select-none shrink-0 min-w-[100px] text-center">
                        {captchaLoading ? '...' : (captcha.question || 'Loading...')}
                      </div>
                      <Input
                        id="captcha_answer"
                        type="text"
                        inputMode="numeric"
                        placeholder="Your answer"
                        value={captchaAnswer}
                        onChange={(e) => {
                          setCaptchaAnswer(e.target.value);
                          if (fieldErrors.captcha) {
                            setFieldErrors(prev => {
                              const c = { ...prev };
                              delete c.captcha;
                              return c;
                            });
                          }
                        }}
                        className={`h-10 text-sm font-semibold ${fieldErrors.captcha ? ERROR_INPUT_CLASS : ''}`}
                      />
                    </div>
                    {fieldErrors.captcha && (
                      <p className="text-xs text-destructive font-medium flex items-center gap-1">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" />{fieldErrors.captcha}
                      </p>
                    )}
                  </div>
                )}

                {flowState === 'email' && (
                  <Button onClick={handleSendCode} disabled={loading} className="w-full h-11 font-bold">
                    {loading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
                    {isPhilippineMobile(form.email) ? 'Continue with Mobile Number' : 'Send Verification Code'}
                  </Button>
                )}

                {flowState !== 'email' && (
                  <Button disabled variant="outline" className="w-full h-11 border-green-200 bg-green-50 text-success opacity-100">
                    <CheckCircle2 className="h-4 w-4 mr-2" /> {flowState === 'password' ? 'Verified' : 'Verification Code Sent'}
                  </Button>
                )}
              </div>

              {/* Step 2: Verification Code */}
              {flowState === 'verify' && (
                <div className="space-y-4 p-3.5 sm:p-5 bg-muted/30 border border-border rounded-2xl animate-in fade-in slide-in-from-top-4">
                  <div>
                    <Label className="text-base font-semibold">Verification Code</Label>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1 mb-3">
                      We sent a 6-digit code to <strong className="text-foreground">{form.email}</strong>.
                    </p>
                  </div>

                  <div className="flex justify-between gap-1 sm:gap-2" onPaste={handleCodePaste}>
                    {verificationCode.map((digit, index) => (
                      <input
                        key={index}
                        ref={(el) => (inputRefs.current[index] = el)}
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleCodeChange(index, e.target.value)}
                        onKeyDown={(e) => handleCodeKeyDown(index, e)}
                        onFocus={(e) => e.target.select()}
                        className="w-9 h-11 min-w-0 sm:w-12 sm:h-14 flex-1 max-w-[48px] text-center text-lg sm:text-2xl font-bold border-2 rounded-lg sm:rounded-xl bg-background
                          focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all
                          text-foreground placeholder:text-muted-foreground/30"
                        placeholder="·"
                        autoFocus={index === 0}
                      />
                    ))}
                  </div>

                  {verifyError && (
                    <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
                      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                      <span>{verifyError}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2">
                    <button
                      onClick={() => {
                        setFlowState('email');
                        setVerificationCode(['', '', '', '', '', '']);
                      }}
                      className="text-sm text-muted-foreground hover:text-foreground"
                    >
                      Change Email
                    </button>
                    {cooldown > 0 ? (
                      <span className="text-sm text-muted-foreground">Resend in {cooldown}s</span>
                    ) : (
                      <button
                        onClick={handleResend}
                        disabled={resending}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        {resending ? 'Sending...' : 'Resend Code'}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Step 3: Password and Submit */}
              {flowState === 'password' && (
                <form onSubmit={handleSubmitFinal} className="space-y-5 animate-in fade-in slide-in-from-top-4 pt-4 border-t border-border">
                  <div className="space-y-2">
                    <Label htmlFor="password" className={fieldErrors.password ? 'text-destructive font-medium' : ''}>
                      Password <span className="text-destructive font-bold">*</span>
                    </Label>
                    <div className="relative">
                      <Input
                        id="password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={form.password}
                        onChange={handleChange}
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
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword" className={fieldErrors.confirmPassword ? 'text-destructive font-medium' : ''}>
                      Confirm Password <span className="text-destructive font-bold">*</span>
                    </Label>
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      placeholder="••••••••"
                      value={form.confirmPassword}
                      onChange={handleChange}
                      className={`h-11 ${fieldErrors.confirmPassword ? ERROR_INPUT_CLASS : ''}`}
                    />
                    {fieldErrors.confirmPassword && (
                      <p className="text-xs text-destructive font-medium flex items-center gap-1 mt-1 animate-in fade-in">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" />{fieldErrors.confirmPassword}
                      </p>
                    )}
                  </div>

                  <div
                    id="dpa_consent_container"
                    onClick={handleConsentContainerClick}
                    className={`flex items-start gap-3 p-4 rounded-xl border transition-colors cursor-pointer ${
                      fieldErrors.dpa_consent
                        ? 'border-destructive ring-1 ring-destructive/40 bg-destructive/5'
                        : form.dpa_consent
                          ? 'border-primary/40 bg-primary/5'
                          : 'bg-muted/40 hover:bg-muted/60'
                    }`}
                  >
                    <input
                      type="checkbox"
                      id="dpa_consent"
                      name="dpa_consent"
                      checked={form.dpa_consent}
                      onChange={handleConsentCheckboxChange}
                      className="mt-0.5 h-4 w-4 rounded border-border cursor-pointer accent-primary shrink-0"
                    />
                    <label htmlFor="dpa_consent" className="text-xs text-muted-foreground leading-relaxed cursor-pointer select-none">
                      I have read and agree to the{' '}
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); openLegalModal('terms'); }}
                        className="font-semibold text-primary underline hover:text-primary/80 inline p-0 bg-transparent border-0 cursor-pointer"
                      >
                        Terms and Conditions
                      </button>{' '}
                      and{' '}
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); openLegalModal('privacy'); }}
                        className="font-semibold text-primary underline hover:text-primary/80 inline p-0 bg-transparent border-0 cursor-pointer"
                      >
                        Privacy Notice
                      </button>
                      , and consent to the collection and processing of my personal data under the{' '}
                      <strong className="text-foreground">Data Privacy Act of 2012 (Republic Act No. 10173)</strong>.{' '}
                      <span className="text-destructive font-bold">*</span>
                    </label>
                  </div>
                  {fieldErrors.dpa_consent && (
                    <p className="text-xs text-destructive font-medium flex items-center gap-1 animate-in fade-in">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />{fieldErrors.dpa_consent}
                    </p>
                  )}

                  <Button type="submit" className="w-full h-11 text-base" disabled={loading}>
                    {loading ? 'Creating account…' : 'Create Account'}
                  </Button>
                </form>
              )}

              {/* Global Error (Step 1 or Step 3) */}
              {error && (
                <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive mt-4">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* ──────── OR Divider ──────── */}
              <div className="relative mt-8 mb-6">
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
                <span>{googleLoading ? 'Connecting…' : 'Sign up with Google'}</span>
              </button>

              <p className="text-center text-sm text-muted-foreground mt-6">
                Already have an account?{' '}
                <Link to="/login" className="text-primary font-medium hover:underline">
                  Sign in
                </Link>
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Terms & Conditions and Privacy Notice Pop-up Modal ── */}
      <Dialog open={legalModalOpen} onOpenChange={setLegalModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col rounded-3xl p-0 overflow-hidden shadow-2xl">
          <DialogHeader className="p-6 pb-3 border-b border-border/80">
            <div className="flex items-center gap-3 pr-6">
              <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                {legalModalTab === 'terms' ? <Scale className="h-5 w-5" /> : <Shield className="h-5 w-5" />}
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-foreground">
                  {legalModalTab === 'terms' ? 'Terms and Conditions' : 'Privacy Notice'}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  City Social Welfare and Development Department (CSWDD) — Butuan City
                </DialogDescription>
              </div>
            </div>

            {/* Segmented Tab Bar */}
            <div className="flex items-center gap-2 pt-4">
              <button
                type="button"
                onClick={() => setLegalModalTab('terms')}
                className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  legalModalTab === 'terms'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                Terms and Conditions
              </button>
              <button
                type="button"
                onClick={() => setLegalModalTab('privacy')}
                className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  legalModalTab === 'privacy'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                Privacy Notice
              </button>
            </div>
          </DialogHeader>

          {/* Scrollable Policy Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs sm:text-sm text-foreground/90 leading-relaxed max-h-[50vh]">
            {legalModalTab === 'terms' ? (
              <>
                <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 text-xs text-primary font-medium flex items-center gap-2">
                  <Scale className="h-4 w-4 shrink-0" />
                  Governing Law: Republic Act No. 11861 & RA 8972 (Expanded Solo Parents Welfare Act)
                </div>

                <div className="space-y-1.5">
                  <h4 className="font-bold text-foreground text-sm flex items-center gap-2">
                    <span className="h-5 w-5 rounded-full bg-primary/10 text-primary text-[11px] font-bold inline-flex items-center justify-center shrink-0">1</span>
                    Acceptance of Terms
                  </h4>
                  <p className="text-muted-foreground">
                    By accessing and registering on the Butuan City Solo Parent Portal, you agree to be bound by these Terms and Conditions. This portal is dedicated to solo parents of Butuan City applying for statutory welfare recognition, services, and official Solo Parent ID Cards.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <h4 className="font-bold text-foreground text-sm flex items-center gap-2">
                    <span className="h-5 w-5 rounded-full bg-primary/10 text-primary text-[11px] font-bold inline-flex items-center justify-center shrink-0">2</span>
                    Eligibility and Statutory Qualifications
                  </h4>
                  <p className="text-muted-foreground">
                    You must be a bonafide resident of Butuan City with sole parental responsibility over your child or children under 22 years of age (or disabled dependents of any age) who are dependent on you for support. All uploaded documentary requirements are subject to statutory verification by the CSWDD and your designated barangay.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <h4 className="font-bold text-foreground text-sm flex items-center gap-2">
                    <span className="h-5 w-5 rounded-full bg-primary/10 text-primary text-[11px] font-bold inline-flex items-center justify-center shrink-0">3</span>
                    Applicant Obligations & Truthfulness
                  </h4>
                  <p className="text-muted-foreground">
                    You certify under penalty of law that all personal information, uploaded certificates, and declarations are true, accurate, and genuine. You agree to promptly report any changes in your civil status, employment, cohabitation, or custody arrangements to the CSWDD office.
                  </p>
                </div>

                <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive space-y-1">
                  <strong className="font-bold block">Penalties for Falsification & Misrepresentation:</strong>
                  <p className="text-destructive/90 leading-normal">
                    Under Section 19 of Republic Act No. 11861 and the Revised Penal Code, misrepresentation of facts, forged documents, or fraudulent certifications shall lead to immediate cancellation of your Solo Parent ID, permanent disqualification, and criminal prosecution.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <h4 className="font-bold text-foreground text-sm flex items-center gap-2">
                    <span className="h-5 w-5 rounded-full bg-primary/10 text-primary text-[11px] font-bold inline-flex items-center justify-center shrink-0">4</span>
                    Card Validity and Renewal
                  </h4>
                  <p className="text-muted-foreground">
                    The Solo Parent Identification Card (SPIC) is valid for one (1) year from issuance and is strictly non-transferable. Annual renewal with updated documentation is required to continue enjoying statutory benefits.
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 text-xs text-primary font-medium flex items-center gap-2">
                  <Shield className="h-4 w-4 shrink-0" />
                  Statutory Basis: Republic Act No. 10173 (Data Privacy Act of 2012)
                </div>

                <div className="space-y-1.5">
                  <h4 className="font-bold text-foreground text-sm flex items-center gap-2">
                    <span className="h-5 w-5 rounded-full bg-primary/10 text-primary text-[11px] font-bold inline-flex items-center justify-center shrink-0">1</span>
                    Collection of Personal and Sensitive Data
                  </h4>
                  <p className="text-muted-foreground">
                    The City Social Welfare and Development Department (CSWDD) collects personal and sensitive data—including your full name, birth date, civil status, contact information, household dependents, and documentary proof (such as PSA birth certificates and barangay certificates of indigency)—strictly for evaluating your solo parent eligibility under RA 11861.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <h4 className="font-bold text-foreground text-sm flex items-center gap-2">
                    <span className="h-5 w-5 rounded-full bg-primary/10 text-primary text-[11px] font-bold inline-flex items-center justify-center shrink-0">2</span>
                    Purpose of Processing
                  </h4>
                  <p className="text-muted-foreground">
                    Your personal information is processed exclusively for identity verification, statutory assessment, printing and release of the official Solo Parent Identification Card, and administration of statutory benefits. We do not sell or share your information with commercial third parties.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <h4 className="font-bold text-foreground text-sm flex items-center gap-2">
                    <span className="h-5 w-5 rounded-full bg-primary/10 text-primary text-[11px] font-bold inline-flex items-center justify-center shrink-0">3</span>
                    Data Protection & Security Controls
                  </h4>
                  <p className="text-muted-foreground">
                    Your data is stored in encrypted databases protected by database-level Row Level Security (RLS) policies and restricted administrative access. Only authorized CSWDD personnel have access to review and assess your application.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <h4 className="font-bold text-foreground text-sm flex items-center gap-2">
                    <span className="h-5 w-5 rounded-full bg-primary/10 text-primary text-[11px] font-bold inline-flex items-center justify-center shrink-0">4</span>
                    Rights as a Data Subject
                  </h4>
                  <p className="text-muted-foreground">
                    Under RA 10173, you hold the right to be informed, access, correct, and request rectification of your personal records. For data privacy inquiries or assistance, you may contact the CSWDD Data Protection Office at cswdd@butuan.gov.ph or (085) 342-8000.
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Modal Footer with Accept Button */}
          <DialogFooter className="p-4 px-6 border-t border-border/80 bg-muted/20 flex flex-col-reverse sm:flex-row items-center justify-between gap-3">
            <div className="text-[11px] text-muted-foreground text-center sm:text-left">
              By accepting, you agree to comply with RA 11861 and RA 10173.
            </div>
            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <Button
                type="button"
                variant="outline"
                onClick={() => setLegalModalOpen(false)}
                className="rounded-xl flex-1 sm:flex-none text-xs font-semibold"
              >
                Decline
              </Button>
              <Button
                type="button"
                onClick={handleAcceptLegal}
                className="rounded-xl flex-1 sm:flex-none font-bold text-xs bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 shadow-sm cursor-pointer"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>Accept Terms & Conditions</span>
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
