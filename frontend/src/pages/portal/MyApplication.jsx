import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { api, toastError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  ClipboardList, FileText, Upload, CheckCircle, Send, Eye,
  RefreshCw, AlertTriangle, ChevronRight, Plus, RotateCcw,
  User, Users, Heart, Phone, ArrowRight, ArrowLeft, Clock, Info, AlertCircle, XCircle
} from 'lucide-react';

/* ─── Status display config ─────────────────────────── */
const STATUS_LABELS = {
  draft:                           { label: 'Draft',                      color: 'bg-muted/30 text-muted-foreground border-border/50' },
  submitted:                       { label: 'Submitted',                  color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border-blue-300' },
  under_review:                    { label: 'Under Review',               color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 border-indigo-300' },
  under_initial_review:            { label: 'Under Review',               color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 border-indigo-300' },
  documents_under_review:          { label: 'Documents Under Review',     color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 border-violet-300' },
  document_verification:           { label: 'Documents Under Review',     color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 border-violet-300' },
  for_document_correction:         { label: 'For Document Correction',    color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-300' },
  pending_additional_requirements: { label: 'For Document Correction',    color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-300' },
  qualified:                       { label: 'Qualified by CSWDD',         color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-300' },
  applicant_verification:          { label: 'Applicant Verification',     color: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300 border-teal-300' },
  ready_for_pickup:                { label: 'Ready for Pickup',           color: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300 border-teal-300' },
  completed:                       { label: 'Completed ✓',                color: 'bg-emerald-200 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200 border-emerald-400' },
  reopened_for_review:             { label: 'Reopened for Review',        color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border-purple-300' },
  under_final_assessment:          { label: 'Final Assessment',           color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300 border-cyan-300' },
  under_final_verification:        { label: 'Final Verification',         color: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300 border-sky-300' },
  approved:                        { label: 'Approved ✓',                 color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-300' },
  ready_for_printing:              { label: 'Ready to Print',             color: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300 border-teal-300' },
  ready_for_release:               { label: 'Ready for Release',          color: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300 border-teal-300' },
  released:                        { label: 'ID Released ✓',              color: 'bg-emerald-200 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200 border-emerald-400' },
  rejected:                        { label: 'Rejected',                   color: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border-red-300' },
  cancelled:                       { label: 'Cancelled',                  color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300 border-gray-300' },
  expired:                         { label: 'Expired',                    color: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 border-gray-300' },
};

/* ─── 6-Stage Visual Progress Tracker (Requirement 11) ────────── */
function ApplicationProgressTracker({ status }) {
  const STAGES = [
    { key: 'submitted', label: 'Submitted' },
    { key: 'initial_review', label: 'Initial Review' },
    { key: 'doc_review', label: 'Document Review' },
    { key: 'qualified', label: 'Qualified' },
    { key: 'pickup', label: 'Ready for Pickup' },
    { key: 'completed', label: 'Completed' },
  ];

  let currentIdx = 0;
  if (['under_initial_review', 'under_review', 'reopened_for_review'].includes(status)) {
    currentIdx = 1;
  } else if (['documents_under_review', 'document_verification', 'for_document_correction', 'pending_additional_requirements', 'under_final_assessment', 'under_final_verification'].includes(status)) {
    currentIdx = 2;
  } else if (['qualified', 'applicant_verification', 'approved'].includes(status)) {
    currentIdx = 3;
  } else if (['ready_for_pickup', 'ready_for_printing', 'ready_for_release'].includes(status)) {
    currentIdx = 4;
  } else if (['completed', 'released'].includes(status)) {
    currentIdx = 5;
  }

  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      const activeEl = scrollRef.current.querySelector('[data-active="true"]');
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }
  }, [currentIdx]);

  const progressPercent = Math.round(((currentIdx + 1) / STAGES.length) * 100);

  return (
    <div className="card-pop rounded-3xl p-4 sm:p-5 border-2 border-border/70 bg-card overflow-hidden">
      <div className="pb-3 border-b border-border/50 flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wider text-muted-foreground font-bold">
            Processing Progress
          </span>
          <span className="text-[11px] font-semibold text-primary sm:hidden">
            ({currentIdx + 1}/{STAGES.length})
          </span>
        </div>
        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold border ${STATUS_LABELS[status]?.color || ''}`}>
          {STATUS_LABELS[status]?.label || status}
        </span>
      </div>

      {/* Mobile Current Stage Banner (< sm) */}
      <div className="sm:hidden mb-3 space-y-1.5 bg-muted/30 p-2.5 rounded-2xl border border-border/50">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-foreground">Current: {STAGES[currentIdx].label}</span>
          <span className="font-mono font-semibold text-primary">{progressPercent}%</span>
        </div>
        <Progress value={progressPercent} className="h-1.5" />
      </div>

      {/* Stepper with Horizontal Scroll and Snap */}
      <div className="w-full max-w-full overflow-hidden min-w-0">
        <div
          ref={scrollRef}
          className="overflow-x-auto pb-2 scrollbar-none snap-x snap-mandatory w-full max-w-full min-w-0 px-0.5"
        >
          <div className="flex items-center justify-between min-w-[420px] sm:min-w-full px-1 py-1">
            {STAGES.map((s, idx) => {
              const isCompleted = idx < currentIdx;
              const isCurrent = idx === currentIdx;

              return (
                <React.Fragment key={s.key}>
                  <div
                    data-active={isCurrent ? 'true' : 'false'}
                    className="flex flex-col items-center text-center snap-center shrink-0"
                  >
                    <div className={`h-8 w-8 sm:h-9 sm:w-9 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-xs ${
                      isCompleted
                        ? 'bg-emerald-600 text-white'
                        : isCurrent
                          ? 'bg-primary text-primary-foreground ring-4 ring-primary/20 scale-105'
                          : 'bg-muted text-muted-foreground'
                    }`}>
                      {isCompleted ? <CheckCircle className="h-4 w-4" /> : idx + 1}
                    </div>
                    <span className={`text-[11px] sm:text-xs mt-1.5 font-semibold max-w-[80px] sm:max-w-[90px] leading-tight ${
                      isCurrent ? 'text-primary font-bold' : isCompleted ? 'text-foreground' : 'text-muted-foreground'
                    }`}>
                      {s.label}
                    </span>
                  </div>

                  {idx < STAGES.length - 1 && (
                    <div className={`flex-1 h-1 mx-1.5 sm:mx-2 rounded-full transition-all ${
                      idx < currentIdx ? 'bg-emerald-500' : 'bg-border/60'
                    }`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Lazy-loaded sub-pages ──────────────────────────── */
const ProfileForm = React.lazy(() => import('./ProfileForm'));
const DocumentManager = React.lazy(() => import('./DocumentManager'));
const ApplicationTracker = React.lazy(() => import('./ApplicationTracker'));
const ApplicationReview = React.lazy(() => import('./ApplicationReview'));

/* ─── Sidebar stepper config ─────────────────────────── */
const STEPS = [
  { key: 'overview',   label: 'Overview',                icon: ClipboardList },
  { key: 'documents',  label: 'Documentary Requirements', icon: Upload },
  { key: 'form',       label: 'Application Form',        icon: FileText },
  { key: 'review',     label: 'Review & Submit',         icon: Send },
  { key: 'status',     label: 'Application Status',      icon: Eye },
];

const SHORT_STEP_LABELS = {
  overview: 'Overview',
  documents: 'Requirements',
  form: 'App Form',
  review: 'Review',
  status: 'Status',
};

export default function MyApplication() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Ensure any legacy stale cache is purged immediately
  useEffect(() => {
    try {
      localStorage.removeItem('portal_dashboard_cache');
    } catch {}
  }, []);

  const [application, setApplication] = useState(null);
  const [history, setHistory] = useState([]);
  const [allApplications, setAllApplications] = useState([]);
  const [documentsComplete, setDocumentsComplete] = useState(false);
  const [documentsApproved, setDocumentsApproved] = useState(false);
  const [completion, setCompletion] = useState(null);
  const [categories, setCategories] = useState([]);
  const categoriesRef = useRef([]);
  const [loading, setLoading] = useState(true);
  const [isReviewingFullPage, setIsReviewingFullPage] = useState(false);

  // Cancellation state (Requirement 12)
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  // Applicant verification modal state (Requirement 7)
  const [reviewInfoModalOpen, setReviewInfoModalOpen] = useState(false);
  const [verifyingSubmitted, setVerifyingSubmitted] = useState(false);
  const [submittedDocs, setSubmittedDocs] = useState([]);
  const [submittedProfile, setSubmittedProfile] = useState(null);
  const actionParam = searchParams.get('action'); // 'apply' | 'renew' | 'loss'
  const appType = application?.application_type || (['renew', 'loss'].includes(actionParam) ? (actionParam === 'renew' ? 'renewal' : 'loss_spic') : 'new');
  const isShortcutApp = ['renewal', 'loss_spic'].includes(appType);
  const isCompleted = ['completed', 'released'].includes(application?.status);

  const activeSteps = STEPS.filter(s => {
    if (isCompleted) {
      if (isShortcutApp) return ['status', 'documents'].includes(s.key);
      return ['status', 'documents', 'form'].includes(s.key);
    }
    if (isShortcutApp) {
      return ['documents', 'review', 'status'].includes(s.key);
    }
    if (appType === 'new') {
      return ['documents', 'form', 'status'].includes(s.key);
    }
    return true;
  });

  const defaultStep = !application || application.status === 'draft'
    ? 'documents'
    : 'status';
  const stepParam = searchParams.get('step') || defaultStep;
  const activeStep = activeSteps.find(s => s.key === stepParam) ? stepParam : defaultStep;

  const setStep = (key) => {
    setSearchParams({ step: key });
  };

  const mobileTabRef = useRef(null);
  useEffect(() => {
    if (mobileTabRef.current) {
      const activeEl = mobileTabRef.current.querySelector('[data-active-tab="true"]');
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }
  }, [activeStep]);

  const handleNavigateToField = ({ step = 'form', section = 'personal', focus = 'barangay', focusReq = null }) => {
    const params = { step };
    if (section) params.section = section;
    if (focus) params.focus = focus;
    if (focusReq !== null && focusReq !== undefined) params.focusReq = focusReq;
    setSearchParams(params);
  };

  const fetchAll = useCallback(async (explicitId) => {
    try {
      const needCategories = categoriesRef.current.length === 0;
      const targetAppId = explicitId || searchParams.get('id') || searchParams.get('application_id');
      const [appRes, compRes, catRes] = await Promise.allSettled([
        api.get('/applications/me', { params: targetAppId ? { id: targetAppId } : {}, cache: false }),
        api.get('/profile/completion', { cache: false }),
        needCategories ? api.get('/public/categories') : Promise.resolve({ data: categoriesRef.current }),
      ]);

      if (appRes.status === 'fulfilled') {
        const appData = appRes.value.data?.application || null;
        setApplication(appData);
        setHistory(appRes.value.data?.history || appRes.value.data?.status_history || []);
        setAllApplications(appRes.value.data?.all_applications || []);
        setDocumentsComplete(appRes.value.data?.documents_complete || false);
        setDocumentsApproved(appRes.value.data?.documents_approved || false);
      }

      if (compRes.status === 'fulfilled') {
        setCompletion(compRes.value.data);
      }

      if (catRes.status === 'fulfilled') {
        const cats = catRes.value.data || [];
        setCategories(cats);
        categoriesRef.current = cats;
      }
    } catch (err) {
      toastError(err, 'Failed to load application data.');
      setApplication(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch verification details on-demand when applicant opens the verification review modal
  const fetchVerificationDetails = useCallback(async () => {
    try {
      const [profRes, docRes] = await Promise.allSettled([
        api.get('/profile'),
        api.get('/documents'),
      ]);
      if (profRes.status === 'fulfilled') {
        setSubmittedProfile(profRes.value.data);
      }
      if (docRes.status === 'fulfilled') {
        setSubmittedDocs(docRes.value.data || []);
      }
    } catch (err) {
      console.warn('Failed to load submitted profile/docs:', err);
    }
  }, []);

  useEffect(() => {
    if (reviewInfoModalOpen) {
      fetchVerificationDetails();
    }
  }, [reviewInfoModalOpen, fetchVerificationDetails]);

  const handleCancelApplication = async () => {
    if (!application?.id) {
      setApplication(null);
      try { localStorage.removeItem('portal_dashboard_cache'); } catch {}
      setCancelModalOpen(false);
      navigate('/portal/services');
      return;
    }
    setCancelling(true);
    try {
      if (application.status === 'draft') {
        await api.delete('/applications/draft');
        toast.success('Draft application deleted.');
      } else {
        await api.post(`/applications/${application.id}/cancel`, {
          reason: cancelReason.trim() || 'Applicant cancelled application to start another service.',
        });
        toast.success('Application cancelled.');
      }
      setCancelModalOpen(false);
      setApplication(null);
      await fetchAll();
      navigate('/portal/services');
    } catch (err) {
      toastError(err, 'Failed to cancel application.');
    } finally {
      setCancelling(false);
    }
  };

  const handleVerifySubmitted = async () => {
    if (!application?.id) return;
    setVerifyingSubmitted(true);
    try {
      await api.post(`/applications/${application.id}/verify-submitted`);
      toast.success('Submitted information verified successfully!');
      setReviewInfoModalOpen(false);
      await fetchAll();
    } catch (err) {
      toastError(err, 'Failed to verify submitted information.');
    } finally {
      setVerifyingSubmitted(false);
    }
  };

  const currentAppParam = searchParams.get('id') || searchParams.get('application_id');
  useEffect(() => { 
    fetchAll(currentAppParam); 
  }, [fetchAll, currentAppParam]);

  // Smart polling with visibility API — pauses when tab is hidden or in terminal status
  useEffect(() => {
    if (!application?.id) return;

    // Differentiate active vs terminal polling rates:
    // Active statuses: 8s interval for fast responsive status progression
    // Terminal statuses (completed/released/rejected/cancelled/expired): 15s lightweight check so reopened applications synchronize automatically without manual refresh
    const terminalStatuses = ['rejected', 'cancelled', 'completed', 'released', 'expired'];
    const isTerminal = terminalStatuses.includes(application.status);
    const POLL_INTERVAL = isTerminal ? 15000 : 8000;

    let intervalId = null;
    let unchangedPollCount = 0;
    let inFlight = false;

    const doFetch = async () => {
      if ((typeof navigator !== 'undefined' && !navigator.onLine) || document.hidden || inFlight) return;
      inFlight = true;

      try {
        const targetAppId = searchParams.get('id') || searchParams.get('application_id');
        const res = await api.get('/applications/me', {
          params: targetAppId ? { id: targetAppId } : {},
          cache: false
        });
        const appData = res.data?.application || null;
        if (appData) {
          setApplication(prev => {
            if (!prev || prev.status !== appData.status || prev.status_reason !== appData.status_reason || prev.updated_at !== appData.updated_at) {
              unchangedPollCount = 0;
              return appData;
            }
            unchangedPollCount++;
            return prev;
          });
          setHistory(res.data?.history || res.data?.status_history || []);
          setAllApplications(res.data?.all_applications || []);
          setDocumentsComplete(res.data?.documents_complete || false);
          setDocumentsApproved(res.data?.documents_approved || false);
        }
      } catch {
        // Silently ignore background polling errors
      } finally {
        inFlight = false;
      }
    };

    const startPolling = () => {
      if (!intervalId) {
        intervalId = setInterval(doFetch, POLL_INTERVAL);
      }
    };

    const stopPolling = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    // Visibility change handler — pause polling when tab is hidden
    const handleVisibility = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        unchangedPollCount = 0;
        doFetch(); // Immediately fetch when tab becomes visible
        startPolling();
      }
    };

    const handleOnline = () => {
      unchangedPollCount = 0;
      doFetch(); // Immediately fetch on network reconnection
      startPolling();
    };

    const handleOffline = () => {
      stopPolling();
    };

    startPolling();
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [application?.id, application?.status, activeStep, searchParams]);

  /* ─── Handle "Start Application" ──────────── */
  const handleStartApplication = useCallback(async (action = 'apply') => {
    try {
      let endpoint = '/applications';
      let successMsg = 'New application started!';
      if (action === 'renew') {
        endpoint = '/applications/renew';
        successMsg = 'Renewal application started!';
      } else if (action === 'loss') {
        endpoint = '/applications/loss-spic';
        successMsg = 'Loss of SPIC application started!';
      }

      const categoryFromUrl = searchParams.get('category');
      const payload = categoryFromUrl ? { category: categoryFromUrl } : {};
      const res = await api.post(endpoint, payload);
      setApplication(res.data);
      toast.success(successMsg);
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('action');
      nextParams.set('step', 'documents');
      setSearchParams(nextParams, { replace: true });
      await fetchAll();
    } catch (err) {
      toastError(err, 'Failed to start application.');
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('action');
      setSearchParams(nextParams, { replace: true });
    }
  }, [searchParams, setSearchParams, fetchAll]);

  /* ─── Handle "Re-apply" (Reopen rejected application) ── */
  const handleReapply = async () => {
    if (!application?.id) return;
    try {
      await api.post(`/applications/${application.id}/reapply`);
      toast.success('Application reopened! You can now update your requirements and details.');
      await fetchAll();
      setStep('documents');
    } catch (err) {
      toastError(err, 'Failed to reopen application for re-applying.');
    }
  };

  // Auto-redirect or start from action params with clear feedback & param cleanup
  useEffect(() => {
    if (!loading && actionParam && ['apply', 'renew', 'loss'].includes(actionParam)) {
      if (!application || application.status === 'rejected') {
        handleStartApplication(actionParam);
      } else {
        const typeLabel = application.application_type === 'renewal'
          ? 'Renewal'
          : application.application_type === 'loss_spic'
            ? 'Loss of SPIC'
            : 'New Application';
        toast.info(`You already have an active ${typeLabel} transaction (${application.reference_no || 'In Progress'}). Showing your current application.`, {
          duration: 4000,
        });
        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete('action');
        if (!nextParams.get('step')) {
          nextParams.set('step', application.status === 'draft' ? 'documents' : 'status');
        }
        setSearchParams(nextParams, { replace: true });
      }
    }
  }, [actionParam, loading, application, handleStartApplication, searchParams, setSearchParams]);

  /* ─── Determine step completion state ──────── */
  const hasApp = !!application;
  const appStatus = application?.status;
  const isRejected = appStatus === 'rejected';
  const isFinalSubmitted = hasApp && ['under_review', 'under_final_assessment', 'under_final_verification', 'approved', 'ready_for_printing', 'ready_for_release', 'ready_for_pickup', 'completed', 'released'].includes(appStatus);
  const isFormComplete = completion?.is_complete || false;
  const formPct = completion?.percentage || 0;
  const isSubmitted = hasApp && appStatus !== 'draft';

  const getStepState = (key) => {
    switch (key) {
      case 'overview':
        return { complete: hasApp, accessible: !isShortcutApp && appType !== 'new' };
      case 'documents':
        return {
          complete: documentsComplete || isFinalSubmitted || ['submitted', 'approved', 'ready_for_pickup', 'completed', 'released', 'rejected'].includes(appStatus),
          accessible: hasApp || isShortcutApp,
        };
      case 'form':
        return {
          complete: isFormComplete || ['submitted', 'approved', 'ready_for_pickup', 'completed', 'released', 'rejected'].includes(appStatus),
          accessible: !isShortcutApp && hasApp && !isRejected,
        };
      case 'review':
        return {
          complete: isFinalSubmitted,
          accessible: hasApp && (documentsApproved || isFinalSubmitted) && (isShortcutApp || isFormComplete) && !isRejected,
        };
      case 'status':
        return {
          complete: isFinalSubmitted || ['approved', 'ready_for_pickup', 'completed', 'released'].includes(appStatus),
          accessible: isSubmitted || ['submitted', 'under_initial_review', 'documents_under_review', 'document_verification', 'qualified', 'approved', 'ready_for_pickup', 'completed', 'released', 'rejected'].includes(appStatus),
        };
      default:
        return { complete: false, accessible: false };
    }
  };

  // Route Guard: Prevent access to invalid steps or status before submission
  useEffect(() => {
    if (!loading) {
      const state = getStepState(activeStep);
      const fallbackStep = isShortcutApp || appType === 'new' ? 'documents' : 'overview';
      if (!state.accessible && activeStep !== fallbackStep) {
        if (activeStep === 'status' && !isSubmitted) {
          setSearchParams({ step: 'documents' });
        } else if (activeStep !== defaultStep) {
          setSearchParams({ step: fallbackStep });
        }
      }
    }
  }, [activeStep, hasApp, isSubmitted, loading, isShortcutApp, appType, defaultStep, setSearchParams]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Requirement 3: When there is No Active Application
  if (!application) {
    return (
      <div className="flex-1 container px-4 sm:px-6 lg:px-8 py-10 max-w-5xl mx-auto space-y-10">
        {/* No active application card */}
        <div className="card-pop rounded-3xl p-8 sm:p-12 text-center border-2 border-dashed border-border/80 bg-card/60 backdrop-blur-sm">
          <div className="h-16 w-16 mx-auto rounded-3xl bg-primary/10 text-primary flex items-center justify-center mb-5 shadow-xs">
            <ClipboardList className="h-8 w-8" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold font-display text-foreground">
            No Active Application
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto mt-2 text-sm sm:text-base leading-relaxed">
            You have not selected a service yet. Please visit Services to start your Solo Parent transaction.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-4">
            <Button asChild size="lg" className="rounded-2xl font-bold gap-2 shadow-md shadow-primary/20">
              <Link to="/portal/services">
                Go to Services <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="rounded-2xl font-bold">
              <Link to="/portal/dashboard">
                Return to Dashboard
              </Link>
            </Button>
          </div>
        </div>

        {/* Previous Application History if any */}
        {allApplications && allApplications.length > 0 && (
          <div className="card-pop rounded-3xl p-6 sm:p-8 border border-border/80 bg-card">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-bold text-lg font-display text-foreground">
                  Application History
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Records of your previously submitted, completed, or cancelled transactions.
                </p>
              </div>
              <Badge variant="outline" className="font-semibold text-xs">
                {allApplications.length} Record{allApplications.length === 1 ? '' : 's'}
              </Badge>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs uppercase tracking-wider text-muted-foreground bg-muted/40 border-b border-border/60">
                  <tr>
                    <th className="py-3 px-4 rounded-l-xl">Reference No.</th>
                    <th className="py-3 px-4">Service</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right rounded-r-xl">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {allApplications.map((app) => (
                    <tr key={app.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-foreground">
                        {app.reference_no}
                      </td>
                      <td className="py-3 px-4 font-medium text-foreground">
                        {app.application_type === 'renewal' || app.is_renewal ? 'Renewal of Solo Parent ID' : app.application_type === 'loss_spic' ? 'Loss of SPIC' : 'New Solo Parent ID'}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground text-xs">
                        {app.submitted_at || app.created_at ? format(new Date(app.submitted_at || app.created_at), 'PPP') : '—'}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${STATUS_LABELS[app.status]?.color || 'bg-muted text-muted-foreground'}`}>
                          {STATUS_LABELS[app.status]?.label || app.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs rounded-xl h-8 font-medium"
                          onClick={() => {
                            setSearchParams({ id: app.id, step: 'status' });
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                        >
                          View Record
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  }

  const serviceTitle = application?.application_type === 'renewal' || application?.is_renewal
    ? 'Renewal of Solo Parent ID'
    : application?.application_type === 'loss_spic'
      ? 'Loss of SPIC'
      : 'Apply for a Solo Parent ID';

  return (
    <div className="flex-1 container px-2.5 sm:px-6 lg:px-8 py-4 sm:py-8 max-w-7xl mx-auto space-y-4 sm:space-y-6 w-full max-w-full overflow-x-hidden min-w-0">
      {isReviewingFullPage ? (
        <React.Suspense fallback={<div className="flex items-center justify-center py-20"><RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
          <ApplicationReview
            onBack={() => setIsReviewingFullPage(false)}
            onEditStep={(stepKeyOrIdx) => {
              setIsReviewingFullPage(false);
              if (typeof stepKeyOrIdx === 'string') {
                setStep(stepKeyOrIdx);
              } else {
                const map = { 0: 'overview', 1: 'form', 2: 'documents' };
                setStep(map[stepKeyOrIdx] || 'overview');
              }
            }}
            onSubmitSuccess={() => {
              setIsReviewingFullPage(false);
              setStep('status');
              fetchAll();
            }}
          />
        </React.Suspense>
      ) : (
        <>
          {/* ─── Active Application Header (Requirement 11) ─────────── */}
          <div className="card-pop rounded-2xl sm:rounded-3xl p-4 sm:p-7 border border-border/70 bg-card w-full max-w-full overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
                  <Badge variant="outline" className="px-2.5 py-0.5 text-xs font-mono font-bold tracking-wider">
                    {application.reference_no}
                  </Badge>
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border shadow-2xs ${
                    STATUS_LABELS[appStatus]?.color || 'bg-muted text-muted-foreground border-border'
                  }`}>
                    {STATUS_LABELS[appStatus]?.label || appStatus}
                  </span>
                </div>
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold font-display text-foreground tracking-tight break-words">
                  {serviceTitle}
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  Submitted: {application.submitted_at ? format(new Date(application.submitted_at), 'PPP') : 'Draft (Not Yet Submitted)'}
                </p>
              </div>

              {/* Header Actions: Back to Services & Cancel Application */}
              <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 w-full sm:w-auto">
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="flex-1 sm:flex-none justify-center rounded-2xl border-2 border-border/80 bg-background hover:bg-muted font-bold text-foreground shadow-xs px-3.5 h-10 touch-manipulation text-xs sm:text-sm"
                >
                  <Link to="/portal/services">
                    <ArrowLeft className="mr-1.5 h-4 w-4 text-primary shrink-0" />
                    <span>Back to Services</span>
                  </Link>
                </Button>
                {!['completed', 'released', 'rejected'].includes(appStatus) && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setCancelModalOpen(true)}
                    className="flex-1 sm:flex-none justify-center rounded-2xl border-2 border-rose-300 dark:border-rose-800 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 dark:text-rose-300 font-bold shadow-xs px-3.5 h-10 gap-1.5 cursor-pointer touch-manipulation text-xs sm:text-sm"
                  >
                    <XCircle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" />
                    <span>Cancel Application</span>
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* ─── 6-Stage Progress Tracker (Requirement 11) ──────────── */}
          <ApplicationProgressTracker status={appStatus} />

          {/* ─── Contextual Action Banners ──────────────────────────── */}
          {/* 1. Document Correction Alert */}
          {appStatus === 'for_document_correction' && (
            <div className="card-pop rounded-3xl p-5 sm:p-6 bg-amber-500/10 border-2 border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="h-10 w-10 rounded-2xl bg-amber-500/20 text-amber-800 dark:text-amber-300 flex items-center justify-center shrink-0">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-bold text-amber-900 dark:text-amber-200 text-base font-display">
                    Documents Need Correction
                  </h4>
                  <p className="text-xs sm:text-sm text-amber-800 dark:text-amber-300 mt-0.5 leading-relaxed">
                    One or more submitted documentary requirements were rejected by the CSWDD reviewer. Please check the feedback and upload replacement documents.
                  </p>
                </div>
              </div>
              <Button
                onClick={() => setStep('documents')}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-2xl text-xs shrink-0 shadow-xs"
              >
                Go to Documents
              </Button>
            </div>
          )}

          {/* 2. Applicant Verification Banner (Requirement 7) */}
          {(appStatus === 'qualified' || appStatus === 'applicant_verification') && (
            <div className="card-pop rounded-3xl p-5 sm:p-6 bg-emerald-500/10 border-2 border-emerald-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="h-10 w-10 rounded-2xl bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 flex items-center justify-center shrink-0">
                  <CheckCircle className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-bold text-emerald-900 dark:text-emerald-200 text-base font-display">
                    Your application has been qualified by CSWDD!
                  </h4>
                  <p className="text-xs sm:text-sm text-emerald-800 dark:text-emerald-300 mt-0.5 leading-relaxed">
                    Please review the information and documents you submitted before proceeding.
                  </p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0 w-full sm:w-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setReviewInfoModalOpen(true)}
                  className="rounded-2xl border-emerald-500/40 text-emerald-900 dark:text-emerald-200 font-bold text-xs h-10 justify-center"
                >
                  <Eye className="h-3.5 w-3.5 mr-1.5" />
                  Review Submitted Information
                </Button>
                {!application.applicant_verified_at ? (
                  <Button
                    size="sm"
                    onClick={handleVerifySubmitted}
                    disabled={verifyingSubmitted}
                    className="rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs h-10 justify-center"
                  >
                    {verifyingSubmitted ? 'Confirming...' : 'Confirm Verification'}
                  </Button>
                ) : (
                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 py-1 px-3 text-xs gap-1 font-semibold justify-center">
                    <CheckCircle className="h-3 w-3 text-emerald-600" /> Confirmed
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* 3. Ready for Pickup Banner */}
          {['ready_for_pickup', 'ready_for_printing', 'ready_for_release'].includes(appStatus) && (
            <div className="card-pop rounded-3xl p-5 sm:p-6 bg-teal-500/10 border-2 border-teal-500/30 flex items-center gap-4">
              <div className="h-10 w-10 rounded-2xl bg-teal-500/20 text-teal-800 dark:text-teal-300 flex items-center justify-center shrink-0">
                <CheckCircle className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-bold text-teal-900 dark:text-teal-200 text-base font-display">
                  Your Solo Parent ID is Ready for Pickup!
                </h4>
                <p className="text-xs sm:text-sm text-teal-800 dark:text-teal-300 mt-0.5 leading-relaxed">
                  Your ID has been processed and is ready for release. Please visit the CSWDD office during regular working hours with a valid government ID.
                </p>
              </div>
            </div>
          )}

          {/* 4. Completed Banner */}
          {['completed', 'released'].includes(appStatus) && (
            <div className="card-pop rounded-3xl p-5 sm:p-7 bg-emerald-500/10 border-2 border-emerald-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-5 shadow-xs">
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <CheckCircle className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-bold text-emerald-950 dark:text-emerald-100 text-lg font-display">
                      Transaction Completed & ID Claimed ✓
                    </h4>
                    <Badge variant="outline" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 font-bold text-xs">
                      Archived Record
                    </Badge>
                  </div>
                  <p className="text-xs sm:text-sm text-emerald-800 dark:text-emerald-300 leading-relaxed max-w-2xl">
                    Your Solo Parent ID card transaction has been finalized and released by the CSWDD office. This record is permanently archived in your history and active transaction processing is concluded.
                  </p>
                  {(application.id_card_number || application.date_issued) && (
                    <div className="flex items-center gap-4 pt-1 text-xs text-emerald-900 dark:text-emerald-200 font-medium flex-wrap">
                      {application.id_card_number && (
                        <span>Official ID Card No: <strong className="font-mono">{application.id_card_number}</strong></span>
                      )}
                      {application.date_issued && (
                        <span>Issued: <strong>{format(new Date(application.date_issued), 'PPP')}</strong></span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0 w-full md:w-auto">
                <Button asChild size="sm" className="rounded-2xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs h-10 px-4 justify-center">
                  <Link to="/portal/services">
                    Explore Services <ArrowRight className="h-4 w-4 ml-1.5" />
                  </Link>
                </Button>
              </div>
            </div>
          )}

          {/* 5. Rejection Banner */}
          {appStatus === 'rejected' && (
            <div className="card-pop rounded-3xl p-5 sm:p-6 bg-rose-500/10 border-2 border-rose-500/30 space-y-3">
              <div className="flex items-start gap-3.5">
                <div className="h-10 w-10 rounded-2xl bg-rose-500/20 text-rose-800 dark:text-rose-300 flex items-center justify-center shrink-0">
                  <XCircle className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-bold text-rose-900 dark:text-rose-200 text-base font-display">
                    Application Disqualified / Rejected
                  </h4>
                  <p className="text-xs sm:text-sm text-rose-800 dark:text-rose-300 mt-0.5 leading-relaxed">
                    Your application was reviewed by CSWDD and could not be approved at this time.
                  </p>
                </div>
              </div>
              {application.status_reason && (
                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs sm:text-sm text-rose-900 dark:text-rose-200">
                  <p className="font-bold mb-1">Reason for Rejection:</p>
                  <p>{application.status_reason}</p>
                </div>
              )}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-2 w-full sm:w-auto">
                <Button
                  onClick={handleReapply}
                  size="sm"
                  className="rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs h-10 justify-center"
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Re-apply & Update Requirements
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCancelModalOpen(true)}
                  className="rounded-2xl border-rose-500/30 text-rose-900 dark:text-rose-200 font-semibold text-xs h-10 justify-center"
                >
                  Cancel & Start Different Service
                </Button>
              </div>
            </div>
          )}

          {/* ─── Main Stepper Layout ──────────────────────────────── */}
          {/* Mobile Horizontal Stepper Strip (< lg) */}
          <div className="lg:hidden w-full max-w-full overflow-hidden min-w-0">
            <div
              ref={mobileTabRef}
              className="w-full overflow-x-auto pb-1.5 scrollbar-none snap-x snap-mandatory px-0.5"
            >
              <div className="flex items-center gap-2 min-w-max py-1">
              {activeSteps.map((step, idx) => {
                const state = getStepState(step.key);
                const isActive = activeStep === step.key;

                return (
                  <button
                    key={step.key}
                    type="button"
                    data-active-tab={isActive ? 'true' : 'false'}
                    onClick={() => {
                      if (state.accessible || step.key === (isShortcutApp ? 'documents' : 'overview')) setStep(step.key);
                    }}
                    disabled={!state.accessible && step.key !== (isShortcutApp ? 'documents' : 'overview')}
                    className={`flex items-center gap-2 px-3 sm:px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 snap-center touch-manipulation min-h-[42px] shadow-2xs ${
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-sm ring-2 ring-primary/30'
                        : state.accessible || step.key === (isShortcutApp ? 'documents' : 'overview')
                          ? 'bg-card border border-border/80 text-foreground hover:bg-muted/60 cursor-pointer active:scale-95'
                          : 'opacity-40 cursor-not-allowed bg-muted/40 text-muted-foreground'
                    }`}
                  >
                    <div className={`h-5 w-5 rounded-md flex items-center justify-center shrink-0 text-[10px] font-bold ${
                      state.complete
                        ? 'bg-emerald-500 text-white'
                        : isActive
                          ? 'bg-white/20 text-white'
                          : 'bg-muted text-muted-foreground'
                    }`}>
                      {state.complete ? <CheckCircle className="h-3 w-3" /> : (idx + 1)}
                    </div>
                    <span className="sm:hidden">{SHORT_STEP_LABELS[step.key] || step.label}</span>
                    <span className="hidden sm:inline">{step.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

          <div className="flex flex-col lg:flex-row gap-6 pt-2">
            {/* Sidebar Stepper (Desktop only) */}
            <aside className="hidden lg:block lg:w-64 shrink-0">
              <div className="card-pop rounded-3xl p-4 sticky top-20 border border-border/70 bg-card">
                <div className="pb-3 mb-3 border-b border-border/60">
                  <div className="flex items-center gap-2 font-bold text-sm text-foreground font-display">
                    <ClipboardList className="h-4 w-4 text-primary" />
                    Application Steps
                  </div>
                  <p className="text-xs font-mono font-medium text-muted-foreground mt-1">
                    Ref: {application.reference_no}
                  </p>
                </div>
                <div>
                  <nav className="space-y-1.5">
                    {activeSteps.map((step, idx) => {
                      const state = getStepState(step.key);
                      const isActive = activeStep === step.key;

                      return (
                        <button
                          key={step.key}
                          onClick={() => {
                            if (state.accessible || step.key === (isShortcutApp ? 'documents' : 'overview')) setStep(step.key);
                          }}
                          disabled={!state.accessible && step.key !== (isShortcutApp ? 'documents' : 'overview')}
                          className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-left text-sm transition-all duration-200 ${
                            isActive
                              ? 'bg-primary text-primary-foreground font-bold shadow-md shadow-primary/20 scale-[1.02]'
                              : state.accessible || step.key === (isShortcutApp ? 'documents' : 'overview')
                                ? 'hover:bg-muted/60 text-foreground cursor-pointer'
                                : 'opacity-40 cursor-not-allowed text-muted-foreground'
                          }`}
                        >
                          <div className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${
                            state.complete
                              ? 'bg-emerald-500 text-white'
                              : isActive
                                ? 'bg-white/20 text-white'
                                : 'bg-muted text-muted-foreground'
                          }`}>
                            {state.complete ? (
                              <CheckCircle className="h-4 w-4" />
                            ) : (
                              <span className="text-xs font-bold">{idx + 1}</span>
                            )}
                          </div>
                          <span className="whitespace-normal leading-tight flex-1 font-medium">{step.label}</span>
                        </button>
                      );
                    })}
                  </nav>

                  {/* Cancel button in sidebar */}
                  {!['completed', 'released', 'rejected'].includes(appStatus) && (
                    <div className="mt-5 pt-4 border-t border-border/60">
                      <Button 
                        variant="outline" 
                        className="w-full justify-center text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border-2 border-rose-300 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 dark:text-rose-300 dark:border-rose-800 rounded-xl shadow-xs gap-1.5 cursor-pointer py-2.5"
                        onClick={() => setCancelModalOpen(true)}
                      >
                        <XCircle className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                        Cancel Application
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 min-w-0">
              <React.Suspense fallback={
                <div className="flex items-center justify-center py-20">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              }>
                {/* STEP: Overview */}
                {activeStep === 'overview' && (
                  <OverviewStep
                    application={application}
                    categories={categories}
                    completion={completion}
                    documentsComplete={documentsComplete}
                    documentsApproved={documentsApproved}
                    onStart={handleStartApplication}
                    onReapply={handleReapply}
                    onNavigate={setStep}
                    actionParam={actionParam}
                  />
                )}

                {/* STEP: Documentary Requirements */}
                {activeStep === 'documents' && (
                  <div>
                    <div className="mb-6">
                      <h2 className="text-xl font-bold flex items-center gap-2">
                        <Upload className="h-5 w-5 text-primary" />
                        Documentary Requirements
                      </h2>
                      <p className="text-sm text-muted-foreground mt-1">
                        Upload your required documentary attachments. Ensure documents are clear and legible.
                      </p>
                    </div>
                    <DocumentManager
                      embedded
                      application={application}
                      applicationId={application?.id}
                      categories={categories}
                      documentsApproved={documentsApproved}
                      onBack={() => navigate('/portal/services')}
                      onComplete={() => {
                        toast.success('Documentary requirements saved!');
                        if (!isShortcutApp) {
                          setStep('form');
                        } else {
                          setStep('review');
                        }
                        fetchAll();
                      }}
                    />
                  </div>
                )}

                {/* STEP: Application Form */}
                {activeStep === 'form' && (
                  <div>
                    <div className="mb-6">
                      <h2 className="text-xl font-bold flex items-center gap-2">
                        <FileText className="h-5 w-5 text-primary" />
                        Solo Parent Application Form
                      </h2>
                      <p className="text-sm text-muted-foreground mt-1">
                        Complete all five sections of the official application form. Your progress is saved automatically.
                      </p>
                    </div>
                    <ProfileForm 
                      embedded 
                      application={application}
                      categories={categories}
                      onBack={() => setStep('documents')}
                      onSubmitFinal={async () => {
                        await fetchAll();
                        setStep('status');
                      }}
                      onComplete={async () => {
                        await fetchAll();
                        setStep('status');
                      }} 
                    />
                  </div>
                )}

                {/* STEP: Review & Submit */}
                {activeStep === 'review' && (
                  <ReviewStep
                    application={application}
                    onStartReview={() => setIsReviewingFullPage(true)}
                    onNavigateToField={handleNavigateToField}
                    onNavigateToStep={setStep}
                  />
                )}

                {/* STEP: Application Status */}
                {activeStep === 'status' && (
                  <div>
                    <div className="mb-6">
                      <h2 className="text-xl font-bold flex items-center gap-2">
                        <Eye className="h-5 w-5 text-primary" />
                        Application Status
                      </h2>
                      <p className="text-sm text-muted-foreground mt-1">
                        Track the progress of your application.
                      </p>
                    </div>
                    <ApplicationTracker application={application} history={history} onRefresh={fetchAll} />
                  </div>
                )}
              </React.Suspense>
            </main>
          </div>

          {/* Application History Records */}
          {allApplications && allApplications.length > 0 && (
            <div className="card-pop rounded-3xl p-6 sm:p-8 border border-border/80 bg-card">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="font-bold text-lg font-display text-foreground">
                    Application History
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Records of your previously submitted, completed, or cancelled transactions.
                  </p>
                </div>
                <Badge variant="outline" className="font-semibold text-xs">
                  {allApplications.length} Record{allApplications.length === 1 ? '' : 's'}
                </Badge>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs uppercase tracking-wider text-muted-foreground bg-muted/40 border-b border-border/60">
                    <tr>
                      <th className="py-3 px-4 rounded-l-xl">Reference No.</th>
                      <th className="py-3 px-4">Service</th>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right rounded-r-xl">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {allApplications.map((app) => (
                      <tr key={app.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-foreground">
                          {app.reference_no}
                        </td>
                        <td className="py-3 px-4 font-medium text-foreground">
                          {app.application_type === 'renewal' || app.is_renewal ? 'Renewal of Solo Parent ID' : app.application_type === 'loss_spic' ? 'Loss of SPIC' : 'New Solo Parent ID'}
                        </td>
                        <td className="py-3 px-4 text-muted-foreground text-xs">
                          {app.submitted_at || app.created_at ? format(new Date(app.submitted_at || app.created_at), 'PPP') : '—'}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${STATUS_LABELS[app.status]?.color || 'bg-muted text-muted-foreground'}`}>
                            {STATUS_LABELS[app.status]?.label || app.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {app.id === application?.id ? (
                            <span className="text-xs font-semibold text-primary px-2.5 py-1 rounded-xl bg-primary/10">
                              Current View
                            </span>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs rounded-xl h-8 font-medium"
                              onClick={() => {
                                setSearchParams({ id: app.id, step: 'status' });
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                              }}
                            >
                              View Record
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ─── Cancel & Start Over Modal (Requirement 12) ─────────── */}
      <Dialog open={cancelModalOpen} onOpenChange={setCancelModalOpen}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive font-display">
              <AlertTriangle className="h-5 w-5" /> Cancel Application
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground pt-1 leading-relaxed">
              {application?.status === 'draft' ? (
                'Are you sure you want to cancel this draft application? It will be deleted and you can select a different service.'
              ) : (
                'Are you sure you want to cancel this submitted application and start a new service? Your record will be safely retained in your application history for CSWDD auditing.'
              )}
            </DialogDescription>
          </DialogHeader>

          {application?.status !== 'draft' && (
            <div className="space-y-2 py-2">
              <label className="text-xs font-semibold text-muted-foreground">
                Reason for Cancellation (Optional)
              </label>
              <Textarea
                placeholder="e.g. Selected wrong service, need to change information..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="rounded-xl text-sm min-h-[80px]"
              />
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0 pt-3">
            <Button
              variant="outline"
              onClick={() => setCancelModalOpen(false)}
              className="rounded-2xl"
              disabled={cancelling}
            >
              Keep Application
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelApplication}
              disabled={cancelling}
              className="rounded-2xl font-bold gap-1.5"
            >
              {cancelling ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
              {cancelling ? 'Cancelling...' : 'Cancel & Start Over'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Review Submitted Information Modal (Requirement 7) ─── */}
      <Dialog open={reviewInfoModalOpen} onOpenChange={setReviewInfoModalOpen}>
        <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[85vh] overflow-y-auto rounded-3xl p-5 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary font-display text-xl">
              <CheckCircle className="h-5 w-5 text-emerald-600" /> Review Submitted Information
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Please review all submitted personal details and documentary requirements for your application ({application?.reference_no}).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-3">
            {/* Service & Category Summary */}
            <div className="card-pop rounded-2xl p-4 bg-muted/30 border border-border/70 space-y-2 text-sm">
              <div className="flex justify-between items-center border-b border-border/50 pb-2">
                <span className="text-muted-foreground font-medium">Service Type:</span>
                <span className="font-bold text-foreground">{serviceTitle}</span>
              </div>
              <div className="flex justify-between items-center border-b border-border/50 pb-2">
                <span className="text-muted-foreground font-medium">Solo Parent Since:</span>
                <span className="font-bold text-foreground">{application?.solo_parent_since ? format(new Date(application.solo_parent_since), 'MMMM d, yyyy') : '—'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground font-medium">Category:</span>
                <span className="font-bold text-foreground">{application?.category_code || application?.solo_parent_category || '—'}</span>
              </div>
              {application?.existing_spic_no && (
                <div className="flex justify-between items-center border-t border-border/50 pt-2">
                  <span className="text-muted-foreground font-medium">Existing SPIC No:</span>
                  <span className="font-bold font-mono text-foreground">{application.existing_spic_no}</span>
                </div>
              )}
            </div>

            {/* Applicant Profile Information (if available) */}
            {submittedProfile && (
              <div className="card-pop rounded-2xl p-4 border border-border/70 space-y-3">
                <h4 className="font-bold text-sm text-foreground flex items-center gap-2 border-b border-border/50 pb-2">
                  <User className="h-4 w-4 text-primary" /> Personal Information
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-muted-foreground">Full Name:</span>
                    <p className="font-bold text-foreground text-sm mt-0.5">
                      {[submittedProfile.first_name, submittedProfile.middle_name, submittedProfile.last_name].filter(Boolean).join(' ') || '—'}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Barangay:</span>
                    <p className="font-bold text-foreground text-sm mt-0.5">
                      {submittedProfile.barangay || '—'}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Contact Number:</span>
                    <p className="font-bold text-foreground text-sm mt-0.5">
                      {submittedProfile.contact_number || submittedProfile.mobile_number || '—'}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Civil Status:</span>
                    <p className="font-bold text-foreground text-sm mt-0.5">
                      {submittedProfile.civil_status || '—'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Submitted Documentary Requirements */}
            <div className="card-pop rounded-2xl p-4 border border-border/70 space-y-3">
              <h4 className="font-bold text-sm text-foreground flex items-center gap-2 border-b border-border/50 pb-2">
                <Upload className="h-4 w-4 text-primary" /> Submitted Documentary Requirements
              </h4>
              {submittedDocs && submittedDocs.length > 0 ? (
                <div className="space-y-2">
                  {submittedDocs.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-2.5 rounded-xl bg-muted/20 border border-border/50 text-xs">
                      <div>
                        <p className="font-bold text-foreground">{doc.name || doc.document_type_name || 'Document'}</p>
                        <p className="text-muted-foreground text-[11px] font-mono mt-0.5">{doc.original_filename || 'Uploaded File'}</p>
                      </div>
                      <span className={`inline-flex px-2 py-0.5 rounded-full font-bold border text-[11px] ${
                        doc.status === 'approved' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                        doc.status === 'rejected' ? 'bg-rose-100 text-rose-800 border-rose-300' :
                        'bg-blue-100 text-blue-800 border-blue-300'
                      }`}>
                        {doc.status === 'approved' ? '✓ Approved' : doc.status === 'rejected' ? '✗ Rejected' : 'Under Review'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground py-2 text-center">
                  No documents found or documentary requirements pending review.
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-border/60">
            <Button
              variant="outline"
              onClick={() => setReviewInfoModalOpen(false)}
              className="rounded-2xl w-full sm:w-auto"
            >
              Close
            </Button>
            {!application?.applicant_verified_at ? (
              <Button
                onClick={handleVerifySubmitted}
                disabled={verifyingSubmitted}
                className="rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold w-full sm:w-auto gap-1.5 shadow-xs"
              >
                {verifyingSubmitted ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                {verifyingSubmitted ? 'Confirming...' : 'I Confirm This Information is Correct'}
              </Button>
            ) : (
              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 py-1.5 px-3 rounded-full text-xs font-semibold gap-1.5">
                <CheckCircle className="h-3.5 w-3.5 text-emerald-600" /> Verified by You
              </Badge>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ */
/*  OVERVIEW STEP                                             */
/* ═══════════════════════════════════════════════════════════ */
function OverviewStep({ application, categories, completion, documentsComplete, documentsApproved, onStart, onReapply, onNavigate, actionParam }) {
  const [starting, setStarting] = useState(false);
  const hasApp = !!application;
  const appStatus = application?.status;
  const isFormComplete = completion?.is_complete || false;
  const formPct = completion?.percentage || 0;

  const handleStart = async (isRenewal) => {
    setStarting(true);
    try {
      await onStart(isRenewal);
    } finally {
      setStarting(false);
    }
  };

  // If no application exists, show the "start" options
  if (!hasApp) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">My Application</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Choose the type of application you'd like to start.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {/* New Application Card */}
          <div 
            className="card-pop card-pop-hover rounded-3xl p-7 cursor-pointer group border border-border/80 flex flex-col justify-between"
            onClick={() => handleStart(false)}
          >
            <div>
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-tr from-[#0e4b65] to-[#197b8a] text-white flex items-center justify-center mb-5 shadow-md shadow-[#0e4b65]/20 group-hover:scale-105 transition-transform">
                <Plus className="h-7 w-7" />
              </div>
              <h3 className="font-bold text-xl text-foreground font-display">Apply for Solo Parent ID</h3>
              <p className="text-sm text-muted-foreground mt-2.5 leading-relaxed">
                Start a new Solo Parent ID application. First select your category and upload requirements, then complete your official application form.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-border/50 flex items-center justify-between text-sm font-bold text-primary">
              <span>Start Application</span>
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Renewal Card */}
          <div 
            className="card-pop card-pop-hover rounded-3xl p-7 cursor-pointer group border border-border/80 flex flex-col justify-between"
            onClick={() => window.location.href = '/portal/renew'}
          >
            <div>
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center mb-5 shadow-md shadow-emerald-600/20 group-hover:scale-105 transition-transform">
                <RotateCcw className="h-7 w-7" />
              </div>
              <h3 className="font-bold text-xl text-foreground font-display">Renew Solo Parent ID</h3>
              <p className="text-sm text-muted-foreground mt-2.5 leading-relaxed">
                Renew your existing Solo Parent ID. Your previous application information will be safely carried over.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-border/50 flex items-center justify-between text-sm font-bold text-emerald-600 dark:text-emerald-400">
              <span>Start Renewal</span>
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Loss of SPIC Card */}
          <div 
            className="card-pop card-pop-hover rounded-3xl p-7 cursor-pointer group border border-border/80 flex flex-col justify-between"
            onClick={() => window.location.href = '/portal/loss-spic'}
          >
            <div>
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-tr from-rose-600 to-orange-500 text-white flex items-center justify-center mb-5 shadow-md shadow-rose-600/20 group-hover:scale-105 transition-transform">
                <AlertCircle className="h-7 w-7" />
              </div>
              <h3 className="font-bold text-xl text-foreground font-display">Loss of SPIC</h3>
              <p className="text-sm text-muted-foreground mt-2.5 leading-relaxed">
                Apply for a replacement Solo Parent ID if you have lost your current active ID card.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-border/50 flex items-center justify-between text-sm font-bold text-rose-600 dark:text-rose-400">
              <span>Report Loss</span>
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </div>

        {starting && (
          <div className="flex items-center justify-center py-4">
            <RefreshCw className="h-5 w-5 animate-spin text-primary mr-2" />
            <span className="text-sm text-muted-foreground">Creating your application...</span>
          </div>
        )}
      </div>
    );
  }

  // Application exists — show progress overview
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold font-display">Application Overview</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {application.is_renewal ? 'Renewal' : 'New'} Application — Ref: <span className="font-mono font-bold text-foreground">{application.reference_no}</span>
        </p>
      </div>

      {/* Status */}
      <div className="card-pop rounded-3xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Application Status</p>
            <span className={`inline-flex items-center px-3.5 py-1.5 rounded-full text-sm font-bold border shadow-2xs ${
              STATUS_LABELS[appStatus]?.color || ''
            }`}>
              {STATUS_LABELS[appStatus]?.label || appStatus}
            </span>
          </div>
          <Badge variant="outline" className="text-xs font-bold px-3 py-1 rounded-full">
            {application.is_renewal ? 'Renewal' : 'New Application'}
          </Badge>
        </div>
      </div>

      {/* REJECTION / NOT QUALIFIED BANNER */}
      {appStatus === 'rejected' && (
        <Card className="border-2 border-destructive/50 bg-rose-50/50 dark:bg-rose-950/20 shadow-sm rounded-3xl">
          <CardContent className="py-6 px-7">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-2xl bg-destructive text-destructive-foreground flex items-center justify-center shrink-0 shadow-sm">
                <XCircle className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-lg text-destructive font-display">Application Not Qualified</h3>
                  <Badge variant="destructive" className="text-xs">Decision Final</Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                  Your application for Solo Parent ID status was reviewed by the CSWDD Administrator and did not qualify under the Republic Act 11861 guidelines.
                </p>

                {application.status_reason && (
                  <div className="mt-4 p-4 rounded-2xl bg-destructive/10 border border-destructive/20 text-sm">
                    <p className="font-bold text-destructive flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4" /> Reason from CSWDD Administrator:
                    </p>
                    <p className="text-foreground mt-1 leading-relaxed whitespace-pre-wrap">{application.status_reason}</p>
                  </div>
                )}

                <div className="mt-5 flex items-center gap-3 pt-3 border-t border-destructive/20 flex-wrap">
                  <Button
                    onClick={onReapply}
                    className="rounded-2xl bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold shadow-md gap-1.5"
                  >
                    <RotateCcw className="h-4 w-4" /> Re-apply & Update Requirements
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleStart(false)}
                    className="rounded-2xl font-semibold border-border gap-1.5"
                  >
                    <Plus className="h-4 w-4" /> Start Fresh
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => onNavigate('documents')}
                    className="rounded-2xl font-semibold border-border gap-1.5"
                  >
                    <Eye className="h-4 w-4" /> View Submitted Requirements
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Progress Steps */}
      {appStatus === 'draft' && (
        <div className="card-pop rounded-3xl p-6 sm:p-7 space-y-5">
          <div className="pb-4 border-b border-border/60">
            <h3 className="text-base font-bold text-foreground font-display">Your Progress</h3>
            <p className="text-sm text-muted-foreground mt-0.5">Complete each step to submit your application.</p>
          </div>
          <div className="space-y-3.5">
            {/* Documents progress (Step 1) */}
            <div 
              className="flex items-center gap-4 p-4.5 rounded-2xl border border-border/80 bg-muted/20 hover:border-primary/50 hover:bg-card transition-all cursor-pointer shadow-xs group"
              onClick={() => onNavigate('documents')}
            >
              <div className={`h-11 w-11 rounded-2xl flex items-center justify-center shrink-0 shadow-2xs ${
                documentsApproved 
                  ? 'bg-emerald-500 text-white' 
                  : (documentsComplete ? 'bg-amber-500 text-white' : 'bg-primary text-white')
              }`}>
                {documentsApproved ? <CheckCircle className="h-5 w-5" /> : <Upload className="h-5 w-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground">1. Documentary Requirements</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {documentsApproved 
                    ? 'Requirements approved by CSWDD Admin ✓' 
                    : (documentsComplete ? 'All uploaded — Awaiting CSWDD Admin approval' : 'Select category & upload required documents')}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
            </div>

            {/* Form progress (Step 2) */}
            <div 
              className={`flex items-center gap-4 p-4.5 rounded-2xl border border-border/80 transition-all shadow-xs group ${
                documentsApproved ? 'bg-muted/20 hover:border-primary/50 hover:bg-card cursor-pointer' : 'bg-muted/10 opacity-60 cursor-not-allowed'
              }`}
              onClick={() => documentsApproved && onNavigate('form')}
            >
              <div className={`h-11 w-11 rounded-2xl flex items-center justify-center shrink-0 shadow-2xs ${
                isFormComplete 
                  ? 'bg-emerald-500 text-white' 
                  : (documentsApproved ? 'bg-amber-500 text-white' : 'bg-muted text-muted-foreground')
              }`}>
                {isFormComplete ? <CheckCircle className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground">2. Application Form</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {documentsApproved 
                    ? (isFormComplete ? 'All sections completed ✓' : `${formPct}% complete`)
                    : 'Locked — CSWDD admin must review & approve your documents first'}
                </p>
                {documentsApproved && !isFormComplete && <Progress value={formPct} className="h-2 mt-2" />}
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
            </div>

            {/* Review & Submit (Step 3) */}
            <div 
              className={`flex items-center gap-4 p-4.5 rounded-2xl border border-border/80 transition-all shadow-xs group ${
                documentsApproved && isFormComplete ? 'bg-muted/20 hover:border-primary/50 hover:bg-card cursor-pointer' : 'bg-muted/10 opacity-50 cursor-not-allowed'
              }`}
              onClick={() => documentsApproved && isFormComplete && onNavigate('review')}
            >
              <div className="h-11 w-11 rounded-2xl flex items-center justify-center shrink-0 bg-muted text-muted-foreground shadow-2xs">
                <Send className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground">3. Review & Submit</p>
                <p className="text-xs text-muted-foreground mt-0.5">Review your application and submit for evaluation</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
            </div>
          </div>
        </div>
      )}

      {/* If already submitted, show quick link to status */}
      {appStatus !== 'draft' && appStatus !== 'rejected' && (
        <div className="card-pop rounded-3xl p-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0 shadow-2xs">
              <Eye className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-foreground">Track Your Application</p>
              <p className="text-xs text-muted-foreground mt-0.5">View status updates and review timeline in real-time</p>
            </div>
            <Button size="sm" className="rounded-xl px-4" onClick={() => onNavigate('status')}>
              View Status <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ */
/*  REVIEW & SUBMIT STEP (Landing)                            */
/* ═══════════════════════════════════════════════════════════ */

const FALLBACK_PROFILE_FIELD_MAP = {
  'Address': {
    name: 'Residential Address (Barangay)',
    section: 'personal',
    section_label: 'Section I: Personal Information',
    field: 'barangay',
    button_label: 'Complete Address',
    hint: 'Select your official Butuan City barangay jurisdiction.',
  },
  'Basic Info': {
    name: 'Personal Identification',
    section: 'personal',
    section_label: 'Section I: Personal Information',
    field: 'first_name',
    button_label: 'Fill Basic Info',
    hint: 'Enter your legal first name, last name, and birth date.',
  },
  'First Name': {
    name: 'First Name',
    section: 'personal',
    section_label: 'Section I: Personal Information',
    field: 'first_name',
    button_label: 'Fill First Name',
    hint: 'Enter your first name as shown on your government ID.',
  },
  'Last Name': {
    name: 'Last Name',
    section: 'personal',
    section_label: 'Section I: Personal Information',
    field: 'last_name',
    button_label: 'Fill Last Name',
    hint: 'Enter your last name as shown on your government ID.',
  },
  'Date of Birth': {
    name: 'Date of Birth',
    section: 'personal',
    section_label: 'Section I: Personal Information',
    field: 'birth_date',
    button_label: 'Set Date of Birth',
    hint: 'Provide your birth date.',
  },
  'Sex': {
    name: 'Sex',
    section: 'personal',
    section_label: 'Section I: Personal Information',
    field: 'sex',
    button_label: 'Select Sex',
    hint: 'Select your sex.',
  },
  'Civil Status': {
    name: 'Civil Status',
    section: 'personal',
    section_label: 'Section I: Personal Information',
    field: 'civil_status',
    button_label: 'Select Civil Status',
    hint: 'Select your legal civil status.',
  },
  'Contact Number': {
    name: 'Contact Number',
    section: 'personal',
    section_label: 'Section I: Personal Information',
    field: 'contact_number',
    button_label: 'Fill Contact Number',
    hint: 'Enter your primary mobile or phone number.',
  },
  'Solo Parent Category': {
    name: 'Solo Parent Category',
    section: 'solo_parent',
    section_label: 'Section III: Solo Parent Category',
    field: 'solo_parent_category',
    button_label: 'Select Category',
    hint: 'Select your qualifying Solo Parent category under RA 11861.',
  },
  'Solo Parent Since Date': {
    name: 'Solo Parent Since Date',
    section: 'solo_parent',
    section_label: 'Section III: Solo Parent Category',
    field: 'solo_parent_since',
    button_label: 'Set Since Date',
    hint: 'Indicate when you became a solo parent.',
  },
  'Needs & Problems': {
    name: 'Needs & Problems',
    section: 'needs',
    section_label: 'Section IV: Needs & Problems',
    field: 'needs_problems',
    button_label: 'Fill Needs & Problems',
    hint: 'Describe your needs and challenges as a solo parent.',
  },
  'Emergency Contact': {
    name: 'Emergency Contact Details',
    section: 'emergency',
    section_label: 'Section V: Emergency Contact',
    field: 'emergency_contact_name',
    button_label: 'Fill Emergency Contact',
    hint: 'Provide emergency contact person name and mobile number.',
  },
};

function ReviewStep({ application, onStartReview, onNavigateToField, onNavigateToStep }) {
  const [check, setCheck] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const refreshCheck = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await api.get('/applications/submission-check');
      setCheck(res.data);
      if (res.data?.ready) {
        toast.success('All requirements verified! Your application is ready.');
      } else {
        toast.info('Readiness check updated.');
      }
    } catch (err) {
      toastError(err, 'Failed to refresh readiness check.');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/applications/submission-check');
        setCheck(res.data);
      } catch (err) {
        toastError(err, 'Failed to load readiness check.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const isReady = check?.ready;

  // Resolve missing profile field items
  const resolvedProfileItems = (check?.missing_field_details && check.missing_field_details.length > 0)
    ? check.missing_field_details
    : (check?.missing_profile_fields || []).map(raw => {
        const mapped = FALLBACK_PROFILE_FIELD_MAP[raw];
        if (mapped) {
          return {
            name: mapped.name,
            section: mapped.section,
            section_label: mapped.section_label,
            field: mapped.field,
            step: 'form',
            button_label: mapped.button_label,
            hint: mapped.hint
          };
        }
        return {
          name: raw,
          section: 'personal',
          section_label: 'Section I: Personal Information',
          field: 'barangay',
          step: 'form',
          button_label: `Fill in ${raw}`,
          hint: 'Please complete this required profile field.'
        };
      });

  // Resolve missing document items
  const resolvedDocumentItems = (check?.missing_document_details && check.missing_document_details.length > 0)
    ? check.missing_document_details
    : (check?.missing_documents || []).map((docName, idx) => ({
        id: `doc_${idx}`,
        name: docName,
        index: idx,
        step: 'documents',
        button_label: 'Upload Document',
        hint: 'Required documentary requirement for your category.'
      }));

  const firstMissingField = resolvedProfileItems[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" />
            Review & Submit
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            You're almost there! Review your complete application before submitting.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onNavigateToStep?.(application?.application_type === 'new' ? 'form' : 'documents')}
            className="rounded-xl text-xs font-semibold gap-1.5"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to {application?.application_type === 'new' ? 'Form' : 'Documents'}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={refreshCheck}
            disabled={refreshing}
            className="rounded-xl text-xs font-semibold gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Checking…' : 'Re-check Status'}
          </Button>
        </div>
      </div>

      <div className={`card-pop rounded-3xl p-6 sm:p-10 flex flex-col items-center text-center border-2 ${
        isReady 
          ? 'border-emerald-500/30 bg-gradient-to-b from-emerald-500/10 via-card to-card shadow-lg shadow-emerald-500/5' 
          : 'border-amber-500/30 bg-gradient-to-b from-amber-500/10 via-card to-card shadow-lg shadow-amber-500/5'
      }`}>
        <div className={`h-20 w-20 rounded-3xl flex items-center justify-center mb-5 shadow-lg ${
          isReady 
            ? 'bg-gradient-to-tr from-emerald-500 to-teal-400 text-white shadow-emerald-500/30' 
            : 'bg-gradient-to-tr from-amber-500 to-orange-400 text-white shadow-amber-500/30'
        }`}>
          {isReady ? <CheckCircle className="h-10 w-10" /> : <AlertTriangle className="h-10 w-10" />}
        </div>
        
        <h3 className="text-2xl font-bold text-foreground font-display mb-2">
          {isReady ? 'Your application is ready for review' : 'Application incomplete'}
        </h3>
        
        <p className="text-sm text-muted-foreground max-w-lg mb-8 leading-relaxed">
          {isReady 
            ? 'All required sections have been completed and documents uploaded. Please proceed to the final comprehensive review.'
            : 'You are missing some required information or documents. Click the redirect button next to any missing field to jump directly to it.'}
        </p>

        {/* ─── MISSING PROFILE FIELDS LIST WITH DIRECT JUMP BUTTONS ─── */}
        {!isReady && resolvedProfileItems.length > 0 && (
          <div className="bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-3xl p-5 sm:p-6 mb-6 text-left w-full max-w-2xl shadow-xs">
            <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-amber-200/80 dark:border-amber-800/60">
              <div>
                <p className="text-xs font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wider flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  Missing Profile Information ({resolvedProfileItems.length})
                </p>
                <p className="text-xs text-amber-800/80 dark:text-amber-300/80 mt-0.5">
                  Click on any field to be redirected directly to its input location.
                </p>
              </div>
              {firstMissingField && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => onNavigateToField?.({
                    step: 'form',
                    section: firstMissingField.section || 'personal',
                    focus: firstMissingField.field || 'barangay'
                  })}
                  className="hidden sm:inline-flex text-xs font-bold border-amber-300 dark:border-amber-700 bg-amber-100 hover:bg-amber-200 text-amber-900 dark:text-amber-200 rounded-xl"
                >
                  Fix First Field →
                </Button>
              )}
            </div>

            <div className="space-y-2.5">
              {resolvedProfileItems.map((item, idx) => (
                <div
                  key={item.field || idx}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-white dark:bg-card border border-amber-200/90 dark:border-amber-800/50 shadow-2xs hover:border-amber-400 dark:hover:border-amber-600 transition-all group"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="h-8 w-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5 font-bold text-xs">
                      {idx + 1}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-foreground">
                          {item.name || item.field}
                        </span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
                          Required
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {item.section_label || 'Section I: Personal Information'} · {item.hint || 'Incomplete field'}
                      </p>
                    </div>
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    onClick={() => onNavigateToField?.({
                      step: 'form',
                      section: item.section || 'personal',
                      focus: item.field || 'barangay'
                    })}
                    className="shrink-0 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-xs gap-1.5 h-9 px-4 sm:self-center group-hover:scale-105 transition-transform"
                  >
                    {item.button_label || `Go to ${item.name || 'Field'}`}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── MISSING DOCUMENTS LIST WITH DIRECT UPLOAD BUTTONS ─── */}
        {!isReady && resolvedDocumentItems.length > 0 && (
          <div className="bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-3xl p-5 sm:p-6 mb-8 text-left w-full max-w-2xl shadow-xs">
            <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-amber-200/80 dark:border-amber-800/60">
              <div>
                <p className="text-xs font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wider flex items-center gap-2">
                  <Upload className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  Missing Documents ({resolvedDocumentItems.length})
                </p>
                <p className="text-xs text-amber-800/80 dark:text-amber-300/80 mt-0.5">
                  Click to be redirected directly to upload this required file.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onNavigateToStep?.('documents')}
                className="hidden sm:inline-flex text-xs font-bold border-amber-300 dark:border-amber-700 bg-amber-100 hover:bg-amber-200 text-amber-900 dark:text-amber-200 rounded-xl"
              >
                Go to Documents Step →
              </Button>
            </div>

            <div className="space-y-2.5">
              {resolvedDocumentItems.map((doc, idx) => (
                <div
                  key={doc.id || doc.name || idx}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-white dark:bg-card border border-amber-200/90 dark:border-amber-800/50 shadow-2xs hover:border-amber-400 dark:hover:border-amber-600 transition-all group"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-foreground">
                          {doc.name}
                        </span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                          Required Document
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Step 3: Documentary Requirements · Upload PDF, PNG, or JPG
                      </p>
                    </div>
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    onClick={() => onNavigateToField?.({
                      step: 'documents',
                      focusReq: doc.index ?? doc.id ?? ''
                    })}
                    className="shrink-0 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs gap-1.5 h-9 px-4 sm:self-center group-hover:scale-105 transition-transform"
                  >
                    Upload this Document
                    <Upload className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── PRIMARY ACTION BUTTON ─── */}
        {isReady ? (
          <Button 
            type="button"
            size="lg" 
            onClick={onStartReview}
            className="h-12 px-8 rounded-2xl font-semibold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            Review Everything <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto justify-center">
            {resolvedProfileItems.length > 0 ? (
              <Button
                type="button"
                size="lg"
                onClick={() => onNavigateToField?.({
                  step: 'form',
                  section: firstMissingField?.section || 'personal',
                  focus: firstMissingField?.field || 'barangay'
                })}
                className="w-full sm:w-auto h-12 px-8 rounded-2xl font-semibold bg-amber-600 hover:bg-amber-700 text-white shadow-lg shadow-amber-600/25 hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                Complete Missing Form Fields <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="button"
                size="lg"
                onClick={() => onNavigateToStep?.('documents')}
                className="w-full sm:w-auto h-12 px-8 rounded-2xl font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/25 hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                Go to Documentary Requirements <Upload className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
