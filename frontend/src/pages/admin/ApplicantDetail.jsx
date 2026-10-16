import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api, toastError, previewDocumentBlob } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Download, ChevronRight, AlertTriangle, User, Clock,
  Upload, MapPin, Users, Heart, Phone, Shield, Pencil, Printer, Baby, RotateCcw, CreditCard,
} from 'lucide-react';

/* ─── Workflow configuration ─────────────────────────────────── */
const WORKFLOW = [
  { from: 'draft',                          to: 'submitted',                      label: 'Mark as Submitted',          variant: 'default' },
  { from: 'submitted',                      to: 'under_initial_review',           label: 'Start Initial Review',       variant: 'default' },
  { from: 'under_initial_review',           to: 'document_verification',          label: 'Move to Doc Verification',   variant: 'default' },
  { from: 'under_initial_review',           to: 'pending_additional_requirements',label: 'Request Additional Docs',    variant: 'outline' },
  { from: 'document_verification',          to: 'under_final_assessment',         label: 'Move to Final Assessment',   variant: 'default' },
  { from: 'document_verification',          to: 'pending_additional_requirements',label: 'Request Additional Docs',    variant: 'outline' },
  { from: 'pending_additional_requirements',to: 'document_verification',          label: 'Resume Verification',        variant: 'default' },
  { from: 'under_final_assessment',         to: 'under_final_verification',       label: 'Move to Final Verification', variant: 'default' },
  { from: 'under_final_assessment',         to: 'rejected',                       label: 'Reject Application',         variant: 'destructive' },
  { from: 'under_final_verification',       to: 'approved',                       label: 'Approve Application',        variant: 'default' },
  { from: 'under_final_verification',       to: 'rejected',                       label: 'Reject Application',         variant: 'destructive' },
  { from: 'approved',                       to: 'ready_for_printing',             label: 'Mark Ready for Printing',    variant: 'default' },
  { from: 'ready_for_printing',             to: 'ready_for_release',              label: 'Mark Ready for Release',     variant: 'default' },
  { from: 'ready_for_release',              to: 'released',                       label: 'Mark as Released',           variant: 'default' },
  { from: 'released',                       to: 'expired',                        label: 'Mark as Expired',            variant: 'outline' },
];

const STATUS_LABELS = {
  draft: 'Draft', submitted: 'Submitted',
  under_initial_review: 'Under Initial Review', document_verification: 'Document Verification',
  pending_additional_requirements: 'Pending Additional Requirements',
  under_final_assessment: 'Under Final Assessment', under_final_verification: 'Under Final Verification',
  approved: 'Approved', ready_for_printing: 'Ready for Printing',
  ready_for_release: 'Ready for Release', released: 'Released',
  rejected: 'Rejected', expired: 'Expired',
};

const STATUS_COLOR = {
  draft: 'bg-muted/50 text-foreground', submitted: 'bg-info-soft text-info',
  under_initial_review: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  document_verification: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  pending_additional_requirements: 'bg-warning-soft text-warning',
  under_final_assessment: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
  under_final_verification: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  approved: 'bg-success-soft text-success', ready_for_printing: 'bg-green-100 text-success dark:bg-green-900/40',
  ready_for_release: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  released: 'bg-green-200 text-success dark:bg-green-900/60', rejected: 'bg-danger-soft text-danger',
  expired: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
};

