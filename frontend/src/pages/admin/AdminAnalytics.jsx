import React, { useEffect, useState, useCallback } from 'react';
import { api, toastError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TrendingUp, RefreshCw, Users, FileText, CheckCircle, Clock, XCircle, AlertTriangle, Calendar, BarChart3, PieChart as PieIcon, MapPin, Briefcase } from 'lucide-react';

const CHART_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#6366f1',
];

function StatCard({ icon: Icon, label, value, sub, color = 'text-primary' }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <div className={`p-2.5 rounded-xl bg-muted ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-2xl font-bold leading-none">{value ?? '—'}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          {sub && <p className="text-xs text-muted-foreground/70">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function toChartData(obj) {
  return Object.entries(obj || {}).map(([name, value]) => ({ name, value: Number(value) }));
}

function MetricProgressList({ data, total, colors = CHART_COLORS, emptyText = "No data available." }) {
  if (!data || data.length === 0) {
    return <p className="text-xs text-muted-foreground text-center py-6">{emptyText}</p>;
  }

  const computedTotal = total || data.reduce((acc, curr) => acc + curr.value, 0) || 1;

  return (
    <div className="space-y-3">
      {data.map((item, idx) => {
        const pct = Math.round((item.value / computedTotal) * 100) || 0;
        const color = colors[idx % colors.length];
        return (
          <div key={idx} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 truncate pr-2">
                <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                <span className="font-medium text-foreground truncate" title={item.name}>{item.name}</span>
              </div>
              <div className="flex items-center gap-1.5 font-mono shrink-0">
                <span className="font-bold text-foreground">{item.value}</span>
                <span className="text-muted-foreground text-[11px]">({pct}%)</span>
              </div>
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div 
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${pct}%`, backgroundColor: color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function AdminAnalytics() {
  const [overview, setOverview]         = useState(null);
  const [demographics, setDemographics] = useState(null);
  const [trends, setTrends]             = useState([]);
  const [loading, setLoading]           = useState(true);

  const [period, setPeriod]     = useState('monthly');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo]     = useState('');
  const [barangay, setBarangay] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ov, dem, tr] = await Promise.all([
        api.get('/admin/analytics/overview'),
        api.get('/admin/analytics/demographics', { params: barangay ? { barangay } : {} }),
        api.get('/admin/analytics/trends', { params: { period, date_from: dateFrom || undefined, date_to: dateTo || undefined } }),
      ]);
      setOverview(ov.data);
      setDemographics(dem.data);
      setTrends(tr.data.trends || []);
    } catch (err) {
      toastError(err, 'Failed to load analytics.');
    } finally {
      setLoading(false);
    }
  }, [period, dateFrom, dateTo, barangay]);

  useEffect(() => { load(); }, [load]);

  const bs = overview?.by_status || {};
  const maxTrend = trends.length > 0 ? Math.max(...trends.map(t => Number(t.count) || 0), 1) : 1;
  const totalTrendCount = trends.reduce((acc, curr) => acc + (Number(curr.count) || 0), 0);

  return (
    <div className="flex-1 px-3 sm:px-6 py-4 sm:py-6 space-y-6 sm:space-y-8 w-full max-w-full overflow-x-hidden min-w-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2.5 sm:gap-3 font-display">
            <TrendingUp className="h-7 w-7 sm:h-8 sm:w-8 text-primary shrink-0" /> Advanced Analytics
          </h1>
          <p className="text-muted-foreground mt-1">
            Real-time demographic distributions and application trend analysis.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Users}        label="Total Applicants"    value={overview?.total_users}         color="text-blue-500" />
        <StatCard icon={FileText}     label="Total Applications"  value={overview?.total_applications}   color="text-purple-500" />
        <StatCard icon={Clock}        label="Needs Review"        value={overview?.needs_review_count}   color="text-amber-500" />
        <StatCard icon={AlertTriangle}label="IDs Near Expiry"     value={overview?.near_expiry_count}    color="text-rose-500" />
        <StatCard icon={CheckCircle}  label="Approved"            value={bs['approved'] ?? 0}            color="text-emerald-500" />
        <StatCard icon={CheckCircle}  label="Released"            value={bs['released'] ?? 0}            color="text-teal-500" />
        <StatCard icon={XCircle}      label="Rejected"            value={bs['rejected'] ?? 0}            color="text-red-500" />
        <StatCard icon={RefreshCw}    label="Active Renewals"     value={overview?.active_renewals}      color="text-indigo-500" />
      </div>

      {/* Trend Filters & Native CSS Bar Chart */}
      <Card>
        <CardHeader className="pb-3 border-b border-border/50">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" /> Application Trends
            </CardTitle>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary">
              Period Total: {totalTrendCount}
            </span>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3 mb-6">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">From</Label>
              <Input type="date" className="w-36 h-9 text-xs" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
              <Label className="text-xs text-muted-foreground">To</Label>
              <Input type="date" className="w-36 h-9 text-xs" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>
          </div>

          {loading ? (
            <div className="h-48 flex items-center justify-center">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : trends.length === 0 ? (
            <p className="text-center text-muted-foreground py-12 text-sm">No trend data for the selected period.</p>
          ) : (
            <div className="space-y-4">
              {/* Pure CSS Bar Visualizer */}
              <div className="h-48 flex items-end gap-2 pt-6 pb-2 border-b border-border/50 overflow-x-auto px-2">
                {trends.map((item, idx) => {
                  const val = Number(item.count) || 0;
                  const pct = Math.max(10, Math.round((val / maxTrend) * 100));
                  return (
                    <div key={idx} className="flex-1 min-w-[36px] flex flex-col items-center gap-1 group relative">
                      <span className="text-[10px] font-bold font-mono text-muted-foreground group-hover:text-primary transition-colors">
                        {val}
                      </span>
                      <div className="w-full bg-muted/40 rounded-t-md h-36 flex items-end justify-center p-1">
                        <div 
                          className="w-full bg-gradient-to-t from-primary to-primary/70 rounded-t transition-all duration-300 group-hover:brightness-110 shadow-xs"
                          style={{ height: `${pct}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-medium text-muted-foreground truncate w-full text-center mt-1" title={item.period}>
                        {item.period}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Demographics Panels — Pure CSS Meters */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Gender Distribution */}
        <Card>
          <CardHeader className="pb-3 border-b border-border/50">
            <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" /> Gender Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {loading ? (
              <div className="h-36 flex items-center justify-center"><RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : (
              <MetricProgressList data={toChartData(demographics?.by_gender)} />
            )}
          </CardContent>
        </Card>

        {/* Age Groups */}
        <Card>
          <CardHeader className="pb-3 border-b border-border/50">
            <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <Calendar className="h-4 w-4 text-indigo-500" /> Age Group Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {loading ? (
              <div className="h-36 flex items-center justify-center"><RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : (
              <MetricProgressList data={toChartData(demographics?.by_age_group)} />
            )}
          </CardContent>
        </Card>

        {/* Solo Parent Categories */}
        <Card>
          <CardHeader className="pb-3 border-b border-border/50">
            <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <FileText className="h-4 w-4 text-emerald-500" /> Solo Parent Categories
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {loading ? (
              <div className="h-36 flex items-center justify-center"><RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : (
              <div className="max-h-56 overflow-y-auto pr-1">
                <MetricProgressList data={toChartData(demographics?.by_category)} />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Barangays */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3 border-b border-border/50">
            <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <MapPin className="h-4 w-4 text-teal-500" /> Top Barangays by Applicant Count
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {loading ? (
              <div className="h-48 flex items-center justify-center"><RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : (
              <div className="max-h-64 overflow-y-auto pr-1">
                <MetricProgressList 
                  data={toChartData(demographics?.by_barangay)} 
                  colors={['#0e4b65', '#0ea5e9', '#10b981', '#6366f1', '#f59e0b']}
                  emptyText="No barangay data recorded yet."
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Civil Status */}
        <Card>
          <CardHeader className="pb-3 border-b border-border/50">
            <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <Users className="h-4 w-4 text-purple-500" /> Civil Status
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {loading ? (
              <div className="h-48 flex items-center justify-center"><RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : (
              <MetricProgressList data={toChartData(demographics?.by_civil_status)} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Employment Status */}
      <Card>
        <CardHeader className="pb-3 border-b border-border/50">
          <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-amber-500" /> Employment Status Distribution
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {loading ? (
            <div className="h-32 flex items-center justify-center"><RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <MetricProgressList data={toChartData(demographics?.by_employment)} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
