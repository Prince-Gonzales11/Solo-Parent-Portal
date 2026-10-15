import React, { useEffect, useState } from 'react';
import { api, toastError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { 
  RefreshCw, BarChart2, FileText, Users, CheckCircle, Clock, Eye, 
  Download, Activity, ArrowUpRight, 
  ShieldCheck, AlertCircle, Sparkles, UserCheck, Tag, Layers
} from 'lucide-react';
import { Link } from 'react-router-dom';

const STATUS_CONFIG = {
  draft: { label: 'Draft', color: '#94a3b8', bg: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300' },
  submitted: { label: 'Submitted', color: '#3b82f6', bg: 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200' },
  under_initial_review: { label: 'Initial Review', color: '#6366f1', bg: 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-200' },
  document_verification: { label: 'Doc Verify', color: '#8b5cf6', bg: 'bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-200' },
  pending_additional_requirements: { label: 'Needs Docs', color: '#f59e0b', bg: 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200' },
  under_final_assessment: { label: 'Final Review', color: '#06b6d4', bg: 'bg-cyan-100 dark:bg-cyan-900/40 text-cyan-800 dark:text-cyan-200' },
  under_final_verification: { label: 'Final Verify', color: '#0ea5e9', bg: 'bg-sky-100 dark:bg-sky-900/40 text-sky-800 dark:text-sky-200' },
  approved: { label: 'Approved', color: '#10b981', bg: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200' },
  ready_for_printing: { label: 'Printing', color: '#059669', bg: 'bg-teal-100 dark:bg-teal-900/40 text-teal-800 dark:text-teal-200' },
  ready_for_release: { label: 'For Release', color: '#047857', bg: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200' },
  ready_for_pickup: { label: 'Ready for Pickup', color: '#0d9488', bg: 'bg-teal-100 dark:bg-teal-900/40 text-teal-800 dark:text-teal-200' },
  completed: { label: 'Completed', color: '#059669', bg: 'bg-emerald-200 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-100' },
  released: { label: 'Released', color: '#065f46', bg: 'bg-emerald-200 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-100' },
  rejected: { label: 'Rejected', color: '#ef4444', bg: 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200' },
  expired: { label: 'Expired', color: '#6b7280', bg: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300' },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || { label: status, color: '#94a3b8', bg: 'bg-slate-100 text-slate-700' };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold shadow-xs border ${cfg.bg} border-black/5 dark:border-white/10`}>
      <span className="h-1.5 w-1.5 rounded-full mr-1.5" style={{ backgroundColor: cfg.color }} />
      {cfg.label}
    </span>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [applications, setApplications] = useState([]);
  const [tab, setTab] = useState('needs_review');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  const [appTypeFilter, setAppTypeFilter] = useState('all');

  const loadStats = async (silent = false) => {
    try {
      const res = await api.get('/admin/analytics/overview', { cache: false });
      setStats(res.data);
    } catch { /* non-fatal */ }
  };

  const loadApplications = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      let params = tab === 'needs_review' ? { group: 'needs_review' } : (statusFilter !== 'all' ? { status: statusFilter } : {});
      if (appTypeFilter !== 'all') {
        params.application_type = appTypeFilter;
      }
      const res = await api.get('/admin/applications', { params, cache: false });
      const data = res.data.data || res.data.items || (Array.isArray(res.data) ? res.data : []);
      setApplications(data);
    } catch (err) {
      if (!silent) toastError(err, 'Failed to load applications. Please refresh the page.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => { loadStats(); }, []);
  useEffect(() => { loadApplications(); }, [tab, statusFilter, appTypeFilter]);

  // Smart polling: auto-refresh stats and dashboard applications every 8s, paused when tab is hidden
  useEffect(() => {
    let intervalId = null;
    let inFlight = false;
    const POLL_INTERVAL = 8000;

    const silentRefresh = async () => {
      if (document.hidden || inFlight) return;
      inFlight = true;
      try {
        await Promise.allSettled([
          loadStats(true),
          loadApplications(true)
        ]);
      } finally {
        inFlight = false;
      }
    };

    const start = () => { if (!intervalId) intervalId = setInterval(silentRefresh, POLL_INTERVAL); };
    const stop = () => { if (intervalId) { clearInterval(intervalId); intervalId = null; } };
    const onVis = () => { document.hidden ? stop() : (silentRefresh(), start()); };

    start();
    document.addEventListener('visibilitychange', onVis);
    return () => { stop(); document.removeEventListener('visibilitychange', onVis); };
  }, [tab, statusFilter, appTypeFilter]);

  const chartData = stats?.by_status
    ? Object.entries(stats.by_status).map(([status, count]) => ({
        name: STATUS_CONFIG[status]?.label || status,
        value: count,
        fill: STATUS_CONFIG[status]?.color || '#94a3b8',
      }))
    : [];

  return (
    <div className="flex-1 px-3 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-6 sm:space-y-8 bg-gradient-to-b from-surface-muted to-background dark:to-background min-h-screen w-full max-w-full overflow-x-hidden min-w-0">
      
      {/* ── Welcome Header ──────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-2 border border-primary/20">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            CSWDD Administrative Console
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-foreground font-display">
            Admin Dashboard
          </h1>
          <p className="text-muted-foreground mt-1 text-xs sm:text-sm md:text-base">
            Solo Parent Portal — local government oversight, verification workflows & live analytics.
          </p>
        </div>
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => { loadStats(); loadApplications(); }}
            className="card-pop bg-card hover:bg-muted font-medium border-border/80 min-h-[40px] flex-1 sm:flex-initial"
          >
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh Data
          </Button>
          <Button asChild size="sm" className="card-pop bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md min-h-[40px] flex-1 sm:flex-initial">
            <Link to="/admin/reports">
              <Download className="mr-2 h-4 w-4" /> Reports & Exports
            </Link>
          </Button>
        </div>
      </div>

      {/* ── Stat Cards (Tactile 3D Cards) ───────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
        
        {/* Needs Review Card */}
        <Link to="/admin/applicants?tab=all&group=needs_review" className="group block">
          <div className="card-pop card-pop-hover rounded-2xl p-5 border-2 border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-card relative overflow-hidden transition-all duration-300">
            <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-amber-500/15 rounded-full blur-xl group-hover:scale-125 transition-transform" />
            <div className="flex items-center justify-between">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 text-white flex items-center justify-center shadow-md shadow-amber-500/25 rim-highlight">
                <Clock className="h-6 w-6" />
              </div>
              <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 text-xs font-semibold px-2.5 py-0.5">
                Action Required
              </Badge>
            </div>
            <div className="mt-4">
              <div className="text-3xl font-extrabold tracking-tight text-foreground">
                {stats?.pending_reviews ?? 0}
              </div>
              <p className="text-sm font-semibold text-amber-700 dark:text-amber-400 mt-0.5">
                Applications Requiring Review
              </p>
            </div>
          </div>
        </Link>

        {/* Total Registered Solo Parents */}
        <Link to="/admin/applicants?tab=registered" className="group block">
          <div className="card-pop card-pop-hover rounded-2xl p-5 border-2 border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-card relative overflow-hidden transition-all duration-300">
            <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-primary/15 rounded-full blur-xl group-hover:scale-125 transition-transform" />
            <div className="flex items-center justify-between">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-teal-600 to-cyan-700 text-white flex items-center justify-center shadow-md shadow-teal-500/25 rim-highlight">
                <FileText className="h-6 w-6" />
              </div>
              <span className="flex items-center text-xs font-semibold text-primary group-hover:translate-x-0.5 transition-transform">
                Registered records <ArrowUpRight className="h-3.5 w-3.5 ml-0.5" />
              </span>
            </div>
            <div className="mt-4">
              <div className="text-3xl font-extrabold tracking-tight text-foreground">
                {stats?.total_registered ?? 0}
              </div>
              <p className="text-sm font-semibold text-muted-foreground mt-0.5">
                Total Registered Solo Parents
              </p>
            </div>
          </div>
        </Link>

        {/* Approved Applications */}
        <Link to="/admin/applicants?tab=approved" className="group block">
          <div className="card-pop card-pop-hover rounded-2xl p-5 border-2 border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-card relative overflow-hidden transition-all duration-300">
            <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-emerald-500/15 rounded-full blur-xl group-hover:scale-125 transition-transform" />
            <div className="flex items-center justify-between">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white flex items-center justify-center shadow-md shadow-emerald-500/25 rim-highlight">
                <CheckCircle className="h-6 w-6" />
              </div>
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-xs font-semibold px-2.5 py-0.5">
                Approved
              </Badge>
            </div>
            <div className="mt-4">
              <div className="text-3xl font-extrabold tracking-tight text-foreground">
                {stats?.approved_count ?? 0}
              </div>
              <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 mt-0.5">
                Approved Applications
              </p>
            </div>
          </div>
        </Link>

        {/* Released IDs */}
        <Link to="/admin/applicants?tab=released" className="group block">
          <div className="card-pop card-pop-hover rounded-2xl p-5 border-2 border-teal-500/20 bg-gradient-to-br from-teal-500/10 via-teal-500/5 to-card relative overflow-hidden transition-all duration-300">
            <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-teal-500/15 rounded-full blur-xl group-hover:scale-125 transition-transform" />
            <div className="flex items-center justify-between">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-teal-600 to-emerald-700 text-white flex items-center justify-center shadow-md shadow-teal-500/25 rim-highlight">
                <Sparkles className="h-6 w-6" />
              </div>
              <Badge variant="outline" className="bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/30 text-xs font-semibold px-2.5 py-0.5">
                Claimed & Released
              </Badge>
            </div>
            <div className="mt-4">
              <div className="text-3xl font-extrabold tracking-tight text-foreground">
                {stats?.released_count ?? 0}
              </div>
              <p className="text-sm font-semibold text-teal-700 dark:text-teal-400 mt-0.5">
                Released IDs
              </p>
            </div>
          </div>
        </Link>

        {/* Total Users / Parents */}
        <Link to="/admin/users" className="group block">
          <div className="card-pop card-pop-hover rounded-2xl p-5 border-2 border-indigo-500/20 bg-gradient-to-br from-indigo-500/10 via-indigo-500/5 to-card relative overflow-hidden transition-all duration-300">
            <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-indigo-500/15 rounded-full blur-xl group-hover:scale-125 transition-transform" />
            <div className="flex items-center justify-between">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/25 rim-highlight">
                <Users className="h-6 w-6" />
              </div>
              <span className="flex items-center text-xs font-semibold text-indigo-600 dark:text-indigo-400 group-hover:translate-x-0.5 transition-transform">
                User accounts <ArrowUpRight className="h-3.5 w-3.5 ml-0.5" />
              </span>
            </div>
            <div className="mt-4">
              <div className="text-3xl font-extrabold tracking-tight text-foreground">
                {stats?.total_users ?? 0}
              </div>
              <p className="text-sm font-semibold text-muted-foreground mt-0.5">
                Total Solo Parent Accounts
              </p>
            </div>
          </div>
        </Link>
      </div>

      {/* ── Applications Requiring Review ───────────────────── */}
      <div className="card-pop rounded-2xl border-2 border-border/70 bg-card overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-border/60 bg-gradient-to-r from-muted/40 via-card to-card flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Applications Requiring Review</h2>
              <p className="text-xs text-muted-foreground">Actionable queue of solo parents awaiting initial qualification or final form assessment.</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap w-full xl:w-auto">
            <div className="flex bg-muted/40 p-1 rounded-xl items-center gap-1 overflow-x-auto max-w-full scrollbar-none">
              <button 
                onClick={() => setAppTypeFilter('all')} 
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors min-h-[36px] ${appTypeFilter === 'all' ? 'bg-background shadow-xs text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                All
              </button>
              <button 
                onClick={() => setAppTypeFilter('new')} 
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors min-h-[36px] ${appTypeFilter === 'new' ? 'bg-background shadow-xs text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                New ID
              </button>
              <button 
                onClick={() => setAppTypeFilter('renewal')} 
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors min-h-[36px] ${appTypeFilter === 'renewal' ? 'bg-background shadow-xs text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Renewal
              </button>
              <button 
                onClick={() => setAppTypeFilter('loss_spic')} 
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors min-h-[36px] ${appTypeFilter === 'loss_spic' ? 'bg-background shadow-xs text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Loss of SPIC
              </button>
            </div>

            <div className="flex items-center gap-2 flex-1 sm:flex-initial">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-48 h-9 text-xs rounded-xl border-border bg-background shadow-xs">
                  <SelectValue placeholder="Filter status" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all">All Needs Review</SelectItem>
                  <SelectItem value="submitted">Stage 1: Submitted (Docs)</SelectItem>
                  <SelectItem value="under_initial_review">Stage 1: Initial Review</SelectItem>
                  <SelectItem value="document_verification">Stage 1: Doc Verification</SelectItem>
                  <SelectItem value="under_final_assessment">Stage 2: Final Assessment</SelectItem>
                  <SelectItem value="under_final_verification">Stage 2: Final Verification</SelectItem>
                </SelectContent>
              </Select>
              <Button asChild size="sm" variant="outline" className="rounded-xl h-9 text-xs border-border bg-background shrink-0">
                <Link to="/admin/applicants">View All</Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile Record Cards List (< md) */}
        <div className="block md:hidden divide-y divide-border/50">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
              Loading applications queue…
            </div>
          ) : applications.filter(app => tab === 'needs_review' || ['submitted','under_initial_review','document_verification','under_final_assessment','under_final_verification'].includes(app.status)).length === 0 ? (
            <div className="p-8 text-center text-muted-foreground bg-muted/10">
              <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-2 text-emerald-600 dark:text-emerald-400">
                <CheckCircle className="h-6 w-6" />
              </div>
              <p className="font-bold text-sm text-foreground">All caught up!</p>
              <p className="text-xs text-muted-foreground mt-0.5">No applications requiring review.</p>
            </div>
          ) : applications.filter(app => statusFilter === 'all' ? ['submitted','under_initial_review','document_verification','under_final_assessment','under_final_verification'].includes(app.status) : app.status === statusFilter).map(app => (
            <div key={app.id} className="p-4 space-y-3 bg-card hover:bg-muted/30 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold text-sm text-foreground truncate">
                    {app.user?.full_name || app.applicant_name || '—'}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{app.user?.email || '—'}</p>
                </div>
                <StatusBadge status={app.status} />
              </div>

              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <Badge variant="outline" className="text-[11px] font-semibold px-2 py-0.5">
                  {app.application_type === 'renewal' || app.is_renewal ? 'Renewal' : app.application_type === 'loss_spic' ? 'Loss of SPIC' : 'New'}
                </Badge>
                <span className="inline-flex items-center rounded-lg bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 text-[11px] font-semibold uppercase">
                  {app.category?.code || app.solo_parent_category || '—'}
                </span>
                <span className="text-[11px] text-muted-foreground ml-auto">
                  {app.submitted_at ? format(new Date(app.submitted_at), 'MMM d, yyyy') : '—'}
                </span>
              </div>

              <Button asChild className="w-full min-h-[44px] rounded-xl font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs gap-2">
                <Link to={`/admin/applications/${app.id}`}>
                  <Eye className="h-4 w-4" /> Review Application
                </Link>
              </Button>
            </div>
          ))}
        </div>

        {/* Desktop Multi-column Table (>= md) */}
        <div className="hidden md:block overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="border-border/50">
                <TableHead className="font-semibold text-muted-foreground pl-6">Applicant</TableHead>
                <TableHead className="font-semibold text-muted-foreground">Type</TableHead>
                <TableHead className="font-semibold text-muted-foreground">Category</TableHead>
                <TableHead className="font-semibold text-muted-foreground">Review Stage</TableHead>
                <TableHead className="font-semibold text-muted-foreground">Status</TableHead>
                <TableHead className="font-semibold text-muted-foreground">Submitted Date</TableHead>
                <TableHead className="text-right font-semibold text-muted-foreground pr-6">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
                    Loading applications queue…
                  </TableCell>
                </TableRow>
              ) : applications.filter(app => tab === 'needs_review' || ['submitted','under_initial_review','document_verification','under_final_assessment','under_final_verification'].includes(app.status)).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-16 text-muted-foreground bg-muted/10">
                    <div className="h-14 w-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-3 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle className="h-8 w-8" />
                    </div>
                    <p className="font-bold text-base text-foreground">All caught up!</p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">There are no pending applications requiring review at this moment.</p>
                  </TableCell>
                </TableRow>
              ) : applications.filter(app => statusFilter === 'all' ? ['submitted','under_initial_review','document_verification','under_final_assessment','under_final_verification'].includes(app.status) : app.status === statusFilter).map(app => {
                const isStage1 = ['submitted', 'document_verification', 'under_initial_review'].includes(app.status);
                const isStage2 = ['under_final_assessment', 'under_final_verification'].includes(app.status);
                const isRegistered = ['approved', 'ready_for_printing', 'ready_for_release', 'released'].includes(app.status);

                return (
                  <TableRow key={app.id} className="hover:bg-muted/40 transition-colors group border-border/40">
                    <TableCell className="pl-6 py-4">
                      <div>
                        <p className="font-bold text-sm text-foreground">
                          {app.user?.full_name || app.applicant_name || '—'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">{app.user?.email || '—'}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs font-semibold px-2 py-0.5">
                        {app.application_type === 'renewal' || app.is_renewal ? 'Renewal' : app.application_type === 'loss_spic' ? 'Loss of SPIC' : 'New'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center rounded-lg bg-primary/10 text-primary border border-primary/20 px-2.5 py-1 text-xs font-semibold uppercase">
                        {app.category?.code || app.solo_parent_category || '—'}
                      </span>
                    </TableCell>
                    <TableCell>
                      {isStage1 ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                          Stage 1: Qualification & Docs
                        </span>
                      ) : isStage2 ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30">
                          Stage 2: Final Form Assessment
                        </span>
                      ) : isRegistered ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                          Registered Solo Parent ✓
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-muted text-muted-foreground border">
                          Draft / Inactive
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={app.status} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground font-medium">
                      {app.submitted_at ? format(new Date(app.submitted_at), 'MMM d, yyyy') : '—'}
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <Button asChild size="sm" className="rounded-xl font-semibold shadow-xs bg-primary hover:bg-primary/90 text-primary-foreground min-h-[36px]">
                        <Link to={`/admin/applications/${app.id}`}>
                          <Eye className="mr-1.5 h-3.5 w-3.5" /> Review
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* ── Status Pipeline & Distribution Panels (Zero-dependency CSS) ──── */}
      {chartData.length > 0 && (() => {
        const totalApps = chartData.reduce((acc, curr) => acc + curr.value, 0) || 1;
        return (
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Status Breakdown with Visual Progress Bars */}
            <div className="card-pop rounded-2xl border-2 border-border/70 bg-card p-6">
              <div className="flex items-center justify-between mb-5 pb-4 border-b border-border/50">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                    <BarChart2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-foreground">Application Status Pipeline</h3>
                    <p className="text-xs text-muted-foreground">Volume breakdown by processing status</p>
                  </div>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-muted text-foreground">
                  Total: {totalApps}
                </span>
              </div>

              {/* Segmented Pipeline Bar */}
              <div className="h-3 w-full rounded-full bg-muted/60 overflow-hidden flex mb-6 shadow-inner">
                {chartData.map((entry, idx) => {
                  const pct = (entry.value / totalApps) * 100;
                  if (pct <= 0) return null;
                  return (
                    <div 
                      key={idx}
                      style={{ width: `${pct}%`, backgroundColor: entry.fill }}
                      className="h-full transition-all duration-300 first:rounded-l-full last:rounded-r-full"
                      title={`${entry.name}: ${entry.value} (${pct.toFixed(1)}%)`}
                    />
                  );
                })}
              </div>

              {/* Status List with Progress Meters */}
              <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                {chartData.map((entry, idx) => {
                  const pct = Math.round((entry.value / totalApps) * 100) || 0;
                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.fill }} />
                          <span className="font-medium text-foreground">{entry.name}</span>
                        </div>
                        <div className="flex items-center gap-2 font-mono">
                          <span className="font-bold text-foreground">{entry.value}</span>
                          <span className="text-muted-foreground text-[11px]">({pct}%)</span>
                        </div>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div 
                          className="h-full rounded-full transition-all duration-300"
                          style={{ width: `${pct}%`, backgroundColor: entry.fill }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Stage Distribution Metric Cards */}
            <div className="card-pop rounded-2xl border-2 border-border/70 bg-card p-6">
              <div className="flex items-center justify-between mb-5 pb-4 border-b border-border/50">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                    <Layers className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-foreground">Applicant Distribution Ratio</h3>
                    <p className="text-xs text-muted-foreground">Proportional distribution across all stages</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 max-h-[260px] overflow-y-auto pr-1">
                {chartData.map((entry, idx) => {
                  const pct = ((entry.value / totalApps) * 100).toFixed(1);
                  return (
                    <div 
                      key={idx} 
                      className="p-3.5 rounded-xl border border-border/60 bg-muted/20 hover:bg-muted/40 transition-colors flex flex-col justify-between"
                    >
                      <div className="flex items-center justify-between gap-1 mb-2">
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: entry.fill }} />
                        <span className="text-[11px] font-bold font-mono px-1.5 py-0.5 rounded bg-muted text-foreground">
                          {pct}%
                        </span>
                      </div>
                      <div>
                        <div className="text-xl font-extrabold text-foreground">{entry.value}</div>
                        <div className="text-xs text-muted-foreground truncate" title={entry.name}>
                          {entry.name}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Quick Management Shortcuts ──────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Link to="/admin/categories" className="group block">
          <div className="card-pop card-pop-hover rounded-2xl p-5 border-2 border-border/60 bg-card flex items-center gap-4 transition-all">
            <div className="h-12 w-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
              <Tag className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-sm text-foreground flex items-center justify-between">
                Categories & Requirements <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">Manage RA 11861 categories and document rules</p>
            </div>
          </div>
        </Link>

        <Link to="/admin/barangays" className="group block">
          <div className="card-pop card-pop-hover rounded-2xl p-5 border-2 border-border/60 bg-card flex items-center gap-4 transition-all">
            <div className="h-12 w-12 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-600 dark:text-teal-400 group-hover:scale-110 transition-transform">
              <Users className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-sm text-foreground flex items-center justify-between">
                Barangay Directory <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-teal-600 transition-colors" />
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">Butuan City barangays and applicant density</p>
            </div>
          </div>
        </Link>

        <Link to="/admin/announcements" className="group block">
          <div className="card-pop card-pop-hover rounded-2xl p-5 border-2 border-border/60 bg-card flex items-center gap-4 transition-all">
            <div className="h-12 w-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform">
              <Activity className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-sm text-foreground flex items-center justify-between">
                Announcements & Updates <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-purple-600 transition-colors" />
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">Publish bulletins and assistance schedules</p>
            </div>
          </div>
        </Link>
      </div>

    </div>
  );
}
