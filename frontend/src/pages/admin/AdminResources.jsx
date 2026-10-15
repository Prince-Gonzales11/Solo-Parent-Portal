import React, { useState, useEffect } from 'react';
import { api, toastError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, RefreshCw, Download, ExternalLink, FileText, Image, File } from 'lucide-react';

const FILE_TYPES = ['PDF', 'DOCX', 'XLSX', 'JPG', 'PNG', 'LINK', 'OTHER'];

function FileTypeIcon({ type }) {
  const t = (type || '').toUpperCase();
  if (t === 'PDF') return <FileText className="h-4 w-4 text-danger" />;
  if (['JPG', 'PNG', 'IMAGE'].includes(t)) return <Image className="h-4 w-4 text-info" />;
  if (t === 'LINK') return <ExternalLink className="h-4 w-4 text-success" />;
  return <File className="h-4 w-4 text-muted-foreground" />;
}

export default function AdminResources() {
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(null);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', url: '', file_type: 'PDF', is_active: true });

  const fetchResources = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/resources');
      setResources(res.data);
    } catch (err) {
      toastError(err, 'Failed to load resources.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchResources(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', description: '', url: '', file_type: 'PDF', is_active: true });
    setDialogOpen(true);
  };

  const openEdit = (res) => {
    setEditing(res);
    setForm({
      name: res.name || '',
      description: res.description || '',
      url: res.url || '',
      file_type: res.file_type || 'PDF',
      is_active: res.is_active !== false,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Resource name is required.');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/admin/resources/${editing.id}`, form);
        toast.success('Resource updated!');
      } else {
        await api.post('/admin/resources', form);
        toast.success('Resource created!');
      }
      setDialogOpen(false);
      fetchResources();
    } catch (err) {
      toastError(err, 'Failed to save resource.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog) return;
    try {
      await api.delete(`/admin/resources/${deleteDialog.id}`);
      toast.success('Resource deleted.');
      setDeleteDialog(null);
      fetchResources();
    } catch (err) {
      toastError(err, 'Failed to delete resource.');
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <RefreshCw className="h-7 w-7 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden min-w-0 p-3 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold break-words">Downloadable Resources</h2>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">
            Manage forms, documents, and links shown on the public landing page.
          </p>
        </div>
        <Button onClick={openCreate} className="w-full sm:w-auto justify-center">
          <Plus className="h-4 w-4 mr-2" /> Add Resource
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto w-full max-w-full min-w-0">
          <Table>
            <TableHeader>
              <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="hidden md:table-cell">Description</TableHead>
              <TableHead className="w-[80px] text-center">Type</TableHead>
              <TableHead className="w-[100px] text-center">Status</TableHead>
              <TableHead className="w-[130px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {resources.map((res) => (
              <TableRow key={res.id}>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <FileTypeIcon type={res.file_type} />
                    <div>
                      <p className="font-medium text-sm">{res.name}</p>
                      {res.url && res.url !== '#' && (
                        <a href={res.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline truncate max-w-[200px] block">
                          {res.url.length > 50 ? res.url.slice(0, 50) + '…' : res.url}
                        </a>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                  {res.description || '—'}
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="outline" className="text-xs uppercase">{res.file_type || '—'}</Badge>
                </TableCell>
                <TableCell className="text-center">
                  {res.is_active !== false
                    ? <Badge className="bg-success-soft text-success border-0 text-xs">Active</Badge>
                    : <Badge variant="secondary" className="text-xs">Hidden</Badge>
                  }
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    {res.url && res.url !== '#' && (
                      <a href={res.url} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="Open URL">
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                      </a>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => openEdit(res)} className="h-8 w-8 p-0">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setDeleteDialog(res)} className="h-8 w-8 p-0 text-destructive hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {resources.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-12">
                  <Download className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p>No resources yet. Click "Add Resource" to create one.</p>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        </div>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Resource' : 'Add New Resource'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Name <span className="text-destructive">*</span></Label>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Solo Parent Application Form"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={2}
                placeholder="Short description shown to applicants"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Download / Link URL</Label>
              <Input
                value={form.url}
                onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                placeholder="https://... or leave blank"
                type="url"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>File Type</Label>
                <Select value={form.file_type} onValueChange={v => setForm(f => ({ ...f, file_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FILE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Visibility</Label>
                <div className="flex items-center gap-2 pt-2.5">
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
                    className={`h-5 w-9 rounded-full border-2 transition-colors relative ${form.is_active ? 'bg-primary border-primary' : 'bg-muted border-border'}`}
                    role="switch" aria-checked={form.is_active}
                  >
                    <span className={`absolute top-0.5 left-0.5 h-3 w-3 rounded-full bg-white transition-transform ${form.is_active ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                  <span className="text-sm">{form.is_active ? 'Visible to public' : 'Hidden'}</span>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Saving…</> : 'Save Resource'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Resource</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Are you sure you want to delete <strong>{deleteDialog?.name}</strong>?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
