import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api, toastError, previewDocumentBlob } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  ArrowLeft, RefreshCw, FileText, Eye, CheckCircle, XCircle,
  Download, CreditCard, ChevronRight, AlertTriangle, AlertCircle, Printer, User, RotateCcw, Baby, Pencil, Clock
} from 'lucide-react';

/* ─── Simplified Status Logic ─────────────────────────────────── */

const STATUS_LABELS = {
  draft: 'Draft',
  submitted: 'Submitted',
  under_review: 'Under Review',
  under_initial_review: 'Under Review',
  documents_under_review: 'Documents Under Review',
  document_verification: 'Documents Under Review',
  for_document_correction: 'For Document Correction',
  pending_additional_requirements: 'For Document Correction',
  qualified: 'Qualified',
  applicant_verification: 'Applicant Verification',
  ready_for_pickup: 'Ready for Pickup',
  completed: 'Completed',
  reopened_for_review: 'Reopened for Review',
  under_final_assessment: 'Final Assessment',
  under_final_verification: 'Final Verification',
  approved: 'Approved',
  ready_for_printing: 'Ready for Printing',
  ready_for_release: 'Ready for Release',
  released: 'Released',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
  expired: 'Expired',
};

const STATUS_COLOR = {
  draft: 'bg-muted/50 text-foreground dark:bg-muted',
  submitted: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  under_review: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  under_initial_review: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  documents_under_review: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  document_verification: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  for_document_correction: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  pending_additional_requirements: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  qualified: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  applicant_verification: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300',
  ready_for_pickup: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300',
  completed: 'bg-emerald-200 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
  reopened_for_review: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
  under_final_assessment: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
  under_final_verification: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  approved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  ready_for_printing: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  ready_for_release: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  released: 'bg-emerald-200 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  cancelled: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
  expired: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
};

