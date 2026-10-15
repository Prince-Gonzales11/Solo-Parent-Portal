import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api, toastError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  IdCard, RotateCcw, AlertOctagon, ArrowRight, CheckCircle2,
  Clock, AlertTriangle, ShieldCheck, FileCheck, RefreshCw, Sparkles,
  Info, XCircle, Eye
} from 'lucide-react';

export default function Services() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeApp, setActiveApp] = useState(null);
  const [eligibility, setEligibility] = useState(null);
  const [latestCompletedApp, setLatestCompletedApp] = useState(null);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  let inFlight = false;
  const fetchActiveApp = async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    if (inFlight) return;
    inFlight = true;
    try {
      const res = await api.get('/applications/me', { cache: false });
      if (res.data?.is_active) {
        setActiveApp(res.data?.application || null);
      } else {
        setActiveApp(null);
      }
      setEligibility(res.data?.eligibility || null);
      const allApps = res.data?.all_applications || [];
      const completed = allApps.find(a => ['completed', 'released'].includes(a.status));
      setLatestCompletedApp(completed || null);
    } catch (err) {
      // non-fatal
    } finally {
      inFlight = false;
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActiveApp();

    let interval = null;
    const startPolling = () => {
      if (!interval) {
        interval = setInterval(() => {
          if (!document.hidden && (!navigator || navigator.onLine)) {
            fetchActiveApp();
          }
        }, 8000);
      }
    };
    const stopPolling = () => {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    };

    startPolling();

    const handleVisibility = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        fetchActiveApp();
        startPolling();
      }
    };

    const handleOnline = () => {
      fetchActiveApp();
      startPolling();
    };

    const handleOffline = () => {
      stopPolling();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleCancelActiveApp = async () => {
    if (!activeApp?.id) return;
    setCancelling(true);
    try {
      await api.post(`/applications/${activeApp.id}/cancel`, {
        reason: cancelReason.trim() || 'Applicant cancelled application to choose a different service.',
      });
      toast.success('Active transaction cancelled successfully.');
      setActiveApp(null);
      setCancelModalOpen(false);
      setCancelReason('');
    } catch (err) {
      toastError(err, 'Failed to cancel application.');
    } finally {
      setCancelling(false);
    }
  };

  const IN_PROGRESS_STATUSES = [
    'draft', 'submitted', 'under_initial_review', 'documents_under_review',
    'document_verification', 'for_document_correction', 'pending_additional_requirements',
    'qualified', 'applicant_verification', 'under_final_assessment',
    'under_final_verification', 'ready_for_printing', 'ready_for_release'
  ];

  const handleSelectService = (serviceType) => {
    if (loading) {
      toast.info('Checking your application status, please wait a moment...');
      return;
    }

    const isActuallyInProgress = activeApp && IN_PROGRESS_STATUSES.includes(activeApp.status);

    if (isActuallyInProgress) {
      const typeLabel = activeApp.application_type === 'renewal'
        ? 'Renewal of Solo Parent ID'
        : activeApp.application_type === 'loss_spic'
          ? 'Loss of SPIC Replacement'
          : 'New Solo Parent ID Application';

      toast.info(`You already have an active transaction in progress (${typeLabel} - Ref: ${activeApp.reference_no}). Redirecting to your application...`, {
        duration: 4000,
      });
      navigate('/portal/my-application');
      return;
    }

    if (serviceType === 'new') {
      if (eligibility && !eligibility.can_apply_new) {
        toast.info(eligibility.can_apply_new_reason || 'You already hold an official Solo Parent ID record.');
        return;
      }
      navigate('/portal/my-application?action=apply');
    } else if (serviceType === 'renewal') {
      if (eligibility && !eligibility.can_apply_renewal) {
        toast.info(eligibility.can_apply_renewal_reason || 'Your Solo Parent ID is currently active and not yet eligible for renewal.');
        return;
      }
      navigate('/portal/renew');
    } else if (serviceType === 'loss') {
      if (eligibility && !eligibility.can_apply_loss) {
        toast.info(eligibility.can_apply_loss_reason || 'You have an active transaction in progress.');
        return;
      }
      navigate('/portal/loss-spic');
    }
  };

  const getServiceLabel = (type) => {
    if (type === 'renewal') return 'Renewal of Solo Parent ID';
    if (type === 'loss_spic') return 'Loss of SPIC Replacement';
    return 'Solo Parent ID Application';
  };

  const hasInProgressApp = activeApp && IN_PROGRESS_STATUSES.includes(activeApp.status);

  return (
    <div className="container mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-8 max-w-6xl space-y-6 sm:space-y-8 w-full max-w-full overflow-x-hidden min-w-0">
      {/* ── Header ────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold border border-primary/20">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          CSWDD Butuan City Online Services
        </div>
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-foreground font-display">
          Solo Parent Services
        </h1>
        <p className="text-muted-foreground text-xs sm:text-sm md:text-base max-w-3xl leading-relaxed">
          Select the service you wish to initiate. Whether applying for the first time, renewing an existing card, or reporting a lost SPIC, your transaction is processed independently according to RA 11861 guidelines.
        </p>
      </div>

      {/* ── Active Application Notice ─────────────────── */}
      {hasInProgressApp && (
        <Card className="border-2 border-primary/30 bg-primary/5 shadow-sm rounded-3xl overflow-hidden">
          <CardContent className="p-4 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3 sm:gap-3.5">
              <div className="h-10 w-10 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shrink-0 shadow-xs">
                <Clock className="h-5 w-5" />
              </div>
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-sm sm:text-base text-foreground">
                    Active Transaction in Progress
                  </span>
                  <Badge variant="outline" className="font-mono text-xs bg-background border-border">
                    {activeApp.reference_no}
                  </Badge>
                  <Badge className="bg-primary/20 text-primary border-primary/30 text-xs capitalize">
                    {activeApp.status?.replace(/_/g, ' ')}
                  </Badge>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  You are currently transacting for <strong className="text-foreground">{getServiceLabel(activeApp.application_type)}</strong>. You may track its progress, complete missing requirements, or cancel it to start over.
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-2.5 shrink-0 w-full md:w-auto">
              <Button
                asChild
                className="rounded-xl font-semibold text-xs shadow-xs bg-primary hover:bg-primary/90 text-primary-foreground min-h-[44px] justify-center"
              >
                <Link to="/portal/my-application">
                  View Active Application <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Link>
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCancelModalOpen(true)}
                className="rounded-xl font-bold text-xs bg-rose-50 hover:bg-rose-100 text-rose-700 border-2 border-rose-300 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 dark:text-rose-300 dark:border-rose-800 shadow-xs cursor-pointer gap-1.5 min-h-[44px] justify-center"
              >
                <XCircle className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                Cancel Application
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Services Cards Grid ──────────────────────── */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Service 1: Apply for a Solo Parent ID */}
        <div className={`card-pop card-pop-hover rounded-3xl p-6 sm:p-7 flex flex-col justify-between border-2 ${latestCompletedApp ? 'border-border/70 bg-muted/10' : 'border-border/80 hover:border-primary/50'} transition-all duration-200`}>
          <div className="space-y-4">
            <div className={`h-14 w-14 rounded-2xl ${latestCompletedApp ? 'bg-muted text-muted-foreground' : 'bg-gradient-to-tr from-[#0e4b65] to-[#197b8a] text-white shadow-md shadow-[#0e4b65]/20'} flex items-center justify-center`}>
              <IdCard className="h-7 w-7" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider text-primary border-primary/20">
                  Service 1
                </Badge>
                {latestCompletedApp && (
                  <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 text-[10px] font-bold">
                    ✓ Already Registered
                  </Badge>
                )}
              </div>
              <h3 className="font-bold text-xl text-foreground font-display">
                Apply for a Solo Parent ID
              </h3>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                {latestCompletedApp
                  ? `You are already registered as a Solo Parent with an official CSWDD record (Ref: ${latestCompletedApp.reference_no}${latestCompletedApp.id_card_number ? ` · ID: ${latestCompletedApp.id_card_number}` : ''}). If your card is expiring, please use Renewal.`
                  : 'For applicants who need to apply for a new Solo Parent Identification Card (SPIC) under Republic Act No. 11861.'}
              </p>
            </div>

            <div className="space-y-2 pt-2 border-t border-border/60 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <span>Choose qualifying solo parent category</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <span>Upload category-specific requirements</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <span>Complete official Solo Parent form</span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-5 border-t border-border/60">
            {latestCompletedApp ? (
              <Button
                asChild
                variant="outline"
                className="w-full rounded-2xl h-11 font-bold border-2 border-border/80 hover:bg-muted text-foreground gap-2 cursor-pointer shadow-xs"
              >
                <Link to={`/portal/my-application?id=${latestCompletedApp.id}&step=status`}>
                  <Eye className="h-4 w-4 text-primary" />
                  <span>View Registered Record</span>
                </Link>
              </Button>
            ) : (
              <Button
                className="w-full rounded-2xl h-11 font-bold shadow-md bg-primary hover:bg-primary/90 text-primary-foreground gap-2 cursor-pointer"
                onClick={() => handleSelectService('new')}
                disabled={loading}
              >
                <span>{loading ? 'Checking Status...' : (activeApp && activeApp.application_type === 'new' ? 'Continue Application' : 'Apply Now')}</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Service 2: Renewal of Solo Parent ID */}
        <div className="card-pop card-pop-hover rounded-3xl p-6 sm:p-7 flex flex-col justify-between border-2 border-border/80 hover:border-emerald-500/50 transition-all duration-200">
          <div className="space-y-4">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-700 text-white shadow-md shadow-emerald-600/20 flex items-center justify-center">
              <RotateCcw className="h-7 w-7" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider text-emerald-700 border-emerald-500/30">
                  Service 2
                </Badge>
                {eligibility?.spic_valid_until && (
                  <Badge className={eligibility.days_until_expiry <= 0
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300 text-[10px] font-bold"
                    : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-300 text-[10px] font-bold"
                  }>
                    {eligibility.days_until_expiry <= 0
                      ? `SPIC Expired (${eligibility.spic_valid_until})`
                      : `Valid Until ${eligibility.spic_valid_until}`}
                  </Badge>
                )}
                {latestCompletedApp && (
                  <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 text-[10px] font-bold">
                    Renewal Available
                  </Badge>
                )}
              </div>
              <h3 className="font-bold text-xl text-foreground font-display">
                Renewal of Solo Parent ID
              </h3>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                {eligibility?.can_apply_renewal_reason || 'For applicants who already have or previously had a Solo Parent ID issued by CSWDD (online or manual offline process).'}
              </p>
            </div>

            <div className="space-y-2 pt-2 border-t border-border/60 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <span>Independent renewal — no prior portal record required</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <span>Affidavit of Solo Parent & Barangay Official</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <span>Latest ITR, Original SPIC copy, & 1x1 Photo</span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-5 border-t border-border/60">
            <Button
              className="w-full rounded-2xl h-11 font-bold shadow-md bg-emerald-600 hover:bg-emerald-700 text-white gap-2 cursor-pointer"
              onClick={() => handleSelectService('renewal')}
              disabled={loading}
            >
              <span>{loading ? 'Checking Status...' : (activeApp && activeApp.application_type === 'renewal' ? 'Continue Renewal' : 'Renew ID')}</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Service 3: Loss of SPIC */}
        <div className="card-pop card-pop-hover rounded-3xl p-6 sm:p-7 flex flex-col justify-between border-2 border-border/80 hover:border-rose-500/50 transition-all duration-200">
          <div className="space-y-4">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-tr from-rose-600 to-amber-700 text-white flex items-center justify-center shadow-md shadow-rose-600/20">
              <AlertOctagon className="h-7 w-7" />
            </div>
            <div>
              <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider text-rose-600 border-rose-500/30 mb-2">
                Service 3
              </Badge>
              <h3 className="font-bold text-xl text-foreground font-display">
                Loss of SPIC
              </h3>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                For applicants whose Solo Parent Identification Card was lost, stolen, or damaged and require a verified replacement card.
              </p>
            </div>

            <div className="space-y-2 pt-2 border-t border-border/60 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <span>No previous portal application required</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <span>Notarized Affidavit of Loss & Sworn Affidavit</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <span>Barangay Affidavit & 1x1 Photo</span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-5 border-t border-border/60">
            <Button
              className="w-full rounded-2xl h-11 font-bold shadow-md bg-rose-600 hover:bg-rose-700 text-white gap-2 cursor-pointer"
              onClick={() => handleSelectService('loss')}
              disabled={loading}
            >
              <span>{loading ? 'Checking Status...' : (activeApp && activeApp.application_type === 'loss_spic' ? 'Continue Report' : 'Report Lost SPIC')}</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* ── Cancel Application Confirmation Modal ── */}
      <Dialog open={cancelModalOpen} onOpenChange={setCancelModalOpen}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="h-5 w-5" /> Cancel Application
            </DialogTitle>
            <DialogDescription className="text-sm pt-2 leading-relaxed">
              Are you sure you want to cancel this active transaction ({activeApp?.reference_no})?
              Once cancelled, you can freely choose and start any other service.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <Label htmlFor="cancel-reason" className="text-xs font-semibold">
              Reason for Cancellation (Optional)
            </Label>
            <Textarea
              id="cancel-reason"
              placeholder="e.g. Selected wrong service, need to change details, etc."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="h-20 text-xs rounded-xl"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCancelModalOpen(false)}
              className="rounded-xl"
              disabled={cancelling}
            >
              Keep Application
            </Button>
            <Button
              type="button"
              onClick={handleCancelActiveApp}
              disabled={cancelling}
              className="rounded-xl font-bold bg-rose-600 hover:bg-rose-700 text-white gap-2 cursor-pointer shadow-md"
            >
              {cancelling ? <RefreshCw className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
              <span>{cancelling ? 'Cancelling...' : 'Yes, Cancel Application'}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
