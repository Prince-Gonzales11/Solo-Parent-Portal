import { BrowserRouter as Router, Routes, Route, Navigate, Outlet, Link } from 'react-router-dom';
import { Toaster } from "@/components/ui/sonner";
import React, { useState, useEffect, Suspense } from 'react';
import { api } from '@/lib/api';
import AdminSidebar from '@/components/AdminSidebar';
import AdminTopBar from '@/components/AdminTopBar';
import ErrorBoundary from '@/components/ErrorBoundary';

import Navbar from '@/components/Navbar';
import GovernmentHeader from '@/components/GovernmentHeader';
const Landing = React.lazy(() => import('@/pages/Landing'));
const Login = React.lazy(() => import('@/pages/Login'));
const Register = React.lazy(() => import('@/pages/Register'));
const GoogleCallback = React.lazy(() => import('@/pages/GoogleCallback'));
const ForgotPassword = React.lazy(() => import('@/pages/ForgotPassword'));
const TermsAndConditions = React.lazy(() => import('@/pages/TermsAndConditions'));
const PrivacyPolicy = React.lazy(() => import('@/pages/PrivacyPolicy'));
const CookiePolicy = React.lazy(() => import('@/pages/CookiePolicy'));

// Applicant Portal (lazy-loaded for high performance and reduced initial bundle)
const Dashboard = React.lazy(() => import('@/pages/portal/Dashboard'));
const Services = React.lazy(() => import('@/pages/portal/Services'));
const Notifications = React.lazy(() => import('@/pages/portal/Notifications'));
const Messages = React.lazy(() => import('@/pages/portal/Messages'));
const MyApplication = React.lazy(() => import('@/pages/portal/MyApplication'));
const AccountSettings = React.lazy(() => import('@/pages/portal/AccountSettings'));
const InitialProfile = React.lazy(() => import('@/pages/portal/InitialProfile'));
const RenewApplication = React.lazy(() => import('@/pages/portal/RenewApplication'));
const LossOfSpicApplication = React.lazy(() => import('@/pages/portal/LossOfSpicApplication'));

// Admin Pages (lazy-loaded so applicant bundle never downloads admin code)
const AdminDashboard = React.lazy(() => import('@/pages/admin/AdminDashboard'));
const AdminApplicants = React.lazy(() => import('@/pages/admin/AdminApplicants'));
const AdminCategories = React.lazy(() => import('@/pages/admin/AdminCategories'));
const AdminBarangays = React.lazy(() => import('@/pages/admin/AdminBarangays'));
const AdminUsers = React.lazy(() => import('@/pages/admin/AdminUsers'));
const AdminMessages = React.lazy(() => import('@/pages/admin/AdminMessages'));
const AdminAnnouncements = React.lazy(() => import('@/pages/admin/AdminAnnouncements'));
const AdminReports = React.lazy(() => import('@/pages/admin/AdminReports'));
const AdminAnalytics = React.lazy(() => import('@/pages/admin/AdminAnalytics'));
const AdminAuditLogs = React.lazy(() => import('@/pages/admin/AdminAuditLogs'));
const AdminResources = React.lazy(() => import('@/pages/admin/AdminResources'));
const ApplicationDetail = React.lazy(() => import('@/pages/admin/ApplicationDetail'));
const ApplicantDetail = React.lazy(() => import('@/pages/admin/ApplicantDetail'));

import { getSafeStoredUser } from '@/lib/session';
export { getSafeStoredUser };

/* ---- Auth Guards ---- */
function RequireAuth({ role }) {
  const user = getSafeStoredUser();
  const token = localStorage.getItem('token');

  // If session is completely invalid or missing role, force logout
  if (!token || !user || !user.role) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    return <Navigate to="/login" replace />;
  }

  const isAdmin = user.role === 'admin' || user.role === 'super_admin';

  if (role === 'admin' && !isAdmin) return <Navigate to="/portal/dashboard" replace />;
  if (role === 'applicant' && user.role !== 'applicant') return <Navigate to="/admin" replace />;

  return <Outlet />;
}

/**
 * Auth guard that checks if the user has completed their initial profile.
 * If not, redirects to /portal/setup-profile.
 * Shows a loading spinner while checking.
 */
