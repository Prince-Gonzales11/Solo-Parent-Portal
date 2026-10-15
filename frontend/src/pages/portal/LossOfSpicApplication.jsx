import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api, toastError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  AlertOctagon, ArrowRight, ArrowLeft, Upload, CheckCircle2,
  AlertCircle, FileText, RefreshCw, Eye, Trash2,
  Send, Calendar, IdCard, Info, XCircle, AlertTriangle
} from 'lucide-react';
import RequirementUploadField from '@/components/RequirementUploadField';

const ALLOWED_EXTS = ['.pdf', '.jpg', '.jpeg', '.png', '.docx'];
const ALLOWED_ACCEPT = '.pdf,.jpg,.jpeg,.png,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,image/jpeg,image/png';
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

const LOSS_REQ_CONFIG = [
  { key: 'req_LOSS_SPIC_0', name: 'Affidavit of Loss', description: 'Notarized Affidavit of Loss stating the circumstances surrounding the loss of your Solo Parent ID.' },
  { key: 'req_LOSS_SPIC_1', name: '1x1 Picture', description: 'Recent 1x1 ID photograph with white background.' },
  { key: 'req_LOSS_SPIC_2', name: 'Sworn Affidavit', description: 'Sworn affidavit declaring sole parental care and custody of dependent children.' },
  { key: 'req_LOSS_SPIC_3', name: 'Affidavit of a Barangay Official', description: 'Affidavit from a barangay official attesting to your residency and single parental care.' },
];