const DOC_STATUS_CONFIG = {
  submitted: { label: 'Submitted', color: 'bg-info-soft text-info' },
  pending: { label: 'Pending', color: 'bg-warning-soft text-warning' },
  under_review: { label: 'Under Review', color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300' },
  approved: { label: 'Approved', color: 'bg-success-soft text-success' },
  verified: { label: 'Approved', color: 'bg-success-soft text-success' },
  rejected: { label: 'Rejected', color: 'bg-danger-soft text-danger' },
  needs_replacement: { label: 'Needs Replacement', color: 'bg-warning-soft text-warning' },
  replacement_required: { label: 'Needs Replacement', color: 'bg-warning-soft text-warning' },
  replaced: { label: 'Replaced', color: 'bg-muted text-muted-foreground' },
};

function StatusPill({ status }) {
  const color = STATUS_COLOR[status] || 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${color}`}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}

function ProfileRow({ label, value }) {
  if (!value && value !== 0) return null;
  return (
    <div className="space-y-0.5">
      <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">{label}</p>
      <p className="text-sm font-medium break-words">{String(value)}</p>
    </div>
  );
}

export default function ApplicantDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [application, setApplication] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [notes, setNotes] = useState('');
  const [updating, setUpdating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [officialFields, setOfficialFields] = useState({});
  const [savingOfficial, setSavingOfficial] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  // Document review dialog state
  const [docDialog, setDocDialog] = useState(null);
  const [docStatus, setDocStatus] = useState('verified');
  const [docRemark, setDocRemark] = useState('');
  const [savingDoc, setSavingDoc] = useState(false);
  const [approvingAllDocs, setApprovingAllDocs] = useState(false);

  const handleApproveAllDocs = async () => {
    if (!application?.id) return;
    setApprovingAllDocs(true);
    try {
      const res = await api.post(`/admin/applications/${application.id}/documents/approve-all`);
      toast.success(res.data?.message || 'All documents approved successfully.');
      await loadData();
    } catch (err) {
      toastError(err, 'Failed to approve all documents.');
    } finally {
      setApprovingAllDocs(false);
    }
  };

  const loadAll = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/admin/applications/${id}`);
      const data = res.data;
      const app = {
        ...(data.application || data),
        user: data.applicant || data.user || null,
        profile: data.profile || null,
        status_history: (data.history || data.status_history || []).map(h => ({
          ...h, status: h.to_status || h.status,
        })),
      };
      setApplication(app);
      setDocuments(data.documents || []);
      setOfficialFields({
        case_number: app.case_number || '',
        beneficiary_code: app.beneficiary_code || '',
        solo_parent_category: app.solo_parent_category || app.profile?.solo_parent_category || '',
        date_issued: app.date_issued || '',
        assigned_personnel: app.assigned_personnel || '',
        id_card_number: app.id_card_number || '',
      });
    } catch (err) {
      toastError(err, 'Failed to load application details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, [id]);

  const handleTransition = async (toStatus) => {
    setUpdating(true);
    try {
      await api.patch(`/admin/applications/${id}/status`, { status: toStatus, note: notes });
      toast.success(`Status updated to: ${STATUS_LABELS[toStatus]}`);
      setNotes('');
      await loadAll();
    } catch (err) {
      toastError(err, 'Failed to update status.');
    } finally {
      setUpdating(false);
    }
  };

  const handleSaveOfficial = async () => {
    setSavingOfficial(true);
    try {
      await api.patch(`/admin/applications/${id}/official-fields`, officialFields);
      toast.success('Official fields saved!');
      await loadAll();
    } catch (err) {
      toastError(err, 'Failed to save official fields.');
    } finally {
      setSavingOfficial(false);
    }
  };

  const handleVerifyDoc = async () => {
    if (!docDialog) return;
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
      toast.success(`Document marked as: ${docStatus}`);
      setDocDialog(null);
      setDocRemark('');
    } catch (err) {
      toastError(err, 'Could not update document status.');
    } finally {
      setSavingDoc(false);
    }
  };

  const handlePreviewDoc = async (docId) => {
    const newTab = window.open('about:blank', '_blank');
    try {
      await previewDocumentBlob(docId, { isAdmin: true, newTab });
    } catch (err) {
      toastError(err, 'Could not preview document.');
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!application) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <AlertTriangle className="h-10 w-10 text-warning mx-auto mb-3" />
          <p className="font-semibold">Application not found</p>
          <Button asChild variant="outline" className="mt-4"><Link to="/admin/applicants">← Back</Link></Button>
        </div>
      </div>
    );
  }

  const profile = application.profile || {};
  const user = application.user || {};
  const availableTransitions = WORKFLOW.filter(w => w.from === application.status);
  const activeDocs = documents.filter(d => d.verification_status !== 'replaced');

  return (
    <div className="flex-1 px-3 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-4 sm:space-y-6 w-full max-w-full overflow-x-hidden min-w-0">

      {/* ── Back + Header ──────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0" onClick={() => navigate('/admin/applicants')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground truncate">
              {[profile.first_name, profile.middle_name, profile.last_name].filter(Boolean).join(' ') || user.full_name || 'Unknown Applicant'}
            </h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-xs sm:text-sm text-muted-foreground font-mono font-medium">{application.reference_no}</span>
              <StatusPill status={application.status} />
              {application.is_renewal && <Badge variant="outline" className="text-xs font-semibold px-2 py-0.5">Renewal</Badge>}
            </div>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={loadAll} className="min-h-[40px] self-end sm:self-auto">
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh
        </Button>
      </div>

      {/* ── Tabs ───────────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 sm:space-y-6">
        <div className="overflow-x-auto pb-1 scrollbar-none">
          <TabsList className="bg-muted/50 inline-flex w-auto min-w-full sm:min-w-0 justify-start sm:justify-center p-1">
            <TabsTrigger value="overview" className="gap-1.5 min-h-[36px] text-xs sm:text-sm whitespace-nowrap"><Eye className="h-3.5 w-3.5" /> Overview</TabsTrigger>
            <TabsTrigger value="profile" className="gap-1.5 min-h-[36px] text-xs sm:text-sm whitespace-nowrap"><User className="h-3.5 w-3.5" /> Profile & Form</TabsTrigger>
            <TabsTrigger value="documents" className="gap-1.5 min-h-[36px] text-xs sm:text-sm whitespace-nowrap"><Upload className="h-3.5 w-3.5" /> Documents</TabsTrigger>
            <TabsTrigger value="status" className="gap-1.5 min-h-[36px] text-xs sm:text-sm whitespace-nowrap"><Clock className="h-3.5 w-3.5" /> Status & Actions</TabsTrigger>
          </TabsList>
        </div>

        {/* ── TAB: Overview ─────────────────────────────────── */}
        <TabsContent value="overview" className="space-y-4 sm:space-y-6">
          <div className="grid md:grid-cols-2 gap-4 sm:gap-6">
            {/* Applicant Info */}
            <Card className="border shadow-xs">
              <CardHeader className="pb-3 border-b"><CardTitle className="text-base flex items-center gap-2"><User className="h-4 w-4 text-primary" /> Applicant Information</CardTitle></CardHeader>
              <CardContent className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <ProfileRow label="Full Name" value={[profile.first_name, profile.middle_name, profile.last_name].filter(Boolean).join(' ')} />
                <ProfileRow label="Email" value={user.email} />
                <ProfileRow label="Contact" value={profile.contact_number} />
                <ProfileRow label="Sex" value={profile.sex} />
                <ProfileRow label="Birth Date" value={profile.birth_date} />
                <ProfileRow label="Civil Status" value={profile.civil_status} />
                <ProfileRow label="Barangay" value={profile.barangay} />
                <ProfileRow label="City" value={profile.city_municipality} />
              </CardContent>
            </Card>

            {/* Application Info */}
            <Card className="border shadow-xs">
              <CardHeader className="pb-3 border-b"><CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> Application Details</CardTitle></CardHeader>
              <CardContent className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <ProfileRow label="Reference No." value={application.reference_no} />
                <ProfileRow label="Type" value={application.is_renewal ? 'Renewal' : 'New Application'} />
                <ProfileRow label="Category" value={application.solo_parent_category || profile.solo_parent_category} />
                <ProfileRow label="Status" value={STATUS_LABELS[application.status]} />
                <ProfileRow label="Submitted" value={application.submitted_at ? format(new Date(application.submitted_at), 'MMM d, yyyy h:mm a') : '—'} />
                <ProfileRow label="Case Number" value={application.case_number} />
                <ProfileRow label="ID Card Number" value={application.id_card_number} />
                <ProfileRow label="Assigned To" value={application.assigned_personnel} />
              </CardContent>
            </Card>
          </div>

          {/* Quick Status Actions */}
          {availableTransitions.length > 0 && (
            <Card className="border shadow-xs">
              <CardHeader className="pb-3 border-b"><CardTitle className="text-base">Quick Actions</CardTitle></CardHeader>
              <CardContent className="pt-4 space-y-3">
                <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Add notes for this status change (optional)…" rows={2} className="text-xs sm:text-sm" />
                <div className="flex flex-wrap gap-2">
                  {availableTransitions.map(t => (
                    <Button key={t.to} variant={t.variant} size="sm" disabled={updating} onClick={() => handleTransition(t.to)} className="gap-1.5 min-h-[40px] px-3.5 flex-1 sm:flex-initial">
                      {t.to === 'rejected' && <XCircle className="h-3.5 w-3.5" />}
                      {t.to === 'approved' && <CheckCircle className="h-3.5 w-3.5" />}
                      {t.label}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Documents Summary */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-base flex items-center gap-2"><Upload className="h-4 w-4 text-primary" /> Documents Summary</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid grid-cols-4 gap-4 text-center">
                <div><p className="text-2xl font-bold">{activeDocs.length}</p><p className="text-xs text-muted-foreground">Total</p></div>
                <div><p className="text-2xl font-bold text-success">{activeDocs.filter(d => ['approved', 'verified'].includes(d.verification_status)).length}</p><p className="text-xs text-muted-foreground">Approved</p></div>
                <div><p className="text-2xl font-bold text-warning">{activeDocs.filter(d => ['pending', 'submitted', 'under_review'].includes(d.verification_status)).length}</p><p className="text-xs text-muted-foreground">Pending</p></div>
                <div><p className="text-2xl font-bold text-danger">{activeDocs.filter(d => ['rejected', 'needs_replacement'].includes(d.verification_status)).length}</p><p className="text-xs text-muted-foreground">Rejected</p></div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TAB: Profile & Form ──────────────────────────── */}
        <TabsContent value="profile" className="space-y-6">
          {/* Personal Information */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-3 border-b"><CardTitle className="text-base flex items-center gap-2"><User className="h-4 w-4 text-primary" /> I. Personal Information</CardTitle></CardHeader>
            <CardContent className="pt-4 grid grid-cols-2 md:grid-cols-3 gap-4">
              <ProfileRow label="First Name" value={profile.first_name} />
              <ProfileRow label="Middle Name" value={profile.middle_name} />
              <ProfileRow label="Last Name" value={profile.last_name} />
              <ProfileRow label="Suffix" value={profile.suffix} />
              <ProfileRow label="Sex" value={profile.sex} />
              <ProfileRow label="Date of Birth" value={profile.birth_date} />
              <ProfileRow label="Civil Status" value={profile.civil_status} />
              <ProfileRow label="Nationality" value={profile.nationality} />
              <ProfileRow label="Religion" value={profile.religion} />
              <ProfileRow label="Place of Birth" value={profile.place_of_birth} />
              <ProfileRow label="PhilSys Card" value={profile.philsys_card_number} />
              <ProfileRow label="Contact Number" value={profile.contact_number} />
              <ProfileRow label="Telephone" value={profile.telephone} />
              <ProfileRow label="Educational Attainment" value={profile.educational_attainment} />
              <ProfileRow label="Employment Status" value={profile.employment_status} />
              <ProfileRow label="Occupation" value={profile.occupation} />
              <ProfileRow label="Employer" value={profile.employer_name} />
              <ProfileRow label="Monthly Income" value={profile.monthly_income} />
              <Separator className="col-span-full" />
              <ProfileRow label="House No." value={profile.house_no} />
              <ProfileRow label="Street" value={profile.street} />
              <ProfileRow label="Barangay" value={profile.barangay} />
              <ProfileRow label="City/Municipality" value={profile.city_municipality} />
              <ProfileRow label="Province" value={profile.province} />
              <ProfileRow label="Region" value={profile.region} />
              <ProfileRow label="Zip Code" value={profile.zip_code} />
            </CardContent>
          </Card>

          {/* Household Composition */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-3 border-b"><CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> II. Household Composition</CardTitle></CardHeader>
            <CardContent className="pt-4">
              <ProfileRow label="Number of Children" value={profile.num_children} />
              {Array.isArray(profile.children) && profile.children.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">Children</p>
                  {profile.children.map((child, i) => (
                    <div key={i} className="flex items-center gap-3 p-2 rounded border text-sm">
                      <Baby className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="font-medium">{child.name}</span>
                      {child.age && <span className="text-muted-foreground">Age {child.age}</span>}
                      {child.sex && <span className="text-muted-foreground">{child.sex}</span>}
                    </div>
                  ))}
                </div>
              )}
              {Array.isArray(profile.household_members) && profile.household_members.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">Household Members</p>
                  {profile.household_members.map((m, i) => (
                    <div key={i} className="flex items-center gap-3 p-2 rounded border text-sm">
                      <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="font-medium">{m.name}</span>
                      {m.relationship && <span className="text-muted-foreground">{m.relationship}</span>}
                      {m.age && <span className="text-muted-foreground">Age {m.age}</span>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Solo Parent Category */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-3 border-b"><CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> III. Solo Parent Category</CardTitle></CardHeader>
            <CardContent className="pt-4 grid grid-cols-2 gap-4">
              <ProfileRow label="Category" value={profile.solo_parent_category} />
              <ProfileRow label="Solo Parent Since" value={profile.solo_parent_since} />
              <ProfileRow label="Classification" value={profile.solo_parent_classification} />
              <ProfileRow label="Is Indigent" value={profile.is_indigent ? 'Yes' : 'No'} />
              <ProfileRow label="4Ps Beneficiary" value={profile.is_4ps_beneficiary ? `Yes (${profile.household_id_4ps || ''})` : 'No'} />
              <ProfileRow label="Indigenous" value={profile.is_indigenous ? `Yes (${profile.indigenous_affiliation || ''})` : 'No'} />
              <ProfileRow label="PWD" value={profile.is_pwd ? 'Yes' : 'No'} />
              <ProfileRow label="LGBTQIA+" value={profile.is_lgbtqia ? 'Yes' : 'No'} />
            </CardContent>
          </Card>

          {/* Needs & Problems */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-3 border-b"><CardTitle className="text-base flex items-center gap-2"><Heart className="h-4 w-4 text-primary" /> IV. Needs & Problems</CardTitle></CardHeader>
            <CardContent className="pt-4">
              <p className="text-sm whitespace-pre-wrap">{profile.needs_problems || 'Not specified'}</p>
            </CardContent>
          </Card>

          {/* Emergency Contact */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-3 border-b"><CardTitle className="text-base flex items-center gap-2"><Phone className="h-4 w-4 text-primary" /> V. Emergency Contact</CardTitle></CardHeader>
            <CardContent className="pt-4 grid grid-cols-2 gap-4">
              <ProfileRow label="Name" value={profile.emergency_contact_name} />
              <ProfileRow label="Relationship" value={profile.emergency_contact_relationship} />
              <ProfileRow label="Contact Number" value={profile.emergency_contact_number} />
              <ProfileRow label="Address" value={profile.emergency_contact_address} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TAB: Documents ──────────────────────────────── */}
        <TabsContent value="documents" className="space-y-4">
          <Card className="border shadow-sm">
            <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Upload className="h-4 w-4 text-primary" /> Uploaded Documents ({activeDocs.length})
              </CardTitle>
              {activeDocs.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-emerald-700 dark:text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/10 text-xs gap-1.5 h-8 font-semibold shadow-2xs"
                  onClick={handleApproveAllDocs}
                  disabled={approvingAllDocs}
                >
                  <CheckCircle className="h-3.5 w-3.5" />
                  {approvingAllDocs ? 'Approving All...' : 'Approve All Documents'}
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {(() => {
                if (activeDocs.length === 0) {
                  return (
                    <div className="py-12 text-center text-muted-foreground">
                      <Upload className="h-8 w-8 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">No documents have been uploaded yet.</p>
                    </div>
                  );
                }

                const groupMap = new Map();
                activeDocs.forEach(doc => {
                  const groupKey = doc.requirement_id || doc.doc_type || doc.label || 'other';
                  const reqTitle = doc.requirement_name || doc.label || 'Documentary Requirement';
                  if (!groupMap.has(groupKey)) {
                    groupMap.set(groupKey, {
                      key: groupKey,
                      name: reqTitle,
                      documents: [],
                    });
                  }
                  groupMap.get(groupKey).documents.push(doc);
                });

                const reqGroups = Array.from(groupMap.values());

                return (
                  <div className="divide-y">
                    {reqGroups.map(group => {
                      const allApproved = group.documents.every(d => ['approved', 'verified'].includes(d.verification_status));
                      const anyRejected = group.documents.some(d => d.verification_status === 'rejected');

                      return (
                        <div key={group.key} className="p-4 sm:p-5 space-y-3">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-primary shrink-0" />
                              <h4 className="text-sm font-bold text-foreground">{group.name}</h4>
                              <Badge variant="secondary" className="text-xs font-semibold px-2 py-0.5">
                                {group.documents.length} {group.documents.length === 1 ? 'Attachment' : 'Attachments'}
                              </Badge>
                            </div>
                            {allApproved ? (
                              <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 text-xs font-semibold">
                                ✓ All Approved
                              </Badge>
                            ) : anyRejected ? (
                              <Badge className="bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 text-xs font-semibold">
                                Has Rejected
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs">Pending Review</Badge>
                            )}
                          </div>

                          <div className="space-y-2 pl-2 sm:pl-4">
                            {group.documents.map(doc => {
                              const statusCfg = DOC_STATUS_CONFIG[doc.verification_status] || DOC_STATUS_CONFIG.pending;
                              return (
                                <div key={doc.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/60 hover:bg-muted/50 transition-colors">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-mono font-semibold text-foreground truncate">{doc.original_filename}</p>
                                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                                      <span>{doc.file_size ? `${(doc.file_size / 1024).toFixed(1)} KB` : 'Uploaded'}</span>
                                      <span>•</span>
                                      <span className="font-mono">{doc.doc_type}</span>
                                    </div>
                                    {doc.verification_remark && (
                                      <p className="text-xs text-warning mt-1 italic">Remark: {doc.verification_remark}</p>
                                    )}
                                  </div>
                                  <Badge className={`shrink-0 text-xs ${statusCfg.color}`}>{statusCfg.label}</Badge>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <Button variant="ghost" size="sm" onClick={() => handlePreviewDoc(doc.id)} className="h-8 px-2" title="Preview document">
                                      <Eye className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={() => { setDocDialog({ doc }); setDocStatus(doc.verification_status || 'pending'); setDocRemark(doc.verification_remark || ''); }} className="h-8 px-2" title="Review status & remarks">
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TAB: Status & Actions ──────────────────────── */}
        <TabsContent value="status" className="space-y-6">
          {/* Workflow Actions */}
          {availableTransitions.length > 0 && (
            <Card className="border shadow-sm">
              <CardHeader className="pb-3 border-b"><CardTitle className="text-base">Workflow Actions</CardTitle></CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div>
                  <Label>Status Change Notes</Label>
                  <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Add notes for this status change..." rows={3} className="mt-1.5" />
                </div>
                <div className="flex flex-wrap items-center gap-2 w-full">
                  {availableTransitions.map(t => (
                    <Button key={t.to} variant={t.variant} size="sm" disabled={updating} onClick={() => handleTransition(t.to)} className="gap-1.5 flex-1 sm:flex-initial min-h-[40px] text-center justify-center">
                      {updating && <RefreshCw className="h-3 w-3 animate-spin shrink-0" />}
                      <span>{t.label}</span>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Official Fields */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-3 border-b"><CardTitle className="text-base flex items-center gap-2"><CreditCard className="h-4 w-4 text-primary" /> Official ID Fields</CardTitle></CardHeader>
            <CardContent className="pt-4 grid grid-cols-2 md:grid-cols-3 gap-4">
              {Object.entries(officialFields).map(([key, val]) => (
                <div key={key} className="space-y-1.5">
                  <Label className="text-xs capitalize">{key.replace(/_/g, ' ')}</Label>
                  <Input value={val} onChange={e => setOfficialFields(f => ({ ...f, [key]: e.target.value }))} />
                </div>
              ))}
              <div className="col-span-full">
                <Button onClick={handleSaveOfficial} disabled={savingOfficial} size="sm" className="gap-2">
                  {savingOfficial ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
                  Save Official Fields
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Status History Timeline */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-3 border-b"><CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4 text-primary" /> Status Timeline</CardTitle></CardHeader>
            <CardContent className="pt-4">
              {(application.status_history || []).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No status changes recorded yet.</p>
              ) : (
                <div className="space-y-3">
                  {(application.status_history || []).map((h, i) => (
                    <div key={h.id || i} className="flex gap-3 group">
                      <div className="flex flex-col items-center">
                        <div className="h-3 w-3 rounded-full bg-primary shrink-0 mt-1" />
                        {i < application.status_history.length - 1 && <div className="w-px flex-1 bg-border min-h-[20px]" />}
                      </div>
                      <div className="pb-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <StatusPill status={h.status} />
                          <span className="text-xs text-muted-foreground font-medium">
                            {h.created_at ? format(new Date(h.created_at), 'MMM d, yyyy h:mm a') : ''}
                          </span>
                        </div>
                        {h.note && <p className="text-sm text-muted-foreground mt-1 italic">"{h.note}"</p>}
                        {h.changed_by_name && <p className="text-xs text-muted-foreground mt-0.5">by {h.changed_by_name}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Document Review Dialog ─────────────────────── */}
      <Dialog open={!!docDialog} onOpenChange={(open) => !open && setDocDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Document</DialogTitle>
            <DialogDescription>
              {docDialog?.doc?.requirement_name || docDialog?.doc?.label || docDialog?.doc?.original_filename}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Verification Status</Label>
              <Select value={docStatus} onValueChange={setDocStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="verified">✓ Approve</SelectItem>
                  <SelectItem value="rejected">✗ Reject</SelectItem>
                  <SelectItem value="needs_replacement">↺ Request Replacement</SelectItem>
                  <SelectItem value="pending">◌ Set to Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Remarks {['rejected', 'needs_replacement', 'replacement_required'].includes(docStatus) && <span className="text-destructive">*</span>}</Label>
              <Textarea value={docRemark} onChange={e => setDocRemark(e.target.value)} placeholder="Add remarks..." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDocDialog(null)}>Cancel</Button>
            <Button onClick={handleVerifyDoc} disabled={savingDoc}>
              {savingDoc ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
