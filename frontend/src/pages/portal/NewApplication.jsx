import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api, toastError, previewDocumentBlob } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import {
  CheckCircle, ChevronRight, ChevronLeft, FileText, Upload, Eye,
  RefreshCw, AlertTriangle, X, Clipboard, Send, RotateCcw, AlertCircle, XCircle
} from 'lucide-react';
import SignaturePad from 'signature_pad';
import { scrollToAndFocus, ERROR_INPUT_CLASS } from '@/lib/formValidation';
import RequirementUploadField from '@/components/RequirementUploadField';

const STEPS = [
  { id: 1, label: 'Category' },
  { id: 2, label: 'Documents' },
  { id: 3, label: 'Review & Sign' },
  { id: 4, label: 'Submitted' },
];

function StepIndicator({ current }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {STEPS.map((step, idx) => {
        const isCompleted = idx < current - 1;
        const isCurrent   = idx === current - 1;
        return (
          <React.Fragment key={step.id}>
            <div className="flex flex-col items-center gap-1.5 min-w-[72px]">
              <div className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                isCompleted ? 'bg-primary border-primary text-primary-foreground' :
                isCurrent   ? 'bg-primary/10 border-primary text-primary' :
                              'bg-muted border-border text-muted-foreground'
              }`}>
                {isCompleted ? <CheckCircle className="h-4 w-4" /> : step.id}
              </div>
              <span className={`text-xs text-center font-semibold ${isCurrent ? 'text-primary' : isCompleted ? 'text-foreground' : 'text-muted-foreground'}`}>
                {step.label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div className={`h-0.5 w-10 mb-5 ${idx < current - 1 ? 'bg-primary' : 'bg-border'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function DocStatusIcon({ status }) {
  if (status === 'verified') return <CheckCircle className="h-4 w-4 text-success" />;
  if (status === 'rejected') return <X className="h-4 w-4 text-destructive" />;
  return <FileText className="h-4 w-4 text-muted-foreground" />;
}

export default function NewApplication() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const urlCategory = new URLSearchParams(location.search).get('category');

  const [step, setStep] = useState(urlCategory ? 2 : 1); // skip to step 2 if category pre-selected
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [profile, setProfile] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [uploading, setUploading] = useState({});
  const [dragOver, setDragOver] = useState(null);
  const [application, setApplication] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sigPad, setSigPad] = useState(null);
  const [categoryError, setCategoryError] = useState(false);
  const [docError, setDocError] = useState(false);
  const [sigError, setSigError] = useState(false);
  const canvasRef = useRef(null);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [catRes, profRes, docRes] = await Promise.all([
          api.get('/public/categories'),
          api.get('/profile').catch(() => ({ data: null })),
          api.get('/documents/my').catch(() => ({ data: [] })),
        ]);
        setCategories(catRes.data || []);
        setProfile(profRes.data);
        setDocuments(docRes.data || []);

        // Pre-select category from URL query param (passed from dashboard category browser)
        if (urlCategory) {
          const cat = catRes.data?.find(c => c.code?.toLowerCase() === urlCategory.toLowerCase());
          if (cat) {
            setSelectedCategory(cat);
            setStep(2); // jump straight to document upload
          }
        } else if (profRes.data?.solo_parent_category) {
          // Fall back to category stored in profile
          const cat = catRes.data?.find(c => c.code === profRes.data.solo_parent_category);
          if (cat) setSelectedCategory(cat);
        }
      } catch (err) {
        toastError(err, 'Failed to load application data.');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // Initialize signature pad on step 3
  useEffect(() => {
    if (step === 3 && canvasRef.current) {
      const pad = new SignaturePad(canvasRef.current, {
        backgroundColor: 'rgba(255,255,255,0)',
        penColor: '#1e3a5f',
      });
      setSigPad(pad);

      // Restore existing signature from profile
      if (profile?.signature_data) {
        pad.fromDataURL(profile.signature_data);
      }

      return () => { pad.off(); };
    }
  }, [step]);

  const handleUpload = async (file, docType, reqConfig) => {
    if (!file) return;
    if (reqConfig?.formats) {
      const ext = '.' + file.name.split('.').pop().toLowerCase();
      if (!reqConfig.formats.includes(ext)) {
        toast.error(`Invalid format. Allowed: ${reqConfig.formats.join(', ')}`);
        return;
      }
      if (file.size > reqConfig.max_size_mb * 1024 * 1024) {
        toast.error(`File too large. Max: ${reqConfig.max_size_mb}MB`);
        return;
      }
    }

    setUploading(prev => ({ ...prev, [docType]: true }));
    const filesArray = Array.isArray(files) ? files : [files];
    const fd = new FormData();
    filesArray.forEach(f => fd.append('files[]', f));
    fd.append('file', filesArray[0]);
    fd.append('doc_type', docType);
    if (reqConfig?.name) fd.append('label', reqConfig.name);
    if (reqConfig?.name) fd.append('requirement_name', reqConfig.name);
    if (reqConfig?.id) fd.append('requirement_id', reqConfig.id);

    try {
      const res = await api.post('/documents/upload', fd);
      const newDocs = res.data?.documents || (Array.isArray(res.data) ? res.data : [res.data]);
      setDocuments(prev => {
        const newIds = new Set(newDocs.map(d => d.id));
        const filtered = prev.filter(d => !newIds.has(d.id));
        return [...filtered, ...newDocs];
      });
      toast.success(newDocs.length > 1 ? `${newDocs.length} attachments uploaded!` : 'Document uploaded!');
    } catch (err) {
      toastError(err, 'Upload failed.');
      throw err;
    } finally {
      setUploading(prev => ({ ...prev, [docType]: false }));
      setDragOver(null);
    }
  };

  const handleReplace = async (file, docId, docType) => {
    if (!file) return;
    setUploading(prev => ({ ...prev, [docType]: true }));
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await api.post(`/documents/${docId}/replace`, fd);
      setDocuments(prev => [...prev.filter(d => d.id !== docId), res.data]);
      toast.success('Document replaced!');
    } catch (err) {
      toastError(err, 'Failed to replace document.');
      throw err;
    } finally {
      setUploading(prev => ({ ...prev, [docType]: false }));
    }
  };

  const handleDeleteDoc = async (id) => {
    try {
      await api.delete(`/documents/${id}`);
      setDocuments(prev => prev.filter(d => d.id !== id));
      toast.success('Attachment removed.');
    } catch (err) {
      toastError(err, 'Could not remove document.');
      throw err;
    }
  };

  const handlePreview = async (id) => {
    const newTab = window.open('about:blank', '_blank');
    try {
      await previewDocumentBlob(id, { newTab });
    } catch (err) {
      toastError(err, 'Preview unavailable.');
    }
  };

  const checkRequirements = () => {
    if (!selectedCategory) return { ready: false, missing: [] };
    const reqs = selectedCategory.requirements || [];
    const missing = reqs
      .filter((r, idx) => {
        const docKey = `req_${selectedCategory.code}_${idx}`;
        const hasDoc = documents.some(d => (d.requirement_id === r.id || d.doc_type === docKey) && !['replaced', 'rejected'].includes(d.verification_status));
        return r.is_required && !hasDoc;
      })
      .map(r => r.name);
    return { ready: missing.length === 0, missing };
  };

  const handleCategorySelect = async (cat) => {
    setSelectedCategory(cat);
    setCategoryError(false);
    // Save category to profile
    try {
      await api.put('/profile', { solo_parent_category: cat.code });
    } catch (err) {
      console.error('Could not save category to profile');
    }
  };

  const handleContinueToDocs = () => {
    if (!selectedCategory) {
      setCategoryError(true);
      toast.error('Please select your Solo Parent category to continue.');
      scrollToAndFocus('category-selection-container');
      return;
    }
    setCategoryError(false);
    setStep(2);
  };

  const handleContinueToReview = () => {
    const { ready, missing } = checkRequirements();
    if (!ready) {
      setDocError(true);
      toast.error(`Please upload all required documents: ${missing.join(', ')}`);
      const reqs = selectedCategory?.requirements || [];
      const firstMissingIdx = reqs.findIndex((r, idx) => {
        const isReq = typeof r === 'string' ? true : r.is_required;
        const docKey = `req_${selectedCategory.code}_${idx}`;
        return isReq && !documents.find(d => d.doc_type === docKey);
      });
      if (firstMissingIdx !== -1) {
        scrollToAndFocus(`doc-card-${firstMissingIdx}`);
      }
      return;
    }
    setDocError(false);
    setStep(3);
  };

  const handleSubmit = async () => {
    const hasExistingSig = Boolean(profile?.signature_data);
    const hasDrawnSig = Boolean(sigPad && !sigPad.isEmpty());
    if (!hasExistingSig && !hasDrawnSig) {
      setSigError(true);
      toast.error('Please provide your digital signature before submitting.');
      scrollToAndFocus('signature-pad-container');
      return;
    }
    setSigError(false);

    setSubmitting(true);
    try {
      // Save signature if changed
      if (hasDrawnSig) {
        const sigData = sigPad.toDataURL();
        await api.put('/profile', { signature_data: sigData });
      }

      // Create application draft if not exists
      let app = application;
      if (!app) {
        const createRes = await api.post('/applications');
        app = createRes.data;
        setApplication(app);
      }

      // Submit the application
      await api.post(`/applications/${app.id}/submit`);
      setStep(4);
      toast.success('Application submitted successfully!');
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (typeof detail === 'string') {
        toast.error(detail);
      } else {
        toastError(err, 'Submission failed. Please ensure all required documents are uploaded.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const requirements = selectedCategory?.requirements || [];
  const { ready: _docsReady, missing: missingDocs } = checkRequirements();

  return (
    <div className="flex-1 container px-4 sm:px-6 lg:px-8 py-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2.5 mb-4 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => navigate('/portal/services')} className="rounded-xl border-2 border-border/80 bg-background hover:bg-muted font-bold text-foreground shadow-xs px-3.5 h-9">
            <ChevronLeft className="h-4 w-4 mr-1 text-primary" /> Back to Services
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate('/portal/services')} className="rounded-xl border-2 border-rose-300 dark:border-rose-800 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 dark:text-rose-300 font-bold shadow-xs px-3.5 h-9 gap-1.5 cursor-pointer">
            <XCircle className="h-4 w-4 text-rose-600 dark:text-rose-400" /> Cancel Application
          </Button>
        </div>
        <h1 className="text-3xl font-bold">Apply for Solo Parent ID</h1>
        <p className="text-muted-foreground mt-1 text-sm sm:text-base">Follow the steps below to submit your SPIC application.</p>
      </div>

      <StepIndicator current={step} />

      {/* ── Step 1: Category Selection ── */}
      {step === 1 && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Select Your Solo Parent Category</CardTitle>
              <CardDescription className="text-sm leading-relaxed">
                Choose the category under <strong>Republic Act No. 11861</strong> that best describes your situation.
                This determines which documentary requirements apply to you.
              </CardDescription>
            </CardHeader>
          </Card>

          <div id="category-selection-container" className={`grid gap-3 p-1 rounded-xl transition-all ${categoryError && !selectedCategory ? 'ring-2 ring-destructive/60' : ''}`}>
            {categories.map(cat => (
              <button
                key={cat.code}
                onClick={() => handleCategorySelect(cat)}
                className={`w-full text-left flex items-start gap-4 p-5 rounded-xl border-2 transition-all group hover:border-primary/50 hover:bg-primary/5 ${
                  selectedCategory?.code === cat.code
                    ? 'border-primary bg-primary/5'
                    : 'border-border'
                }`}
              >
                <div className={`h-11 w-11 rounded-lg flex items-center justify-center shrink-0 font-bold text-sm ${
                  selectedCategory?.code === cat.code ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}>
                  {cat.code?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-base">{cat.name}</h3>
                    {selectedCategory?.code === cat.code && (
                      <Badge variant="default" className="text-xs font-semibold h-5 px-2">Selected</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{cat.description}</p>
                  <p className="text-xs sm:text-sm text-primary/90 mt-1.5 font-semibold">
                    {(cat.requirements || []).filter(r => r.is_required).length} required document(s)
                  </p>
                </div>
                <ChevronRight className={`h-5 w-5 shrink-0 mt-1 transition-colors ${
                  selectedCategory?.code === cat.code ? 'text-primary' : 'text-muted-foreground/30 group-hover:text-primary/50'
                }`} />
              </button>
            ))}
          </div>

          {categoryError && !selectedCategory && (
            <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/5 flex items-center gap-2 text-destructive text-xs font-semibold animate-in fade-in">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>Solo Parent Category is required (*). Please select a category above to proceed.</span>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button
              size="lg"
              onClick={handleContinueToDocs}
              className="gap-2"
            >
              View Requirements <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 2: Document Upload ── */}
      {step === 2 && (
        <div className="space-y-6">
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="py-4 px-5 flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm shrink-0">
                {selectedCategory?.code?.toUpperCase()}
              </div>
              <div>
                <h3 className="font-semibold">{selectedCategory?.name}</h3>
                <p className="text-xs text-muted-foreground">{selectedCategory?.description}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setStep(1)} className="ml-auto">
                Change
              </Button>
            </CardContent>
          </Card>

          <div className="space-y-3">
            <h2 className="text-lg font-bold">Upload Documentary Requirements</h2>
            {requirements.length === 0 && (
              <p className="text-muted-foreground text-sm">No specific requirements defined for this category. You may proceed.</p>
            )}
            {requirements.map((req, idx) => {
              const r = typeof req === 'string'
                ? { name: req, description: '', is_required: true, formats: ['.pdf', '.jpg', '.jpeg', '.png'], max_size_mb: 20, instructions: '' }
                : req;
              const docKey = `req_${selectedCategory.code}_${idx}`;
              const reqDocs = documents.filter(d => (d.requirement_id === r.id || d.doc_type === docKey) && d.verification_status !== 'replaced');
              const isMissingRequired = docError && r.is_required && reqDocs.length === 0;

              return (
                <RequirementUploadField
                  key={r.id || idx}
                  requirement={{ ...r, index: idx }}
                  docKey={docKey}
                  existingDocuments={reqDocs}
                  isUploading={uploading[docKey]}
                  onUpload={(files) => handleUpload(files, docKey, r)}
                  onReplace={(file, docId) => handleReplace(file, docId, docKey)}
                  onDelete={handleDeleteDoc}
                  onPreview={(d) => handlePreview(d.id)}
                  error={isMissingRequired ? 'This document is required (*). Please upload at least one file.' : null}
                />
              );
            })}
          </div>

          {missingDocs.length > 0 && (
            <Card className="border-warning/30 bg-warning-soft">
              <CardContent className="flex items-start gap-3 py-4 px-5">
                <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-warning">Missing required documents:</p>
                  <ul className="text-xs text-warning mt-1 space-y-0.5 list-disc ml-4">
                    {missingDocs.map((d, i) => <li key={i}>{d}</li>)}
                  </ul>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={() => setStep(1)} className="border-2 border-slate-300 dark:border-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-bold h-11 px-5 rounded-xl shadow-xs"><ChevronLeft className="h-4 w-4 mr-1 text-primary" /> Back</Button>
            <Button onClick={handleContinueToReview} className="gap-2">
              Review Application <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 3: Review & Sign ── */}
      {step === 3 && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Clipboard className="h-5 w-5 text-primary" /> Review Your Application</CardTitle>
              <CardDescription>Please review all information carefully before submitting.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">

              {/* Category Summary */}
              <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-1">Solo Parent Category</p>
                <p className="font-bold">{selectedCategory?.code?.toUpperCase()} — {selectedCategory?.name}</p>
                <p className="text-sm text-muted-foreground mt-0.5">{selectedCategory?.description}</p>
              </div>

              {/* Profile Summary */}
              {profile && (
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-2">Personal Information</p>
                  <div className="grid sm:grid-cols-2 gap-3 text-sm">
                    {[
                      ['Full Name', [profile.first_name, profile.middle_name, profile.last_name].filter(Boolean).join(' ')],
                      ['Date of Birth', profile.birth_date],
                      ['Sex', profile.sex],
                      ['Civil Status', profile.civil_status],
                      ['Contact No.', profile.contact_number],
                      ['Address', [profile.barangay, profile.city_municipality, profile.province].filter(Boolean).join(', ')],
                      ['Employment', profile.employment_status],
                      ['Monthly Income', profile.monthly_income],
                    ].filter(([, v]) => v).map(([label, value]) => (
                      <div key={label} className="bg-muted/30 rounded p-2">
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className="font-medium">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Documents Summary */}
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-2">Uploaded Documents</p>
                <div className="space-y-2">
                  {requirements.map((req, idx) => {
                    const r = typeof req === 'string' ? { name: req, is_required: true } : req;
                    const docKey = `req_${selectedCategory.code}_${idx}`;
                    const doc = documents.find(d => d.doc_type === docKey);
                    return (
                      <div key={idx} className="flex items-center gap-3 text-sm">
                        {doc
                          ? <CheckCircle className="h-4 w-4 text-success shrink-0" />
                          : <AlertTriangle className="h-4 w-4 text-warning shrink-0" />}
                        <span className={doc ? '' : 'text-muted-foreground'}>{r.name}</span>
                        {!r.is_required && <Badge variant="outline" className="text-[9px] h-4">Optional</Badge>}
                        {doc && <span className="ml-auto text-xs text-muted-foreground truncate max-w-[160px]">{doc.original_filename}</span>}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Digital Signature */}
              <div id="signature-pad-container">
                <p className={`text-xs uppercase tracking-widest font-medium mb-2 ${sigError ? 'text-destructive font-bold' : 'text-muted-foreground'}`}>
                  Digital Signature <span className="text-destructive font-bold">*</span>
                </p>
                <div
                  className={`border-2 rounded-lg overflow-hidden bg-white dark:bg-slate-900 transition-colors ${
                    sigError ? 'border-destructive ring-2 ring-destructive/40' : 'border-border'
                  }`}
                  onMouseDown={() => setSigError(false)}
                  onTouchStart={() => setSigError(false)}
                >
                  <canvas ref={canvasRef} width={600} height={160} className="w-full touch-none cursor-crosshair" />
                </div>
                {sigError && (
                  <p className="text-xs text-destructive font-semibold flex items-center gap-1.5 mt-1.5 animate-in fade-in">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" /> Digital signature is required (*). Please sign in the box above before submitting.
                  </p>
                )}
                <div className="flex justify-between mt-2">
                  <p className="text-xs text-muted-foreground">Sign above with your mouse or finger</p>
                  <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => { sigPad?.clear(); }}>
                    <RotateCcw className="h-3 w-3 mr-1" /> Clear
                  </Button>
                </div>
              </div>

              {/* Declaration */}
              <div className="p-4 bg-muted/30 rounded-lg text-xs text-muted-foreground space-y-1 border">
                <p className="font-semibold text-foreground">Declaration</p>
                <p>I hereby certify that all information provided in this application and the documents submitted are true, accurate, and complete to the best of my knowledge. I understand that any false statement or document submitted may result in the disqualification of my application and may be subject to legal action under applicable laws.</p>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(2)} className="border-2 border-slate-300 dark:border-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-bold h-11 px-5 rounded-xl shadow-xs"><ChevronLeft className="h-4 w-4 mr-1 text-primary" /> Back</Button>
            <Button onClick={handleSubmit} disabled={submitting} className="gap-2 bg-primary">
              {submitting
                ? <><RefreshCw className="h-4 w-4 animate-spin" /> Submitting…</>
                : <><Send className="h-4 w-4" /> Submit Application</>}
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 4: Success ── */}
      {step === 4 && (
        <Card className="text-center p-10 border-success/30 bg-success-soft">
          <CheckCircle className="h-20 w-20 text-success mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-success">Application Submitted!</h2>
          <p className="text-muted-foreground mt-3 max-w-md mx-auto">
            Your Solo Parent ID application has been submitted to the CSWDD office for review.
            You will receive notifications as your application progresses.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Button onClick={() => navigate('/portal/application')} className="gap-2">
              <FileText className="h-4 w-4" /> Track Application
            </Button>
            <Button variant="outline" onClick={() => navigate('/portal/dashboard')}>
              Return to Dashboard
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

