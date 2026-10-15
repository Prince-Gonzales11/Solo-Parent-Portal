import React, { useEffect, useState } from 'react';
import { api, toastError } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import { FileText, CheckCircle, Clock, AlertTriangle, RefreshCw, Printer, RotateCcw, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

/* ---- Status config ---- */
const STATUS_CONFIG = {
  draft:                          { label: 'Draft',                       variant: 'outline',     step: 0 },
  submitted:                      { label: 'Submitted',                   variant: 'secondary',   step: 1 },
  under_initial_review:           { label: 'Under Initial Review',        variant: 'secondary',   step: 2 },
  document_verification:          { label: 'Document Verification',       variant: 'secondary',   step: 3 },
  documents_under_review:         { label: 'Document Verification',       variant: 'secondary',   step: 3 },
  pending_additional_requirements:{ label: 'Additional Requirements',     variant: 'destructive', step: 3 },
  for_document_correction:        { label: 'For Document Correction',     variant: 'destructive', step: 3 },
  reopened_for_review:            { label: 'Reopened for Review',         variant: 'secondary',   step: 2 },
  under_final_assessment:         { label: 'Under Final Assessment',      variant: 'secondary',   step: 4 },
  under_final_verification:       { label: 'Under Final Verification',    variant: 'secondary',   step: 4 },
  qualified:                      { label: 'Qualified',                   variant: 'default',     step: 5 },
  applicant_verification:         { label: 'Applicant Verification',      variant: 'default',     step: 5 },
  approved:                       { label: 'Approved',                    variant: 'default',     step: 5 },
  ready_for_printing:             { label: 'Ready for Printing',          variant: 'default',     step: 6 },
  ready_for_pickup:               { label: 'Ready for Pickup',            variant: 'default',     step: 7 },
  ready_for_release:              { label: 'Ready for Release',           variant: 'default',     step: 7 },
  released:                       { label: 'ID Released ✓',              variant: 'default',     step: 8 },
  completed:                      { label: 'Completed ✓',                 variant: 'default',     step: 8 },
  rejected:                       { label: 'Rejected',                    variant: 'destructive', step: -1 },
  expired:                        { label: 'Expired',                     variant: 'outline',     step: -1 },
};

const STAGES = [
  { key: 'submitted',              label: 'Submitted'        },
  { key: 'under_initial_review',   label: 'Initial Review'   },
  { key: 'document_verification',  label: 'Doc Verification' },
  { key: 'under_final_assessment', label: 'Final Assessment' },
  { key: 'approved',               label: 'Approved'         },
  { key: 'ready_for_printing',     label: 'Printing'         },
  { key: 'ready_for_release',      label: 'For Release'      },
  { key: 'released',               label: 'Released'         },
];

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || { label: status, variant: 'outline' };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

function StageTracker({ status }) {
  const currentStep = STATUS_CONFIG[status]?.step ?? 0;
  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex min-w-max gap-0 py-4 px-2">
        {STAGES.map((stage, idx) => {
          const isCompleted = idx < currentStep;
          const isCurrent   = idx === currentStep;
          return (
            <div key={stage.key} className="flex items-center">
              <div className="flex flex-col items-center gap-2 min-w-[88px]">
                <div className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                  isCompleted ? 'bg-primary border-primary text-primary-foreground shadow-md'
                  : isCurrent  ? 'bg-primary/10 border-primary text-primary'
                               : 'bg-muted border-border text-muted-foreground'
                }`}>
                  {isCompleted ? <CheckCircle className="h-4 w-4" /> : idx + 1}
                </div>
                <span className={`text-xs text-center leading-tight max-w-[80px] font-medium ${
                  isCurrent ? 'text-primary' : isCompleted ? 'text-foreground' : 'text-muted-foreground'
                }`}>{stage.label}</span>
              </div>
              {idx < STAGES.length - 1 && (
                <div className={`h-0.5 w-8 mb-7 ${idx < currentStep ? 'bg-primary' : 'bg-border'}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ApplicationTracker({ application: initialApp, history: initialHist, onRefresh }) {
  const [application, setApplication] = useState(initialApp || null);
  const [history, setHistory]         = useState(initialHist || []);
  const [check, setCheck]             = useState(null);
  const [loading, setLoading]         = useState(!initialApp);
  const [submitting, setSubmitting]   = useState(false);
  const [renewing, setRenewing]       = useState(false);
  const [renewDialog, setRenewDialog] = useState(false);

  useEffect(() => {
    if (initialApp) {
      setApplication(initialApp);
      if (initialHist) setHistory(initialHist);
      setLoading(false);
    }
  }, [initialApp, initialHist]);

  const fetchData = async (signal) => {
    if (!initialApp) setLoading(true);
    try {
      // GET /applications/me returns { application, history } OR { application: null, history: [] }
      const res = await api.get('/applications/me', { signal });
      if (signal?.aborted) return;
      const { application: app, history: hist } = res.data;
      setApplication(app || null);
      setHistory(hist || []);

      if (app && app.status === 'draft') {
        const checkRes = await api.get('/applications/submission-check', { signal });
        if (!signal?.aborted) setCheck(checkRes.data);
      } else {
        setCheck(null);
      }
    } catch (err) {
      if (signal?.aborted || err.name === 'CanceledError' || err.name === 'AbortError') {
        return;
      }
      if (err.response?.status !== 404) {
        toastError(err, 'Failed to load your application data. Please refresh the page.');
      }
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);
    return () => controller.abort();
  }, []);


  /* Create brand-new application */
  const handleCreate = async () => {
    try {
      await api.post('/applications');
      toast.success('Application draft created!');
      fetchData();
    } catch (err) {
      const status = err.response?.status;
      if (status === 409) {
        toast.error('You already have an active application. You cannot create another one at this time.');
      } else {
        toastError(err, 'Could not create your application. Please try again.');
      }
    }
  };

  /* Submit application */
  const handleSubmit = async () => {
    if (!application?.id) return;
    setSubmitting(true);
    try {
      await api.post(`/applications/${application.id}/submit`);
      toast.success('Application submitted successfully!');
      fetchData();
    } catch (err) {
      const detail = err.response?.data?.detail;
      const status = err.response?.status;
      if (status === 422 || (typeof detail === 'string' && /document|requirement/i.test(detail))) {
        toast.error('Submission incomplete. Please ensure all required documents are uploaded before submitting.');
      } else if (typeof detail === 'string') {
        toast.error(detail);
      } else {
        toastError(err, 'Submission failed. Please check your documents and try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  /* Renew expired / released ID */
  const handleRenew = async () => {
    setRenewing(true);
    try {
      await api.post('/applications/renew');
      toast.success('Renewal started! Your profile and documents were carried over.');
      setRenewDialog(false);
      fetchData();
    } catch (err) {
      toastError(err, 'Renewal could not be started. Please try again or contact the CSWDD office.');
    } finally {
      setRenewing(false);
    }
  };

  /* Download PDF form */
  const handleDownloadPdf = async () => {
    if (!application?.id) return;
    try {
      const res = await api.get(`/applications/${application.id}/form.pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a   = document.createElement('a');
      a.href = url; a.download = `application_${application.reference_no}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toastError(err, 'Could not download your PDF form. Please try again.');
    }
  };

  if (loading) return (
    <div className="flex-1 flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <p className="text-sm">Loading your application…</p>
      </div>
    </div>
  );

  /* ---- No application yet ---- */
  if (!application) return (
    <div className="flex-1 container px-4 py-16 max-w-xl mx-auto">
      <Card className="text-center p-10 shadow-sm">
        <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-6" />
        <h2 className="text-2xl font-bold mb-3">No Application Yet</h2>
        <p className="text-muted-foreground mb-8 leading-relaxed">
          Complete your <Link to="/portal/profile" className="text-primary underline-offset-2 hover:underline">profile</Link> and upload your <Link to="/portal/documents" className="text-primary underline-offset-2 hover:underline">required documents</Link>, then start your Solo Parent ID application here.
        </p>
        <Button size="lg" className="w-full" onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" /> Start Application
        </Button>
      </Card>
    </div>
  );

  const canRenew   = application.status === 'released' || application.status === 'expired';
  const canSubmit  = application.status === 'draft' || application.status === 'pending_additional_requirements';
  const canDownload = ['approved', 'ready_for_printing', 'ready_for_release', 'released', 'qualified', 'ready_for_pickup', 'completed'].includes(application.status);
  const isDraft    = application.status === 'draft';

  return (
    <div className="flex-1 container px-3 sm:px-6 py-5 sm:py-10 max-w-5xl mx-auto space-y-5 sm:space-y-7 w-full max-w-full overflow-x-hidden min-w-0">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">My Application</h1>
          {application.reference_no && (
            <p className="text-muted-foreground mt-1 text-xs sm:text-sm">
              Ref. No. <span className="font-mono font-semibold text-foreground">{application.reference_no}</span>
              {application.is_renewal && (
                <Badge variant="outline" className="ml-2 text-xs">Renewal</Badge>
              )}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <StatusBadge status={application.status} />
          {canDownload && (
            <Button size="sm" variant="outline" onClick={handleDownloadPdf} className="min-h-[40px] px-3">
              <Printer className="mr-2 h-4 w-4" /> Download PDF
            </Button>
          )}
          {canRenew && (
            <Button size="sm" onClick={() => setRenewDialog(true)} className="gap-2 min-h-[40px] px-3">
              <RotateCcw className="h-4 w-4" />
              Renew ID
            </Button>
          )}
        </div>
      </div>

      {/* Renewal info banner for expired */}
      {application.status === 'expired' && (
        <Card className="border-warning/30 bg-warning-soft">
          <CardContent className="flex items-start gap-3 py-4 px-5">
            <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-warning">Your Solo Parent ID has expired</p>
              <p className="text-sm text-warning mt-0.5">
                You can renew in a few taps — your profile and uploaded documents will be carried over automatically. Click <strong>Renew ID</strong> above to begin.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Renewal info banner for released */}
      {application.status === 'released' && application.valid_until && (
        <Card className="border-success/30 bg-success-soft">
          <CardContent className="flex items-start gap-3 py-4 px-5">
            <CheckCircle className="h-5 w-5 text-success shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-success">Solo Parent ID Active</p>
              <p className="text-sm text-success mt-0.5">
                Valid until <strong>{format(new Date(application.valid_until), 'MMMM d, yyyy')}</strong>.
                You can renew early — click <strong>Renew ID</strong> to start without losing your data.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stage tracker — only for active statuses */}
      {!['rejected', 'expired'].includes(application.status) && (
        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">Application Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <StageTracker status={application.status} />
          </CardContent>
        </Card>
      )}

      {/* Submission checklist */}
      {isDraft && check && (
        <Card className={check.ready ? 'border-success/30' : 'border-warning/30'}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              {check.ready
                ? <CheckCircle className="h-5 w-5 text-success" />
                : <AlertTriangle className="h-5 w-5 text-warning" />}
              Submission Checklist
            </CardTitle>
            <CardDescription>
              {check.ready
                ? 'All requirements are met — you can submit your application now.'
                : 'Complete these items before submitting.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ChecklistRow
              ok={!check.missing_profile_fields?.length}
              label="Profile information complete"
              hint={check.missing_profile_fields?.length ? `Missing: ${check.missing_profile_fields.slice(0, 3).join(', ')}` : null}
              link="/portal/profile"
            />
            <ChecklistRow
              ok={check.ready && !check.missing_documents?.length}
              label={`Required documents (${check.uploaded_required_documents ?? 0}/${check.total_required_documents ?? '?'} uploaded)`}
              hint={check.missing_documents?.length ? check.missing_documents.slice(0, 2).join('; ') + (check.missing_documents.length > 2 ? '…' : '') : null}
              link="/portal/documents"
            />

            <div className="pt-2">
              <Button
                onClick={handleSubmit}
                disabled={!check.ready || submitting}
                className="w-full sm:w-auto"
                data-testid="submit-application-button"
              >
                {submitting
                  ? <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Submitting…</>
                  : 'Submit Application'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Official ID card details */}
      {application.id_card_number && (
        <Card>
          <CardHeader><CardTitle className="text-base">Solo Parent ID Details</CardTitle></CardHeader>
          <CardContent className="grid sm:grid-cols-3 gap-4 text-sm">
            {[
              ['ID Card Number', application.id_card_number],
              ['Beneficiary Code', application.beneficiary_code],
              ['Category', (typeof application.category === 'object' ? application.category?.name : application.category) || '—'],
              ['Date Issued', application.released_at ? format(new Date(application.released_at), 'MMMM d, yyyy') : null],
              ['Valid Until', application.valid_until ? format(new Date(application.valid_until), 'MMMM d, yyyy') : null],
            ].filter(([, v]) => v).map(([label, value]) => (
              <div key={label}>
                <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">{label}</p>
                <p className="font-semibold">{value}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Status history timeline */}
      {history.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Status History</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-0">
              {history.map((h, i) => (
                <div key={i} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="h-2.5 w-2.5 rounded-full bg-primary mt-1.5 shrink-0" />
                    {i < history.length - 1 && <div className="flex-1 w-px bg-border mt-1" />}
                  </div>
                  <div className="pb-5 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <StatusBadge status={h.to_status} />
                      <span className="text-xs text-muted-foreground">
                        {h.created_at ? format(new Date(h.created_at), 'PPpp') : ''}
                      </span>
                    </div>
                    {h.note && <p className="text-sm text-muted-foreground">{h.note}</p>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Renew confirmation dialog */}
      <Dialog open={renewDialog} onOpenChange={setRenewDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-primary" /> Renew Your Solo Parent ID
            </DialogTitle>
            <DialogDescription className="space-y-2 pt-2">
              <p>Starting a renewal will:</p>
              <ul className="list-disc ml-5 space-y-1 text-sm">
                <li>Create a new application linked to your previous ID</li>
                <li>Carry over your <strong>profile information</strong> automatically</li>
                <li>Carry over your <strong>uploaded documents</strong> (reset to pending re-verification)</li>
                <li>Let you review and re-submit in just a few taps</li>
              </ul>
              <p className="text-sm text-muted-foreground pt-1">
                Your previous application record will be preserved for reference.
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenewDialog(false)}>Cancel</Button>
            <Button onClick={handleRenew} disabled={renewing}>
              {renewing
                ? <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Starting…</>
                : <><RotateCcw className="mr-2 h-4 w-4" /> Start Renewal</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ChecklistRow({ ok, label, hint, link }) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-3 text-sm">
        {ok
          ? <CheckCircle className="h-4 w-4 text-success shrink-0" />
          : <AlertTriangle className="h-4 w-4 text-warning shrink-0" />}
        <span className={ok ? 'text-foreground' : 'text-warning font-medium'}>{label}</span>
        {!ok && link && (
          <Link to={link} className="ml-auto text-xs text-primary hover:underline underline-offset-2">Fix →</Link>
        )}
      </div>
      {hint && !ok && (
        <p className="ml-7 text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}
