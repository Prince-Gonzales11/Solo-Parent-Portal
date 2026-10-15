import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { api, clearAuthSession } from '@/lib/api';

export default function GoogleCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState('');
  const exchangedRef = useRef(false);

  useEffect(() => {
    // Prevent duplicate execution under React StrictMode
    if (exchangedRef.current) return;

    const authCode = searchParams.get('auth_code') || searchParams.get('code');
    const legacyToken = searchParams.get('token');
    const legacyUserData = searchParams.get('user');
    const errorParam = searchParams.get('error');

    if (errorParam) {
      const errorMessages = {
        google_auth_failed: 'Google authentication failed. Please try again.',
        no_code: 'No authorization code received from Google.',
        token_exchange_failed: 'Failed to verify your Google account. Please try again.',
        invalid_token: 'Invalid Google authentication token.',
        account_inactive: 'Your account has been deactivated. Please contact the CSWDD office.',
        google_auth_exception: 'An error occurred during Google sign-in. Please try again.',
      };
      const msg = errorMessages[errorParam] || 'Google sign-in failed. Please try again.';
      toast.error(msg);
      navigate('/login', { replace: true });
      return;
    }

    // Immediately sanitize the URL query string from browser history and address bar
    if (window.history && window.history.replaceState) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    // Primary Path: Securely exchange one-time authorization ticket over POST body
    if (authCode) {
      exchangedRef.current = true;
      api.post('/google/exchange', { code: authCode })
        .then(res => {
          const { token, user } = res.data;
          clearAuthSession();
          localStorage.setItem('token', token);
          localStorage.setItem('user', JSON.stringify(user));

          toast.success(`Welcome, ${user.full_name?.split(' ')[0] || 'there'}! 👋`);

          if (user.role === 'applicant') {
            window.location.href = '/portal/dashboard';
          } else {
            window.location.href = '/admin';
          }
        })
        .catch(err => {
          console.error('Failed to exchange Google OAuth code:', err);
          const msg = err.response?.data?.message || 'Google sign-in verification failed. Please try again.';
          setError(msg);
          toast.error(msg);
          setTimeout(() => navigate('/login', { replace: true }), 1500);
        });
      return;
    }

    // Backward-compatible fallback for legacy query-param redirects
    if (legacyToken && legacyUserData) {
      exchangedRef.current = true;
      try {
        const user = JSON.parse(atob(legacyUserData));
        
        clearAuthSession();
        localStorage.setItem('token', legacyToken);
        localStorage.setItem('user', JSON.stringify(user));

        toast.success(`Welcome, ${user.full_name?.split(' ')[0] || 'there'}! 👋`);

        if (user.role === 'applicant') {
          window.location.href = '/portal/dashboard';
        } else {
          window.location.href = '/admin';
        }
      } catch (e) {
        console.error('Failed to parse user data from Google callback:', e);
        toast.error('Failed to process Google sign-in data. Please try again.');
        navigate('/login', { replace: true });
      }
      return;
    }

    navigate('/login', { replace: true });
  }, [navigate, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <div className="h-10 w-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
        <p className="text-muted-foreground text-sm font-medium">Completing secure Google sign-in...</p>
        {error && (
          <p className="text-destructive text-sm font-medium">{error}</p>
        )}
      </div>
    </div>
  );
}
