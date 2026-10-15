import React, { useEffect, useState } from 'react';
import { api, toastError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { Shield, RefreshCw, Search, ChevronLeft, ChevronRight, Info } from 'lucide-react';

const ACTION_LABELS = {
  'application.status_changed':        { label: 'Status Changed',       color: 'bg-info-soft text-info dark:bg-info-soft dark:text-info' },
  'document.verified':                 { label: 'Document Verified',     color: 'bg-green-100 text-success dark:bg-green-900/40 dark:text-success' },
  'user.role_changed':                 { label: 'Role Changed',          color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' },
  'user.activated':                    { label: 'User Activated',        color: 'bg-success-soft text-success' },
  'user.suspended':                    { label: 'User Suspended',        color: 'bg-danger-soft text-danger dark:bg-danger-soft dark:text-danger' },
  'user.created':                      { label: 'User Created',          color: 'bg-teal-100 text-teal-700' },
  'user.password_reset':               { label: 'Password Reset',        color: 'bg-warning-soft text-warning' },
  'barangay.created':                  { label: 'Barangay Added',        color: 'bg-muted/50 text-foreground' },
  'barangay.updated':                  { label: 'Barangay Updated',      color: 'bg-muted/50 text-foreground' },
  'barangay.deleted':                  { label: 'Barangay Deleted',      color: 'bg-danger-soft text-danger' },
  'application.official_fields_saved': { label: 'Official Fields Saved', color: 'bg-indigo-100 text-indigo-700' },
  'announcement.created':              { label: 'Announcement Created',  color: 'bg-cyan-100 text-cyan-700' },
  'announcement.updated':              { label: 'Announcement Updated',  color: 'bg-cyan-100 text-cyan-700' },
  'announcement.deleted':              { label: 'Announcement Deleted',  color: 'bg-danger-soft text-danger' },
  'maintenance.renewal_reminders':     { label: 'Renewal Reminders',     color: 'bg-warning-soft text-warning' },
};

function ActionBadge({ action }) {
  const cfg = ACTION_LABELS[action] || { label: action, color: 'bg-gray-100 text-gray-700' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

function MetaViewer({ meta }) {
  if (!meta || Object.keys(meta).length === 0) return null;
  return (
    <pre className="mt-2 text-xs bg-muted/50 rounded p-2 overflow-auto max-h-32 whitespace-pre-wrap text-muted-foreground">
      {JSON.stringify(meta, null, 2)}
    </pre>
  );
}

export default function AdminAuditLogs() {
  const [logs, setLogs]         = useState([]);
  const [meta, setMeta]         = useState({ current_page: 1, last_page: 1, total: 0 });
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo]     = useState('');
  const [page, setPage]         = useState(1);
  const [expanded, setExpanded] = useState(null);

  const load = async (pg = page) => {
    setLoading(true);
    try {
      const params = { page: pg };
      if (search) params.search = search;
      if (actionFilter !== 'all') params.action = actionFilter;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo)   params.date_to   = dateTo;
      const res = await api.get('/admin/audit-logs', { params });
      const d = res.data;
      setLogs(d.data || []);
      setMeta({ current_page: d.current_page, last_page: d.last_page, total: d.total });
    } catch (err) {
      toastError(err, 'Failed to load audit logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { setPage(1); load(1); }, [search, actionFilter, dateFrom, dateTo]);
  useEffect(() => { load(page); }, [page]);

  return (
    <div className="flex-1 px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6 w-full max-w-full overflow-x-hidden min-w-0">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2.5 sm:gap-3">
          <Shield className="h-7 w-7 sm:h-8 sm:w-8 text-primary shrink-0" /> Audit Logs
        </h1>
        <p className="text-muted-foreground mt-1 text-xs sm:text-sm">
          Immutable record of all significant administrative actions. Compliant with RA 10173 (Data Privacy Act).
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row flex-wrap gap-2.5 sm:gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9 h-10 text-sm" placeholder="Search by admin email or action…"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-full sm:w-52 h-10 text-xs sm:text-sm">
            <SelectValue placeholder="All actions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            {Object.entries(ACTION_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 flex-1 sm:flex-initial">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">From</Label>
            <Input type="date" className="h-10 text-xs flex-1 sm:w-36" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div className="flex items-center gap-1.5 flex-1 sm:flex-initial">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">To</Label>
            <Input type="date" className="h-10 text-xs flex-1 sm:w-36" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
          <Button variant="outline" size="icon" className="h-10 w-10 shrink-0" onClick={() => load(page)}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Mobile Card List (< md) */}
      <div className="block md:hidden space-y-2.5">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground bg-card rounded-2xl border">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
            Loading audit logs…
          </div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground bg-card rounded-2xl border">
            No audit log entries found.
          </div>
        ) : logs.map(log => (
          <div 
            key={log.id} 
            className="p-3.5 rounded-2xl border bg-card space-y-2 cursor-pointer hover:bg-muted/20 transition-colors shadow-xs"
            onClick={() => setExpanded(expanded === log.id ? null : log.id)}
          >
            <div className="flex items-start justify-between gap-2">
              <ActionBadge action={log.action} />
              <span className="text-[11px] text-muted-foreground shrink-0">
                {log.created_at ? format(new Date(log.created_at), 'MMM d, p') : '—'}
              </span>
            </div>

            <div className="text-xs text-muted-foreground space-y-0.5">
              <p><span className="font-semibold text-foreground">Admin:</span> {log.actor_email || 'System'}</p>
              {log.entity_type && (
                <p><span className="font-semibold text-foreground">Entity:</span> {log.entity_type} {log.entity_id ? `(#${log.entity_id})` : ''}</p>
              )}
            </div>

            {expanded === log.id && (
              <div className="pt-2 border-t border-border/60 text-xs space-y-2 bg-muted/20 -mx-3.5 -mb-3.5 p-3 rounded-b-2xl">
                {log.ip_address && <p><span className="font-semibold">IP:</span> {log.ip_address}</p>}
                {log.user_agent && <p className="truncate"><span className="font-semibold">Agent:</span> {log.user_agent}</p>}
                {log.meta && <MetaViewer meta={log.meta} />}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Desktop Table (>= md) */}
      <Card className="hidden md:block overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead>Action</TableHead>
              <TableHead className="hidden md:table-cell">Admin</TableHead>
              <TableHead className="hidden lg:table-cell">Entity</TableHead>
              <TableHead className="hidden lg:table-cell">IP Address</TableHead>
              <TableHead>Timestamp</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-12">
                <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
              </TableCell></TableRow>
            ) : logs.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                No audit log entries found.
              </TableCell></TableRow>
            ) : logs.map(log => (
              <React.Fragment key={log.id}>
                <TableRow
                  className="cursor-pointer hover:bg-muted/30"
                  onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                >
                  <TableCell>
                    <Info className={`h-4 w-4 ${expanded === log.id ? 'text-primary' : 'text-muted-foreground/40'}`} />
                  </TableCell>
                  <TableCell>
                    <ActionBadge action={log.action} />
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm">
                    <span className="font-mono text-xs">{log.actor_email || '—'}</span>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                    {log.entity_type ? <><span className="font-medium">{log.entity_type}</span></> : '—'}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell font-mono text-xs text-muted-foreground">
                    {log.ip_address || '—'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {log.created_at ? format(new Date(log.created_at), 'PP p') : '—'}
                  </TableCell>
                </TableRow>
                {expanded === log.id && (
                  <TableRow>
                    <TableCell colSpan={6} className="bg-muted/20 px-6 py-4">
                      <div className="grid sm:grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Entity ID</p>
                          <p className="font-mono text-xs break-all">{log.entity_id || '—'}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">User Agent</p>
                          <p className="text-xs text-muted-foreground truncate">{log.user_agent || '—'}</p>
                        </div>
                      </div>
                      {log.meta && <MetaViewer meta={log.meta} />}
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Pagination */}
      {meta.last_page > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm text-muted-foreground">
          <span>{meta.total} total entries</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="min-h-[40px] px-3" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Prev
            </Button>
            <span>Page {meta.current_page} of {meta.last_page}</span>
            <Button variant="outline" size="sm" className="min-h-[40px] px-3" disabled={page >= meta.last_page} onClick={() => setPage(p => p + 1)}>
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