export default function LossOfSpicApplication() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1); // 1: Lost SPIC Details, 2: Upload Requirements, 3: Review & Submit
  const [application, setApplication] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  // Cancellation modal state
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  // Form state for lost SPIC
  const [existingSpicNo, setExistingSpicNo] = useState('');
  const [lossCircumstance, setLossCircumstance] = useState('');
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
        reason: cancelReason.trim() || 'Applicant cancelled lost SPIC replacement application.',
      });
      toast.success('Replacement application cancelled successfully.');
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
            if (active.application_type === 'loss_spic') {
              setApplication(active);
              setExistingSpicNo(active.previous_id_card_number || active.id_card_number || '');
              setLossCircumstance(active.loss_circumstance || '');
              setStep(2);
              fetchDocs(active.id);
            } else {
              toast.error('You have a different active transaction in progress. Please complete or cancel it before starting replacement.');
              navigate('/portal/my-application');
            }
          } else {
            // Prior application was released/completed/expired: pre-fill existing SPIC number
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

  const handleCreateLossDraft = async (e) => {
    e.preventDefault();

    setStartingApp(true);
    try {
      const res = await api.post('/applications/loss-spic', {
        existing_spic_no: existingSpicNo.trim() || null,
        loss_circumstance: lossCircumstance.trim() || null,
      });
      setApplication(res.data);
      toast.success('Loss of SPIC transaction initiated! Please upload your requirements.');
      setStep(2);
      fetchDocs(res.data.id);
    } catch (err) {
      toastError(err, 'Failed to initialize Loss of SPIC application.');
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

  const isAllDocsUploaded = LOSS_REQ_CONFIG.every(r =>
    documents.some(d => d.doc_type?.toLowerCase() === r.key.toLowerCase())
  );

  const handleSubmitLoss = async () => {
    if (!isAllDocsUploaded) {
      toast.error('Please upload all 4 required documents before submitting.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post(`/applications/${application.id}/submit-requirements`, {
        category: 'LOSS_SPIC',
      });
      toast.success('Loss of SPIC replacement application submitted for CSWDD review!');
      navigate('/portal/my-application');
    } catch (err) {
      toastError(err, 'Failed to submit Loss of SPIC application.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-3">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Preparing replacement service...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-2.5 sm:px-6 lg:px-8 py-5 sm:py-8 max-w-4xl space-y-6 sm:space-y-8 w-full max-w-full overflow-x-hidden min-w-0">
      {/* ── Top Header ────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-rose-600 dark:text-rose-400 mb-1">
            <AlertOctagon className="h-3.5 w-3.5" />
            Service 3 — Solo Parent Portal
          </div>
          <h1 className="text-xl sm:text-3xl font-extrabold text-foreground font-display break-words">
            Loss of SPIC Replacement
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Report a lost card and apply for an official replacement. No prior portal registration needed.
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap w-full sm:w-auto">
          <Button asChild variant="outline" size="sm" className="flex-1 sm:flex-initial rounded-2xl border-2 border-border/80 bg-background hover:bg-muted font-bold text-foreground shadow-xs px-3.5 h-9 justify-center">
            <Link to="/portal/services">
              <ArrowLeft className="mr-1.5 h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" /> Back
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
          <span className="text-xs hidden sm:inline">Loss Information</span>
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

      {/* ── STEP 1: Enter / Confirm Lost SPIC Info ────── */}
      {step === 1 && (
        <Card className="rounded-3xl border-2 border-border/80 shadow-sm p-6 sm:p-8 space-y-6">

          <form onSubmit={handleCreateLossDraft} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="spic_no" className="font-semibold text-sm">
                Lost Solo Parent ID Card Number (or last known number) (Optional)
              </Label>
              <Input
                id="spic_no"
                placeholder="e.g. SPIC-2023-XXXX or last known ID number"
                value={existingSpicNo}
                onChange={e => setExistingSpicNo(e.target.value)}
                className="h-11 rounded-xl"
              />
              <p className="text-xs text-muted-foreground">
                If you do not remember the exact number, you may leave this blank or provide an approximate reference number.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="circumstance" className="font-semibold text-sm">
                Circumstances of Loss (Optional)
              </Label>
              <Textarea
                id="circumstance"
                rows={4}
                placeholder="Briefly explain when, where, and how your Solo Parent ID card was lost, damaged, or stolen..."
                value={lossCircumstance}
                onChange={e => setLossCircumstance(e.target.value)}
                className="rounded-xl resize-none text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Optional narrative. Details will be verified against your uploaded Notarized Affidavit of Loss in Step 2.
              </p>
            </div>

            <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-border/60">
              <div className="flex items-center gap-2.5 w-full sm:w-auto">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/portal/services')}
                  className="flex-1 sm:flex-none justify-center rounded-xl h-11 px-4 border-2 border-border font-bold hover:bg-muted gap-1.5 touch-manipulation text-xs sm:text-sm"
                >
                  <ArrowLeft className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" />
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
                className="w-full sm:w-auto rounded-2xl h-11 px-6 font-bold shadow-md bg-rose-600 hover:bg-rose-700 text-white gap-2 cursor-pointer touch-manipulation justify-center"
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
                  Required Replacement Documents
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Lost SPIC: <strong className="text-foreground font-mono">{existingSpicNo || 'None / Not Provided'}</strong> • Please upload clear copies in PDF, Image (JPG, PNG), or DOCX format (max 20MB).
                </p>
              </div>
              <Badge variant="outline" className="text-xs font-semibold px-3 py-1">
                {LOSS_REQ_CONFIG.filter(r => documents.some(d => d.doc_type?.toLowerCase() === r.key.toLowerCase())).length} of {LOSS_REQ_CONFIG.length} Completed
              </Badge>
            </div>

            <div className="space-y-4 pt-2">
              {LOSS_REQ_CONFIG.map((req, idx) => {
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
                <ArrowLeft className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" />
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
              className="w-full sm:w-auto rounded-2xl h-11 px-6 font-bold shadow-md bg-rose-600 hover:bg-rose-700 text-white gap-2 cursor-pointer touch-manipulation justify-center"
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
              Review Replacement Submission
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Please verify the reported circumstances of loss and submitted affidavits before submitting for CSWDD review.
            </p>
          </div>

          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-muted/40 border border-border/80 space-y-2">
              <h4 className="text-xs uppercase font-bold text-muted-foreground tracking-wider">
                Lost Solo Parent ID Details
              </h4>
              <div className="space-y-2 text-xs sm:text-sm">
                <div>
                  <span className="text-muted-foreground block text-xs">Lost SPIC Number:</span>
                  <strong className="font-mono font-bold text-foreground">{existingSpicNo || 'None / Not Provided'}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs">Circumstances of Loss:</span>
                  <p className="text-foreground leading-relaxed mt-0.5 bg-background p-2.5 rounded-xl border border-border/60">
                    {lossCircumstance || 'Not provided (refer to uploaded Notarized Affidavit of Loss)'}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-muted/40 border border-border/80 space-y-3">
              <h4 className="text-xs uppercase font-bold text-muted-foreground tracking-wider">
                Uploaded Documentary Requirements ({documents.length} {documents.length === 1 ? 'file' : 'files'})
              </h4>
              <div className="space-y-3">
                {LOSS_REQ_CONFIG.map(req => {
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
                <ArrowLeft className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" />
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
              onClick={handleSubmitLoss}
              className="w-full sm:w-auto rounded-2xl h-11 px-7 font-bold shadow-md bg-rose-600 hover:bg-rose-700 text-white gap-2 cursor-pointer touch-manipulation justify-center"
            >
              {submitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              <span>Submit Replacement to CSWDD</span>
            </Button>
          </div>
        </Card>
      )}

      {/* ── Cancel Application Confirmation Modal ── */}
      <Dialog open={cancelModalOpen} onOpenChange={setCancelModalOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md rounded-3xl p-5 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-display">
              <AlertTriangle className="h-5 w-5" /> Cancel Replacement Application
            </DialogTitle>
            <DialogDescription className="text-sm pt-2 leading-relaxed">
              Are you sure you want to cancel this lost SPIC replacement application?
              {application?.reference_no ? ` (Ref: ${application.reference_no})` : ''}
              <br /><br />
              Any uploaded affidavits and progress for this transaction will be cancelled, and you can freely return to Services.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <Label htmlFor="loss-cancel-reason" className="text-xs font-semibold">
              Reason for Cancellation (Optional)
            </Label>
            <Textarea
              id="loss-cancel-reason"
              placeholder="e.g. Found the card, need to update information, choose different service, etc."
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
              Keep Replacement
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
