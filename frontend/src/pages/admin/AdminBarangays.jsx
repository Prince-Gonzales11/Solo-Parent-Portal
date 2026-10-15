import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, toastError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { 
  MapPin, Plus, RefreshCw, Search, Pencil, Trash2, 
  CheckCircle, XCircle, Users, ChevronDown, ChevronUp, 
  ArrowUpRight, Eye, UserCheck, ShieldCheck
} from 'lucide-react';

export default function AdminBarangays() {
  const [barangays, setBarangays] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing]     = useState(null);
  const [form, setForm]           = useState({ name: '', is_active: true });
  const [saving, setSaving]       = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [applicants, setApplicants] = useState([]);
  const [loadingApplicants, setLoadingApplicants] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/barangays', {
        params: search ? { search } : {}
      });
      setBarangays(res.data || []);
    } catch (err) {
      toastError(err, 'Failed to load barangays.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [search]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', is_active: true });
    setDialogOpen(true);
  };

  const openEdit = (b) => {
    setEditing(b);
    setForm({ name: b.name, is_active: b.is_active !== false });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Barangay name is required.'); return; }
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/admin/barangays/${editing.id}`, form);
        toast.success('Barangay updated successfully.');
      } else {
        await api.post('/admin/barangays', form);
        toast.success('Barangay added successfully.');
      }
      setDialogOpen(false);
      load();
    } catch (err) {
      toastError(err, 'Failed to save barangay.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (b) => {
    try {
      await api.put(`/admin/barangays/${b.id}`, { is_active: !b.is_active });
      toast.success(b.is_active ? 'Barangay deactivated.' : 'Barangay activated.');
      load();
    } catch (err) {
      toastError(err, 'Failed to update barangay.');
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog) return;
    try {
      await api.delete(`/admin/barangays/${deleteDialog.id}`);
      toast.success('Barangay deleted.');
      setDeleteDialog(null);
      load();
    } catch (err) {
      toastError(err, 'Failed to delete barangay.');
    }
  };

  const activeCount   = barangays.filter(b => b.is_active !== false).length;
  const inactiveCount = barangays.length - activeCount;
  const totalApplicants = barangays.reduce((sum, b) => sum + (b.profiles_count || 0), 0);

  const toggleExpand = async (id) => {
    if (expandedId === id) {
      setExpandedId(null);
      setApplicants([]);
      return;
    }
    setExpandedId(id);
    setLoadingApplicants(true);
    try {
      const res = await api.get(`/admin/barangays/${id}/applicants`);
      setApplicants(res.data?.data || res.data || []);
    } catch (err) {
      toastError(err, 'Failed to load applicants.');
    } finally {
      setLoadingApplicants(false);
    }
  };

  return (
    <div className="flex-1 px-3 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-5 sm:space-y-6 bg-gradient-to-b from-surface-muted to-background min-h-screen w-full max-w-full overflow-x-hidden min-w-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-2 border border-primary/20">
            <MapPin className="h-3.5 w-3.5 text-primary" />
            Butuan City Administrative Jurisdictions
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-foreground font-display flex items-center gap-3">
            Barangay Management
          </h1>
          <p className="text-muted-foreground mt-1 text-xs sm:text-sm md:text-base">
            Official 86 barangays of Butuan City, applicant demographics & direct community registry.
          </p>
        </div>
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-2.5 w-full sm:w-auto">
          <Button variant="outline" size="sm" onClick={load} className="card-pop bg-card min-h-[40px] flex-1 sm:flex-initial">
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
          <Button onClick={openCreate} size="sm" className="card-pop bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md min-h-[40px] flex-1 sm:flex-initial">
            <Plus className="mr-1.5 h-4 w-4" /> Add Barangay
          </Button>
        </div>
      </div>

      {/* Stats Cards (Tactile 3D) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="card-pop rounded-2xl p-4 sm:p-5 border-2 border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-card relative overflow-hidden">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-xl bg-primary text-white flex items-center justify-center shadow-md rim-highlight shrink-0">
              <MapPin className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-extrabold text-foreground">{barangays.length}</p>
              <p className="text-xs font-semibold text-muted-foreground mt-0.5">Total Barangays</p>
            </div>
          </div>
        </div>

        <div className="card-pop rounded-2xl p-4 sm:p-5 border-2 border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-card relative overflow-hidden">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md rim-highlight shrink-0">
              <CheckCircle className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-extrabold text-foreground">{activeCount}</p>
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mt-0.5">Active Jurisdictions</p>
            </div>
          </div>
        </div>

        <div className="card-pop rounded-2xl p-4 sm:p-5 border-2 border-indigo-500/20 bg-gradient-to-br from-indigo-500/10 via-indigo-500/5 to-card relative overflow-hidden">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md rim-highlight shrink-0">
              <Users className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-extrabold text-foreground">{totalApplicants}</p>
              <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-400 mt-0.5">Total Registered Solo Parents</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Action Bar */}
      <div className="card-pop rounded-2xl border-2 border-border/70 bg-card p-3.5 sm:p-4 flex flex-col sm:flex-row gap-2.5 sm:gap-3 items-center justify-between">
        <div className="relative flex-1 w-full sm:max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            className="pl-10 h-10 rounded-xl bg-muted/30 border-border/70 focus:bg-background text-sm" 
            placeholder="Search barangay name…"
            value={search} 
            onChange={e => setSearch(e.target.value)} 
          />
        </div>
        <p className="text-xs text-muted-foreground font-medium self-start sm:self-auto">
          Showing {barangays.length} registered barangays
        </p>
      </div>

      {/* Mobile Card List (< md) */}
      <div className="block md:hidden space-y-3">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground bg-card rounded-2xl border">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
            Loading barangays directory…
          </div>
        ) : barangays.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground bg-card rounded-2xl border">
            No barangays found.
          </div>
        ) : barangays.map((b, i) => (
          <div key={b.id} className="p-4 rounded-2xl border-2 border-border/70 bg-card space-y-3 shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-muted-foreground">#{i + 1}</span>
                <span className="font-bold text-base text-foreground">{b.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Active</span>
                <Switch
                  checked={b.is_active !== false}
                  onCheckedChange={() => handleToggleActive(b)}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/50 text-xs">
              <Link
                to={`/admin/applicants?barangay=${encodeURIComponent(b.name)}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 text-primary font-bold min-h-[36px]"
              >
                <Users className="h-3.5 w-3.5" />
                <span>{b.profiles_count || 0} Solo Parents</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>

              <div className="flex items-center gap-1">
                <Button size="sm" variant="outline" onClick={() => openEdit(b)} className="min-h-[38px] px-2.5">
                  <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                </Button>
                <Button size="sm" variant="outline" className="min-h-[38px] px-2.5 text-destructive border-destructive/30" onClick={() => setDeleteDialog(b)}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Table (>= md) */}
      <div className="hidden md:block card-pop rounded-2xl border-2 border-border/70 bg-card overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow className="border-border/50">
              <TableHead className="w-16 pl-6 font-semibold">#</TableHead>
              <TableHead className="font-semibold">Barangay Name</TableHead>
              <TableHead className="text-center font-semibold">Registered Solo Parents</TableHead>
              <TableHead className="text-center font-semibold">Status</TableHead>
              <TableHead className="text-right font-semibold pr-6">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-16 text-muted-foreground">
                  <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
                  Loading barangays directory…
                </TableCell>
              </TableRow>
            ) : barangays.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-16 text-muted-foreground bg-muted/10">
                  <MapPin className="h-10 w-10 mx-auto mb-3 opacity-30 text-primary" />
                  <p className="font-bold text-base text-foreground">No barangays found</p>
                  <p className="text-xs text-muted-foreground mt-1">Try adjusting your search query.</p>
                </TableCell>
              </TableRow>
            ) : barangays.map((b, i) => (
              <React.Fragment key={b.id}>
                <TableRow 
                  className={`border-border/40 transition-colors cursor-pointer ${
                    expandedId === b.id ? 'bg-primary/5' : 'hover:bg-muted/40'
                  }`} 
                  onClick={() => toggleExpand(b.id)}
                >
                  <TableCell className="pl-6 text-muted-foreground font-mono text-xs w-16">{i + 1}</TableCell>
                  <TableCell className="font-bold text-sm text-foreground">
                    <div className="flex items-center gap-2.5">
                      <span className="h-6 w-6 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
                        {expandedId === b.id ? <ChevronUp className="h-4 w-4 text-primary" /> : <ChevronDown className="h-4 w-4" />}
                      </span>
                      <span>{b.name}</span>
                    </div>
                  </TableCell>
                  
                  {/* CLICKABLE DIRECT LINK TO APPLICANTS IN THIS BARANGAY */}
                  <TableCell className="text-center" onClick={e => e.stopPropagation()}>
                    <Link
                      to={`/admin/applicants?barangay=${encodeURIComponent(b.name)}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 font-bold text-xs shadow-xs transition-all duration-200 group"
                      title={`Click to view all ${b.profiles_count || 0} solo parents registered in ${b.name}`}
                    >
                      <Users className="h-3.5 w-3.5 text-primary" />
                      <span>{b.profiles_count || 0} Solo Parents</span>
                      <ArrowUpRight className="h-3.5 w-3.5 text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                    </Link>
                  </TableCell>

                  <TableCell className="text-center" onClick={e => e.stopPropagation()}>
                    <Switch
                      checked={b.is_active !== false}
                      onCheckedChange={(e) => { e?.stopPropagation?.(); handleToggleActive(b); }}
                    />
                  </TableCell>
                  <TableCell className="text-right pr-6" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(b)} className="h-8 w-8 p-0 rounded-lg hover:bg-muted">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost"
                        className="h-8 w-8 p-0 rounded-lg text-destructive hover:bg-destructive/10"
                        onClick={() => setDeleteDialog(b)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>

                {/* Expanded Row: Resident Solo Parents with direct links to application/user */}
                {expandedId === b.id && (
                  <TableRow className="border-border/40">
                    <TableCell colSpan={5} className="bg-muted/20 p-0">
                      <div className="px-8 py-5 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                            <Users className="h-4 w-4 text-primary" />
                            Registered Solo Parents in Barangay {b.name} ({applicants.length})
                          </h4>
                          <Button asChild size="sm" variant="outline" className="rounded-xl text-xs card-pop bg-card">
                            <Link to={`/admin/applicants?barangay=${encodeURIComponent(b.name)}`}>
                              Explore All In Applicants Table <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
                            </Link>
                          </Button>
                        </div>

                        {loadingApplicants ? (
                          <div className="flex items-center justify-center py-6 text-muted-foreground gap-2">
                            <RefreshCw className="h-4 w-4 animate-spin text-primary" />
                            <span className="text-xs">Loading residents…</span>
                          </div>
                        ) : applicants.length === 0 ? (
                          <p className="text-xs text-muted-foreground py-4 text-center bg-card rounded-xl border border-dashed">
                            No registered solo parent residents found in {b.name}.
                          </p>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {applicants.map(p => (
                              <div 
                                key={p.id} 
                                className="card-pop rounded-xl p-3.5 border border-border/70 bg-card flex items-center justify-between gap-3 hover:border-primary/40 transition-all"
                              >
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-sm text-foreground">
                                      {p.first_name} {p.last_name}
                                    </span>
                                    {p.solo_parent_category && (
                                      <Badge variant="outline" className="text-xs font-mono font-semibold uppercase bg-primary/5 text-primary border-primary/20 px-2 py-0.5">
                                        {p.solo_parent_category}
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground">{p.user?.email || 'No email'}</p>
                                  {p.latest_application_ref && (
                                    <p className="text-xs font-mono text-muted-foreground">
                                      Ref: {p.latest_application_ref}
                                    </p>
                                  )}
                                </div>

                                {/* CLICKABLE DIRECT LINK TO INDIVIDUAL SOLO PARENT */}
                                <Button asChild size="sm" className="shrink-0 rounded-xl font-semibold shadow-xs bg-primary hover:bg-primary/90 text-primary-foreground">
                                  <Link to={p.latest_application_id ? `/admin/applications/${p.latest_application_id}` : `/admin/users?search=${encodeURIComponent(p.user?.email || p.last_name)}`}>
                                    <Eye className="h-3.5 w-3.5 mr-1.5" />
                                    {p.latest_application_id ? 'Review Application' : 'View Profile'}
                                  </Link>
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold font-display">{editing ? 'Edit Barangay' : 'Add New Barangay'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground">Barangay Name <span className="text-destructive font-bold">*</span></Label>
              <Input 
                value={form.name} 
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Bayanihan" 
                className="rounded-xl"
              />
            </div>
            <div className="flex items-center space-x-2.5 p-3.5 rounded-xl bg-muted/40 border border-border/50">
              <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
              <div>
                <Label className="font-semibold text-sm">Active jurisdiction</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Visible to applicants in registration dropdown.</p>
              </div>
            </div>
          </div>
          <DialogFooter className="border-t border-border/40 pt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl">Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="rounded-xl font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm">
              {saving ? <><RefreshCw className="mr-2 h-4 w-4 animate-spin" />Saving…</> : 'Save Barangay'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      {deleteDialog && (
        <Dialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
          <DialogContent className="max-w-sm rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-destructive">Delete Barangay</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete <strong>{deleteDialog.name}</strong>? This may affect existing applicant profiles.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDialog(null)} className="rounded-xl">Cancel</Button>
              <Button variant="destructive" onClick={handleDelete} className="rounded-xl font-semibold">Delete</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
