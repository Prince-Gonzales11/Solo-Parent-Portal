import React, { useEffect, useState, useCallback } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { api, toastError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TypeableSelect } from '@/components/ui/typeable-select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import {
  RefreshCw, Search, Eye, Users, Clock, CheckCircle,
  Filter, ChevronLeft, ChevronRight, ClipboardList, AlertTriangle, X, Tag, Sparkles,
  Phone, MapPin, CreditCard
} from 'lucide-react';

/* ─── Status config ──────────────────────────────────────────── */
const STATUS_CONFIG = {
  draft:                           { label: 'Draft',              color: '#94a3b8' },
  submitted:                       { label: 'Submitted',          color: '#3b82f6' },
  under_initial_review:            { label: 'Initial Review',     color: '#6366f1' },
  document_verification:           { label: 'Doc Verification',   color: '#8b5cf6' },
  pending_additional_requirements: { label: 'Needs Documents',    color: '#f59e0b' },
  under_final_assessment:          { label: 'Final Assessment',   color: '#06b6d4' },
  under_final_verification:        { label: 'Final Verification', color: '#0ea5e9' },
  approved:                        { label: 'Approved',           color: '#10b981' },
  ready_for_printing:              { label: 'Ready to Print',     color: '#059669' },
  ready_for_release:               { label: 'For Release',        color: '#047857' },
  ready_for_pickup:                { label: 'Ready for Pickup',   color: '#0d9488' },
  completed:                       { label: 'Completed',          color: '#059669' },
  released:                        { label: 'Released',           color: '#065f46' },
  rejected:                        { label: 'Rejected',           color: '#ef4444' },
  expired:                         { label: 'Expired',            color: '#6b7280' },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || { label: status, color: '#94a3b8' };
  return (
    <Badge style={{ backgroundColor: cfg.color + '20', color: cfg.color, border: `1px solid ${cfg.color}40` }}>
      {cfg.label}
    </Badge>
  );
}

