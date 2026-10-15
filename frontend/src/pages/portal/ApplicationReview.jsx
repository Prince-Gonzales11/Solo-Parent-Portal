import React, { useState, useEffect } from 'react';
import { api, toastError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  ArrowLeft, CheckCircle, FileText, User, Users, AlertCircle, RefreshCw
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

function ProfileRow({ label, value }) {
  if (!value && value !== 0) return null;
  return (
    <div className="space-y-0.5">
      <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">{label}</p>
      <p className="text-sm font-medium break-words">{String(value)}</p>
    </div>
  );
}

export default function ApplicationReview({ onBack, onEditStep, onSubmitSuccess }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(false);

  useEffect(() => {
    loadReviewData();
  }, []);

  const loadReviewData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/applications/review');
      setData(res.data);
    } catch (err) {
      toastError(err, 'Failed to load application data for review.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!data?.application?.id) return;
    setSubmitting(true);
    try {
      await api.post(`/applications/${data.application.id}/submit`);
      toast.success('Application submitted successfully!');
      if (onSubmitSuccess) onSubmitSuccess();
    } catch (err) {
      toastError(err, 'Failed to submit application.');
    } finally {
      setSubmitting(false);
      setConfirmDialog(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse">Gathering your application details...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
        <h3 className="text-lg font-medium text-foreground">Something went wrong</h3>
        <p className="text-muted-foreground">Unable to load application data.</p>
        <Button onClick={onBack} variant="outline" className="mt-4">Go Back</Button>
      </div>
    );
  }

  const { profile, application, documents } = data;
  const form = application?.form || {};
  const familyMembers = application?.family_members || [];

  const name = [profile?.first_name, profile?.middle_name, profile?.last_name, profile?.suffix].filter(Boolean).join(' ') || 'Not provided';
  const address = [profile?.house_no, profile?.street, profile?.barangay?.name || profile?.barangay, profile?.city_municipality, profile?.province].filter(Boolean).join(', ') || 'Not provided';

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12 w-full max-w-full overflow-x-hidden min-w-0">
      
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-6">
        <div>
          <Button variant="ghost" className="mb-2 -ml-3 text-muted-foreground" onClick={onBack}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to application steps
          </Button>
          <h1 className="text-3xl font-bold text-primary flex items-center gap-2">
            <CheckCircle className="h-8 w-8 text-primary" />
            Review & Submit
          </h1>
          <p className="text-muted-foreground mt-2 text-base sm:text-lg">
            Please carefully review all your information below before submitting.
          </p>
        </div>
      </div>

      {/* Section 1: Personal Profile */}
      <Card className="border-primary/20 shadow-md">
        <CardHeader className="bg-primary/5 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-4 w-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">1. Personal Profile</CardTitle>
                <CardDescription>Your basic identity and contact information.</CardDescription>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => onEditStep('form')} className="w-full sm:w-auto">Edit Profile</Button>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            <ProfileRow label="Full Name" value={name} />
            <ProfileRow label="Date of Birth" value={profile?.birth_date} />
            <ProfileRow label="Sex" value={profile?.sex} />
            <ProfileRow label="Contact Number" value={profile?.contact_number} />
            <ProfileRow label="Telephone" value={profile?.telephone} />
            <div className="col-span-2 md:col-span-3">
              <ProfileRow label="Complete Address" value={address} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Application Form */}
      <Card className="border-primary/20 shadow-md">
        <CardHeader className="bg-primary/5 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <FileText className="h-4 w-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">2. Solo Parent Details</CardTitle>
                <CardDescription>Your socio-economic details, classification, and household.</CardDescription>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => onEditStep('form')} className="w-full sm:w-auto">Edit Details</Button>
          </div>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            <ProfileRow label="Place of Birth" value={form?.place_of_birth} />
            <ProfileRow label="Civil Status" value={form?.civil_status} />
            <ProfileRow label="Religion" value={form?.religion} />
            <ProfileRow label="Nationality" value={form?.nationality} />
            <ProfileRow label="Educational Attainment" value={form?.educational_attainment} />
            <ProfileRow label="PhilSys ID" value={form?.philsys_card_number} />
          </div>

          <Separator />
          
          <div>
            <h4 className="text-sm font-semibold mb-4 text-foreground/80">Employment & Income</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
              <ProfileRow label="Employment Status" value={form?.employment_status} />
              <ProfileRow label="Occupation" value={form?.occupation} />
              <ProfileRow label="Monthly Income" value={form?.monthly_income} />
              <div className="col-span-2 md:col-span-3">
                <ProfileRow label="Employer / Company Agency" value={[form?.employer_name, form?.company_agency].filter(Boolean).join(' - ')} />
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <h4 className="text-sm font-semibold mb-4 text-foreground/80">Solo Parent Classification</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ProfileRow label="Solo Parent Category" value={application?.category?.name} />
              <ProfileRow label="Solo Parent Since" value={form?.solo_parent_since} />
              <div className="col-span-1 md:col-span-2">
                <ProfileRow label="Classification Details" value={form?.classification_details} />
              </div>
              <div className="col-span-1 md:col-span-2">
                <ProfileRow label="Needs / Problems" value={form?.needs_problems} />
              </div>
            </div>
          </div>

          {(form?.is_indigent || form?.is_4ps_beneficiary || form?.is_indigenous || form?.is_lgbtqia || form?.is_pwd) && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-semibold mb-4 text-foreground/80">Special Classifications</h4>
                <div className="flex flex-wrap gap-2">
                  {form?.is_indigent && <Badge variant="outline" className="border-info text-info">Indigent</Badge>}
                  {form?.is_4ps_beneficiary && <Badge variant="outline" className="border-info text-info">4Ps Beneficiary {form.household_id_4ps ? `(${form.household_id_4ps})` : ''}</Badge>}
                  {form?.is_indigenous && <Badge variant="outline" className="border-info text-info">Indigenous ({form.indigenous_affiliation})</Badge>}
                  {form?.is_lgbtqia && <Badge variant="outline" className="border-info text-info">LGBTQ+</Badge>}
                  {form?.is_pwd && <Badge variant="outline" className="border-info text-info">Person with Disability (PWD)</Badge>}
                </div>
              </div>
            </>
          )}

          <Separator />
          
          <div>
            <h4 className="text-sm font-semibold mb-4 text-foreground/80">Household Members</h4>
            {familyMembers.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No household members listed.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border rounded-lg overflow-hidden">
                  <thead className="bg-muted text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">Name</th>
                      <th className="px-4 py-3 font-medium">Relationship</th>
                      <th className="px-4 py-3 font-medium">Age</th>
                      <th className="px-4 py-3 font-medium">Civil Status</th>
                      <th className="px-4 py-3 font-medium">Income</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {familyMembers.map((m, idx) => (
                      <tr key={idx} className="bg-card">
                        <td className="px-4 py-3 font-medium">{m.name}</td>
                        <td className="px-4 py-3">{m.relationship}</td>
                        <td className="px-4 py-3">{m.age || '-'}</td>
                        <td className="px-4 py-3">{m.civil_status || '-'}</td>
                        <td className="px-4 py-3">{m.monthly_income || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <Separator />

          <div>
            <h4 className="text-sm font-semibold mb-4 text-foreground/80">Emergency Contact</h4>
            <div className="grid grid-cols-2 gap-6">
              <ProfileRow label="Name" value={form?.emergency_contact_name} />
              <ProfileRow label="Relationship" value={form?.emergency_contact_relationship} />
              <ProfileRow label="Contact Number" value={form?.emergency_contact_number} />
              <ProfileRow label="Address" value={form?.emergency_contact_address} />
            </div>
          </div>

        </CardContent>
      </Card>

      {/* Section 3: Documentary Requirements */}
      <Card className="border-primary/20 shadow-md">
        <CardHeader className="bg-primary/5 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="h-4 w-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">3. Documentary Requirements</CardTitle>
                <CardDescription>Your uploaded supporting documents.</CardDescription>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => onEditStep('documents')} className="w-full sm:w-auto">Edit Documents</Button>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {documents.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No documents uploaded.</p>
          ) : (
            <div className="space-y-3">
              {documents.map((doc, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 border rounded-md bg-muted/20">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{doc.requirement?.name || doc.original_filename}</p>
                      <p className="text-xs text-muted-foreground">{doc.original_filename}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-success-soft text-success border-success-soft/50">Uploaded</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Final Submission Section */}
      <Card className="border-2 border-primary/40 bg-primary/5 shadow-lg mt-8 sm:mt-12 w-full max-w-full overflow-hidden">
        <CardContent className="p-4 sm:p-8">
          <div className="flex items-start gap-3 sm:gap-4">
            <Checkbox 
              id="confirm" 
              className="mt-1 h-5 w-5 shrink-0"
              checked={confirmed}
              onCheckedChange={setConfirmed}
            />
            <div className="grid gap-1.5 leading-none">
              <label
                htmlFor="confirm"
                className="text-sm sm:text-base font-semibold leading-relaxed cursor-pointer"
              >
                I hereby certify that all information and documents provided in this application are true and correct to the best of my knowledge and belief.
              </label>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed mt-1.5 sm:mt-2">
                I understand that any false statement or misrepresentation made in this application is a ground for disqualification, cancellation of my Solo Parent ID, and possible legal action under the law.
              </p>
            </div>
          </div>

          <div className="mt-6 sm:mt-8 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
            <Button variant="outline" size="lg" onClick={onBack} className="w-full sm:w-auto h-11 justify-center font-bold">
              Return to draft
            </Button>
            <Button 
              size="lg" 
              onClick={() => setConfirmDialog(true)} 
              disabled={!confirmed || submitting}
              className="w-full sm:w-auto h-auto min-h-[44px] py-2.5 px-4 sm:px-8 shadow-md bg-primary hover:bg-primary/90 text-primary-foreground font-bold justify-center text-center whitespace-normal break-words leading-tight"
            >
              <span className="hidden sm:inline">Submit Application Form for Final CSWDD Assessment</span>
              <span className="sm:hidden">Submit Application Form</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmDialog} onOpenChange={setConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit Application Form for Final Assessment?</AlertDialogTitle>
            <AlertDialogDescription className="leading-relaxed">
              This action will submit your completed Solo Parent Application Form to the CSWDD Office for final review and approval. Once approved, your Solo Parent ID registration will be officially completed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSubmit} disabled={submitting} className="bg-primary hover:bg-primary/90 font-bold">
              {submitting ? <><RefreshCw className="mr-2 h-4 w-4 animate-spin" />Submitting...</> : 'Yes, submit application'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