function RequireInitialProfile() {
  const storedUser = getSafeStoredUser() || {};

  const initiallyComplete = Boolean(
    storedUser?.is_profile_complete ||
    storedUser?.setup_completed ||
    sessionStorage.getItem('initial_profile_complete') === 'true'
  );

  const [status, setStatus] = useState(initiallyComplete ? 'complete' : 'loading');

  useEffect(() => {
    if (initiallyComplete) return;
    let cancelled = false;
    const check = async () => {
      try {
        const res = await api.get('/profile/initial-status');
        if (!cancelled) {
          const isDone = Boolean(res.data?.is_initial_complete);
          if (isDone) sessionStorage.setItem('initial_profile_complete', 'true');
          setStatus(isDone ? 'complete' : 'incomplete');
        }
      } catch {
        if (!cancelled) setStatus('complete');
      }
    };
    check();
    return () => { cancelled = true; };
  }, [initiallyComplete]);

  if (status === 'loading') {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="h-8 w-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (status === 'incomplete') {
    return <Navigate to="/portal/setup-profile" replace />;
  }

  return <Outlet />;
}

/* ---- Layouts ---- */
function PublicLayout() {
  return (
    <div className="min-h-screen flex flex-col">
      <GovernmentHeader />
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-border bg-background py-8 mt-auto">
        <div className="container px-4 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              <img src="/images/seal.gif" alt="Butuan Seal" className="h-8 w-8 rounded-full border-2 border-background shadow-sm object-cover" />
              <img src="/images/cswdd.jpg" alt="CSWDD Logo" className="h-8 w-8 rounded-full border-2 border-background shadow-sm object-cover bg-background" />
            </div>
            <span className="font-bold text-sm text-[#0e4b65] dark:text-primary" style={{ fontFamily: 'Outfit, sans-serif' }}>
              Solo Parent Portal
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap justify-center">
            <Link to="/terms" className="hover:text-foreground transition-colors underline-offset-4 hover:underline">Terms & Conditions</Link>
            <span>•</span>
            <Link to="/privacy" className="hover:text-foreground transition-colors underline-offset-4 hover:underline">Privacy Notice</Link>
            <span>•</span>
            <Link to="/cookies" className="hover:text-foreground transition-colors underline-offset-4 hover:underline">Cookie Policy</Link>
          </div>
          
          <div className="text-xs text-muted-foreground text-center md:text-right">
            <div>Under RA 11861 — Protected by RA 10173</div>
            <div className="text-[11px] text-muted-foreground/80">© 2026 CSWDD, City of Butuan</div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function PortalLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-background pb-24 md:pb-8 w-full max-w-full overflow-x-hidden min-w-0">
      <Navbar />
      <main className="flex-1 w-full max-w-full overflow-x-hidden min-w-0">
        <ErrorBoundary>
          <Suspense fallback={<div className="flex-1 flex items-center justify-center p-8"><div className="h-8 w-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" /></div>}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </main>
    </div>
  );
}