function StatCard({ label, value, icon: Icon, color, active, onClick }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
      className={`card-pop card-pop-hover rounded-2xl p-5 border-2 bg-card relative overflow-hidden transition-all duration-300 cursor-pointer select-none text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
        active
          ? 'border-primary ring-2 ring-primary/40 shadow-md bg-primary/5'
          : 'border-border/60 hover:border-primary/40'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-4 min-w-0">
          <div className={`h-12 w-12 rounded-xl flex items-center justify-center text-white shadow-md ${color} rim-highlight shrink-0`}>
            <Icon className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground truncate">{value}</p>
            <p className="text-xs font-semibold text-muted-foreground mt-0.5 truncate">{label}</p>
          </div>
        </div>
        {active && (
          <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary text-primary-foreground shrink-0 shadow-2xs">
            Active
          </span>
        )}
      </div>
    </div>
  );
}

export default function AdminApplicants() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [applications, setApplications] = useState([]);
  const [categories, setCategories] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);

  // Active section/tab and special queue group
  const activeTab = searchParams.get('tab') || 'all';
  const groupParam = searchParams.get('group') || '';

  // Filters
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all');
  const [typeFilter, setTypeFilter] = useState(searchParams.get('type') || 'all');
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get('category') || 'all');
  const [barangayFilter, setBarangayFilter] = useState(searchParams.get('barangay') || 'all');
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1);
  const perPage = 25;

  const fetchStats = async () => {
    try {
      const res = await api.get('/admin/analytics/overview', { cache: false });
      setStats(res.data);
    } catch { /* non-fatal */ }
  };

  const fetchMetadata = async () => {
    try {
      const [catRes, brgyRes] = await Promise.all([
        api.get('/public/categories').catch(() => ({ data: [] })),
        api.get('/public/barangays').catch(() => ({ data: [] }))
      ]);
      const catData = Array.isArray(catRes.data) ? catRes.data : (catRes.data?.data || []);
      const brgyData = Array.isArray(brgyRes.data) ? brgyRes.data : (brgyRes.data?.data || []);
      setCategories(catData);
      setBarangays(brgyData);
    } catch { /* non-fatal */ }
  };

  const fetchApplications = useCallback(async () => {
    setLoading(true);
    try {
      const currentTab = searchParams.get('tab') || 'all';
      const currentGroup = searchParams.get('group') || '';

      const params = {
        tab: currentTab,
        page,
        per_page: perPage,
      };

      if (currentGroup) params.group = currentGroup;
      if (search.trim()) params.search = search.trim();
      if (statusFilter !== 'all') params.status = statusFilter;
      if (typeFilter !== 'all') params.application_type = typeFilter;
      if (categoryFilter !== 'all') params.category = categoryFilter;
      if (barangayFilter !== 'all') params.barangay = barangayFilter;

      const res = await api.get('/admin/applications', { params, cache: false });
      const data = res.data.data || res.data.items || (Array.isArray(res.data) ? res.data : []);
      setApplications(data);
    } catch (err) {
      toastError(err, 'Failed to load applicants.');
    } finally {
      setLoading(false);
    }
  }, [searchParams, search, statusFilter, typeFilter, categoryFilter, barangayFilter, page]);

  useEffect(() => { 
    fetchStats(); 
    fetchMetadata();
  }, []);

  useEffect(() => { 
    // Synchronize filters if URL params change
    const statusFromUrl = searchParams.get('status') || 'all';
    if (statusFromUrl !== statusFilter) {
      setStatusFilter(statusFromUrl);
    }
    const catFromUrl = searchParams.get('category');
    if (catFromUrl && catFromUrl !== categoryFilter) {
      setCategoryFilter(catFromUrl);
    }
    const brgyFromUrl = searchParams.get('barangay');
    if (brgyFromUrl && brgyFromUrl !== barangayFilter) {
      setBarangayFilter(brgyFromUrl);
    }
    const typeFromUrl = searchParams.get('type') || 'all';
    if (typeFromUrl !== typeFilter) {
      setTypeFilter(typeFromUrl);
    }
    const pageFromUrl = Number(searchParams.get('page')) || 1;
    if (pageFromUrl !== page) {
      setPage(pageFromUrl);
    }
  }, [searchParams]);

  useEffect(() => { 
    fetchApplications(); 
  }, [fetchApplications]);

  // Smart polling: auto-refresh application list and stats every 6s, paused when tab is hidden
  useEffect(() => {
    let intervalId = null;
    let inFlight = false;
    const POLL_INTERVAL = 8000;

    const silentFetch = async () => {
      if ((typeof navigator !== 'undefined' && !navigator.onLine) || document.hidden || inFlight) return;
      inFlight = true;
      try {
        const currentTab = searchParams.get('tab') || 'all';
        const currentGroup = searchParams.get('group') || '';
        const params = {
          tab: currentTab,
          page,
          per_page: perPage,
        };
        if (currentGroup) params.group = currentGroup;
        if (search.trim()) params.search = search.trim();
        if (statusFilter !== 'all') params.status = statusFilter;
        if (typeFilter !== 'all') params.application_type = typeFilter;
        if (categoryFilter !== 'all') params.category = categoryFilter;
        if (barangayFilter !== 'all') params.barangay = barangayFilter;

        const [appRes, statsRes] = await Promise.allSettled([
          api.get('/admin/applications', { params, cache: false }),
          api.get('/admin/analytics/overview', { cache: false })
        ]);
        if (appRes.status === 'fulfilled') {
          const res = appRes.value;
          const data = res.data.data || res.data.items || (Array.isArray(res.data) ? res.data : []);
          setApplications(data);
        }
        if (statsRes.status === 'fulfilled') {
          setStats(statsRes.value.data);
        }
      } catch {
        // Silent background polling
      } finally {
        inFlight = false;
      }
    };

    const startPolling = () => {
      if (!intervalId) intervalId = setInterval(silentFetch, POLL_INTERVAL);
    };
    const stopPolling = () => {
      if (intervalId) { clearInterval(intervalId); intervalId = null; }
    };

    const handleVisibility = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        silentFetch();
        startPolling();
      }
    };

    const handleOnline = () => {
      silentFetch();
      startPolling();
    };

    const handleOffline = () => {
      stopPolling();
    };

    startPolling();
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [searchParams, search, statusFilter, typeFilter, categoryFilter, barangayFilter, page]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchApplications();
  };

  const handleSelectTab = (tabId, extra = {}) => {
    setSearchParams(prev => {
      const p = new URLSearchParams(prev);
      p.set('tab', tabId);
      if (extra.group) {
        p.set('group', extra.group);
      } else {
        p.delete('group');
      }
      if (extra.status) {
        p.set('status', extra.status);
      } else if (tabId !== 'all') {
        p.delete('status');
      }
      p.delete('page');
      return p;
    });
    setPage(1);
  };

  const clearCategoryFilter = () => {
    setCategoryFilter('all');
    setSearchParams(prev => {
      const p = new URLSearchParams(prev);
      p.delete('category');
      return p;
    });
    setPage(1);
  };

  const clearBarangayFilter = () => {
    setBarangayFilter('all');
    setSearchParams(prev => {
      const p = new URLSearchParams(prev);
      p.delete('barangay');
      return p;
    });
    setPage(1);
  };

  const clearGroupFilter = () => {
    setSearchParams(prev => {
      const p = new URLSearchParams(prev);
      p.delete('group');
      return p;
    });
    setPage(1);
  };

  const activeCategoryObj = Array.isArray(categories) 
    ? categories.find(c => c.code?.toLowerCase() === categoryFilter?.toLowerCase() || c.id === categoryFilter)
    : null;

  const isPendingReviewActive = activeTab === 'all' && (groupParam === 'needs_review' || statusFilter === 'submitted' || statusFilter === 'pending_review');

  return (
    <div className="flex-1 px-2.5 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-6 bg-gradient-to-b from-surface-muted to-background min-h-screen w-full max-w-full overflow-x-hidden min-w-0">

      {/* ── Header ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-foreground font-display break-words">Applicants & Applications</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            Comprehensive registry of Solo Parent ID applications, review queues & verifications.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { fetchStats(); fetchApplications(); }} className="card-pop bg-card">
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
        </div>
      </div>

      {/* ── Stat Cards (Clickable Navigation Controls) ─────── */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Registered"
            value={stats.total_registered ?? 0}
            icon={Users}
            color="bg-primary"
            active={activeTab === 'registered'}
            onClick={() => handleSelectTab('registered')}
          />
          <StatCard
            label="Pending Review"
            value={stats.needs_review_count || 0}
            icon={Clock}
            color="bg-amber-500"
            active={isPendingReviewActive}
            onClick={() => handleSelectTab('all', { group: 'needs_review' })}
          />
          <StatCard
            label="Approved Applications"
            value={stats.approved_count ?? 0}
            icon={CheckCircle}
            color="bg-emerald-600"
            active={activeTab === 'approved'}
            onClick={() => handleSelectTab('approved')}
          />
          <StatCard
            label="Released IDs"
            value={stats.released_count ?? 0}
            icon={Sparkles}
            color="bg-teal-600"
            active={activeTab === 'released'}
            onClick={() => handleSelectTab('released')}
          />
        </div>
      )}

      {/* ── Registry Management Tabs ───────────────────────────── */}
      <div className="card-pop rounded-2xl border-2 border-border/70 bg-card p-1.5 overflow-x-auto scrollbar-none w-full max-w-full">
        <div className="flex items-center gap-1.5 min-w-max sm:min-w-0">
          {[
            { id: 'all', label: 'All Applications', icon: ClipboardList, count: stats?.total_applications },
            { id: 'registered', label: 'Registered Solo Parents', icon: Users, count: stats?.total_registered },
            { id: 'approved', label: 'Approved Applications', icon: CheckCircle, count: stats?.approved_count },
            { id: 'released', label: 'Released IDs', icon: Sparkles, count: stats?.released_count },
          ].map((t) => {
            const isSelected = activeTab === t.id && (!groupParam || t.id !== 'all');
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => handleSelectTab(t.id)}
                className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 cursor-pointer touch-manipulation min-h-[38px] ${
                  isSelected
                    ? 'bg-primary text-primary-foreground shadow-sm ring-2 ring-primary/30'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{t.label}</span>
                {typeof t.count === 'number' && (
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                    isSelected ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'
                  }`}>
                    {t.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Active Filter Banners (Queue / Category / Barangay) ───── */}
      <div className="flex flex-col gap-3">
        {groupParam === 'needs_review' && (
          <div className="card-pop rounded-2xl p-4 bg-amber-500/10 border-2 border-amber-500/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                <Clock className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Filtered by Review Queue</p>
                <p className="text-sm font-bold text-foreground">Applications Requiring Review (Submitted, Document Verification & Assessments)</p>
              </div>
            </div>
            <Button size="sm" variant="ghost" onClick={clearGroupFilter} className="h-8 text-xs text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5 mr-1" /> View All
            </Button>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          {categoryFilter !== 'all' && (
            <div className="card-pop rounded-2xl p-4 bg-primary/10 border-2 border-primary/30 flex items-center justify-between flex-1">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-primary text-white flex items-center justify-center font-mono font-bold text-xs uppercase shadow-xs">
                  {activeCategoryObj?.code || categoryFilter}
                </div>
                <div>
                  <p className="text-xs font-semibold text-primary uppercase tracking-wider">Filtered by Category</p>
                  <p className="text-sm font-bold text-foreground">{activeCategoryObj?.name || `Category ${categoryFilter}`}</p>
                </div>
              </div>
              <Button size="sm" variant="ghost" onClick={clearCategoryFilter} className="h-8 text-xs text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5 mr-1" /> Clear
              </Button>
            </div>
          )}

          {barangayFilter !== 'all' && (
            <div className="card-pop rounded-2xl p-4 bg-indigo-500/10 border-2 border-indigo-500/30 flex items-center justify-between flex-1">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                  <Users className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">Filtered by Barangay</p>
                  <p className="text-sm font-bold text-foreground">Barangay {barangayFilter}</p>
                </div>
              </div>
              <Button size="sm" variant="ghost" onClick={clearBarangayFilter} className="h-8 text-xs text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5 mr-1" /> Clear
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* ── Search & Filters ──────────────────────────────── */}
      <div className="card-pop rounded-2xl border-2 border-border/70 bg-card p-4">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, email, or reference number..."
              className="pl-10 rounded-xl"
            />
          </div>

          <Select value={categoryFilter} onValueChange={v => { setCategoryFilter(v); setPage(1); }}>
            <SelectTrigger className="w-full sm:w-52 rounded-xl">
              <Tag className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent className="rounded-xl max-h-72">
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.code}>
                  <span className="font-mono font-bold uppercase mr-1.5">{c.code}:</span>
                  {c.name.length > 24 ? c.name.slice(0, 24) + '…' : c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="w-full sm:w-48">
            <TypeableSelect
              value={barangayFilter === 'all' ? '' : barangayFilter}
              onChange={v => {
                setBarangayFilter(v || 'all');
                setPage(1);
              }}
              options={[
                { value: 'all', label: 'All Barangays' },
                ...barangays.map(b => ({ value: b.name, label: b.name }))
              ]}
              placeholder="All Barangays"
              icon={Users}
            />
          </div>

          {activeTab === 'all' && (
            <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1); }}>
              <SelectTrigger className="w-full sm:w-40 rounded-xl">
                <Filter className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">All Statuses</SelectItem>
                {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                  <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full sm:w-32 h-10 rounded-xl bg-background border-border shadow-xs">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="new">New ID</SelectItem>
              <SelectItem value="renewal">Renewal</SelectItem>
              <SelectItem value="loss_spic">Loss of SPIC</SelectItem>
            </SelectContent>
          </Select>

          <Button type="submit" size="sm" className="w-full sm:w-auto h-10 rounded-xl shrink-0 font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs touch-manipulation cursor-pointer">
            <Search className="h-4 w-4 mr-1.5" /> Search
          </Button>
        </form>
      </div>

      {/* ── 3 Separate Service Queues Filter Buttons ─────── */}
      <div className="w-full max-w-full overflow-x-auto pb-1 scrollbar-none min-w-0">
        <div className="flex items-center gap-2 min-w-max sm:min-w-0 sm:flex-wrap">
          {[
            { key: 'all', label: 'All Services', icon: Users },
            { key: 'new', label: 'New Solo Parent ID', icon: ClipboardList },
            { key: 'renewal', label: 'Renewal', icon: RefreshCw },
            { key: 'loss_spic', label: 'Loss of SPIC', icon: AlertTriangle },
          ].map(t => {
            const active = typeFilter === t.key;
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => {
                  setTypeFilter(t.key);
                  setSearchParams(prev => {
                    const p = new URLSearchParams(prev);
                    if (t.key === 'all') p.delete('type');
                    else p.set('type', t.key);
                    return p;
                  });
                  setPage(1);
                }}
                className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-xs shrink-0 touch-manipulation min-h-[38px] ${
                  active
                    ? 'bg-primary text-primary-foreground shadow-sm ring-2 ring-primary/30'
                    : 'bg-card border-2 border-border/70 text-muted-foreground hover:text-foreground hover:bg-muted/40'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Applicants Registry Container ─────────────────── */}
      <div className="card-pop rounded-2xl border-2 border-border/70 bg-card overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-border/60 bg-gradient-to-r from-muted/30 to-card flex items-center justify-between">
          <div className="flex items-center gap-2">
            {activeTab === 'registered' ? (
              <Users className="h-5 w-5 text-primary" />
            ) : activeTab === 'approved' ? (
              <CheckCircle className="h-5 w-5 text-emerald-600" />
            ) : activeTab === 'released' ? (
              <Sparkles className="h-5 w-5 text-teal-600" />
            ) : (
              <ClipboardList className="h-5 w-5 text-primary" />
            )}
            <h3 className="font-bold text-sm sm:text-base text-foreground">
              {activeTab === 'registered'
                ? `Registered Solo Parents (${applications.length})`
                : activeTab === 'approved'
                ? `Approved Applications (${applications.length})`
                : activeTab === 'released'
                ? `Released Solo Parent IDs (${applications.length})`
                : groupParam === 'needs_review'
                ? `Applications Requiring Review (${applications.length})`
                : `All Applications Records (${applications.length})`}
            </h3>
          </div>
        </div>
        
        {/* Mobile Record Cards View (< md) */}
        <div className="block md:hidden divide-y divide-border/60">
          {loading ? (
            <div className="p-10 text-center text-muted-foreground">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
              <p className="text-xs font-semibold">Loading applicants registry…</p>
            </div>
          ) : applications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground bg-muted/10">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-30 text-primary" />
              <p className="font-bold text-sm text-foreground">No records found</p>
              <p className="text-xs text-muted-foreground mt-1">
                {search || categoryFilter !== 'all' || barangayFilter !== 'all' ? 'Try adjusting your search filters.' : 'No records registered in this section yet.'}
              </p>
            </div>
          ) : (
            applications.map(app => {
              const applicantName = app.user?.full_name || app.applicant_name || '—';
              const applicantEmail = app.user?.email || '—';
              const applicantPhone = app.user?.profile?.contact_number || app.user?.phone_number || '—';
              const applicantBarangay = app.user?.user_profile?.barangay || app.user?.profile?.barangayRecord?.name || app.user?.profile?.barangay || '—';
              const idNumber = app.id_card_number || app.beneficiary_code || null;

              return (
                <div
                  key={app.id}
                  onClick={() => navigate(`/admin/applications/${app.id}`)}
                  className="p-4 hover:bg-muted/30 transition-colors cursor-pointer space-y-2.5 touch-manipulation"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-sm text-foreground leading-snug truncate">
                        {applicantName}
                      </p>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {applicantEmail}
                      </p>
                    </div>
                    <StatusBadge status={app.status} />
                  </div>

                  {activeTab === 'registered' && (
                    <div className="space-y-1.5 text-xs">
                      {idNumber && (
                        <div className="flex items-center gap-1.5 font-mono text-[11px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-md w-fit">
                          <CreditCard className="h-3 w-3" />
                          ID: {idNumber}
                        </div>
                      )}
                      <div className="flex items-center gap-3 text-muted-foreground flex-wrap">
                        {applicantPhone !== '—' && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" /> {applicantPhone}
                          </span>
                        )}
                        {applicantBarangay !== '—' && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> Brgy. {applicantBarangay}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <span className="font-mono text-[11px] font-semibold bg-muted/80 px-2 py-0.5 rounded-md text-foreground">
                      {app.reference_no || '—'}
                    </span>
                    <Badge variant="outline" className="text-[10px] font-semibold py-0">
                      {app.application_type === 'renewal' || app.is_renewal ? 'Renewal' : app.application_type === 'loss_spic' ? 'Loss of SPIC' : 'New ID'}
                    </Badge>
                    <span className="inline-flex items-center rounded-md bg-primary/10 text-primary border border-primary/20 px-1.5 py-0 text-[10px] font-semibold uppercase">
                      Cat: {app.category?.code || app.solo_parent_category || '—'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-muted-foreground">
                      {activeTab === 'approved' && app.decided_at ? (
                        <>Approved: {format(new Date(app.decided_at), 'MMM d, yyyy')}</>
                      ) : activeTab === 'released' && (app.released_at || app.decided_at) ? (
                        <>Released: {format(new Date(app.released_at || app.decided_at), 'MMM d, yyyy')}</>
                      ) : (
                        <>Submitted: {app.submitted_at ? format(new Date(app.submitted_at), 'MMM d, yyyy') : '—'}</>
                      )}
                    </span>
                    <Button
                      size="sm"
                      className="h-8 px-3 text-xs font-semibold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-2xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/admin/applications/${app.id}`);
                      }}
                    >
                      <Eye className="h-3.5 w-3.5 mr-1" />
                      {activeTab === 'registered' || activeTab === 'released' ? 'View Details' : 'Review'}
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop Table View (>= md) */}
        <div className="hidden md:block overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              {activeTab === 'registered' ? (
                <TableRow className="border-border/50">
                  <TableHead className="font-semibold pl-6">Solo Parent</TableHead>
                  <TableHead className="font-semibold">Beneficiary / ID No.</TableHead>
                  <TableHead className="font-semibold">Contact</TableHead>
                  <TableHead className="font-semibold">Barangay</TableHead>
                  <TableHead className="font-semibold">Category</TableHead>
                  <TableHead className="font-semibold">Associated Service</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="text-right font-semibold pr-6">Action</TableHead>
                </TableRow>
              ) : activeTab === 'approved' ? (
                <TableRow className="border-border/50">
                  <TableHead className="font-semibold pl-6">Applicant</TableHead>
                  <TableHead className="font-semibold">Reference No.</TableHead>
                  <TableHead className="font-semibold">Service Type</TableHead>
                  <TableHead className="font-semibold">Category</TableHead>
                  <TableHead className="font-semibold">Approval Date</TableHead>
                  <TableHead className="font-semibold">Current Status</TableHead>
                  <TableHead className="text-right font-semibold pr-6">Action</TableHead>
                </TableRow>
              ) : activeTab === 'released' ? (
                <TableRow className="border-border/50">
                  <TableHead className="font-semibold pl-6">Applicant</TableHead>
                  <TableHead className="font-semibold">Reference No.</TableHead>
                  <TableHead className="font-semibold">Service Type</TableHead>
                  <TableHead className="font-semibold">ID Card Details</TableHead>
                  <TableHead className="font-semibold">Release Date</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="text-right font-semibold pr-6">Action</TableHead>
                </TableRow>
              ) : (
                <TableRow className="border-border/50">
                  <TableHead className="font-semibold pl-6">Applicant</TableHead>
                  <TableHead className="font-semibold">Reference No.</TableHead>
                  <TableHead className="font-semibold">Type</TableHead>
                  <TableHead className="font-semibold">Category</TableHead>
                  <TableHead className="font-semibold">Submitted</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="text-right font-semibold pr-6">Action</TableHead>
                </TableRow>
              )}
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-16 text-muted-foreground">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
                    Loading registry records…
                  </TableCell>
                </TableRow>
              ) : applications.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-16 text-muted-foreground bg-muted/10">
                    <Users className="h-10 w-10 mx-auto mb-3 opacity-30 text-primary" />
                    <p className="font-bold text-base text-foreground">No records found</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {search || categoryFilter !== 'all' || barangayFilter !== 'all' ? 'Try clearing or adjusting your search filters.' : 'No records exist in this registry section yet.'}
                    </p>
                  </TableCell>
                </TableRow>
              ) : applications.map(app => {
                const applicantName = app.user?.full_name || app.applicant_name || '—';
                const applicantEmail = app.user?.email || '—';
                const applicantPhone = app.user?.profile?.contact_number || app.user?.phone_number || '—';
                const applicantBarangay = app.user?.user_profile?.barangay || app.user?.profile?.barangayRecord?.name || app.user?.profile?.barangay || '—';
                const idNumber = app.id_card_number || app.beneficiary_code || '—';
                const serviceLabel = app.application_type === 'renewal' || app.is_renewal ? 'Renewal' : app.application_type === 'loss_spic' ? 'Loss of SPIC' : 'New ID';

                if (activeTab === 'registered') {
                  return (
                    <TableRow 
                      key={app.id} 
                      className="hover:bg-muted/40 transition-colors group cursor-pointer border-border/40"
                      onClick={() => navigate(`/admin/applications/${app.id}`)}
                    >
                      <TableCell className="pl-6 py-4">
                        <div>
                          <p className="font-bold text-sm text-foreground">{applicantName}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{applicantEmail}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-xs font-semibold bg-primary/10 text-primary px-2.5 py-1 rounded-md border border-primary/20 whitespace-nowrap">
                          {idNumber}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-foreground font-medium whitespace-nowrap">
                        {applicantPhone}
                      </TableCell>
                      <TableCell className="text-xs text-foreground font-medium">
                        {applicantBarangay !== '—' ? `Brgy. ${applicantBarangay}` : '—'}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center rounded-lg bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 text-xs font-semibold uppercase">
                          {app.category?.code || app.solo_parent_category || '—'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-0.5">
                          <span className="font-mono text-xs text-muted-foreground block">{app.reference_no || '—'}</span>
                          <Badge variant="outline" className="text-[10px] font-semibold px-1.5 py-0">
                            {serviceLabel}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={app.status} />
                      </TableCell>
                      <TableCell className="text-right pr-6" onClick={e => e.stopPropagation()}>
                        <Button asChild size="sm" className="rounded-xl font-semibold shadow-xs bg-primary hover:bg-primary/90 text-primary-foreground">
                          <Link to={`/admin/applications/${app.id}`}>
                            <Eye className="mr-1.5 h-3.5 w-3.5" /> View Details
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                }

                if (activeTab === 'approved') {
                  const approvalDate = app.decided_at 
                    ? format(new Date(app.decided_at), 'MMM d, yyyy') 
                    : (app.updated_at ? format(new Date(app.updated_at), 'MMM d, yyyy') : '—');

                  return (
                    <TableRow 
                      key={app.id} 
                      className="hover:bg-muted/40 transition-colors group cursor-pointer border-border/40"
                      onClick={() => navigate(`/admin/applications/${app.id}`)}
                    >
                      <TableCell className="pl-6 py-4">
                        <div>
                          <p className="font-bold text-sm text-foreground">{applicantName}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{applicantEmail}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-xs font-semibold bg-muted/60 px-2 py-1 rounded-md text-foreground">{app.reference_no || '—'}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs font-semibold px-2 py-0.5 whitespace-nowrap">
                          {serviceLabel}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center rounded-lg bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 text-xs font-semibold uppercase">
                          {app.category?.code || app.solo_parent_category || '—'}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground font-medium">
                        {approvalDate}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={app.status} />
                      </TableCell>
                      <TableCell className="text-right pr-6" onClick={e => e.stopPropagation()}>
                        <Button asChild size="sm" className="rounded-xl font-semibold shadow-xs bg-primary hover:bg-primary/90 text-primary-foreground">
                          <Link to={`/admin/applications/${app.id}`}>
                            <Eye className="mr-1.5 h-3.5 w-3.5" /> Review / Details
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                }

                if (activeTab === 'released') {
                  const releaseDate = app.released_at 
                    ? format(new Date(app.released_at), 'MMM d, yyyy') 
                    : (app.decided_at ? format(new Date(app.decided_at), 'MMM d, yyyy') : (app.updated_at ? format(new Date(app.updated_at), 'MMM d, yyyy') : '—'));

                  return (
                    <TableRow 
                      key={app.id} 
                      className="hover:bg-muted/40 transition-colors group cursor-pointer border-border/40"
                      onClick={() => navigate(`/admin/applications/${app.id}`)}
                    >
                      <TableCell className="pl-6 py-4">
                        <div>
                          <p className="font-bold text-sm text-foreground">{applicantName}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{applicantEmail}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-xs font-semibold bg-muted/60 px-2 py-1 rounded-md text-foreground">{app.reference_no || '—'}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs font-semibold px-2 py-0.5 whitespace-nowrap">
                          {serviceLabel}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-xs font-semibold bg-teal-500/10 text-teal-700 dark:text-teal-300 px-2.5 py-1 rounded-md border border-teal-500/20 whitespace-nowrap">
                          {idNumber !== '—' ? idNumber : 'Physical ID Released'}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground font-medium">
                        {releaseDate}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={app.status} />
                      </TableCell>
                      <TableCell className="text-right pr-6" onClick={e => e.stopPropagation()}>
                        <Button asChild size="sm" className="rounded-xl font-semibold shadow-xs bg-primary hover:bg-primary/90 text-primary-foreground">
                          <Link to={`/admin/applications/${app.id}`}>
                            <Eye className="mr-1.5 h-3.5 w-3.5" /> View Details
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                }

                // Default: All Applications view
                return (
                  <TableRow 
                    key={app.id} 
                    className="hover:bg-muted/40 transition-colors group cursor-pointer border-border/40"
                    onClick={() => navigate(`/admin/applications/${app.id}`)}
                  >
                    <TableCell className="pl-6 py-4">
                      <div>
                        <p className="font-bold text-sm text-foreground">{applicantName}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{applicantEmail}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs font-semibold bg-muted/60 px-2 py-1 rounded-md text-foreground">{app.reference_no || '—'}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs font-semibold px-2 py-0.5 whitespace-nowrap">
                        {serviceLabel}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center rounded-lg bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 text-xs font-semibold uppercase">
                        {app.category?.code || app.solo_parent_category || '—'}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground font-medium">
                      {app.submitted_at ? format(new Date(app.submitted_at), 'MMM d, yyyy') : '—'}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={app.status} />
                    </TableCell>
                    <TableCell className="text-right pr-6" onClick={e => e.stopPropagation()}>
                      <Button asChild size="sm" className="rounded-xl font-semibold shadow-xs bg-primary hover:bg-primary/90 text-primary-foreground">
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

        {/* Pagination */}
        {applications.length >= perPage && (
          <div className="flex flex-col sm:flex-row items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-t border-border/50 bg-muted/20 gap-3">
            <p className="text-xs text-muted-foreground">Page {page}</p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)} className="rounded-xl min-h-[36px]">
                <ChevronLeft className="h-4 w-4 mr-1" /> Prev
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} className="rounded-xl min-h-[36px]">
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
