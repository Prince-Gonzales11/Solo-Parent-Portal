import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, toastError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { RefreshCw, FileWarning, ArrowLeft, Upload, Send, FileText } from 'lucide-react';
import DocumentManager from './DocumentManager';

export default function LossOfSpicFlow() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [application, setApplication] = useState(null);
  
  // Steps: 'intro' | 'form' | 'documents' | 'success'
  const [step, setStep] = useState('intro');
  
  const [formData, setFormData] = useState({
    loss_date: '',
    loss_reason: ''
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchActiveApplication();
  }, []);

  const fetchActiveApplication = async () => {
    try {
      setLoading(true);
      const res = await api.get('/applications/active');
      if (res.data) {
        setApplication(res.data);
        if (res.data.application_type === 'loss_of_spic') {
          if (res.data.status === 'draft') {
            setStep('documents');
          } else {
            setStep('success');
          }
        } else {
          toast.info('You have an active application that is not a Loss of SPIC application.');
          navigate('/portal/my-application');
        }
      } else {
        setStep('intro');
      }
    } catch (err) {
      console.error('Error fetching application:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartLossApplication = async () => {
    try {
      setSubmitting(true);
      const res = await api.post('/applications/loss');
      setApplication(res.data);
      toast.success('Loss of SPIC application started.');
      setStep('form');
    } catch (err) {
      toastError(err, 'Failed to start Loss of SPIC application. You might not have an existing active ID to replace.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveForm = async () => {
    if (!formData.loss_date || !formData.loss_reason) {
      toast.error('Please fill in both Date of Loss and Description of Loss.');
      return;
    }
    setStep('documents');
  };

  const handleFinalSubmit = async () => {
    try {
      setSubmitting(true);
      const res = await api.post(`/applications/${application.id}/submit-loss`, formData);
      toast.success('Loss of SPIC application submitted successfully!');
      setApplication(res.data);
      setStep('success');
    } catch (err) {
      toastError(err, 'Failed to submit application. Ensure all documents are uploaded.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Button variant="ghost" onClick={() => navigate('/portal/my-application')} className="mb-4">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Dashboard
      </Button>

      {step === 'intro' && (
        <Card className="border border-border/80 rounded-3xl shadow-sm">
          <CardContent className="p-8 md:p-12 text-center max-w-2xl mx-auto space-y-6">
            <div className="h-20 w-20 bg-amber-100 dark:bg-amber-900/30 text-amber-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
              <FileWarning className="h-10 w-10" />
            </div>
            <div>
              <h2 className="text-3xl font-bold font-display tracking-tight text-foreground">Replace Lost Solo Parent ID</h2>
              <p className="text-muted-foreground mt-4 text-base leading-relaxed">
                If you have lost your valid Solo Parent ID Card, you can request a replacement here. 
                You will need to provide an Affidavit of Loss, a 1x1 ID Picture, a Sworn Affidavit, and a Barangay Certificate.
              </p>
            </div>
            
            <div className="pt-6">
              <Button onClick={handleStartLossApplication} disabled={submitting} size="lg" className="px-8 font-bold rounded-full w-full sm:w-auto h-12 shadow-md">
                {submitting ? <RefreshCw className="h-5 w-5 animate-spin mr-2" /> : <FileText className="h-5 w-5 mr-2" />}
                Start Replacement Application
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'form' && (
        <Card className="border border-border/80 rounded-3xl shadow-sm">
          <CardContent className="p-8">
            <h2 className="text-2xl font-bold mb-6 font-display flex items-center gap-2">
              <FileText className="h-6 w-6 text-primary" />
              Loss Details
            </h2>
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="loss_date" className="font-semibold text-foreground">Date of Loss <span className="text-destructive">*</span></Label>
                <Input
                  id="loss_date"
                  type="date"
                  max={new Date().toISOString().split('T')[0]}
                  value={formData.loss_date}
                  onChange={(e) => setFormData({ ...formData, loss_date: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="loss_reason" className="font-semibold text-foreground">Description of Loss <span className="text-destructive">*</span></Label>
                <Textarea
                  id="loss_reason"
                  placeholder="Please describe how and where you lost your ID card..."
                  className="min-h-[120px]"
                  value={formData.loss_reason}
                  onChange={(e) => setFormData({ ...formData, loss_reason: e.target.value })}
                  required
                />
              </div>
              <div className="pt-4 flex justify-end">
                <Button onClick={handleSaveForm} size="lg" className="font-bold rounded-full px-8">
                  Continue to Documents
                  <ArrowLeft className="h-4 w-4 ml-2 rotate-180" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'documents' && application && (
        <div className="space-y-6">
          <Card className="border border-border/80 rounded-3xl shadow-sm">
            <CardContent className="p-8">
              <h2 className="text-2xl font-bold mb-2 font-display flex items-center gap-2">
                <Upload className="h-6 w-6 text-primary" />
                Documentary Requirements
              </h2>
              <p className="text-muted-foreground mb-6">
                Please upload the required documents for the replacement of your lost ID.
              </p>
              
              <DocumentManager application={application} onUploadComplete={() => {}} />

              <div className="mt-8 pt-6 border-t border-border/50 flex flex-col sm:flex-row gap-4 items-center justify-between">
                <p className="text-sm text-muted-foreground flex-1">
                  Once all 4 required documents (Affidavit of Loss, 1x1 ID Picture, Sworn Affidavit, Affidavit of Barangay) are uploaded, you can submit your request.
                </p>
                <Button onClick={handleFinalSubmit} disabled={submitting} size="lg" className="font-bold rounded-full w-full sm:w-auto">
                  {submitting ? <RefreshCw className="h-5 w-5 animate-spin mr-2" /> : <Send className="h-5 w-5 mr-2" />}
                  Submit Application
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {step === 'success' && (
        <Card className="border border-border/80 rounded-3xl shadow-sm border-t-4 border-t-success">
          <CardContent className="p-8 md:p-12 text-center max-w-2xl mx-auto space-y-6">
            <div className="h-20 w-20 bg-success/10 text-success rounded-full flex items-center justify-center mx-auto shadow-sm">
              <Send className="h-10 w-10" />
            </div>
            <div>
              <h2 className="text-3xl font-bold font-display tracking-tight text-foreground">Request Submitted!</h2>
              <p className="text-muted-foreground mt-4 text-base leading-relaxed">
                Your replacement request for a lost Solo Parent ID has been submitted to the CSWDD for review. 
                You can track its progress in your dashboard.
              </p>
            </div>
            <div className="pt-6">
              <Button onClick={() => navigate('/portal/my-application')} size="lg" className="px-8 font-bold rounded-full h-12 shadow-md">
                View Application Status
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