function AdminLayout() {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('admin-sidebar-collapsed') === 'true'; } catch { return false; }
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleCollapsed = () => {
    setCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem('admin-sidebar-collapsed', String(next)); } catch {}
      return next;
    });
  };

  return (
    <div className="min-h-screen flex bg-background w-full max-w-full overflow-x-hidden">
      <AdminSidebar
        collapsed={collapsed}
        onToggle={toggleCollapsed}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      {/* Main content — offset by sidebar width */}
      <div
        className="flex-1 flex flex-col min-h-screen min-w-0 w-full max-w-full overflow-x-hidden transition-all duration-300"
        style={{ marginLeft: 'var(--admin-content-ml, 0px)' }}
      >
        <style>{`
          @media (min-width: 1024px) {
            :root { --admin-content-ml: ${collapsed ? 'var(--sidebar-collapsed-width)' : 'var(--sidebar-width)'}; }
          }
        `}</style>
        <AdminTopBar onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 min-w-0 w-full max-w-full overflow-x-hidden">
          <ErrorBoundary>
            <Suspense fallback={<div className="flex-1 flex items-center justify-center p-8"><div className="h-8 w-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" /></div>}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        {/* Public */}
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Suspense fallback={<div className="min-h-[60vh] flex items-center justify-center"><div className="h-8 w-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" /></div>}><Landing /></Suspense>} />
          <Route path="/terms" element={<Suspense fallback={<div className="min-h-[60vh] flex items-center justify-center"><div className="h-8 w-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" /></div>}><TermsAndConditions /></Suspense>} />
          <Route path="/privacy" element={<Suspense fallback={<div className="min-h-[60vh] flex items-center justify-center"><div className="h-8 w-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" /></div>}><PrivacyPolicy /></Suspense>} />
          <Route path="/cookies" element={<Suspense fallback={<div className="min-h-[60vh] flex items-center justify-center"><div className="h-8 w-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" /></div>}><CookiePolicy /></Suspense>} />
        </Route>

        {/* Auth (no nav) */}
        <Route path="/login" element={<Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="h-8 w-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" /></div>}><Login /></Suspense>} />
        <Route path="/register" element={<Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="h-8 w-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" /></div>}><Register /></Suspense>} />
        <Route path="/forgot-password" element={<Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="h-8 w-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" /></div>}><ForgotPassword /></Suspense>} />
        <Route path="/auth/google/callback" element={<Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="h-8 w-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" /></div>}><GoogleCallback /></Suspense>} />

        {/* Applicant Portal */}
        <Route element={<RequireAuth role="applicant" />}>
          <Route element={<PortalLayout />}>
            {/* Setup profile — accessible before initial profile is complete */}
            <Route path="/portal/setup-profile" element={<InitialProfile />} />
            <Route path="/portal/initial-profile" element={<Navigate to="/portal/setup-profile" replace />} />

            {/* Everything below requires initial profile completion */}
            <Route element={<RequireInitialProfile />}>
              {/* Dashboard is the primary landing page */}
              <Route path="/portal/dashboard" element={<Dashboard />} />
              {/* Redirect /portal to the dashboard */}
              <Route path="/portal" element={<Navigate to="/portal/dashboard" replace />} />
              {/* Services Hub */}
              <Route path="/portal/services" element={<Services />} />
              {/* My Application — unified workflow */}
              <Route path="/portal/my-application" element={<MyApplication />} />
              {/* Notifications */}
              <Route path="/portal/notifications" element={<Notifications />} />
              {/* Messages with CSWDD */}
              <Route path="/portal/messages" element={<Messages />} />
              <Route path="/portal/renew" element={<RenewApplication />} />
              <Route path="/portal/loss-spic" element={<LossOfSpicApplication />} />
              {/* Account Settings */}
              <Route path="/portal/settings" element={<AccountSettings />} />
              <Route path="/portal/account-settings" element={<Navigate to="/portal/settings" replace />} />
              {/* Legacy routes → redirect to new structure */}
              <Route path="/portal/profile" element={<Navigate to="/portal/my-application?step=form" replace />} />
              <Route path="/portal/documents" element={<Navigate to="/portal/my-application?step=documents" replace />} />
              <Route path="/portal/application" element={<Navigate to="/portal/my-application?step=status" replace />} />
              <Route path="/portal/apply" element={<Navigate to="/portal/my-application?action=apply" replace />} />
            </Route>
          </Route>
        </Route>

        {/* Admin */}
        <Route element={<RequireAuth role="admin" />}>
          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/applicants" element={<AdminApplicants />} />
            <Route path="/admin/applicants/:id" element={<ApplicationDetail />} />
            {/* Admin application review routes */}
            <Route path="/admin/applications" element={<AdminDashboard />} />
            <Route path="/admin/applications/:id" element={<ApplicationDetail />} />
            <Route path="/admin/messages" element={<AdminMessages />} />
            <Route path="/admin/categories" element={<AdminCategories />} />
            <Route path="/admin/announcements" element={<AdminAnnouncements />} />
            <Route path="/admin/reports" element={<AdminReports />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/barangays" element={<AdminBarangays />} />
            <Route path="/admin/audit-logs" element={<AdminAuditLogs />} />
            <Route path="/admin/analytics" element={<AdminAnalytics />} />
            <Route path="/admin/resources" element={<AdminResources />} />
          </Route>
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <Toaster richColors position="top-right" />
    </Router>
  );
}