function StatusPill({ status }) {
  const color = STATUS_COLOR[status] || 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${color}`}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}

function safeFormatDate(val, pattern = 'PPpp') {
  if (!val) return '';
  try {
    const d = new Date(val);
    return isNaN(d.getTime()) ? String(val) : format(d, pattern);
  } catch {
    return String(val);
  }
}

function ProfileRow({ label, value }) {
  if (!value && value !== 0) return null;
  const display = typeof value === 'object' ? (value?.name || value?.title || JSON.stringify(value)) : String(value);
  return (
    <div className="space-y-0.5">
      <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">{label}</p>
      <p className="text-sm font-medium break-words">{display}</p>
    </div>
  );
}

export default function ApplicationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [application, setApplication] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [notes, setNotes] = useState('');
  const [updating, setUpdating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [officialFields, setOfficialFields] = useState({});
  const [savingOfficial, setSavingOfficial] = useState(false);
  const [downloadingCard, setDownloadingCard] = useState(false);

  // Granular document verification state
  const [docDialog, setDocDialog] = useState(null); // { doc }
  const [docStatus, setDocStatus] = useState('verified');
  const [docRemark, setDocRemark] = useState('');
  const [savingDoc, setSavingDoc] = useState(false);
  const [approvingAllDocs, setApprovingAllDocs] = useState(false);
  const [approveAllConfirmOpen, setApproveAllConfirmOpen] = useState(false);

  // Dedicated single-doc reject modal (Requirement 19)
  const [rejectDocModal, setRejectDocModal] = useState({ open: false, doc: null, reason: '' });
  const [rejectingDoc, setRejectingDoc] = useState(false);

  // Reopen Review Modal (Requirement 24)
  const [reopenModal, setReopenModal] = useState({ open: false, reason: '' });
  const [reopening, setReopening] = useState(false);

  // Disqualification state (Requirement 20 & 21)
  const [disqualifyDialogOpen, setDisqualifyDialogOpen] = useState(false);
  const [disqualifyReason, setDisqualifyReason] = useState('');
  const [disqualifying, setDisqualifying] = useState(false);

  const handleApproveAllDocs = async () => {
    if (approvingAllDocs) return;
    setApprovingAllDocs(true);
    setApproveAllConfirmOpen(false);
    try {
      const res = await api.post(`/admin/applications/${id}/documents/approve-all`);
      toast.success(res.data?.message || 'All documents approved.');
      await reloadQuietly();
    } catch (err) {
      // Reconcile server persisted state before declaring failure
      try {
        const freshRes = await api.get(`/admin/applications/${id}`, { cache: false });
        const freshDocs = freshRes.data?.documents || [];
        const isAllApproved = freshDocs.length > 0 && freshDocs.every(d => ['approved', 'verified'].includes(d.review_status || d.verification_status));
        if (isAllApproved) {
          toast.success('All documents approved.');
          applyData(freshRes.data);
          return;
        }
      } catch (_) {}
      toastError(err, 'Failed to approve all documents.');
    } finally {
      setApprovingAllDocs(false);
    }
  };

  const handleQuickApproveDoc = async (docId) => {
    try {
      const res = await api.post(`/admin/documents/${docId}/review`, {
        status: 'approved',
      });
      setDocuments(docs => docs.map(d => d.id === docId ? { ...d, ...res.data, review_status: 'approved', verification_status: 'approved' } : d));
      toast.success('Document approved.');
      await reloadQuietly();
    } catch (err) {
      toastError(err, 'Failed to approve document.');
    }
  };

  const handleApproveGroup = async (groupDocs = []) => {
    try {
      for (const d of groupDocs) {
        if (!['approved', 'verified'].includes(d.review_status || d.verification_status)) {
          await api.post(`/admin/documents/${d.id}/review`, { status: 'approved' });
        }
      }
      toast.success('All attachments under this requirement approved.');
      await reloadQuietly();
    } catch (err) {
      toastError(err, 'Failed to approve requirement attachments.');
    }
  };

  const openDocRejectModal = (doc) => {
    setRejectDocModal({ open: true, doc, reason: '' });
  };

  const handleConfirmRejectDoc = async () => {
    if (!rejectDocModal.doc || !rejectDocModal.reason.trim()) {
      toast.error('Rejection reason is mandatory.');
      return;
    }
    setRejectingDoc(true);
    try {
      const res = await api.post(`/admin/documents/${rejectDocModal.doc.id}/review`, {
        status: 'rejected',
        remarks: rejectDocModal.reason.trim(),
      });
      setDocuments(docs => docs.map(d => d.id === rejectDocModal.doc.id ? { ...d, ...res.data, review_status: 'rejected', verification_status: 'rejected' } : d));
      toast.success('Document rejected with explanation. Application moved to For Document Correction.');
      setRejectDocModal({ open: false, doc: null, reason: '' });
      await reloadQuietly();
    } catch (err) {
      toastError(err, 'Failed to reject document.');
    } finally {
      setRejectingDoc(false);
    }
  };

  const handleConfirmReopen = async () => {
    if (!reopenModal.reason.trim() || reopenModal.reason.trim().length < 3) {
      toast.error('Please specify the reason for reopening this review (at least 3 characters).');
      return;
    }
    setReopening(true);
    try {
      await api.patch(`/admin/applications/${id}/status`, {
        status: 'reopened_for_review',
        note: reopenModal.reason.trim(),
      });
      toast.success('Application reopened for review.');
      setReopenModal({ open: false, reason: '' });
      await reloadQuietly();
    } catch (err) {
      toastError(err, 'Failed to reopen review.');
    } finally {
      setReopening(false);
    }
  };

  const handleDisqualify = async () => {
    if (!disqualifyReason.trim() || disqualifyReason.trim().length < 3) {
      toast.error('Please enter an explanation for disqualifying the applicant (at least 3 characters).');
      return;
    }
    setDisqualifying(true);
    try {
      const res = await api.post(`/admin/applications/${id}/disqualify`, {
        reason: disqualifyReason.trim(),
      });
      toast.success(res.data?.message || 'Applicant marked as not qualified / rejected.');
      setDisqualifyDialogOpen(false);
      setDisqualifyReason('');
      await reloadQuietly();
    } catch (err) {
      toastError(err, 'Failed to disqualify applicant.');
    } finally {
      setDisqualifying(false);
    }
  };

  const applyData = (data) => {
    if (!data) return;
    const app = {
      ...(data.application || data),
      user: data.applicant || data.user || null,
      profile: data.profile || null,
      status_history: (data.history || data.status_history || []).map(h => ({
        ...h, status: h.to_status || h.status,
      })),
      form: data.application?.form || {},
      familyMembers: data.application?.family_members || [],
    };
    setApplication(app);
    setDocuments(data.documents || []);
    setOfficialFields({
      case_number: app.case_number || '',
      beneficiary_code: app.beneficiary_code || '',
      solo_parent_category: app.category?.name || app.solo_parent_category || app.profile?.solo_parent_category || '',
      date_issued: app.date_issued || '',
      assigned_personnel: app.assigned_personnel || '',
      id_card_number: app.id_card_number || '',
    });
  };

  const reloadQuietly = async () => {
    try {
      const res = await api.get(`/admin/applications/${id}`, { cache: false });
      applyData(res.data);
    } catch (_) {}
  };

  const loadAll = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/admin/applications/${id}`, { cache: false });
      applyData(res.data);
    } catch (err) {
      toastError(err, 'Failed to load this application. Please go back and try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, [id]);

  // Smart polling: auto-refresh every 8s with cache: false, paused when tab is hidden, offline, or terminal status
  useEffect(() => {
    let intervalId = null;
    let inFlight = false;
    const isTerminal = ['completed', 'released', 'rejected', 'cancelled'].includes(application?.status);
    const POLL_INTERVAL = isTerminal ? 15000 : 8000;

    const silentRefresh = async () => {
      if ((typeof navigator !== 'undefined' && !navigator.onLine) || document.hidden || inFlight || approvingAllDocs || updating) return;
      inFlight = true;
      try {
        const res = await api.get(`/admin/applications/${id}`, { cache: false });
        applyData(res.data);
      } catch {
        // Silent polling
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
    window.addEventListener('focus', onVis);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onVis);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [id, approvingAllDocs, updating, application?.status]);

  // Move to next status
  const handleTransition = async (toStatus) => {
    if (updating) return;
    if (toStatus === 'rejected') {
      setDisqualifyReason(notes || '');
      setDisqualifyDialogOpen(true);
      return;
    }
    setUpdating(true);
    try {
      const defaultNote = toStatus === 'approved' 
        ? 'Application and documentary requirements approved by CSWDD Admin.'
        : undefined;
      await api.patch(`/admin/applications/${id}/status`, { status: toStatus, note: notes || defaultNote });
      toast.success(`Status updated to: ${STATUS_LABELS[toStatus] || toStatus}`);
      setNotes('');
      await reloadQuietly();
    } catch (err) {
      // Reconcile server persisted state before declaring failure
      try {
        const freshRes = await api.get(`/admin/applications/${id}`, { cache: false });
        const freshApp = freshRes.data?.application || freshRes.data;
        if (freshApp?.status === toStatus) {
          toast.success(`Status updated to: ${STATUS_LABELS[toStatus] || toStatus}`);
          setNotes('');
          applyData(freshRes.data);
          return;
        }
      } catch (_) {}
      toastError(err, 'Failed to update status. Please try again.');
    } finally {
      setUpdating(false);
    }
  };

  // Save official fields
  const handleSaveOfficial = async () => {
    setSavingOfficial(true);
    try {
      await api.patch(`/admin/applications/${id}/official-fields`, officialFields);
      toast.success('Official fields saved!');
      await reloadQuietly();
    } catch (err) {
      toastError(err, 'Failed to save official fields.');
    } finally {
      setSavingOfficial(false);
    }
  };

  const handleVerifyDoc = async () => {
    if (!docDialog) return;
    // Require remarks for rejection/replacement
    if (['rejected', 'needs_replacement', 'replacement_required'].includes(docStatus) && !docRemark.trim()) {
      toast.error('Please provide a reason when rejecting a document.');
      return;
    }
    setSavingDoc(true);
    try {
      const res = await api.post(`/admin/documents/${docDialog.doc.id}/review`, {
        status: docStatus,
        remarks: docRemark || null,
      });
      setDocuments(d => d.map(doc => doc.id === docDialog.doc.id ? { ...doc, ...res.data } : doc));
      toast.success(`Document marked as: ${docStatus}.`);
      setDocDialog(null);
      setDocRemark('');
      await reloadQuietly();
    } catch (err) {
      toastError(err, 'Could not update document status. Please try again.');
    } finally {
      setSavingDoc(false);
    }
  };

  const openDocDialog = (doc) => {
    setDocDialog({ doc });
    setDocStatus(doc.verification_status || 'pending');
    setDocRemark(doc.verification_remark || '');
  };

  const handlePreviewDoc = async (docId) => {
    const newTab = window.open('about:blank', '_blank');
    try {
      await previewDocumentBlob(docId, { isAdmin: true, newTab });
    } catch (err) {
      toastError(err, 'Could not generate document preview. Please try again.');
    }
  };

  const handleDownloadForm = async () => {
    try {
      const res = await api.get(`/applications/${id}/form.pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url; a.download = `application_${id}_form.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toastError(err, 'Could not download the application form. Please try again.');
    }
  };

  const handleDownloadIdCard = async () => {
    setDownloadingCard(true);
    try {
      const res = await api.get(`/admin/applications/${id}/id-card.pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url; a.download = `id_card_${application.id_card_number || id}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toastError(err, 'Could not generate ID card PDF. Please try again.');
    } finally {
      setDownloadingCard(false);
    }
  };

  if (loading) return (
    <div className="flex-1 flex items-center justify-center min-h-[60vh]">
      <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );

  if (!application) return (
    <div className="flex-1 px-6 py-6">
      <p className="text-center text-muted-foreground">Application not found.</p>
    </div>
  );

  const p = application.profile || {};
  const f = application.form || {};
  const fm = application.familyMembers || [];
  const currentStatus = application?.status || 'draft';
  const canGenerateId = ['approved', 'ready_for_pickup', 'ready_for_printing', 'ready_for_release', 'released', 'completed'].includes(currentStatus);
  const name = [p?.first_name, p?.middle_name, p?.last_name, p?.suffix].filter(Boolean).join(' ') ||
    application.user?.full_name || 'Applicant';
  const barangayName = typeof p?.barangay === 'object' ? p?.barangay?.name : p?.barangay;
  const address = [p?.house_no, p?.street, barangayName, p?.city_municipality, p?.province].filter(Boolean).join(', ');

  return (
    <div className="flex-1 px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6 w-full max-w-full overflow-x-hidden min-w-0">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin')} className="h-9 px-2.5 text-xs font-semibold touch-manipulation">
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold truncate">{name}</h1>
          <p className="text-sm text-muted-foreground">
            {application.user?.email}
            {application.case_number ? ` · Case ${application.case_number}` : ''}
            {application.reference_no ? ` · Ref ${application.reference_no}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <StatusPill status={currentStatus} />
          <Button variant="outline" size="sm" onClick={handleDownloadForm}>
            <Printer className="mr-2 h-4 w-4" /> Application Form
          </Button>
          {canGenerateId && (
            <Button size="sm" onClick={handleDownloadIdCard} disabled={downloadingCard}
              className="bg-success text-success-foreground hover:bg-success/90 text-white border-0">
              {downloadingCard ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
              Generate ID Card
            </Button>
          )}
        </div>
      </div>

      {/* Renewal Banner */}
      {(application.is_renewal || application.application_type === 'renewal') && (
        <Card className="border-info/30/50 bg-info-soft/60 dark:bg-info-soft">
          <CardContent className="flex items-center gap-3 py-3">
            <RotateCcw className="h-5 w-5 text-info shrink-0" />
            <div>
              <p className="font-semibold text-info text-sm">Renewal Application</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                This is a renewal for a previously issued Solo Parent ID.
                {application.previous_id_card_number && <> Previous ID: <span className="font-mono font-semibold">{application.previous_id_card_number}</span></>}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loss of SPIC Banner */}
      {application.application_type === 'loss_spic' && (
        <Card className="border-rose-500/30 bg-rose-500/5 dark:bg-rose-500/10">
          <CardContent className="flex items-center gap-3 py-3">
            <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
            <div>
              <p className="font-semibold text-rose-600 text-sm">Loss of SPIC Application</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                This is a replacement application for a lost Solo Parent ID.
                {application.previous_id_card_number && <> Previous ID: <span className="font-mono font-semibold">{application.previous_id_card_number}</span></>}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rejected / Expired banner */}
      {(currentStatus === 'rejected' || currentStatus === 'expired') && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="flex items-start gap-3 py-4">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-destructive text-sm">
                Application {currentStatus === 'rejected' ? 'Not Qualified / Rejected' : 'Expired'}
              </p>
              <p className="text-xs text-muted-foreground">
                {currentStatus === 'rejected' ? 'This application has been disqualified/rejected.' : 'This ID has expired.'}
              </p>
              {currentStatus === 'rejected' && application.status_reason && (
                <div className="mt-2 p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-xs">
                  <span className="font-semibold block mb-0.5">Reason provided to applicant:</span>
                  <p className="whitespace-pre-wrap">{application.status_reason}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Main Unified Review & Decision Bar ────────────────────── */}
      <Card className="border-2 border-primary/20 bg-card shadow-sm overflow-hidden">
        <CardContent className="py-4 px-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              {currentStatus === 'submitted' && (
                <Badge variant="outline" className="bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30 font-bold px-2.5 py-0.5">
                  ● Status: Submitted
                </Badge>
              )}
              {['under_review', 'under_initial_review', 'documents_under_review', 'document_verification', 'pending_additional_requirements', 'for_document_correction', 'reopened_for_review'].includes(currentStatus) && (
                <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 font-bold px-2.5 py-0.5">
                  ● Review in Progress
                </Badge>
              )}
              {['under_final_assessment', 'under_final_verification'].includes(currentStatus) && (
                <Badge className="bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30 font-bold px-2.5 py-0.5">
                  ● Final Form Assessment
                </Badge>
              )}
              {['qualified', 'applicant_verification'].includes(currentStatus) && (
                <Badge className="bg-emerald-600 text-white font-bold px-2.5 py-0.5">
                  ✓ Qualified by CSWDD
                </Badge>
              )}
              {currentStatus === 'ready_for_pickup' && (
                <Badge className="bg-teal-600 text-white font-bold px-2.5 py-0.5">
                  📦 Ready for Pickup
                </Badge>
              )}
              {['approved', 'ready_for_printing', 'ready_for_release', 'released', 'completed'].includes(currentStatus) && (
                <Badge className="bg-emerald-700 text-white font-bold px-2.5 py-0.5">
                  ✓ Completed / Active Solo Parent
                </Badge>
              )}

              {application.solo_parent_since && (
                <Badge variant="secondary" className="text-xs font-normal">
                  Solo Parent Since: <strong className="ml-1 text-foreground">{application.solo_parent_since}</strong>
                </Badge>
              )}

              {application.application_type && (
                <Badge variant="outline" className="text-xs capitalize font-semibold">
                  Service: {application.application_type === 'renewal' ? 'Renewal' : application.application_type === 'loss_spic' ? 'Loss of SPIC' : 'New Solo Parent ID'}
                </Badge>
              )}
            </div>

            <p className="text-sm font-semibold text-foreground">
              {currentStatus === 'submitted'
                ? 'Applicant has submitted requirements. Click "START REVIEW" to begin official CSWDD verification.'
                : ['under_initial_review', 'documents_under_review', 'document_verification', 'pending_additional_requirements', 'for_document_correction', 'reopened_for_review'].includes(currentStatus)
                ? 'Review documentary requirements below. Approve or reject individual documents or decide qualification.'
                : ['under_final_assessment', 'under_final_verification'].includes(currentStatus)
                ? 'Review completed Solo Parent Application Form for final assessment.'
                : ['qualified', 'applicant_verification'].includes(currentStatus)
                ? 'Applicant is qualified. Once verified, advance to Ready for Pickup or reopen if changes are required.'
                : currentStatus === 'ready_for_pickup'
                ? 'SPIC card is processed and ready for release at CSWDD office.'
                : 'Application transaction lifecycle completed.'}
            </p>
          </div>

          {/* Action Sequence Buttons */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap w-full md:w-auto">
            {/* When submitted: allow direct Approve, Reject, or Start Review */}
            {currentStatus === 'submitted' && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="bg-primary/5 hover:bg-primary/15 text-primary border-primary/30 gap-1.5 shadow-xs font-bold text-xs min-h-[40px] h-10 px-3.5 cursor-pointer flex-1 sm:flex-initial justify-center"
                  onClick={() => handleTransition('under_review')}
                  disabled={updating}
                  id="admin-start-review-btn"
                >
                  {updating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                  Start Review
                </Button>

                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-xs font-bold text-xs min-h-[40px] h-10 px-3.5 cursor-pointer flex-1 sm:flex-initial justify-center"
                  onClick={() => handleTransition('approved')}
                  disabled={updating}
                  id="admin-approve-btn"
                >
                  {updating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                  Approve Application
                </Button>

                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    setDisqualifyReason('');
                    setDisqualifyDialogOpen(true);
                  }}
                  className="gap-1.5 shadow-xs font-bold text-xs min-h-[40px] h-10 px-3.5 cursor-pointer flex-1 sm:flex-initial justify-center"
                  disabled={updating}
                  id="admin-reject-btn"
                >
                  <XCircle className="h-4 w-4" />
                  Reject Application
                </Button>
              </>
            )}

            {/* Decision Actions for In-Review / Assessment */}
            {['under_review', 'under_initial_review', 'documents_under_review', 'document_verification', 'pending_additional_requirements', 'for_document_correction', 'reopened_for_review', 'under_final_assessment', 'under_final_verification'].includes(currentStatus) && (
              <>
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-xs font-bold text-xs min-h-[40px] h-10 px-3.5 cursor-pointer flex-1 sm:flex-initial justify-center"
                  onClick={() => handleTransition('approved')}
                  disabled={updating}
                  id="admin-approve-btn"
                >
                  {updating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                  Approve Application
                </Button>

                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    setDisqualifyReason('');
                    setDisqualifyDialogOpen(true);
                  }}
                  className="gap-1.5 shadow-xs font-bold text-xs min-h-[40px] h-10 px-3.5 cursor-pointer flex-1 sm:flex-initial justify-center"
                  disabled={updating}
                  id="admin-reject-btn"
                >
                  <XCircle className="h-4 w-4" />
                  Reject Application
                </Button>
              </>
            )}

            {/* Lifecycle progression for Qualified */}
            {['qualified', 'applicant_verification'].includes(currentStatus) && (
              <>
                <Button
                  size="sm"
                  className="bg-teal-600 hover:bg-teal-700 text-white gap-1.5 shadow-xs font-bold text-xs min-h-[40px] h-10 px-3.5 flex-1 sm:flex-initial justify-center"
                  onClick={() => handleTransition('ready_for_pickup')}
                  disabled={updating}
                >
                  {updating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                  Mark Ready for Pickup
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setReopenModal({ open: true, reason: '' })}
                  className="gap-1.5 font-semibold text-xs min-h-[40px] h-10 px-3.5 border-border flex-1 sm:flex-initial justify-center"
                >
                  <RotateCcw className="h-3.5 w-3.5 text-primary" />
                  Reopen Application
                </Button>

                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    setDisqualifyReason('');
                    setDisqualifyDialogOpen(true);
                  }}
                  className="gap-1.5 font-bold text-xs min-h-[40px] h-10 px-3.5 flex-1 sm:flex-initial justify-center"
                  disabled={updating}
                >
                  <XCircle className="h-4 w-4" />
                  Reject & Disqualify
                </Button>
              </>
            )}

            {/* Lifecycle progression for Ready for Pickup */}
            {currentStatus === 'ready_for_pickup' && (
              <>
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-xs font-bold text-xs min-h-[40px] h-10 px-3.5 flex-1 sm:flex-initial justify-center"
                  onClick={() => handleTransition('completed')}
                  disabled={updating}
                >
                  {updating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                  Mark Completed
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setReopenModal({ open: true, reason: '' })}
                  className="gap-1.5 font-semibold text-xs min-h-[40px] h-10 px-3.5 border-border flex-1 sm:flex-initial justify-center"
                >
                  <RotateCcw className="h-3.5 w-3.5 text-primary" />
                  Reopen Application
                </Button>
              </>
            )}

            {/* Completed / Released / Expired Actions */}
            {/* Approved: Mark Ready for Pickup + Reopen */}
            {currentStatus === 'approved' && (
              <>
                <Button
                  size="sm"
                  className="bg-teal-600 hover:bg-teal-700 text-white gap-1.5 shadow-xs font-bold text-xs min-h-[40px] h-auto py-2 px-3.5 cursor-pointer flex-1 sm:flex-initial w-full sm:w-auto text-center justify-center whitespace-normal"
                  onClick={() => handleTransition('ready_for_pickup')}
                  disabled={updating}
                  id="admin-notify-pickup-btn"
                >
                  {updating ? <RefreshCw className="h-4 w-4 animate-spin shrink-0" /> : <CheckCircle className="h-4 w-4 shrink-0" />}
                  <span>Notify Applicant — ID Ready for Pickup</span>
                </Button>

                {canGenerateId && (
                  <Button size="sm" onClick={handleDownloadIdCard} disabled={downloadingCard}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs min-h-[40px] h-auto py-2 px-3.5 cursor-pointer flex-1 sm:flex-initial w-full sm:w-auto text-center justify-center whitespace-normal">
                    {downloadingCard ? <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin shrink-0" /> : <CreditCard className="mr-1.5 h-3.5 w-3.5 shrink-0" />}
                    <span>Download / Print ID Card</span>
                  </Button>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setReopenModal({ open: true, reason: '' })}
                  className="gap-1.5 font-semibold text-xs min-h-[40px] h-auto py-2 px-3.5 border-border flex-1 sm:flex-initial w-full sm:w-auto text-center justify-center whitespace-normal"
                >
                  <RotateCcw className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span>Reopen Application for Review</span>
                </Button>
              </>
            )}

            {/* Completed / Released / Expired Actions */}
            {['completed', 'released', 'ready_for_printing', 'ready_for_release'].includes(currentStatus) && (
              <>
                {canGenerateId && (
                  <Button size="sm" onClick={handleDownloadIdCard} disabled={downloadingCard}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs min-h-[40px] h-auto py-2 px-3.5 flex-1 sm:flex-initial w-full sm:w-auto text-center justify-center whitespace-normal">
                    {downloadingCard ? <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin shrink-0" /> : <CreditCard className="mr-1.5 h-3.5 w-3.5 shrink-0" />}
                    <span>Download / Print ID Card</span>
                  </Button>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setReopenModal({ open: true, reason: '' })}
                  className="gap-1.5 font-semibold text-xs min-h-[40px] h-auto py-2 px-3.5 border-border flex-1 sm:flex-initial w-full sm:w-auto text-center justify-center whitespace-normal"
                >
                  <RotateCcw className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span>Reopen Application for Review</span>
                </Button>
              </>
            )}

            {/* Rejected action: Reopen */}
            {currentStatus === 'rejected' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setReopenModal({ open: true, reason: '' })}
                className="gap-1.5 font-semibold text-xs min-h-[40px] h-auto py-2 px-3.5 border-border flex-1 sm:flex-initial w-full sm:w-auto text-center justify-center whitespace-normal"
              >
                <RotateCcw className="h-3.5 w-3.5 text-primary shrink-0" />
                <span>Reopen Application for Review</span>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left column: Workflow Actions + Official Fields */}
        <div className="space-y-5">
          {/* Official Fields */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Official Fields</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { key: 'case_number', label: 'Case Number' },
                { key: 'beneficiary_code', label: 'Beneficiary Code' },
                { key: 'id_card_number', label: 'ID Card Number' },
                { key: 'solo_parent_category', label: 'Assigned Category' },
                { key: 'date_issued', label: 'Date Issued', type: 'date' },
                { key: 'assigned_personnel', label: 'Assigned Personnel' },
              ].map(({ key, label, type }) => (
                <div key={key} className="space-y-1">
                  <Label className="text-xs">{label}</Label>
                  <Input
                    type={type || 'text'}
                    value={officialFields[key] || ''}
                    onChange={e => setOfficialFields(f => ({ ...f, [key]: e.target.value }))}
                    className="h-8 text-sm"
                    placeholder={label}
                  />
                </div>
              ))}
              <Button size="sm" className="w-full mt-1" onClick={handleSaveOfficial} disabled={savingOfficial}>
                {savingOfficial ? <><RefreshCw className="h-3.5 w-3.5 mr-2 animate-spin" />Saving…</> : 'Save Official Fields'}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right column: Profile + Documents */}
        <div className="lg:col-span-2 space-y-5">
          {/* Profile */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <User className="h-4 w-4" /> Applicant Profile
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                <ProfileRow label="Full Name" value={name} />
                <ProfileRow label="Date of Birth" value={p?.birth_date} />
                <ProfileRow label="Place of Birth" value={f?.place_of_birth} />
                <ProfileRow label="Sex" value={p?.sex} />
                <ProfileRow label="Civil Status" value={f?.civil_status} />
                <ProfileRow label="Nationality" value={f?.nationality} />
                <ProfileRow label="Religion" value={f?.religion} />
                <ProfileRow label="PhilSys #" value={f?.philsys_card_number} />
                <ProfileRow label="Contact No." value={p?.contact_number} />
                <ProfileRow label="Telephone" value={p?.telephone} />
                <ProfileRow label="Educational Attainment" value={f?.educational_attainment} />
                <ProfileRow label="Employment Status" value={f?.employment_status} />
                <ProfileRow label="Occupation" value={f?.occupation} />
                <ProfileRow label="Company / Agency" value={f?.company_agency} />
                <ProfileRow label="Monthly Income" value={f?.monthly_income} />
                <ProfileRow label="Solo Parent Category" value={application?.category?.name || p?.solo_parent_category} />
                <ProfileRow label="Solo Parent Since" value={application?.solo_parent_since || f?.solo_parent_since} />
                <div className="col-span-2 sm:col-span-3">
                  <ProfileRow label="Address" value={address} />
                </div>
                <div className="col-span-2 sm:col-span-3 mt-2">
                  <ProfileRow label="Classification Details" value={f?.classification_details} />
                </div>
              </div>

              {/* Special classifications */}
              {(f?.is_4ps_beneficiary || f?.is_indigenous || f?.is_lgbtqia || f?.is_pwd) && (
                <>
                  <Separator className="my-4" />
                  <div className="flex flex-wrap gap-2">
                    {f?.is_4ps_beneficiary && <Badge variant="outline">4Ps Beneficiary {f?.household_id_4ps ? `(${f.household_id_4ps})` : ''}</Badge>}
                    {f?.is_indigenous && <Badge variant="outline">Indigenous Person ({f?.indigenous_affiliation})</Badge>}
                    {f?.is_lgbtqia && <Badge variant="outline">LGBTQ+</Badge>}
                    {f?.is_pwd && <Badge variant="outline">PWD</Badge>}
                  </div>
                </>
              )}

              {/* Signature preview */}
              {p?.signature_data && (
                <>
                  <Separator className="my-4" />
                  <div>
                    <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-2">Signature</p>
                    <img
                      src={p.signature_data}
                      alt="Signature"
                      className="max-h-16 border rounded p-1.5 bg-white"
                    />
                  </div>
                </>
              )}

              {/* Emergency Contact */}
              {(f?.emergency_contact_name) && (
                <>
                  <Separator className="my-4" />
                  <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-3">Emergency Contact</p>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <ProfileRow label="Name" value={f.emergency_contact_name} />
                    <ProfileRow label="Relationship" value={f.emergency_contact_relationship} />
                    <ProfileRow label="Contact No." value={f.emergency_contact_number} />
                    <ProfileRow label="Address" value={f.emergency_contact_address} />
                  </div>
                </>
              )}

              {/* Household Members */}
              <>
                <Separator className="my-4" />
                <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-3">Household Members ({Array.isArray(fm) ? fm.length : 0})</p>
                {(!Array.isArray(fm) || fm.length === 0) ? (
                  <p className="text-sm text-muted-foreground italic">No household members listed.</p>
                ) : (
                  <div className="space-y-2">
                    {fm.map((m, i) => (
                      <div key={i} className="flex items-center gap-3 text-xs p-2.5 rounded-lg bg-muted/30 border">
                        <span className="font-bold text-primary w-5 shrink-0">{i + 1}.</span>
                        <span className="font-medium">{m.name}</span>
                        {m.relationship && <span className="text-muted-foreground">· {m.relationship}</span>}
                        {m.age && <span className="text-muted-foreground">· Age {m.age}</span>}
                        {m.civil_status && <Badge variant="outline" className="text-xs py-0 h-4">{m.civil_status}</Badge>}
                      </div>
                    ))}
                  </div>
                )}
              </>

              {/* Needs/Problems */}
              {f?.needs_problems && (
                <>
                  <Separator className="my-4" />
                  <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-2">Needs / Problems</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.needs_problems}</p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Documents */}
          <Card className="border shadow-xs overflow-hidden">
            <CardHeader className="pb-3 flex flex-row items-center justify-between gap-3 flex-wrap bg-muted/20 border-b border-border/50">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-semibold text-foreground uppercase tracking-wide flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" /> Submitted Requirements & Attachments ({documents.filter(d => d.verification_status !== 'replaced').length})
                </CardTitle>
                {documents.length > 0 && documents.filter(d => d.verification_status !== 'replaced').every(d => ['approved', 'verified'].includes(d.review_status || d.verification_status)) && (
                  <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-300 text-xs font-semibold gap-1 shadow-2xs">
                    <CheckCircle className="h-3.5 w-3.5" /> All Approved
                  </Badge>
                )}
              </div>
              {documents.length > 0 && (
                <Button
                  size="sm"
                  variant={documents.every(d => ['approved', 'verified'].includes(d.review_status || d.verification_status)) ? "outline" : "default"}
                  className={`text-xs gap-1.5 h-8 font-semibold shadow-2xs ${documents.every(d => ['approved', 'verified'].includes(d.review_status || d.verification_status))
                      ? 'text-emerald-700 dark:text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/10'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    }`}
                  onClick={() => setApproveAllConfirmOpen(true)}
                  disabled={approvingAllDocs}
                >
                  <CheckCircle className="h-3.5 w-3.5" />
                  {approvingAllDocs
                    ? 'Approving All...'
                    : documents.every(d => ['approved', 'verified'].includes(d.review_status || d.verification_status))
                      ? 'Re-Approve All Documents'
                      : 'Approve All Documents'}
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-4 sm:p-5 space-y-4">
              {(() => {
                const activeDocs = documents.filter(d => d.verification_status !== 'replaced');
                if (activeDocs.length === 0) {
                  return <p className="text-sm text-muted-foreground text-center py-6">No documents submitted yet.</p>;
                }

                // Group active documents by requirement
                const groupMap = new Map();
                activeDocs.forEach(doc => {
                  const groupKey = doc.requirement_id || doc.doc_type || doc.label || 'other';
                  const reqTitle = doc.requirement_name || doc.requirement?.name || doc.label || 'Documentary Requirement';
                  if (!groupMap.has(groupKey)) {
                    groupMap.set(groupKey, {
                      key: groupKey,
                      name: reqTitle,
                      is_required: doc.is_required !== false,
                      documents: [],
                    });
                  }
                  groupMap.get(groupKey).documents.push(doc);
                });

                const reqGroups = Array.from(groupMap.values());

                return reqGroups.map(group => {
                  const isGroupAllApproved = group.documents.every(d => ['approved', 'verified'].includes(d.review_status || d.verification_status));
                  const hasGroupRejected = group.documents.some(d => ['rejected'].includes(d.review_status || d.verification_status));
                  const hasGroupNeedsReplacement = group.documents.some(d => ['needs_replacement', 'replacement_required'].includes(d.review_status || d.verification_status));

                  return (
                    <div key={group.key} className="rounded-2xl border border-border/80 p-4 transition-all bg-card/60 hover:bg-card space-y-3 shadow-xs">
                      {/* Requirement Header */}
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-primary shrink-0" />
                          <h4 className="text-sm font-bold text-foreground">
                            {group.name}
                          </h4>
                          {group.is_required && (
                            <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider bg-primary/10 text-primary border-primary/20">
                              Required
                            </Badge>
                          )}
                          <Badge variant="secondary" className="text-xs font-semibold px-2 py-0.5">
                            {group.documents.length} {group.documents.length === 1 ? 'Attachment' : 'Attachments'}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          {isGroupAllApproved ? (
                            <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 text-xs font-semibold gap-1 shadow-2xs">
                              <CheckCircle className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                              All Approved
                            </Badge>
                          ) : hasGroupRejected ? (
                            <Badge className="bg-destructive/15 text-destructive border-destructive/30 text-xs font-semibold gap-1">
                              <XCircle className="h-3.5 w-3.5" />
                              Rejected
                            </Badge>
                          ) : hasGroupNeedsReplacement ? (
                            <Badge className="bg-purple-100 text-purple-800 border-purple-300 text-xs font-semibold gap-1">
                              <RefreshCw className="h-3.5 w-3.5" />
                              Needs Replacement
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-sky-50 text-sky-800 border-sky-300 dark:bg-sky-950/30 dark:text-sky-300 text-xs font-semibold gap-1">
                              <Clock className="h-3.5 w-3.5" />
                              Pending Review
                            </Badge>
                          )}

                          {!isGroupAllApproved && group.documents.length > 1 && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleApproveGroup(group.documents)}
                              className="h-7 px-2.5 text-xs font-semibold border-emerald-500/40 text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                              title="Approve all attachments under this requirement"
                            >
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Approve Requirement ({group.documents.length})
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* List of attachments for this requirement */}
                      <div className="space-y-2 pt-1 pl-0 sm:pl-2">
                        {group.documents.map(doc => {
                          const vstatus = doc.review_status || doc.verification_status || doc.status || 'pending';
                          const isApproved = ['approved', 'verified'].includes(vstatus);
                          const isRejected = ['rejected'].includes(vstatus);
                          const isNeedsReplacement = ['needs_replacement', 'replacement_required'].includes(vstatus);

                          return (
                            <div key={doc.id} className="p-3.5 rounded-xl bg-muted/40 border border-border/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="h-9 w-9 rounded-lg bg-background border border-border/80 flex items-center justify-center shrink-0 shadow-2xs">
                                  <FileText className="h-4 w-4 text-primary" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-mono font-semibold text-foreground truncate max-w-xs sm:max-w-md break-all">
                                    {doc.original_filename || doc.label || 'Uploaded Document'}
                                  </p>
                                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5 flex-wrap">
                                    <span>{doc.file_size ? `${(doc.file_size / 1024).toFixed(1)} KB` : 'Uploaded Document'}</span>
                                    {isApproved && (
                                      <>
                                        <span>•</span>
                                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">Verified & Approved</span>
                                      </>
                                    )}
                                    {isRejected && (
                                      <>
                                        <span>•</span>
                                        <span className="text-destructive font-medium">Rejected</span>
                                      </>
                                    )}
                                    {isNeedsReplacement && (
                                        <>
                                          <span>•</span>
                                          <span className="text-purple-600 font-medium">Needs Replacement</span>
                                        </>
                                    )}
                                  </div>
                                  {(doc.verification_remark || doc.review_note) && (
                                    <p className="text-xs text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 px-2 py-1 rounded-md border border-amber-200 dark:border-amber-800/40 mt-1.5 italic">
                                      💬 Note: {doc.verification_remark || doc.review_note}
                                    </p>
                                  )}
                                </div>
                              </div>

                              {/* Actions: View, Approve, Reject */}
                              <div className="flex items-center gap-1.5 w-full sm:w-auto shrink-0 flex-wrap sm:flex-nowrap pt-2 sm:pt-0 border-t sm:border-t-0 border-border/40">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handlePreviewDoc(doc.id)}
                                  className="flex-1 sm:flex-none justify-center h-9 sm:h-8 gap-1 text-xs text-muted-foreground hover:text-foreground touch-manipulation"
                                >
                                  <Eye className="h-3.5 w-3.5" /> View
                                </Button>
                                <Button
                                  size="sm"
                                  variant={isApproved ? "outline" : "default"}
                                  onClick={() => handleQuickApproveDoc(doc.id)}
                                  disabled={isApproved}
                                  className={`flex-1 sm:flex-none justify-center h-9 sm:h-8 gap-1 text-xs font-semibold touch-manipulation ${
                                    isApproved
                                      ? 'border-emerald-500/40 text-emerald-700 dark:text-emerald-400 bg-emerald-50/50'
                                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                  }`}
                                >
                                  <CheckCircle className="h-3.5 w-3.5" /> Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openDocRejectModal(doc)}
                                  className="flex-1 sm:flex-none justify-center h-9 sm:h-8 gap-1 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-300 dark:border-rose-800 touch-manipulation"
                                >
                                  <XCircle className="h-3.5 w-3.5" /> Reject
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                });
              })()}
            </CardContent>
          </Card>

          {/* Status History */}
          {application.status_history?.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Status History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {application.status_history.map((h, i) => (
                    <div key={i} className="flex gap-3 text-sm">
                      <div className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />
                      <div>
                        <span className="font-medium">{STATUS_LABELS[h.status] || h.to_status || h.status}</span>
                        <span className="text-muted-foreground ml-2 text-xs">
                          {safeFormatDate(h.changed_at || h.created_at, 'PPpp')}
                        </span>
                        {(h.notes || h.note) && (
                          <p className="text-muted-foreground text-xs mt-0.5">{h.notes || h.note}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Document Verification Dialog */}
      {docDialog && (
        <Dialog open={!!docDialog} onOpenChange={(open) => { if (!open) setDocDialog(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Review Document</DialogTitle>
              <DialogDescription className="truncate">{docDialog.doc?.label || docDialog.doc?.original_filename || 'Requirement Verification'}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Verification Status</Label>
                <Select value={docStatus} onValueChange={setDocStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="approved">✅ Approved</SelectItem>
                    <SelectItem value="under_review">🔍 Under Review</SelectItem>
                    <SelectItem value="rejected">❌ Rejected</SelectItem>
                    <SelectItem value="needs_replacement">🔄 Needs Replacement</SelectItem>
                    <SelectItem value="pending">⏳ Pending Review</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Remark for Applicant {['rejected', 'needs_replacement', 'replacement_required'].includes(docStatus) ? '(required)' : '(optional)'}</Label>
                <Textarea
                  rows={3}
                  placeholder="e.g. The birth certificate is too blurry to read. Please re-upload a clearer copy."
                  value={docRemark}
                  onChange={e => setDocRemark(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDocDialog(null)}>Cancel</Button>
              <Button onClick={handleVerifyDoc} disabled={savingDoc}>
                {savingDoc ? <><RefreshCw className="mr-2 h-4 w-4 animate-spin" />Saving…</> : 'Save Decision'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Disqualification Dialog */}
      <Dialog open={disqualifyDialogOpen} onOpenChange={setDisqualifyDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" /> Disqualify Applicant
            </DialogTitle>
            <DialogDescription>
              Provide the specific reason why this applicant does not qualify. This message will be sent to the applicant and displayed directly in their portal.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Reason for Disqualification <span className="text-destructive">*</span></Label>
              <Textarea
                rows={4}
                placeholder="e.g. The submitted documents indicate that the children are over 18 years old and not enrolled in school, which does not meet Republic Act 11861 qualification criteria."
                value={disqualifyReason}
                onChange={e => setDisqualifyReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisqualifyDialogOpen(false)} disabled={disqualifying}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDisqualify} disabled={disqualifying}>
              {disqualifying ? (
                <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Submitting…</>
              ) : (
                'Reject & Disqualify'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Bulk Approve All Documents Confirmation Dialog (Requirement 18) ── */}
      <Dialog open={approveAllConfirmOpen} onOpenChange={setApproveAllConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground font-bold">
              <CheckCircle className="h-5 w-5 text-emerald-600" />
              Approve All Documents
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to approve all submitted documents for this applicant?
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 text-xs text-muted-foreground">
            All pending requirements will be marked as verified and approved simultaneously.
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveAllConfirmOpen(false)} disabled={approvingAllDocs}>
              Cancel
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              onClick={handleApproveAllDocs}
              disabled={approvingAllDocs}
            >
              {approvingAllDocs ? <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Approving All…</> : 'Yes, Approve All'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Single Document Rejection Dialog (Requirement 19 & 22) ── */}
      <Dialog open={rejectDocModal.open} onOpenChange={(open) => { if (!open) setRejectDocModal({ open: false, doc: null, reason: '' }); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2 font-bold">
              <XCircle className="h-5 w-5" />
              Reject Document
            </DialogTitle>
            <DialogDescription>
              Rejecting this document will notify the applicant and move their application to <strong className="text-foreground">For Document Correction</strong> so they can upload a replacement.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="p-3 rounded-xl bg-muted/40 border border-border/70">
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block mb-0.5">Target Document</span>
              <p className="font-bold text-sm text-foreground">
                {rejectDocModal.doc?.requirement_name || rejectDocModal.doc?.requirement?.name || rejectDocModal.doc?.label || 'Document Requirement'}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                Reason for Rejection <span className="text-destructive">*</span>
              </Label>
              <Textarea
                rows={3}
                placeholder="e.g. Income Tax Return is outdated. Please upload your latest ITR (BIR Form 2316 or stamped 1701)."
                value={rejectDocModal.reason}
                onChange={e => setRejectDocModal(prev => ({ ...prev, reason: e.target.value }))}
                className="rounded-xl text-xs sm:text-sm"
              />
              <p className="text-[11px] text-muted-foreground">
                This explanation will be displayed directly to the applicant so they know what to correct.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectDocModal({ open: false, doc: null, reason: '' })}
              disabled={rejectingDoc}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmRejectDoc}
              disabled={rejectingDoc || !rejectDocModal.reason.trim()}
              className="font-bold"
            >
              {rejectingDoc ? <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Rejecting…</> : 'Reject Document'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Reopen Application for Review Dialog (Requirement 24) ── */}
      <Dialog open={reopenModal.open} onOpenChange={(open) => { if (!open) setReopenModal({ open: false, reason: '' }); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-bold text-foreground">
              <RotateCcw className="h-5 w-5 text-primary" />
              Reopen Application for Review
            </DialogTitle>
            <DialogDescription>
              Reopening allows CSWDD staff to re-evaluate documents or previous decisions. Previous actions and timestamps are preserved in the audit log.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                Reason for Reopening <span className="text-destructive">*</span>
              </Label>
              <Textarea
                rows={3}
                placeholder="e.g. Incorrect document was previously approved. Needs re-verification of income bracket."
                value={reopenModal.reason}
                onChange={e => setReopenModal(prev => ({ ...prev, reason: e.target.value }))}
                className="rounded-xl text-xs sm:text-sm"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReopenModal({ open: false, reason: '' })}
              disabled={reopening}
            >
              Cancel
            </Button>
            <Button
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
              onClick={handleConfirmReopen}
              disabled={reopening || !reopenModal.reason.trim()}
            >
              {reopening ? <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Reopening…</> : 'Reopen for Review'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
