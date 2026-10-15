import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api, toastError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  RotateCcw, ArrowRight, ArrowLeft, Upload, CheckCircle2,
  AlertCircle, FileText, RefreshCw, Eye, Trash2,
  Send, Calendar, IdCard, Info, XCircle, AlertTriangle
} from 'lucide-react';
import RequirementUploadField from '@/components/RequirementUploadField';

const ALLOWED_EXTS = ['.pdf', '.jpg', '.jpeg', '.png', '.docx'];
const ALLOWED_ACCEPT = '.pdf,.jpg,.jpeg,.png,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,image/jpeg,image/png';
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

const RENEWAL_REQ_CONFIG = [
  { key: 'req_RENEWAL_0', name: 'Affidavit of Solo Parent', description: 'Notarized affidavit declaring that you have sole parental care and support of the child/children.' },
  { key: 'req_RENEWAL_1', name: 'Affidavit of Barangay Official', description: 'Notarized affidavit from a barangay official attesting to your residency and solo parent status.' },
  { key: 'req_RENEWAL_2', name: 'Income Tax Return', description: 'Latest Income Tax Return (ITR) or proof of income / certificate of indigency.' },
  { key: 'req_RENEWAL_3', name: 'Original of Solo Parent ID', description: 'Clear photo or scan of your previously issued (or expired) Solo Parent ID Card.' },
  { key: 'req_RENEWAL_4', name: '1x1 Picture', description: 'Recent 1x1 ID photograph with white background.' },
];

