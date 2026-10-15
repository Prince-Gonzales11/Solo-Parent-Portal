import React, { useState } from 'react';
import { api, toastError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  FileText, FileSpreadsheet, Download, RefreshCw, Bell, BarChart2, Users, AlertCircle
} from 'lucide-react';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'under_initial_review', label: 'Under Initial Review' },
  { value: 'document_verification', label: 'Document Verification' },
  { value: 'pending_additional_requirements', label: 'Pending Additional Requirements' },
  { value: 'under_final_assessment', label: 'Under Final Assessment' },
  { value: 'under_final_verification', label: 'Under Final Verification' },
  { value: 'approved', label: 'Approved' },
  { value: 'ready_for_printing', label: 'Ready for Printing' },
  { value: 'ready_for_release', label: 'Ready for Release' },
  { value: 'released', label: 'Released' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'expired', label: 'Expired' },
];

function ExportCard({ icon: Icon, title, description, children, accentClass }) {
  return (
    <Card className={`border-l-4 ${accentClass}`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-5 w-5" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

export default function AdminReports() {
  /* Applications CSV state */
  const [appStatus, setAppStatus] = useState('all');
  const [appSearch, setAppSearch] = useState('');
  const [exportingAppCsv, setExportingAppCsv] = useState(false);

  /* Stats state */
  const [exportingStatsCsv, setExportingStatsCsv] = useState(false);
  const [exportingStatsPdf, setExportingStatsPdf] = useState(false);

  /* Renewal reminders state */
  const [triggeringReminders, setTriggeringReminders] = useState(false);
  const [reminderResult, setReminderResult] = useState(null);

  /* --- Helpers --- */
  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const exportApplicationsCsv = async () => {
    setExportingAppCsv(true);
    try {
      const res = await api.get('/admin/reports/export.csv', {
        responseType: 'blob',
      });
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      downloadBlob(res.data, `applications_${today}.csv`);
      toast.success('Applications CSV exported!');
    } catch (err) {
      if (err.response?.status === 403) {
        toast.error('Admin access required. You do not have permission to export reports.');
      } else {
        toastError(err, 'Failed to export applications. Please try again.');
      }
    } finally {
      setExportingAppCsv(false);
    }
  };

  const exportStatsCsv = async () => {
    setExportingStatsCsv(true);
    try {
      const res = await api.get('/admin/reports/export.csv', { responseType: 'blob' });
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      downloadBlob(res.data, `statistics_${today}.csv`);
      toast.success('Statistics CSV exported!');
    } catch (err) {
      toastError(err, 'Failed to export statistics CSV. Please try again.');
    } finally {
      setExportingStatsCsv(false);
    }
  };

  const exportStatsPdf = async () => {
    setExportingStatsPdf(true);
    try {
      const res = await api.get('/admin/reports/statistics.pdf', { responseType: 'blob' });
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      downloadBlob(res.data, `statistics_${today}.pdf`);
      toast.success('Statistics PDF exported!');
    } catch (err) {
      toastError(err, 'Failed to export statistics PDF. Please try again.');
    } finally {
      setExportingStatsPdf(false);
    }
  };

  const triggerRenewalReminders = async () => {
    setTriggeringReminders(true);
    setReminderResult(null);
    try {
      const res = await api.post('/admin/maintenance/renewal-reminders');
      setReminderResult(res.data);
      toast.success(res.data.message || `Sent ${res.data.sent} renewal reminder(s).`);
    } catch (err) {
      toastError(err, 'Failed to send renewal reminders. Please try again.');
    } finally {
      setTriggeringReminders(false);
    }
  };

  return (
    <div className="flex-1 px-3 sm:px-6 py-4 sm:py-6 space-y-6 w-full max-w-full overflow-x-hidden min-w-0">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2.5 sm:gap-3">
          <BarChart2 className="h-7 w-7 sm:h-8 sm:w-8 text-primary shrink-0" /> Reports & Exports
        </h1>
        <p className="text-muted-foreground mt-1 text-xs sm:text-sm">
          One-click CSV and PDF exports, plus admin maintenance tools.
        </p>
      </div>

      {/* Applications CSV */}
      <ExportCard
        icon={FileSpreadsheet}
        title="Applications CSV Export"
        description="Download a spreadsheet of all applications with applicant details, status, dates, and ID card numbers."
        accentClass="border-l-primary"
      >
        <div className="grid sm:grid-cols-2 gap-3 sm:gap-4">
          <div className="space-y-1.5 sm:space-y-2">
            <Label className="text-xs sm:text-sm">Filter by Status</Label>
            <Select value={appStatus} onValueChange={setAppStatus}>
              <SelectTrigger className="h-10 text-xs sm:text-sm" data-testid="export-status-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:space-y-2">
            <Label className="text-xs sm:text-sm">Search (name / email / ref no)</Label>
            <Input
              className="h-10 text-xs sm:text-sm"
              placeholder="e.g. Juan dela Cruz"
              value={appSearch}
              onChange={e => setAppSearch(e.target.value)}
              data-testid="export-search-input"
            />
          </div>
        </div>
        <Button
          onClick={exportApplicationsCsv}
          disabled={exportingAppCsv}
          className="w-full sm:w-auto min-h-[44px] font-semibold"
          data-testid="export-applications-csv-button"
        >
          {exportingAppCsv
            ? <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Generating…</>
            : <><Download className="mr-2 h-4 w-4" /> Export Applications CSV</>}
        </Button>
      </ExportCard>

      {/* Statistics exports */}
      <ExportCard
        icon={BarChart2}
        title="Monthly Statistics Export"
        description="Download a summary report with applicant counts, status distribution, and monthly application trends."
        accentClass="border-l-secondary"
      >
        <div className="flex flex-col sm:flex-row flex-wrap gap-2.5 sm:gap-3">
          <Button
            variant="outline"
            onClick={exportStatsCsv}
            disabled={exportingStatsCsv}
            className="w-full sm:w-auto min-h-[44px] font-medium"
            data-testid="export-statistics-csv-button"
          >
            {exportingStatsCsv
              ? <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Generating…</>
              : <><FileSpreadsheet className="mr-2 h-4 w-4" /> Statistics CSV</>}
          </Button>
          <Button
            onClick={exportStatsPdf}
            disabled={exportingStatsPdf}
            className="w-full sm:w-auto min-h-[44px] font-medium"
            data-testid="export-statistics-pdf-button"
          >
            {exportingStatsPdf
              ? <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Generating PDF…</>
              : <><FileText className="mr-2 h-4 w-4" /> Statistics PDF</>}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          The PDF includes a formatted report with the Solo Parent Portal header, summary table, status breakdown, and monthly trend — ready to attach to official reports.
        </p>
      </ExportCard>

      <Separator />

      {/* Renewal Reminders */}
      <ExportCard
        icon={Bell}
        title="Renewal Reminder Sweep"
        description="Manually trigger the automated reminder system. Solo parents whose IDs are expiring within 30 days will receive an in-portal notification to renew. This sweep runs automatically every hour in the background — use this button to trigger it on demand."
        accentClass="border-l-accent"
      >
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <Button
            variant="outline"
            onClick={triggerRenewalReminders}
            disabled={triggeringReminders}
            className="w-full sm:w-auto min-h-[44px] font-medium"
            data-testid="trigger-renewal-reminders-button"
          >
            {triggeringReminders
              ? <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Sweeping…</>
              : <><Bell className="mr-2 h-4 w-4" /> Send Renewal Reminders Now</>}
          </Button>

          {reminderResult !== null && (
            <div className={`flex items-center gap-2 text-xs sm:text-sm font-medium ${reminderResult.sent > 0 ? 'text-success' : 'text-muted-foreground'}`}>
              {reminderResult.sent > 0
                ? <Bell className="h-4 w-4 shrink-0" />
                : <AlertCircle className="h-4 w-4 shrink-0" />}
              {reminderResult.message}
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          This operation is <strong>idempotent</strong> — each solo parent receives at most one reminder per ID cycle. Safe to trigger multiple times.
        </p>
      </ExportCard>
    </div>
  );
}
