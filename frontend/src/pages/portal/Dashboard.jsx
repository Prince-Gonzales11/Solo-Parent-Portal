import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, toastError } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  FileText, User, Upload, Bell, RotateCcw, Plus, CheckCircle,
  AlertTriangle, RefreshCw, Megaphone, ChevronRight, X,
  ClipboardList, Shield, ArrowRight, Info, Clock, Eye, Sparkles,
  LayoutGrid, AlertOctagon, MessageSquare, Calendar
} from 'lucide-react';
import { format } from 'date-fns';

/* ─── Status display config ─────────────────────────────────── */
const STATUS_CONFIG = {
  draft:                    { label: 'Draft',                   color: 'bg-muted text-muted-foreground border-border' },
  submitted:                { label: 'Submitted',               color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-300' },
  under_initial_review:     { label: 'Under Initial Review',    color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-300' },
  documents_under_review:   { label: 'Documents Under Review',  color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300 border-indigo-300' },
  document_verification:    { label: 'Document Review',         color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-300' },
  for_document_correction:  { label: 'For Document Correction', color: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 border-rose-300 animate-pulse' },
  qualified:                { label: 'Qualified by CSWDD ✓',    color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-300' },
  applicant_verification:   { label: 'Applicant Verification',  color: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300 border-cyan-300' },
  under_final_assessment:   { label: 'Final Assessment',        color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300 border-indigo-300' },
  under_final_verification: { label: 'Final Verification',      color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300 border-indigo-300' },
  approved:                 { label: 'Approved ✓',              color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-300' },
  ready_for_pickup:         { label: 'Ready for Pickup 📦',     color: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300 border-teal-300 font-bold' },
  ready_for_release:        { label: 'Ready for Pickup 📦',     color: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300 border-teal-300 font-bold' },
  ready_for_printing:       { label: 'Ready for Printing',      color: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300 border-teal-300' },
  completed:                { label: 'Completed ✓',             color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-300' },
  released:                 { label: 'ID Released ✓',           color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-300' },
  rejected:                 { label: 'Application Rejected',    color: 'bg-destructive/15 text-destructive border-destructive/30' },
  cancelled:                { label: 'Cancelled',               color: 'bg-muted text-muted-foreground border-border' },
  reopened_for_review:      { label: 'Reopened for Review',     color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-300' },
};

export default function Dashboard() {
  const navigate = useNavigate();

  const user = (() => {
    let u = JSON.parse(localStorage.getItem('user') || 'null');
    if (u && u.data && !u.role) u = u.data;
    return u;
  })();

  const [application, setApplication] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.get('/portal/dashboard-summary', { cache: false });
      if (res.data) {
        setApplication(res.data.application || null);
        const list = Array.isArray(res.data.announcements) ? res.data.announcements : [];
        setAnnouncements(list.slice(0, 3));
      }
    } catch (err) {
      console.warn('Consolidated summary error, attempting fallback:', err);
      try {
        const [appRes, annRes] = await Promise.allSettled([
          api.get('/applications/me', { cache: false }),
          api.get('/public/announcements'),
        ]);
        if (appRes.status === 'fulfilled') {
          setApplication(appRes.value.data?.application || null);
        }
        if (annRes.status === 'fulfilled') {
          const data = annRes.value.data;
          const list = Array.isArray(data) ? data : data?.data || [];
          setAnnouncements(list.slice(0, 3));
        }
      } catch (fallbackErr) {
        console.error('Failed to load dashboard fallback data:', fallbackErr);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Smart polling: auto-refresh dashboard data every 8s, paused when tab is hidden
  useEffect(() => {
    let intervalId = null;
    let inFlight = false;
    const POLL_INTERVAL = 8000;

    const silentRefresh = async () => {
      if ((typeof navigator !== 'undefined' && !navigator.onLine) || document.hidden || inFlight) return;
      inFlight = true;
      try {
        await fetchDashboardData(true);
      } finally {
        inFlight = false;
      }
    };

    const start = () => { if (!intervalId) intervalId = setInterval(silentRefresh, POLL_INTERVAL); };
    const stop = () => { if (intervalId) { clearInterval(intervalId); intervalId = null; } };
    const onVis = () => { document.hidden ? stop() : (silentRefresh(), start()); };
    const onOnline = () => { silentRefresh(); start(); };
    const onOffline = () => { stop(); };

    start();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [fetchDashboardData]);

  const applicantName = user?.full_name || 'Solo Parent Applicant';

  const getServiceTitle = (type) => {
    if (type === 'renewal') return 'Renewal of Solo Parent ID';
    if (type === 'loss_spic') return 'Loss of SPIC Replacement';
    return 'Apply for a Solo Parent ID';
  };

  const currentStatusConfig = application
    ? STATUS_CONFIG[application.status] || { label: application.status?.replace(/_/g, ' '), color: 'bg-muted text-muted-foreground' }
    : null;

  return (
    <div className="container mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-8 max-w-6xl space-y-6 sm:space-y-8 w-full max-w-full overflow-x-hidden min-w-0">
      {/* ── Welcome Header ────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold border border-primary/20 mb-2">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Republic Act No. 11861 Portal
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-foreground font-display">
            Welcome, {applicantName}
          </h1>
          <p className="text-xs sm:text-base text-muted-foreground mt-1">
            City Social Welfare and Development Department (CSWDD) — Butuan City
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0 w-full sm:w-auto">
          <Button
            asChild
            variant={application ? "outline" : "default"}
            className="rounded-2xl font-bold min-h-[44px] h-11 px-5 shadow-2xs w-full sm:w-auto justify-center"
          >
            <Link to="/portal/services">
              <LayoutGrid className="mr-2 h-4 w-4" />
              Go to Services
            </Link>
          </Button>
          {application && (
            <Button
              asChild
              className="rounded-2xl font-bold min-h-[44px] h-11 px-5 bg-primary hover:bg-primary/90 text-primary-foreground shadow-md shadow-primary/20 w-full sm:w-auto justify-center"
            >
              <Link to="/portal/my-application">
                <ClipboardList className="mr-2 h-4 w-4" />
                View Application
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* ── Current Application Overview Card ─────────── */}
      <div className="rounded-3xl border-2 border-border/80 bg-card p-5 sm:p-8 shadow-sm">
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center space-y-3">
            <RefreshCw className="h-6 w-6 animate-spin text-primary" />
            <p className="text-xs text-muted-foreground font-medium">Checking application status...</p>
          </div>
        ) : application ? (
          /* Active Application Present */
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-border/60">
              <div className="flex items-start gap-4">
                <div className={`h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
                  application.status === 'qualified' || application.status === 'completed' || application.status === 'ready_for_pickup'
                    ? 'bg-emerald-600 text-white'
                    : application.status === 'for_document_correction'
                      ? 'bg-rose-600 text-white'
                      : 'bg-primary text-primary-foreground'
                }`}>
                  {application.status === 'qualified' || application.status === 'completed' ? (
                    <CheckCircle className="h-6 w-6" />
                  ) : application.status === 'for_document_correction' ? (
                    <AlertTriangle className="h-6 w-6" />
                  ) : (
                    <Clock className="h-6 w-6" />
                  )}
                </div>
                <div>
                  <span className="text-xs uppercase font-bold tracking-wider text-muted-foreground">
                    {application.status === 'completed' || application.status === 'released'
                      ? 'Completed Application Record'
                      : 'Current Active Application'}
                  </span>
                  <h2 className="text-xl sm:text-2xl font-bold text-foreground font-display mt-0.5">
                    {getServiceTitle(application.application_type)}
                  </h2>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className="text-xs font-mono font-bold bg-muted px-2.5 py-0.5 rounded-lg border border-border">
                      App No: {application.reference_no}
                    </span>
                    <Badge variant="outline" className={`text-xs font-bold px-3 py-0.5 rounded-full border shadow-2xs ${currentStatusConfig.color}`}>
                      {currentStatusConfig.label}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0 w-full sm:w-auto">
                <Button
                  asChild
                  className="rounded-2xl font-bold min-h-[44px] h-11 px-5 bg-primary hover:bg-primary/90 text-primary-foreground shadow-md gap-2 w-full sm:w-auto justify-center"
                >
                  <Link to="/portal/my-application">
                    <span>View Application</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="rounded-2xl font-semibold min-h-[44px] h-11 px-4 border-border shadow-2xs w-full sm:w-auto justify-center"
                >
                  <Link to="/portal/services">
                    Services Menu
                  </Link>
                </Button>
              </div>
            </div>

            {/* Application Status Details Alert */}
            {application.status === 'for_document_correction' && (
              <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 flex items-start gap-3 text-xs sm:text-sm">
                <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-rose-800 dark:text-rose-300">
                    Action Required: Document Correction Needed
                  </p>
                  <p className="text-rose-700 dark:text-rose-400">
                    {application.status_reason || 'One or more of your submitted documentary requirements was rejected by CSWDD. Please re-upload the required document.'}
                  </p>
                  <Link to="/portal/my-application?step=documents" className="inline-flex items-center gap-1 font-bold text-rose-800 dark:text-rose-300 underline mt-1">
                    Upload Replacement Document →
                  </Link>
                </div>
              </div>
            )}

            {application.status === 'qualified' && (
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 flex items-start gap-3 text-xs sm:text-sm">
                <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-emerald-800 dark:text-emerald-300">
                    Your Application Has Been Qualified by CSWDD!
                  </p>
                  <p className="text-emerald-700 dark:text-emerald-400">
                    Please review your submitted information and documents to confirm their correctness.
                  </p>
                  <Link to="/portal/my-application" className="inline-flex items-center gap-1 font-bold text-emerald-800 dark:text-emerald-300 underline mt-1">
                    Review Submitted Information →
                  </Link>
                </div>
              </div>
            )}

            {application.status === 'ready_for_pickup' && (
              <div className="p-4 rounded-2xl bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-900/50 flex items-start gap-3 text-xs sm:text-sm">
                <CheckCircle className="h-5 w-5 text-teal-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-teal-800 dark:text-teal-300">
                    Your Solo Parent ID Card is Ready for Pickup!
                  </p>
                  <p className="text-teal-700 dark:text-teal-400">
                    Please visit the CSWDD Butuan City office with a valid government ID to claim your card.
                  </p>
                </div>
              </div>
            )}

            {(application.status === 'completed' || application.status === 'released') && (
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 flex items-start gap-3 text-xs sm:text-sm">
                <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-emerald-800 dark:text-emerald-300">
                    ID Claimed & Application Completed
                  </p>
                  <p className="text-emerald-700 dark:text-emerald-400">
                    Your Solo Parent ID card has been successfully claimed and released. Your submitted application form and documentary requirements remain permanently preserved in your application history. You may apply for renewal or loss replacement when eligible.
                  </p>
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    <Link to="/portal/my-application" className="inline-flex items-center gap-1 font-bold text-emerald-800 dark:text-emerald-300 underline">
                      View Application Records →
                    </Link>
                    <Link to="/portal/services" className="inline-flex items-center gap-1 font-bold text-primary underline">
                      Explore Other Services →
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* No Active Application State */
          <div className="py-8 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="h-14 w-14 rounded-3xl bg-muted/60 border border-border flex items-center justify-center shrink-0 text-muted-foreground">
                <ClipboardList className="h-7 w-7 text-primary" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-xl text-foreground font-display">
                  No Active Application
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-xl">
                  You do not have an ongoing transaction. Choose a service from the options below to start your Solo Parent transaction.
                </p>
              </div>
            </div>

            <Button
              asChild
              size="lg"
              className="rounded-2xl font-bold h-12 px-6 shadow-md bg-primary hover:bg-primary/90 text-primary-foreground shrink-0 gap-2 cursor-pointer"
            >
              <Link to="/portal/services">
                <LayoutGrid className="h-4 w-4" />
                <span>Go to Services</span>
                <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </div>
        )}
      </div>

      {/* ── Services Quick Selection ───────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-foreground font-display">
              Solo Parent Services
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Select what you need to process with CSWDD.
            </p>
          </div>
          <Button asChild variant="ghost" size="sm" className="font-semibold text-xs text-primary gap-1">
            <Link to="/portal/services">
              View All Details <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {/* Card 1: Apply Now */}
          <div className="card-pop card-pop-hover rounded-3xl p-6 flex flex-col justify-between border border-border/80">
            <div className="space-y-3">
              <div className="h-11 w-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                <Plus className="h-6 w-6" />
              </div>
              <h3 className="font-bold text-lg text-foreground font-display">
                Apply for Solo Parent ID
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                For applicants needing to apply for an official Solo Parent ID card for the first time.
              </p>
            </div>
            <div className="mt-5 pt-4 border-t border-border/60">
              <Button asChild size="sm" className="w-full rounded-xl font-bold bg-primary hover:bg-primary/90 text-primary-foreground">
                <Link to="/portal/my-application?action=apply">
                  Apply Now <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </div>

          {/* Card 2: Renew ID */}
          <div className="card-pop card-pop-hover rounded-3xl p-6 flex flex-col justify-between border border-border/80">
            <div className="space-y-3">
              <div className="h-11 w-11 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
                <RotateCcw className="h-6 w-6" />
              </div>
              <h3 className="font-bold text-lg text-foreground font-display">
                Renewal of Solo Parent ID
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                For applicants who already have or previously had a Solo Parent ID (online or manual).
              </p>
            </div>
            <div className="mt-5 pt-4 border-t border-border/60">
              <Button asChild size="sm" className="w-full rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white">
                <Link to="/portal/renew">
                  Renew ID <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </div>

          {/* Card 3: Report Lost SPIC */}
          <div className="card-pop card-pop-hover rounded-3xl p-6 flex flex-col justify-between border border-border/80">
            <div className="space-y-3">
              <div className="h-11 w-11 rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center font-bold">
                <AlertOctagon className="h-6 w-6" />
              </div>
              <h3 className="font-bold text-lg text-foreground font-display">
                Loss of SPIC
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                For applicants whose card was lost, damaged, or stolen and need a replacement card.
              </p>
            </div>
            <div className="mt-5 pt-4 border-t border-border/60">
              <Button asChild size="sm" className="w-full rounded-xl font-bold bg-rose-600 hover:bg-rose-700 text-white">
                <Link to="/portal/loss-spic">
                  Report Lost SPIC <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Important Announcements ────────────────────── */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold text-foreground font-display">
            Important Announcements
          </h2>
        </div>

        {announcements.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border/80 p-8 text-center bg-muted/10">
            <p className="text-sm text-muted-foreground">
              No new announcements at this time. Check back later for official CSWDD updates.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {announcements.map((ann) => (
              <div
                key={ann.id}
                className="rounded-3xl border border-border/80 bg-card p-5 space-y-2 shadow-2xs"
              >
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-semibold text-primary uppercase tracking-wider text-[10px]">Official Notice</span>
                  <span>{ann.created_at ? format(new Date(ann.created_at), 'MMM dd, yyyy') : ''}</span>
                </div>
                <h4 className="font-bold text-base text-foreground line-clamp-1">
                  {ann.title}
                </h4>
                <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                  {ann.content || ann.body || ann.description}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
