import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { api, toastError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { 
  Plus, Pencil, Trash2, RefreshCw, CheckCircle, XCircle, 
  ChevronRight, ChevronLeft, FileText, Users, ArrowUpRight, 
  Search, ShieldAlert, Heart, Lock, UserX, UserMinus, 
  FileSignature, Briefcase, Globe, Baby, Shield, 
  Layers, AlertCircle, Info, Sparkles, Check, Tag
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';

const GROUP_LABELS = {
  'all': 'All (13)',
  'A': 'Group A (Death/Abandonment)',
  'B': 'Group B (OFW)',
  'C-E': 'Group C–E (Unmarried/Relatives)',
  'F': 'Group F (Pregnant)'
};

export default function AdminCategories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(null);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeGroup, setActiveGroup] = useState('all');

  const [form, setForm] = useState({ 
    name: '', 
    code: '', 
    description: '', 
    display_order: 1, 
    requirements: [], 
    is_active: true 
  });

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/categories');
      const data = res.data || [];
      setCategories(data);
      if (data.length > 0 && !selectedId) {
        setSelectedId(data[0].id);
      }
    } catch (err) {
      toastError(err, 'Failed to load categories.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCategories(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ 
      name: '', 
      code: '', 
      description: '', 
      display_order: categories.length + 1, 
      requirements: [], 
      is_active: true 
    });
    setDialogOpen(true);
  };

  const openEdit = (cat) => {
    setEditing(cat);
    setForm({
      name: cat.name || '',
      code: cat.code || '',
      description: cat.description || '',
      display_order: cat.display_order || 1,
      requirements: Array.isArray(cat.requirements) ? JSON.parse(JSON.stringify(cat.requirements)) : [],
      is_active: cat.is_active !== false,
    });
    setDialogOpen(true);
  };

  const addReq = () => {
    setForm(f => ({
      ...f, 
      requirements: [...f.requirements, {
        name: '',
        description: '',
        is_required: true,
        formats: ['.pdf', '.jpg', '.jpeg', '.png'],
        max_size_mb: 10,
        instructions: 'Please ensure the document is clear and readable.'
      }]
    }));
  };

  const removeReq = (idx) => {
    setForm(f => ({ ...f, requirements: f.requirements.filter((_, i) => i !== idx) }));
  };

  const moveReq = (idx, dir) => {
    const arr = [...form.requirements];
    const target = idx + dir;
    if (target < 0 || target >= arr.length) return;
    [arr[idx], arr[target]] = [arr[target], arr[idx]];
    setForm(f => ({ ...f, requirements: arr }));
  };

  const updateReq = (idx, field, value) => {
    const arr = [...form.requirements];
    arr[idx][field] = value;
    setForm(f => ({ ...f, requirements: arr }));
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.code.trim()) {
      toast.error('Name and code are required.');
      return;
    }

    for (let i = 0; i < form.requirements.length; i++) {
      const req = form.requirements[i];
      if (!req.name || typeof req.name === 'object') {
        toast.error(`Requirement ${i+1} is invalid. Name is required.`);
        return;
      }
    }

    setSaving(true);
    try {
      if (editing) {
        await api.put(`/admin/categories/${editing.id}`, form);
        toast.success('Category updated successfully!');
      } else {
        const res = await api.post('/admin/categories', form);
        toast.success('Category created successfully!');
        if (res.data?.id) setSelectedId(res.data.id);
      }
      setDialogOpen(false);
      fetchCategories();
    } catch (err) {
      toastError(err, 'Failed to save category.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog) return;
    try {
      await api.delete(`/admin/categories/${deleteDialog.id}`);
      toast.success('Category deleted.');
      setDeleteDialog(null);
      const remaining = categories.filter(c => c.id !== deleteDialog.id);
      if (remaining.length > 0) setSelectedId(remaining[0].id);
      fetchCategories();
    } catch (err) {
      toastError(err, 'Failed to delete category.');
    }
  };

  // Filtered list of categories for the selector deck
  const filteredCategories = useMemo(() => {
    return categories.filter((c) => {
      const codeStr = (c.code || '').toLowerCase();
      const nameStr = (c.name || '').toLowerCase();
      const q = searchQuery.toLowerCase().trim();

      let matchesGroup = true;
      if (activeGroup === 'A') matchesGroup = codeStr.startsWith('a');
      else if (activeGroup === 'B') matchesGroup = codeStr.startsWith('b');
      else if (activeGroup === 'C-E') matchesGroup = ['c', 'd', 'e'].includes(codeStr);
      else if (activeGroup === 'F') matchesGroup = codeStr === 'f';

      let matchesSearch = true;
      if (q) {
        matchesSearch = codeStr.includes(q) || nameStr.includes(q);
      }

      return matchesGroup && matchesSearch;
    });
  }, [categories, searchQuery, activeGroup]);

  // Selected Category
  const selectedCat = useMemo(() => {
    return categories.find(c => c.id === selectedId) || categories[0] || null;
  }, [categories, selectedId]);

  // Aggregate stats
  const totalApplicants = useMemo(() => {
    return categories.reduce((sum, c) => sum + (c.applications_count || 0), 0);
  }, [categories]);

  const totalRequirements = useMemo(() => {
    return categories.reduce((sum, c) => sum + (c.requirements?.length || 0), 0);
  }, [categories]);

  if (loading && categories.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm font-medium">Loading RA 11861 categories and requirements…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 px-3 sm:px-6 lg:px-8 py-5 sm:py-6 space-y-5 bg-gradient-to-b from-surface-muted to-background min-h-screen w-full max-w-full overflow-x-hidden min-w-0">

      {/* ── Top Header ─────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border/40">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-1.5 border border-primary/20">
            <Layers className="h-3.5 w-3.5 text-primary" />
            Republic Act No. 11861 Master Directory
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground font-display">
            Solo Parent Categories & Requirements
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm">
            Official statutory classifications (A1 to F), specific documentary rules, and live applicant totals.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button variant="outline" size="sm" onClick={fetchCategories} className="card-pop bg-card h-9">
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
          </Button>
          <Button onClick={openCreate} size="sm" className="card-pop bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-sm h-9">
            <Plus className="h-4 w-4 mr-1.5" /> Add Category
          </Button>
        </div>
      </div>

      {/* ── Compact Stat Chips & Category Dropdown Ribbon ──── */}
      <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
        
        {/* Dropdown Quick Selector */}
        <div className="flex items-center gap-3 flex-1">
          <div className="w-full sm:w-80">
            <Select 
              value={selectedId || ''} 
              onValueChange={(val) => setSelectedId(val)}
            >
              <SelectTrigger className="rounded-xl h-10 card-pop bg-card font-semibold">
                <Tag className="h-4 w-4 mr-2 text-primary shrink-0" />
                <SelectValue placeholder="Select Category..." />
              </SelectTrigger>
              <SelectContent className="rounded-xl max-h-80">
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id} className="cursor-pointer">
                    <span className="font-mono font-bold uppercase text-primary mr-2">[{c.code}]:</span>
                    <span>{c.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">({c.applications_count || 0} applicants)</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Group Filter Tabs */}
          <div className="hidden md:flex items-center gap-1.5 bg-muted/40 p-1 rounded-xl border border-border/50">
            {Object.entries(GROUP_LABELS).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setActiveGroup(key)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  activeGroup === key
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Metric Summary Chips */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="card-pop rounded-xl px-3 py-1.5 bg-card border border-border/60 flex items-center gap-2 text-xs font-semibold">
            <span className="text-muted-foreground">Categories:</span>
            <span className="text-primary font-bold">{categories.length}</span>
          </div>
          <div className="card-pop rounded-xl px-3 py-1.5 bg-card border border-border/60 flex items-center gap-2 text-xs font-semibold">
            <span className="text-muted-foreground">Active:</span>
            <span className="text-emerald-600 font-bold">{categories.filter(c => c.is_active !== false).length}</span>
          </div>
          <div className="card-pop rounded-xl px-3 py-1.5 bg-card border border-border/60 flex items-center gap-2 text-xs font-semibold">
            <span className="text-muted-foreground">Total Solo Parents:</span>
            <span className="text-indigo-600 font-bold">{totalApplicants}</span>
          </div>
        </div>
      </div>

      {/* ── Category Code Ribbon (Quick Jump Buttons) ──────── */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {categories.map((c) => {
          const isSelected = selectedId === c.id;
          return (
            <button
              key={c.id}
              onClick={() => setSelectedId(c.id)}
              className={`px-3 py-1.5 rounded-xl font-mono text-xs font-extrabold uppercase transition-all shrink-0 flex items-center gap-1.5 ${
                isSelected
                  ? 'bg-primary text-primary-foreground shadow-md rim-highlight scale-105'
                  : 'bg-card border border-border/70 text-foreground hover:border-primary/50 hover:bg-muted/40'
              }`}
            >
              <span>{c.code}</span>
              {(c.applications_count || 0) > 0 && (
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isSelected ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'}`}>
                  {c.applications_count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Main 1-Page Master-Detail Layout ────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* Left Column: Compact Category Selector Deck (4 Cols) */}
        <div className="lg:col-span-4 space-y-3">
          <div className="card-pop rounded-2xl border-2 border-border/70 bg-card p-3 space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Quick filter categories…"
                className="pl-8.5 h-8.5 text-xs rounded-xl bg-muted/30"
              />
            </div>

            {/* Scrollable Category Cards List */}
            <div className="space-y-2 max-h-[calc(100vh-320px)] overflow-y-auto pr-1">
              {filteredCategories.map((cat) => {
                const isSelected = selectedId === cat.id;
                const appCount = cat.applications_count || 0;
                const reqCount = cat.requirements?.length || 0;

                return (
                  <div
                    key={cat.id}
                    onClick={() => setSelectedId(cat.id)}
                    className={`card-pop p-3.5 rounded-xl border-2 transition-all cursor-pointer select-none text-left relative overflow-hidden ${
                      isSelected
                        ? 'border-primary bg-primary/5 shadow-md rim-highlight'
                        : 'border-border/60 bg-card hover:border-primary/40 hover:bg-muted/30'
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-primary" />
                    )}

                    <div className="flex items-start gap-2.5">
                      <div className={`h-8 w-8 rounded-lg flex items-center justify-center font-mono font-extrabold text-xs shrink-0 uppercase shadow-xs ${
                        isSelected 
                          ? 'bg-primary text-white' 
                          : 'bg-muted text-foreground'
                      }`}>
                        {cat.code}
                      </div>

                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-sm text-foreground truncate leading-tight">
                          {cat.name}
                        </h4>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-xs text-muted-foreground">
                            {reqCount} requirements
                          </span>
                          <span className="text-border">•</span>
                          {/* Clickable direct link to category applicants */}
                          <Link
                            to={`/admin/applicants?category=${cat.code}`}
                            onClick={e => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                            title="View applicants in this category"
                          >
                            <Users className="h-3.5 w-3.5" />
                            <span>{appCount} solo parents</span>
                            <ArrowUpRight className="h-3 w-3" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {filteredCategories.length === 0 && (
                <div className="p-6 text-center text-muted-foreground text-xs">
                  No categories match "{searchQuery}".
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Active Category Inspector (8 Cols - Fits 1 Page) */}
        <div className="lg:col-span-8 space-y-4">
          {selectedCat ? (
            <div className="space-y-4">

              {/* Selected Category Header Card */}
              <div className="card-pop rounded-2xl border-2 border-border/70 bg-card p-5 sm:p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary to-teal-700 text-white flex items-center justify-center font-mono font-extrabold text-base tracking-wider shrink-0 shadow-md rim-highlight uppercase">
                      {selectedCat.code}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg sm:text-xl font-extrabold text-foreground font-display">
                          {selectedCat.name}
                        </h2>
                        {selectedCat.is_active !== false ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                            <CheckCircle className="h-3.5 w-3.5 mr-1" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-300">
                            <XCircle className="h-3.5 w-3.5 mr-1" /> Inactive
                          </span>
                        )}
                        <Badge variant="outline" className="text-xs font-mono font-medium px-2 py-0.5">
                          Order #{selectedCat.display_order || 1}
                        </Badge>
                      </div>
                      {selectedCat.description && (
                        <p className="text-xs sm:text-sm text-muted-foreground mt-1.5 leading-relaxed">
                          {selectedCat.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions for Category */}
                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-start">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => openEdit(selectedCat)} 
                      className="rounded-xl h-8.5 text-xs font-semibold card-pop bg-card"
                    >
                      <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={() => setDeleteDialog(selectedCat)} 
                      className="rounded-xl h-8.5 text-xs font-semibold text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                    </Button>
                  </div>
                </div>

                {/* Direct Applicant Drilldown Banner */}
                <div className="p-3.5 rounded-xl bg-gradient-to-r from-primary/10 via-primary/5 to-card border border-primary/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-lg bg-primary text-white flex items-center justify-center font-bold text-xs shadow-xs">
                      <Users className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-primary uppercase tracking-wider">Registered Solo Parents Registry</p>
                      <p className="text-sm font-bold text-foreground">
                        {selectedCat.applications_count || 0} Solo Parents enrolled in Category {selectedCat.code.toUpperCase()}
                      </p>
                    </div>
                  </div>

                  {/* CLICKABLE BUTTON DIRECTING TO CATEGORY APPLICANTS */}
                  <Button asChild size="sm" className="rounded-xl font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs shrink-0 w-full sm:w-auto text-center justify-center whitespace-normal break-words py-2 px-3.5 h-auto min-h-[38px]">
                    <Link to={`/admin/applicants?category=${selectedCat.code}`}>
                      <span className="hidden sm:inline">View All Applicants In Category</span>
                      <span className="sm:hidden">View Applicants</span>
                      <ArrowUpRight className="h-4 w-4 ml-1.5 shrink-0" />
                    </Link>
                  </Button>
                </div>
              </div>

              {/* Documentary Requirements Grid (Clean, Fitted) */}
              <div className="card-pop rounded-2xl border-2 border-border/70 bg-card p-4 sm:p-5 space-y-3.5 w-full max-w-full overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-border/50 pb-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 text-primary shrink-0" />
                    <h3 className="font-bold text-sm text-foreground break-words">
                      Documentary Requirements ({selectedCat.requirements?.length || 0}) — RA 11861 Standards
                    </h3>
                  </div>
                  <Button size="sm" variant="ghost" className="h-8 text-xs text-primary hover:bg-primary/10 shrink-0 self-start sm:self-auto" onClick={() => openEdit(selectedCat)}>
                    <Plus className="h-3 w-3 mr-1" /> Add Requirement
                  </Button>
                </div>

                {(!selectedCat.requirements || selectedCat.requirements.length === 0) ? (
                  <div className="text-center py-8 border border-dashed rounded-xl bg-muted/10">
                    <p className="text-xs text-muted-foreground">No specific documentary requirements defined yet.</p>
                    <Button size="sm" variant="outline" className="mt-2 text-xs" onClick={() => openEdit(selectedCat)}>
                      Add First Requirement
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[calc(100vh-420px)] overflow-y-auto pr-1">
                    {selectedCat.requirements.map((req, i) => {
                      const isString = typeof req === 'string';
                      const reqName = isString ? req : req.name;
                      const reqDesc = !isString ? req.description : '';
                      const reqInst = !isString ? req.instructions : '';
                      const isRequired = !isString ? req.is_required !== false : true;
                      const formats = !isString ? (req.formats || ['.pdf', '.jpg', '.png']) : ['.pdf', '.jpg', '.png'];
                      const maxSize = !isString ? (req.max_size_mb || 10) : 10;

                      return (
                        <div
                          key={i}
                          className="card-pop rounded-xl p-3.5 border border-border/70 bg-card hover:border-primary/40 transition-all flex flex-col justify-between space-y-2.5"
                        >
                          <div className="space-y-1">
                            <div className="flex items-start gap-2.5">
                              <span className="h-5 w-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                                {i + 1}
                              </span>
                              <h4 className="font-bold text-sm text-foreground leading-snug">
                                {reqName}
                              </h4>
                            </div>
                            {reqDesc && (
                              <p className="text-xs text-muted-foreground ml-7 leading-relaxed">
                                {reqDesc}
                              </p>
                            )}
                            {reqInst && (
                              <div className="ml-7 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 font-medium flex items-start gap-1.5">
                                <Info className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                                <span>{reqInst}</span>
                              </div>
                            )}
                          </div>

                          <div className="ml-7 flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-border/40">
                            <Badge variant={isRequired ? "default" : "secondary"} className="text-[9px] h-4">
                              {isRequired ? 'Required' : 'Optional'}
                            </Badge>
                            <Badge variant="outline" className="text-[9px] h-4 font-mono">
                              Max {maxSize}MB
                            </Badge>
                            <span className="text-[9px] text-muted-foreground font-mono">
                              {formats.join(', ')}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          ) : (
            <div className="card-pop rounded-2xl border-2 border-dashed border-border/80 p-12 text-center bg-card">
              <Layers className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
              <h3 className="font-bold text-base text-foreground">Select a Category</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Choose a category from the dropdown or left deck to view its requirements and applicant counts.
              </p>
            </div>
          )}
        </div>

      </div>

      {/* ── Create / Edit Category Modal Dialog ───────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold font-display">
              {editing ? 'Edit Category & Requirements' : 'Create New Category'}
            </DialogTitle>
            <DialogDescription>
              Configure category details, legal definition, display order, and documentary schema.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-3">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="space-y-1.5 sm:col-span-1">
                <Label className="font-semibold text-xs">Code <span className="text-destructive">*</span></Label>
                <Input 
                  value={form.code} 
                  onChange={e => setForm(f => ({ ...f, code: e.target.value.toLowerCase() }))} 
                  placeholder="e.g. a1" 
                  maxLength={10}
                  className="rounded-xl font-mono uppercase" 
                />
              </div>
              <div className="space-y-1.5 sm:col-span-1">
                <Label className="font-semibold text-xs">Display Order</Label>
                <Input 
                  type="number" 
                  value={form.display_order} 
                  onChange={e => setForm(f => ({ ...f, display_order: parseInt(e.target.value) || 1 }))} 
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="font-semibold text-xs">Category Full Name <span className="text-destructive">*</span></Label>
                <Input 
                  value={form.name} 
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} 
                  placeholder="e.g. Widow or Widower" 
                  className="rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="font-semibold text-xs">Official Statutory Description (RA 11861)</Label>
              <Textarea 
                value={form.description} 
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))} 
                rows={3} 
                placeholder="Comprehensive definition of who qualifies under this specific category..."
                className="rounded-xl"
              />
            </div>
            
            <div className="flex items-center space-x-2.5 p-3.5 rounded-xl bg-muted/40 border border-border/50">
              <Switch checked={form.is_active} onCheckedChange={(c) => setForm(f => ({ ...f, is_active: c }))} />
              <div>
                <Label className="font-semibold text-sm">Category is active and visible in portal</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Applicants can choose this classification when applying.</p>
              </div>
            </div>

            {/* Requirements editor */}
            <div className="border-t border-border/60 pt-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-foreground">Specific Documentary Requirements</h3>
                  <p className="text-xs text-muted-foreground">Define what documents applicants must upload for this classification.</p>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={addReq} className="rounded-xl">
                  <Plus className="h-4 w-4 mr-1.5" /> Add Requirement
                </Button>
              </div>

              <div className="space-y-4">
                {form.requirements.map((req, i) => {
                  const isString = typeof req === 'string';
                  if (isString) {
                    updateReq(i, 'name', req);
                    return null;
                  }
                  return (
                    <div key={i} className="card-pop rounded-xl p-4 border border-border/70 bg-card space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-border/40">
                        <div className="flex items-center gap-2">
                          <span className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                            {i + 1}
                          </span>
                          <span className="font-bold text-sm">Requirement #{i + 1}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => moveReq(i, -1)} disabled={i === 0}>
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => moveReq(i, 1)} disabled={i === form.requirements.length - 1}>
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                          <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10" onClick={() => removeReq(i)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1 sm:col-span-2">
                          <Label className="text-xs font-semibold">Document Name <span className="text-destructive">*</span></Label>
                          <Input 
                            value={req.name} 
                            onChange={e => updateReq(i, 'name', e.target.value)} 
                            placeholder="e.g. Birth certificate/s of the child or children" 
                            className="rounded-xl"
                          />
                        </div>
                        <div className="space-y-1 sm:col-span-2">
                          <Label className="text-xs font-semibold">Description / Guidance</Label>
                          <Input 
                            value={req.description} 
                            onChange={e => updateReq(i, 'description', e.target.value)} 
                            placeholder="e.g. PSA-issued birth certificate/s of dependent child/children." 
                            className="rounded-xl"
                          />
                        </div>
                        <div className="space-y-1 sm:col-span-2">
                          <Label className="text-xs font-semibold">Special Instructions / Renewal Note</Label>
                          <Input 
                            value={req.instructions} 
                            onChange={e => updateReq(i, 'instructions', e.target.value)} 
                            placeholder="e.g. Note: For purposes of booklet renewal, this document must be submitted every year." 
                            className="rounded-xl"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs font-semibold">Allowed Formats</Label>
                          <Input 
                            value={(req.formats || []).join(', ')} 
                            onChange={e => updateReq(i, 'formats', e.target.value.split(',').map(s => s.trim()))} 
                            placeholder=".pdf, .jpg, .jpeg, .png" 
                            className="rounded-xl font-mono text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs font-semibold">Max File Size (MB)</Label>
                          <Input 
                            type="number" 
                            value={req.max_size_mb || 10} 
                            onChange={e => updateReq(i, 'max_size_mb', parseInt(e.target.value) || 10)} 
                            className="rounded-xl"
                          />
                        </div>
                        <div className="flex items-center space-x-2 pt-2 sm:col-span-2">
                          <Switch 
                            checked={req.is_required !== false} 
                            onCheckedChange={(c) => updateReq(i, 'is_required', c)} 
                          />
                          <Label className="text-xs font-semibold">Mandatory for application submission</Label>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {form.requirements.length === 0 && (
                  <div className="text-center py-8 border-2 border-dashed rounded-xl bg-muted/10">
                    <p className="text-muted-foreground text-xs">No documentary requirements added yet.</p>
                    <Button type="button" size="sm" variant="outline" className="mt-3 rounded-xl" onClick={addReq}>
                      Add First Requirement
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="border-t border-border/40 pt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl">Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="rounded-xl font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm">
              {saving ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Saving…</> : 'Save Category'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Dialog ───────────────────── */}
      <Dialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-destructive">Delete Category Classification</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-foreground">
              Are you sure you want to delete category <strong>{deleteDialog?.code?.toUpperCase()}: {deleteDialog?.name}</strong>?
            </p>
            {deleteDialog?.applications_count > 0 && (
              <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-destructive font-semibold flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  Warning: There are currently {deleteDialog.applications_count} applicants registered under this category.
                </span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(null)} className="rounded-xl">Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} className="rounded-xl font-semibold">
              Yes, Delete Category
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