export default function RenewApplication() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1); // 1: SPIC Details, 2: Upload Requirements, 3: Review & Submit
  const [application, setApplication] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  // Cancellation modal state
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  // Form state for existing SPIC
  const [existingSpicNo, setExistingSpicNo] = useState('');
  const [existingIssueDate, setExistingIssueDate] = useState('');
  const [existingExpiryDate, setExistingExpiryDate] = useState('');
  const [startingApp, setStartingApp] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState({});

  const handleInitiateCancel = () => {
    if (!application?.id) {
      navigate('/portal/services');
      return;
    }
    setCancelModalOpen(true);
  };

  const handleConfirmCancel = async () => {
    if (!application?.id) {
      navigate('/portal/services');
      return;
    }
    setCancelling(true);
    try {
      await api.post(`/applications/${application.id}/cancel`, {
        reason: cancelReason.trim() || 'Applicant cancelled renewal application.',
      });
      toast.success('Renewal application cancelled successfully.');
      setCancelModalOpen(false);
      navigate('/portal/services');
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

  useEffect(() => {
    const init = async () => {
      try {
        const res = await api.get('/applications/me', { cache: false });
        const active = res.data?.application;
        if (active) {
          const isActuallyInProgress = IN_PROGRESS_STATUSES.includes(active.status);
          if (isActuallyInProgress) {
            if (active.application_type === 'renewal') {
              setApplication(active);
              setExistingSpicNo(active.previous_id_card_number || active.id_card_number || '');
              setExistingIssueDate(active.existing_spic_issue_date || '');
              setExistingExpiryDate(active.existing_spic_expiry_date || '');
              setStep(2);
              fetchDocs(active.id);
            } else {
              toast.error('You have a different active transaction in progress. Please complete or cancel it before starting renewal.');
              navigate('/portal/my-application');
            }
          } else {
            // Application completed/released/expired: pre-fill existing SPIC info if available
            if (active.id_card_number || active.previous_id_card_number) {
              setExistingSpicNo(active.id_card_number || active.previous_id_card_number || '');
            }
          }
        }
      } catch (err) {
        // non-fatal
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [navigate]);

  const fetchDocs = async (appId) => {
    try {
      const res = await api.get(`/documents/my?application_id=${appId}`);
      const allDocs = res.data || [];
      setDocuments(allDocs.filter(d => d.application_id === appId && d.verification_status !== 'replaced'));
    } catch {
      // non-fatal
    }
  };

  const handleCreateRenewalDraft = async (e) => {
    e.preventDefault();

    setStartingApp(true);
    try {
      const res = await api.post('/applications/renew', {
        existing_spic_no: existingSpicNo.trim() || null,
        previous_id_card_number: existingSpicNo.trim() || null,
        existing_issue_date: existingIssueDate || null,
        existing_expiry_date: existingExpiryDate || null,
      });
      setApplication(res.data);
      toast.success('Renewal application initiated! Please upload your requirements.');
      setStep(2);
      fetchDocs(res.data.id);
    } catch (err) {
      toastError(err, 'Failed to initialize renewal application.');
    } finally {
      setStartingApp(false);
    }
  };

  const handleUploadFile = async (reqKey, reqName, files) => {
    if (!files || !application?.id) return;
    const filesArray = Array.isArray(files) ? files : [files];
    if (filesArray.length === 0) return;

    for (const f of filesArray) {
      const ext = '.' + f.name.split('.').pop().toLowerCase();
      if (!ALLOWED_EXTS.includes(ext)) {
        toast.error(`Invalid format for "${f.name}". Allowed: ${ALLOWED_EXTS.join(', ')}`);
        return;
      }
      if (f.size > MAX_FILE_SIZE) {
        toast.error(`File "${f.name}" exceeds the 20MB limit.`);
        return;
      }
    }

    setUploadingDoc(prev => ({ ...prev, [reqKey]: true }));
    const formData = new FormData();
    filesArray.forEach(f => formData.append('files[]', f));
    formData.append('file', filesArray[0]);
    formData.append('doc_type', reqKey);
    formData.append('label', reqName);
    formData.append('requirement_name', reqName);
    formData.append('application_id', application.id);

    try {
      const res = await api.post('/documents/upload', formData);
      const newDocs = res.data?.documents || (Array.isArray(res.data) ? res.data : [res.data]);
      setDocuments(prev => {
        const newIds = new Set(newDocs.map(d => d.id));
        return [...prev.filter(d => !newIds.has(d.id)), ...newDocs];
      });
      toast.success(filesArray.length > 1 ? `${filesArray.length} attachments uploaded!` : `${reqName} uploaded successfully!`);
    } catch (err) {
      toastError(err, 'Failed to upload document.');
      throw err;
    } finally {
      setUploadingDoc(prev => ({ ...prev, [reqKey]: false }));
    }
  };

  const handleReplaceFile = async (docId, reqKey, reqName, file) => {
    if (!file || !application?.id) return;
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!ALLOWED_EXTS.includes(ext)) {
      toast.error(`Invalid format. Allowed: ${ALLOWED_EXTS.join(', ')}`);
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      toast.error('File size exceeds the 20MB limit.');
      return;
    }

    setUploadingDoc(prev => ({ ...prev, [reqKey]: true }));
    const formData = new FormData();
    formData.append('file', file);
    formData.append('application_id', application.id);

    try {
      if (docId) {
        const res = await api.post(`/documents/${docId}/replace`, formData);
        setDocuments(prev => [...prev.filter(d => d.id !== docId), res.data]);
      } else {
        formData.append('doc_type', reqKey);
        formData.append('label', reqName);
        formData.append('requirement_name', reqName);
        const res = await api.post('/documents/upload', formData);
        const newDocs = res.data?.documents || [res.data];
        setDocuments(prev => [...prev, ...newDocs]);
      }
      toast.success(`${reqName} replaced successfully!`);
    } catch (err) {
      toastError(err, 'Failed to replace document.');
      throw err;
    } finally {
      setUploadingDoc(prev => ({ ...prev, [reqKey]: false }));
    }
  };

  const handleDeleteDoc = async (docId) => {
    try {
      await api.delete(`/documents/${docId}`);
      toast.success('Document removed.');
      setDocuments(prev => prev.filter(d => d.id !== docId));
    } catch (err) {
      toastError(err, 'Failed to remove document.');
    }
  };

  const handlePreviewDoc = async (docId) => {
    const newTab = window.open('about:blank', '_blank');
    try {
      const res = await api.get(`/documents/${docId}/view`);
      const url = res.data?.url || res.data?.preview_url;
      if (url) {
        if (newTab) newTab.location.href = url;
        else window.open(url, '_blank', 'noopener,noreferrer');
      } else {
        if (newTab) newTab.close();
        throw new Error('No preview URL available');
      }
    } catch (err) {
      if (newTab) newTab.close();
      toastError(err, 'Could not preview document.');
    }
  };

  const isAllDocsUploaded = RENEWAL_REQ_CONFIG.every(r =>
    documents.some(d => d.doc_type?.toLowerCase() === r.key.toLowerCase())
  );

  const handleSubmitRenewal = async () => {
    if (!isAllDocsUploaded) {
      toast.error('Please upload all 5 required documents before submitting.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post(`/applications/${application.id}/submit-requirements`, {
        category: 'RENEWAL',
      });
      toast.success('Renewal application submitted for CSWDD review!');
      navigate('/portal/my-application');
    } catch (err) {
      toastError(err, 'Failed to submit renewal application.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-3">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Preparing renewal service...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-2.5 sm:px-6 lg:px-8 py-5 sm:py-8 max-w-4xl space-y-6 sm:space-y-8 w-full max-w-full overflow-x-hidden min-w-0">
      {/* ── Top Header ────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-1">
            <RotateCcw className="h-3.5 w-3.5" />
            Service 2 — Solo Parent Portal
          </div>
          <h1 className="text-xl sm:text-3xl font-extrabold text-foreground font-display break-words">
            Renewal of Solo Parent ID
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Renew your ID independently. Prior online portal registration is not required.
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap w-full sm:w-auto">
          <Button asChild variant="outline" size="sm" className="flex-1 sm:flex-initial rounded-2xl border-2 border-border/80 bg-background hover:bg-muted font-bold text-foreground shadow-xs px-3.5 h-9 justify-center">
            <Link to="/portal/services">
              <ArrowLeft className="mr-1.5 h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" /> Back
            </Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleInitiateCancel}
            className="flex-1 sm:flex-initial rounded-2xl border-2 border-rose-300 dark:border-rose-800 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 dark:text-rose-300 font-bold shadow-xs px-3.5 h-9 gap-1.5 cursor-pointer justify-center"
          >
            <XCircle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" />
            Cancel
          </Button>
        </div>
      </div>

      {/* ── Progress Stepper ──────────────────────────── */}
      <div className="flex items-center justify-between gap-2 max-w-xl mx-auto py-2">
        <div className={`flex items-center gap-2 ${step >= 1 ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
          <div className={`h-8 w-8 rounded-xl flex items-center justify-center text-xs font-bold ${step >= 1 ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
            1
          </div>
          <span className="text-xs hidden sm:inline">SPIC Details</span>
        </div>
        <div className={`h-0.5 flex-1 ${step >= 2 ? 'bg-primary' : 'bg-border'}`} />
        <div className={`flex items-center gap-2 ${step >= 2 ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
          <div className={`h-8 w-8 rounded-xl flex items-center justify-center text-xs font-bold ${step >= 2 ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
            2
          </div>
          <span className="text-xs hidden sm:inline">Upload Requirements</span>
        </div>
        <div className={`h-0.5 flex-1 ${step >= 3 ? 'bg-primary' : 'bg-border'}`} />
        <div className={`flex items-center gap-2 ${step >= 3 ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
          <div className={`h-8 w-8 rounded-xl flex items-center justify-center text-xs font-bold ${step >= 3 ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
            3
          </div>
          <span className="text-xs hidden sm:inline">Review & Submit</span>
        </div>
      </div>

      {/* ── STEP 1: Enter / Confirm Existing SPIC Info ── */}
      {step === 1 && (
        <Card className="rounded-3xl border-2 border-border/80 shadow-sm p-6 sm:p-8 space-y-6">
          <form onSubmit={handleCreateRenewalDraft} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="spic_no" className="font-semibold text-sm">
                Existing / Previous Solo Parent ID Number (Optional)
              </Label>
              <Input
                id="spic_no"
                placeholder="e.g. SPIC-2023-01234 or CSWDD-SP-001"
                value={existingSpicNo}
                onChange={e => setExistingSpicNo(e.target.value)}
                className="h-11 rounded-xl"
              />
              <p className="text-xs text-muted-foreground">
                Enter the ID card number written on your previous or expired Solo Parent ID.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="issue_date" className="font-semibold text-sm">
                  Date Issued (Optional)
                </Label>
                <Input
                  id="issue_date"
                  type="date"
                  value={existingIssueDate}
                  onChange={e => setExistingIssueDate(e.target.value)}
                  className="h-11 rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="expiry_date" className="font-semibold text-sm">
                  Date of Expiry (Optional)
                </Label>
                <Input
                  id="expiry_date"
                  type="date"
                  value={existingExpiryDate}
                  onChange={e => setExistingExpiryDate(e.target.value)}
                  className="h-11 rounded-xl"
                />
              </div>
            </div>

            <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-border/60">
              <div className="flex items-center gap-2.5 w-full sm:w-auto">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/portal/services')}
                  className="flex-1 sm:flex-none justify-center rounded-xl h-11 px-4 border-2 border-border font-bold hover:bg-muted gap-1.5 touch-manipulation text-xs sm:text-sm"
                >
                  <ArrowLeft className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Back to Services</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleInitiateCancel}
                  className="flex-1 sm:flex-none justify-center rounded-xl h-11 px-4 font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border-2 border-rose-300 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 dark:text-rose-300 dark:border-rose-800 gap-1.5 cursor-pointer shadow-xs touch-manipulation text-xs sm:text-sm"
                >
                  <XCircle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" />
                  <span>Cancel</span>
                </Button>
              </div>
              <Button
                type="submit"
                disabled={startingApp}
                className="w-full sm:w-auto rounded-2xl h-11 px-6 font-bold shadow-md bg-emerald-600 hover:bg-emerald-700 text-white gap-2 cursor-pointer touch-manipulation justify-center"
              >
                {startingApp ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
                <span>Continue to Requirements</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* ── STEP 2: Upload Documentary Requirements ──── */}
      {step === 2 && (
        <div className="space-y-6">
          <Card className="rounded-3xl border-2 border-border/80 shadow-sm p-6 sm:p-7 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border/60 flex-wrap gap-2">
              <div>
                <h3 className="font-bold text-lg text-foreground font-display">
                  Required Renewal Documents
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Existing SPIC: <strong className="text-foreground font-mono">{existingSpicNo || 'None / Not Provided'}</strong> • Please upload clear copies in PDF, Image (JPG, PNG), or DOCX format (max 20MB).
                </p>
              </div>
              <Badge variant="outline" className="text-xs font-semibold px-3 py-1">
                {RENEWAL_REQ_CONFIG.filter(r => documents.some(d => d.doc_type?.toLowerCase() === r.key.toLowerCase())).length} of {RENEWAL_REQ_CONFIG.length} Completed
              </Badge>
            </div>

            <div className="space-y-4 pt-2">
              {RENEWAL_REQ_CONFIG.map((req, idx) => {
                const reqDocs = documents.filter(d => d.doc_type?.toLowerCase() === req.key.toLowerCase());
                return (
                  <RequirementUploadField
                    key={req.key}
                    requirement={{
                      name: req.name,
                      description: req.description,
                      is_required: true,
                      formats: ALLOWED_EXTS,
                      max_size_mb: 20,
                    }}
                    docKey={req.key}
                    existingDocuments={reqDocs}
                    isUploading={uploadingDoc[req.key]}
                    onUpload={(files) => handleUploadFile(req.key, req.name, files)}
                    onReplace={(file, docId) => handleReplaceFile(docId, req.key, req.name, file)}
                    onDelete={handleDeleteDoc}
                    onPreview={(doc) => handlePreviewDoc(doc.id)}
                  />
                );
              })}
            </div>
          </Card>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-border/60">
            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <Button
                variant="outline"
                onClick={() => setStep(1)}
                className="flex-1 sm:flex-none justify-center rounded-xl h-11 px-4 border-2 border-slate-300 dark:border-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-bold gap-1.5 shadow-xs touch-manipulation text-xs sm:text-sm"
              >
                <ArrowLeft className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Back</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleInitiateCancel}
                className="flex-1 sm:flex-none justify-center rounded-xl h-11 px-4 font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border-2 border-rose-300 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 dark:text-rose-300 dark:border-rose-800 gap-1.5 cursor-pointer shadow-xs touch-manipulation text-xs sm:text-sm"
              >
                <XCircle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" />
                <span>Cancel</span>
              </Button>
            </div>

            <Button
              disabled={!isAllDocsUploaded}
              onClick={() => setStep(3)}
              className="w-full sm:w-auto rounded-2xl h-11 px-6 font-bold shadow-md bg-emerald-600 hover:bg-emerald-700 text-white gap-2 cursor-pointer touch-manipulation justify-center"
            >
              <span>Review Submission</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Review Submission & Submit ────────── */}
      {step === 3 && (
        <Card className="rounded-3xl border-2 border-border/80 shadow-sm p-6 sm:p-8 space-y-6">
          <div className="space-y-1">
            <h3 className="font-bold text-xl text-foreground font-display">
              Review Renewal Submission
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Please verify your existing SPIC details and submitted requirements before final submission to CSWDD.
            </p>
          </div>

          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-muted/40 border border-border/80 space-y-2">
              <h4 className="text-xs uppercase font-bold text-muted-foreground tracking-wider">
                Existing Solo Parent ID Information
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs sm:text-sm">
                <div>
                  <span className="text-muted-foreground block text-xs">SPIC Number:</span>
                  <strong className="font-mono font-bold text-foreground">{existingSpicNo || 'None / Not Provided'}</strong>
                </div>
                {existingIssueDate && (
                  <div>
                    <span className="text-muted-foreground block text-xs">Date Issued:</span>
                    <strong className="text-foreground">{existingIssueDate}</strong>
                  </div>
                )}
                {existingExpiryDate && (
                  <div>
                    <span className="text-muted-foreground block text-xs">Expiry Date:</span>
                    <strong className="text-foreground">{existingExpiryDate}</strong>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-muted/40 border border-border/80 space-y-3">
              <h4 className="text-xs uppercase font-bold text-muted-foreground tracking-wider">
                Uploaded Documentary Requirements ({documents.length} {documents.length === 1 ? 'file' : 'files'})
              </h4>
              <div className="space-y-3">
                {RENEWAL_REQ_CONFIG.map(req => {
                  const reqDocs = documents.filter(d => d.doc_type?.toLowerCase() === req.key.toLowerCase());
                  return (
                    <div key={req.key} className="p-3.5 rounded-xl bg-background border border-border/60 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                          <p className="font-semibold text-foreground text-sm">{req.name}</p>
                        </div>
                        <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 text-[10px] font-bold">
                          {reqDocs.length} {reqDocs.length === 1 ? 'attachment' : 'attachments'}
                        </Badge>
                      </div>

                      {reqDocs.length > 0 ? (
                        <div className="pl-6 space-y-1.5">
                          {reqDocs.map(doc => (
                            <div key={doc.id} className="flex items-center justify-between text-xs py-1.5 px-3 rounded-lg bg-muted/40 border border-border/40">
                              <span className="truncate max-w-xs sm:max-w-md font-mono text-muted-foreground">
                                {doc.original_filename || 'Uploaded file'}
                              </span>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => handlePreviewDoc(doc.id)}
                                className="h-7 px-2 text-xs gap-1 font-semibold text-primary hover:bg-primary/10"
                                title="Preview attachment"
                              >
                                <Eye className="h-3 w-3" /> View
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="pl-6 text-xs text-rose-500 font-medium">No files uploaded yet.</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-4 border-t border-border/60 gap-3">
            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <Button
                variant="outline"
                onClick={() => setStep(2)}
                className="flex-1 sm:flex-none justify-center rounded-xl h-11 px-4 border-2 border-slate-300 dark:border-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-bold gap-1.5 shadow-xs touch-manipulation text-xs sm:text-sm"
              >
                <ArrowLeft className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Back</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleInitiateCancel}
                className="flex-1 sm:flex-none justify-center rounded-xl h-11 px-4 font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border-2 border-rose-300 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 dark:text-rose-300 dark:border-rose-800 gap-1.5 cursor-pointer shadow-xs touch-manipulation text-xs sm:text-sm"
              >
                <XCircle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" />
                <span>Cancel</span>
              </Button>
            </div>

            <Button
              disabled={submitting || !isAllDocsUploaded}
              onClick={handleSubmitRenewal}
              className="w-full sm:w-auto rounded-2xl h-11 px-7 font-bold shadow-md bg-emerald-600 hover:bg-emerald-700 text-white gap-2 cursor-pointer touch-manipulation justify-center"
            >
              {submitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              <span>Submit Renewal to CSWDD</span>
            </Button>
          </div>
        </Card>
      )}

      {/* ── Cancel Application Confirmation Modal ── */}
      <Dialog open={cancelModalOpen} onOpenChange={setCancelModalOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md rounded-3xl p-5 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-display">
              <AlertTriangle className="h-5 w-5" /> Cancel Renewal Application
            </DialogTitle>
            <DialogDescription className="text-sm pt-2 leading-relaxed">
              Are you sure you want to cancel this renewal application?
              {application?.reference_no ? ` (Ref: ${application.reference_no})` : ''}
              <br /><br />
              Any uploaded documents and progress for this transaction will be cancelled, and you can freely return to Services.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <Label htmlFor="renew-cancel-reason" className="text-xs font-semibold">
              Reason for Cancellation (Optional)
            </Label>
            <Textarea
              id="renew-cancel-reason"
              placeholder="e.g. Need to update previous SPIC details, choose different service, etc."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="h-20 text-xs rounded-xl"
            />
          </div>

          <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCancelModalOpen(false)}
              className="w-full sm:w-auto h-11 rounded-xl touch-manipulation"
              disabled={cancelling}
            >
              Keep Renewal
            </Button>
            <Button
              type="button"
              onClick={handleConfirmCancel}
              disabled={cancelling}
              className="w-full sm:w-auto h-11 rounded-xl font-bold bg-rose-600 hover:bg-rose-700 text-white gap-2 cursor-pointer shadow-md touch-manipulation"
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
