import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api, toastError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import {
  Upload, FileText, Trash2, CheckCircle, RefreshCw, Eye, AlertTriangle,
  ShieldCheck, XCircle, Clock, Replace, FileWarning, Info, AlertCircle, ExternalLink,
  Calendar, ArrowRight, ArrowLeft, Send, RotateCcw
} from 'lucide-react';
import { toast } from 'sonner';
import { DEFAULT_CATEGORIES } from '@/data/soloParentCategories';
import { scrollToAndFocus } from '@/lib/formValidation';
import RequirementUploadField from '@/components/RequirementUploadField';

/* ─── Status badge mapping ─────────────────────────────────────── */
const STATUS_CONFIG = {
  submitted:              { label: 'Submitted',              icon: Clock,        color: 'bg-info-soft text-info' },
  pending:                { label: 'Pending',                icon: Clock,        color: 'bg-warning-soft text-warning' },
  under_review:           { label: 'Under Review',           icon: RefreshCw,    color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300' },
  approved:               { label: 'Approved',               icon: CheckCircle,  color: 'bg-success-soft text-success' },
  verified:               { label: 'Approved',               icon: CheckCircle,  color: 'bg-success-soft text-success' },
  rejected:               { label: 'Rejected',               icon: XCircle,      color: 'bg-danger-soft text-danger' },
  needs_replacement:      { label: 'Replacement Required',   icon: Replace,      color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' },
  replacement_required:   { label: 'Replacement Required',   icon: Replace,      color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' },
  replaced:               { label: 'Replaced',               icon: RefreshCw,    color: 'bg-muted text-muted-foreground' },
};

function DocStatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const Icon = cfg.icon;
  return (
    <Badge variant="outline" className={`capitalize gap-1 ${cfg.color}`}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </Badge>
  );
}

/* ─── File size formatter ──────────────────────────────────────── */
function formatFileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

/* ═══════════════════════════════════════════════════════════════════
   DOCUMENT MANAGER COMPONENT
   ═══════════════════════════════════════════════════════════════════ */
export default function DocumentManager({ 
  embedded = false, 
  onComplete, 
  onBack,
  applicationId: propAppId, 
  documentsApproved: propDocumentsApproved,
  application: propApplication,
  categories: propCategories,
  profile: propProfile
}) {
  const [categories, setCategories] = useState(propCategories || DEFAULT_CATEGORIES);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [soloParentSince, setSoloParentSince] = useState('');
  const [savingSince, setSavingSince] = useState(false);
  const [documentsApproved, setDocumentsApproved] = useState(false);
  const [requirements, setRequirements] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [application, setApplication] = useState(propApplication || null);
  const [profile, setProfile] = useState(propProfile || null);

  const isShortcutApp = ['renewal', 'loss_spic'].includes(application?.application_type);

  const [submittingRequirements, setSubmittingRequirements] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState({});        // { [docType]: true }
  const [uploadProgress, setUploadProgress] = useState({}); // { [docType]: 0-100 }
  const [dragOver, setDragOver] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const fileInputRefs = useRef({});
  const navigate = useNavigate();

  const activeAppId = propAppId || application?.id;
  const isCompleted = ['completed', 'released'].includes(application?.status);
  const isDocsApproved = Boolean((propDocumentsApproved !== undefined ? propDocumentsApproved : documentsApproved) || isCompleted);

  // Smart polling: auto-refresh documents when review is in progress
  useEffect(() => {
    if (!activeAppId) return;
    const shouldPoll = ['submitted', 'under_initial_review', 'documents_under_review', 'document_verification', 'under_review'].includes(application?.status);
    if (!shouldPoll) return;

    let intervalId = null;
    let inFlight = false;
    const POLL_INTERVAL = 8000;

    const silentFetchDocs = async () => {
      if (document.hidden || inFlight) return;
      inFlight = true;
      try {
        const docEndpoint = `/documents/my?application_id=${activeAppId}`;
        const docRes = await api.get(docEndpoint, { cache: false });
        if (docRes.data) {
          setDocuments(docRes.data || []);
        }
      } catch {} finally {
        inFlight = false;
      }
    };

    const start = () => { if (!intervalId) intervalId = setInterval(silentFetchDocs, POLL_INTERVAL); };
    const stop = () => { if (intervalId) { clearInterval(intervalId); intervalId = null; } };
    const onVis = () => { document.hidden ? stop() : (silentFetchDocs(), start()); };

    start();
    document.addEventListener('visibilitychange', onVis);
    return () => { stop(); document.removeEventListener('visibilitychange', onVis); };
  }, [activeAppId, application?.status]);

  /* ── Data fetching ─────────────────────────────────────────── */
  const fetchCategories = async (signal) => {
    if (propCategories && propCategories.length > 0) {
      setCategories(propCategories);
      return;
    }
    try {
      const res = await api.get('/public/categories', { signal });
      let data = res.data;
      if (data && typeof data === 'object' && !Array.isArray(data) && Array.isArray(data.data)) {
        data = data.data;
      }
      if (Array.isArray(data) && data.length > 0 && data[0]?.code) {
        setCategories(data);
      } else {
        setCategories(DEFAULT_CATEGORIES);
      }
    } catch (err) {
      console.warn('Could not load categories from API, using permanent categories:', err);
      setCategories(DEFAULT_CATEGORIES);
    }
  };

  const fetchProfileAndDocs = async (signal) => {
    setLoading(true);
    try {
      // Build an array of promises only for the data we actually need to fetch
      const promises = [];
      
      const profilePromiseIdx = propProfile ? -1 : promises.push(api.get('/profile', { signal })) - 1;
      const appPromiseIdx = propApplication ? -1 : promises.push(api.get('/applications/me', { signal })) - 1;
      const docEndpoint = activeAppId ? `/documents/my?application_id=${activeAppId}` : '/documents/my';
      const docPromiseIdx = promises.push(api.get(docEndpoint, { signal })) - 1;

      const results = await Promise.allSettled(promises);

      let catFound = null;

      // 0. Check URL query parameters
      const urlParams = new URLSearchParams(window.location.search);
      const urlCat = urlParams.get('category');
      const urlSince = urlParams.get('since');
      if (urlCat) {
        catFound = urlCat;
      }
      if (urlSince) {
        setSoloParentSince(urlSince);
        // Persist to profile in background so it's not lost
        api.put('/profile', { solo_parent_since: urlSince }, { signal }).catch(() => {});
      }

      // 1. Check profile response or prop
      const activeProfile = propProfile || (profilePromiseIdx >= 0 && results[profilePromiseIdx].status === 'fulfilled' ? (results[profilePromiseIdx].value.data.data ?? results[profilePromiseIdx].value.data) : null);
      if (activeProfile) {
        setProfile(activeProfile);
        if (activeProfile?.solo_parent_category) {
          catFound = catFound || activeProfile.solo_parent_category;
        }
        if (activeProfile?.solo_parent_since && !urlSince) {
          setSoloParentSince(activeProfile.solo_parent_since);
        }
      }

      // 2. Check active application response or prop
      const activeAppRes = propApplication ? { application: propApplication } : (appPromiseIdx >= 0 && results[appPromiseIdx].status === 'fulfilled' ? results[appPromiseIdx].value.data : null);
      if (activeAppRes) {
        if (activeAppRes.application) {
          const app = activeAppRes.application;
          setApplication(app);
          catFound = catFound || app.category?.code || app.solo_parent_category || null;
          if (app.form?.solo_parent_since && !urlSince) {
            setSoloParentSince(app.form.solo_parent_since);
          } else if (app.solo_parent_since && !urlSince) {
            setSoloParentSince(app.solo_parent_since);
          }
        }
        if (typeof activeAppRes.documents_approved === 'boolean') {
          setDocumentsApproved(activeAppRes.documents_approved);
        }
      }

      if (catFound) {
        setSelectedCategory(catFound.toLowerCase());
      }

      // 3. Set Documents
      if (docPromiseIdx >= 0 && results[docPromiseIdx].status === 'fulfilled') {
        setDocuments(results[docPromiseIdx].value?.data || []);
      }
    } catch (err) {
      toastError(err, 'Could not load your documents.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchCategories(controller.signal);
    fetchProfileAndDocs(controller.signal);
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (selectedCategory && categories.length > 0) {
      const normalized = selectedCategory.toLowerCase();
      const cat = categories.find(c => c.code?.toLowerCase() === normalized);
      if (cat) {
        setRequirements(cat.requirements || []);
      }
    }
  }, [selectedCategory, categories]);

  // Auto-scroll and highlight target document requirement if ?focusReq= is provided in URL
  useEffect(() => {
    const focusReq = new URLSearchParams(window.location.search).get('focusReq');
    if (!focusReq || loading || requirements.length === 0) return;

    const timer = setTimeout(() => {
      const el = document.getElementById(`doc-manager-req-${focusReq}`) || 
                 document.querySelector(`[data-req-id="${focusReq}"]`) ||
                 document.getElementById(focusReq);
      if (el) {
        scrollToAndFocus(el, { delay: 200, block: 'center' });
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [loading, requirements]);

  /* ── Solo parent since change ──────────────────────────────── */
  const handleSoloParentSinceChange = async (val) => {
    setSoloParentSince(val);
    setSavingSince(true);
    try {
      await api.put('/profile', { solo_parent_since: val });
    } catch (err) {
      console.error('Failed to save solo parent since:', err);
    } finally {
      setSavingSince(false);
    }
  };

  /* ── Category change ───────────────────────────────────────── */
  const handleCategoryChange = async (val) => {
    const lowerVal = val.toLowerCase();
    setSelectedCategory(lowerVal);
    try {
      await api.put('/profile', { solo_parent_category: lowerVal });
      toast.success('Category preference updated.');
    } catch (err) {
      toastError(err, 'Could not save category preference.');
    }
  };

  /* ── Upload handler (supports array of files or single file) ── */
  const handleUpload = useCallback(async (filesOrFile, docType, reqConfig) => {
    if (!filesOrFile) return;
    const filesArray = Array.isArray(filesOrFile) ? filesOrFile : [filesOrFile];
    if (filesArray.length === 0) return;

    let currentAppId = activeAppId;
    if (!currentAppId) {
      try {
        const appRes = await api.post('/applications', { category: selectedCategory });
        currentAppId = appRes.data?.id;
        setApplication(appRes.data);
      } catch (err) {
        toast.error('You must start an application before uploading documents.');
        return;
      }
    }

    setUploading(prev => ({ ...prev, [docType]: true }));
    setUploadProgress(prev => ({ ...prev, [docType]: 0 }));

    const formData = new FormData();
    filesArray.forEach(f => {
      formData.append('files[]', f);
    });
    formData.append('file', filesArray[0]);
    formData.append('doc_type', docType);
    formData.append('application_id', currentAppId);
    if (reqConfig?.name) {
      formData.append('label', reqConfig.name);
      formData.append('requirement_name', reqConfig.name);
    }
    if (reqConfig?.id) {
      formData.append('requirement_id', reqConfig.id);
    }
    const idxMatch = docType.match(/_(\d+)$/);
    if (idxMatch) {
      formData.append('requirement_index', idxMatch[1]);
    }

    try {
      const res = await api.post('/documents/upload', formData, {
        onUploadProgress: (progressEvent) => {
          const pct = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 1));
          setUploadProgress(prev => ({ ...prev, [docType]: pct }));
        },
      });

      const newDocs = res.data?.documents || (Array.isArray(res.data) ? res.data : [res.data]);

      // Retain existing uploaded attachments, add newly uploaded attachments
      setDocuments(prev => {
        const newDocIds = new Set(newDocs.map(d => d.id));
        const filtered = prev.filter(d => !newDocIds.has(d.id));
        return [...filtered, ...newDocs];
      });

      setShowErrors(false);
      toast.success(
        newDocs.length > 1
          ? `${newDocs.length} attachments uploaded successfully!`
          : 'Document uploaded successfully!'
      );
    } catch (err) {
      toastError(err, 'Failed to upload document(s).');
      throw err;
    } finally {
      setUploading(prev => ({ ...prev, [docType]: false }));
      setUploadProgress(prev => ({ ...prev, [docType]: 0 }));
      setDragOver(null);
    }
  }, [activeAppId, selectedCategory]);

  /* ── Replace handler ───────────────────────────────────────── */
  const handleReplace = useCallback(async (file, docId, docType) => {
    if (!file) return;

    const currentAppId = activeAppId;
    if (!currentAppId) {
      toast.error('You must start an application before uploading documents.');
      return;
    }

    setUploading(prev => ({ ...prev, [docType]: true }));
    setUploadProgress(prev => ({ ...prev, [docType]: 0 }));

    const formData = new FormData();
    formData.append('file', file);
    formData.append('application_id', currentAppId);

    try {
      const res = await api.post(`/documents/${docId}/replace`, formData, {
        onUploadProgress: (progressEvent) => {
          const pct = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 1));
          setUploadProgress(prev => ({ ...prev, [docType]: pct }));
        },
      });
      // Replace old doc in state
      setDocuments(prev => {
        const updated = prev.map(d => d.id === docId ? { ...d, verification_status: 'replaced' } : d);
        return [...updated, res.data];
      });
      setShowErrors(false);
      toast.success('Document replaced successfully!');
    } catch (err) {
      toastError(err, 'Failed to replace document.');
      throw err;
    } finally {
      setUploading(prev => ({ ...prev, [docType]: false }));
      setUploadProgress(prev => ({ ...prev, [docType]: 0 }));
    }
  }, [activeAppId]);

  /* ── Delete handler ────────────────────────────────────────── */
  const handleDeleteDoc = useCallback(async (docId) => {
    if (!docId) return;
    try {
      await api.delete(`/documents/${docId}`);
      setDocuments(prev => prev.filter(d => d.id !== docId));
      toast.success('Attachment removed.');
    } catch (err) {
      toastError(err, 'Failed to remove document.');
      throw err;
    }
  }, []);

  /* ── Submit Requirements for Admin Review ──────────────────── */
  const handleSubmitRequirements = async () => {
    if (!isShortcutApp && !soloParentSince) {
      toast.error('Please enter the date you became a solo parent before submitting.');
      const el = document.getElementById('solo_parent_since');
      if (el) scrollToAndFocus(el);
      return;
    }

    const missing = requirements
      .map((r, idx) => {
        const docKey = `req_${selectedCategory}_${idx}`;
        const hasDoc = documents.some(
          d => (d.requirement_id === r.id || d.doc_type === docKey) &&
               !['replaced', 'rejected'].includes(d.verification_status)
        );
        return { r, idx, docKey, hasDoc };
      })
      .filter(item => item.r.is_required !== false && !item.hasDoc);

    if (missing.length > 0) {
      setShowErrors(true);
      toast.error(`Please upload all required documents (${missing.length} missing).`);
      scrollToAndFocus(`doc-manager-req-${missing[0].idx}`);
      return;
    }

    const currentAppId = activeAppId;
    if (!currentAppId) {
      toast.error('No active application found. Please refresh the page.');
      return;
    }

    setSubmittingRequirements(true);
    try {
      const payload = { category: selectedCategory };
      if (!isShortcutApp) {
        payload.solo_parent_since = soloParentSince;
      }
      const res = await api.post(`/applications/${currentAppId}/submit-requirements`, payload);
      toast.success(res.data?.message || 'Requirements submitted for CSWDD review!');
      await fetchProfileAndDocs();
    } catch (err) {
      toastError(err, 'Failed to submit requirements for review.');
    } finally {
      setSubmittingRequirements(false);
    }
  };

  /* ── Proceed handler with validation ───────────────────────── */
  const handleProceed = async () => {
    if (!selectedCategory) {
      toast.error('Please select your Solo Parent category before proceeding.');
      return;
    }

    if (!isShortcutApp && !soloParentSince) {
      toast.error('Please enter the date you became a solo parent before proceeding.');
      const el = document.getElementById('solo_parent_since');
      if (el) scrollToAndFocus(el);
      return;
    }

    const missing = requirements
      .map((r, idx) => {
        const docKey = `req_${selectedCategory}_${idx}`;
        const hasDoc = documents.some(
          d => (d.requirement_id === r.id || d.doc_type === docKey) &&
               !['replaced', 'rejected'].includes(d.verification_status)
        );
        return { r, idx, docKey, hasDoc };
      })
      .filter(item => item.r.is_required !== false && !item.hasDoc);

    if (missing.length > 0) {
      setShowErrors(true);
      toast.error(`Please upload all required documents (${missing.length} missing) before proceeding to the Application Form.`);
      scrollToAndFocus(`doc-manager-req-${missing[0].idx}`);
      return;
    }

    setShowErrors(false);
    // Persist category and solo_parent_since
    try {
      await api.put('/profile', {
        solo_parent_category: selectedCategory,
        solo_parent_since: soloParentSince,
      });
    } catch {}

    toast.success('Documentary requirements saved! Proceeding to Application Form.');
    if (onComplete) {
      onComplete();
    } else {
      navigate('/portal/my-application?step=form');
    }
  };

  /* ── Delete dialog handler (legacy fallback) ────────────────── */
  const handleDelete = async () => {
    if (!deleteDialog) return;
    setDeleting(true);
    try {
      await api.delete(`/documents/${deleteDialog.id}`);
      setDocuments(prev => prev.filter(d => d.id !== deleteDialog.id));
      toast.success('Document removed.');
      setDeleteDialog(null);
    } catch (err) {
      toastError(err, 'Failed to remove document.');
    } finally {
      setDeleting(false);
    }
  };

  /* ── Preview handler (redirects to a new tab) ─────────────────── */
  const handlePreview = async (docOrId) => {
    const docId = typeof docOrId === 'object' && docOrId !== null ? docOrId.id : docOrId;
    if (!docId) return;

    // Immediately open window reference during user gesture to avoid popup blocker
    const newTab = window.open('about:blank', '_blank');

    try {
      const res = await api.get(`/documents/${docId}/view`);
      const fileUrl = res.data?.url || res.data?.preview_url;
      if (fileUrl) {
        if (newTab) {
          newTab.location.href = fileUrl;
        } else {
          window.open(fileUrl, '_blank', 'noopener,noreferrer');
        }
      } else {
        if (newTab) newTab.close();
        throw new Error('No preview URL available');
      }
    } catch (err) {
      if (newTab) newTab.close();
      toastError(err, 'Could not preview document. Please try again.');
    }
  };

  /* ── Derived data ──────────────────────────────────────────── */
  // Active (non-replaced) docs for the current category
  const curCat = selectedCategory ? selectedCategory.toLowerCase() : '';
  const activeDocs = documents.filter(d => d.verification_status !== 'replaced');
  const catDocs = activeDocs.filter(d => d.doc_type?.toLowerCase().startsWith(`req_${curCat}_`));

  // Obsolete docs from a different category
  const obsoleteDocs = curCat ? activeDocs.filter(d => {
    if (!d.doc_type?.startsWith('req_')) return false;
    if (d.doc_type.startsWith('req_additional_') || d.doc_type.startsWith('req_lost_')) return false;
    return !d.doc_type.toLowerCase().startsWith(`req_${curCat}_`);
  }) : [];

  // Summary counts
  const totalRequired = requirements.filter(r => (typeof r === 'string') || r.is_required !== false).length;
  // Fulfilled count is the number of required requirements that have at least 1 active document
  const fulfilledRequiredCount = requirements.filter((r, idx) => {
    const docKey = `req_${curCat}_${idx}`;
    return ((typeof r === 'string') || r.is_required !== false) &&
      catDocs.some(d => d.requirement_id === r.id || d.doc_type?.toLowerCase() === docKey.toLowerCase());
  }).length;
  const submittedCount = fulfilledRequiredCount;
  const totalAttachments = catDocs.length;
  const approvedCount = catDocs.filter(d => ['approved', 'verified'].includes(d.verification_status)).length;
  const rejectedCount = catDocs.filter(d => ['rejected', 'needs_replacement', 'replacement_required'].includes(d.verification_status)).length;
  const pendingCount = catDocs.filter(d => ['submitted', 'pending', 'under_review'].includes(d.verification_status)).length;

  /* ── Loading state ─────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 flex justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={embedded ? 'space-y-4 sm:space-y-6 w-full max-w-full overflow-x-hidden min-w-0' : 'container mx-auto px-2.5 sm:px-6 lg:px-8 py-5 sm:py-8 max-w-5xl space-y-5 sm:space-y-8 w-full max-w-full overflow-x-hidden min-w-0'}>
      {/* Header — hidden when embedded */}
      {!embedded && (
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Documentary Requirements</h1>
        <p className="text-muted-foreground mt-2 text-xs sm:text-base">
          Select your solo parent category to see exactly which documents you need to submit. Upload clear copies in PDF or image format (max 20MB each).
        </p>
      </div>
      )}

      {/* Step 1: Category Selection & Solo Parent Details (Hidden for Renewal/Loss of SPIC) */}
      {!isShortcutApp && (
        <div className="card-pop rounded-3xl p-4 sm:p-7">
          <div className="pb-3 sm:pb-4 mb-3 sm:mb-4 border-b border-border/60">
            <h3 className="font-bold text-base sm:text-lg text-foreground font-display">1. Category & Solo Parent Details</h3>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">Please specify when you became a solo parent and choose your qualifying category.</p>
          </div>
          <div className="space-y-4 sm:space-y-5">
            {/* Solo parent since input field */}
            <div className="space-y-2 max-w-xl">
              <div className="flex items-center justify-between">
                <Label htmlFor="solo_parent_since" className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-primary" />
                  Solo parent since <span className="text-destructive">*</span>
                </Label>
                {savingSince && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <RefreshCw className="h-3 w-3 animate-spin text-primary" /> Auto-saving...
                  </span>
                )}
              </div>
              <Input
                id="solo_parent_since"
                type="date"
                value={soloParentSince || ''}
                onChange={(e) => handleSoloParentSinceChange(e.target.value)}
                className="max-w-md h-11 bg-background rounded-xl border-border/80"
              />
              <p className="text-xs text-muted-foreground">
                Indicate when you officially or practically became a solo parent under RA 11861.
              </p>
            </div>

            {/* Category selection */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground">
                Solo Parent Category <span className="text-destructive">*</span>
              </Label>
              <Select value={selectedCategory} onValueChange={handleCategoryChange}>
                <SelectTrigger className="max-w-2xl h-11 bg-background rounded-xl border-border/80" data-testid="category-select">
                  <SelectValue placeholder="Select the category that applies to you" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(c => (
                    <SelectItem key={c.code} value={c.code.toLowerCase()}>
                      {c.code.toUpperCase()} — {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedCategory && (
                <p className="text-xs text-muted-foreground leading-relaxed bg-muted/40 p-3 rounded-xl border border-border/50 max-w-2xl">
                  {categories.find(c => c.code?.toLowerCase() === selectedCategory.toLowerCase())?.description}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Obsolete docs warning */}
      {obsoleteDocs.length > 0 && (
        <Card className="border-warning/30 bg-warning-soft">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
            <div className="flex-1 space-y-2">
              <div>
                <h3 className="font-semibold text-warning">Category Changed! Obsolete Documents Found.</h3>
                <p className="text-sm text-warning mt-1">
                  You previously uploaded documents for a different category. They are no longer required for your current category. You can safely delete them.
                </p>
              </div>
              <div className="grid gap-2">
                {obsoleteDocs.map(doc => (
                  <div key={doc.id} className="flex items-center justify-between bg-white dark:bg-background border border-warning/30 rounded p-2 text-sm">
                    <span className="truncate mr-4">{doc.label || doc.original_filename}</span>
                    <Button size="sm" variant="destructive" onClick={() => setDeleteDialog(doc)} className="h-7 px-2 text-xs">Delete</Button>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Requirements + Upload */}
      {selectedCategory ? (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2 break-words leading-tight">
              {!isShortcutApp ? '2. ' : ''}Required Documents for {selectedCategory.toUpperCase()} — {categories.find(c => c.code?.toLowerCase() === selectedCategory.toLowerCase())?.name || ''}
            </h2>
            {totalRequired > 0 && (
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm">
                <span className="font-semibold px-2.5 py-1 rounded-lg bg-muted/60">{submittedCount}/{totalRequired} uploaded</span>
                <span className="text-success font-semibold px-2.5 py-1 rounded-lg bg-emerald-500/10 dark:bg-emerald-500/20">{approvedCount} approved</span>
                {pendingCount > 0 && <span className="text-info font-semibold px-2.5 py-1 rounded-lg bg-sky-500/10 dark:bg-sky-500/20">{pendingCount} pending</span>}
                {rejectedCount > 0 && <span className="text-danger font-semibold px-2.5 py-1 rounded-lg bg-rose-500/10 dark:bg-rose-500/20">{rejectedCount} rejected</span>}
              </div>
            )}
          </div>

          {/* Progress bar */}
          {totalRequired > 0 && (
            <Progress value={(submittedCount / totalRequired) * 100} className="h-2" />
          )}

          <div className="grid gap-4">
            {requirements.map((req, idx) => {
              const isString = typeof req === 'string';
              const r = isString ? {
                name: req, description: '', is_required: true,
                formats: ['.pdf', '.jpg', '.jpeg', '.png', '.docx'], max_size_mb: 20, instructions: '',
              } : { ...req, max_size_mb: req.max_size_mb || 20 };

              const docKey = `req_${selectedCategory.toLowerCase()}_${idx}`;
              const reqDocs = activeDocs.filter(d => d.requirement_id === r.id || d.doc_type?.toLowerCase() === docKey.toLowerCase());
              const isMissingRequired = showErrors && (r.is_required !== false) && reqDocs.length === 0;

              return (
                <RequirementUploadField
                  key={r.id || idx}
                  requirement={{ ...r, index: idx }}
                  docKey={docKey}
                  existingDocuments={reqDocs}
                  disabled={isDocsApproved}
                  isUploading={uploading[docKey]}
                  uploadProgress={uploadProgress[docKey] || 0}
                  onUpload={handleUpload}
                  onReplace={handleReplace}
                  onDelete={handleDeleteDoc}
                  onPreview={handlePreview}
                  error={isMissingRequired ? 'This document is required (*). Please upload at least one file.' : null}
                />
              );
            })}
          </div>
        </div>
      ) : (
        <div className="text-center py-12 bg-muted/20 border-2 border-dashed rounded-xl">
          <p className="text-muted-foreground font-medium">Please select a category above to view your requirements.</p>
        </div>
      )}

      {/* Additional / Uncategorized Documents */}
      {activeDocs.filter(d => !d.doc_type?.startsWith('req_')).length > 0 && (
        <div className="space-y-4 pt-8">
          <h2 className="text-lg font-semibold">Additional / Supporting Documents</h2>
          {activeDocs.filter(d => !d.doc_type?.startsWith('req_')).map(doc => (
            <Card key={doc.id}>
              <CardContent className="flex items-center justify-between py-4 px-5 gap-4 flex-wrap">
                <div className="flex items-center gap-3 flex-1">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-sm">{doc.label || doc.original_filename || 'Document'}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <DocStatusBadge status={doc.verification_status || doc.status || 'pending'} />
                      <span className="text-xs text-muted-foreground">{formatFileSize(doc.file_size)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 items-center">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handlePreview(doc)}
                    className="h-8 px-3 rounded-xl gap-1.5 text-xs font-semibold bg-background hover:bg-primary hover:text-primary-foreground border-border/80 shadow-2xs transition-all group"
                    title="Preview document in a new tab"
                  >
                    <Eye className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary-foreground transition-colors" />
                    <span>Preview Document</span>
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-xl text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteDialog(doc)} title="Delete document">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Upload Additional */}
      {!isCompleted && !isDocsApproved && (
        <Card className="border-dashed bg-transparent">
          <CardContent className="flex items-center justify-center py-8">
            <label className="flex flex-col items-center gap-3 cursor-pointer text-muted-foreground hover:text-primary transition-colors">
              <Upload className="h-8 w-8" />
              <span className="text-sm font-medium">Upload Additional Supporting Document</span>
              <input
                type="file"
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,image/jpeg,image/png"
                onChange={e => {
                  if (e.target.files[0]) {
                    const type = 'other_' + Date.now();
                    handleUpload(e.target.files[0], type, { name: 'Additional Document', formats: ['.pdf', '.jpg', '.jpeg', '.png', '.docx'], max_size_mb: 20 });
                  }
                }}
              />
            </label>
          </CardContent>
        </Card>
      )}

      {/* Rejection Notice Banner */}
      {application?.status === 'rejected' && (
        <Card className="border-2 border-destructive/50 bg-rose-50/50 dark:bg-rose-950/20 shadow-sm">
          <CardContent className="py-5 px-6">
            <div className="flex items-start gap-3.5">
              <div className="h-10 w-10 rounded-2xl bg-destructive text-destructive-foreground flex items-center justify-center shrink-0 shadow-xs">
                <XCircle className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-base text-destructive">Application Not Qualified / Rejected</h3>
                  <Badge variant="destructive" className="text-xs">Action Required</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Your documentary requirements were reviewed by the CSWDD Administrator and did not meet qualification criteria.
                </p>
                {application?.status_reason && (
                  <div className="mt-3 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-xs">
                    <p className="font-bold text-destructive">Reason provided by CSWDD Administrator:</p>
                    <p className="text-foreground mt-0.5 whitespace-pre-wrap">{application.status_reason}</p>
                  </div>
                )}
                <div className="mt-4 flex items-center gap-3 flex-wrap">
                  <Button
                    size="sm"
                    onClick={async () => {
                      try {
                        await api.post(`/applications/${application.id}/reapply`);
                        toast.success('Application reopened! You can now update your requirements.');
                        await fetchProfileAndDocs();
                      } catch (err) {
                        toastError(err, 'Failed to reopen application.');
                      }
                    }}
                    className="rounded-xl bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold text-xs gap-1.5"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Re-apply / Update Requirements
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      try {
                        const res = await api.post('/applications', { category: selectedCategory });
                        setApplication(res.data);
                        toast.success('New application draft started. Please review your requirements.');
                        await fetchProfileAndDocs();
                      } catch (err) {
                        toastError(err, 'Failed to start new application.');
                      }
                    }}
                    className="rounded-xl font-semibold text-xs border-border"
                  >
                    Start New Application
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Document Completion Summary */}
      {selectedCategory && totalRequired > 0 && (
        <Card className={`border-2 ${
          submittedCount >= totalRequired
            ? isDocsApproved
              ? 'border-success/40 bg-success-soft'
              : application?.status === 'draft'
                ? 'border-primary/40 bg-primary/5'
                : 'border-amber-500/40 bg-amber-50 dark:bg-amber-950/20'
            : 'border-border'
        }`}>
          <CardContent className="py-4 px-3.5 sm:py-6 sm:px-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${
                  submittedCount >= totalRequired
                    ? isDocsApproved 
                      ? 'bg-success/20 text-success' 
                      : application?.status === 'draft'
                        ? 'bg-primary/20 text-primary'
                        : 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {submittedCount >= totalRequired ? (
                    isDocsApproved ? (
                      <CheckCircle className="h-5 w-5 text-success" />
                    ) : application?.status === 'draft' ? (
                      <Send className="h-5 w-5 text-primary" />
                    ) : (
                      <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400 animate-pulse" />
                    )
                  ) : (
                    <FileWarning className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-sm">
                    {submittedCount >= totalRequired
                      ? isDocsApproved
                        ? 'All Required Documents Reviewed & Approved! ✓'
                        : application?.status === 'draft'
                          ? 'All Requirements Uploaded — Ready for CSWDD Review'
                          : 'Requirements Submitted — Waiting for Admin Review'
                      : `${totalRequired - submittedCount} Required Document(s) Remaining`}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5 max-w-xl">
                    {submittedCount >= totalRequired
                      ? 'All required documents uploaded! Click "Next Step" to proceed to the Solo Parent Application Form.'
                      : 'Please upload all required documents above before clicking Next Step.'}
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto shrink-0">
                {onBack && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onBack}
                    className="flex-1 sm:flex-none justify-center gap-2 shrink-0 rounded-2xl font-bold h-11 px-4 border-border shadow-2xs touch-manipulation"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </Button>
                )}
                {!isCompleted && (
                  <Button
                    type="button"
                    onClick={handleProceed}
                    disabled={submittingRequirements}
                    className="flex-1 sm:flex-none justify-center bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-md gap-2 shrink-0 rounded-2xl h-11 px-6 transition-all duration-200 cursor-pointer touch-manipulation"
                    id="next-step-btn"
                  >
                    <span>Next Step</span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <DialogContent className="w-[95vw] sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Delete Document?</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deleteDialog?.label || deleteDialog?.original_filename}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteDialog(null)} disabled={deleting} className="w-full sm:w-auto">Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting} className="w-full sm:w-auto">
              {deleting ? <><RefreshCw className="h-4 w-4 animate-spin mr-2" /> Deleting...</> : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

