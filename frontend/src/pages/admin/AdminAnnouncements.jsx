import React, { useEffect, useState } from 'react';
import { api, toastError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Plus, Pencil, Trash2, RefreshCw, Megaphone } from 'lucide-react';

export default function AdminAnnouncements() {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ title: '', body: '', is_published: true });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/announcements');
      setAnnouncements(res.data || []);
    } catch (err) { toastError(err, 'Failed to load announcements. Please refresh.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ title: '', body: '', is_published: true });
    setDialogOpen(true);
  };

  const openEdit = (ann) => {
    setEditing(ann);
    setForm({ title: ann.title, body: ann.body, is_published: ann.is_published });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error('Please enter an announcement title.'); return; }
    if (!form.body.trim()) { toast.error('Please enter the announcement body text.'); return; }
    setSaving(true);
    try {
      if (editing) {
        const res = await api.put(`/admin/announcements/${editing.id}`, form);
        setAnnouncements(a => a.map(x => x.id === editing.id ? res.data : x));
      } else {
        const res = await api.post('/admin/announcements', form);
        setAnnouncements(a => [res.data, ...a]);
      }
      toast.success(editing ? 'Announcement updated successfully.' : 'Announcement created and published.');
      setDialogOpen(false);
    } catch (err) {
      toastError(err, 'Failed to save announcement. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this announcement?')) return;
    try {
      await api.delete(`/admin/announcements/${id}`);
      setAnnouncements(a => a.filter(x => x.id !== id));
      toast.success('Deleted.');
    } catch (err) { toastError(err, 'Failed to delete announcement. Please try again.'); }
  };

  return (
    <div className="flex-1 px-3 sm:px-6 py-4 sm:py-6 space-y-6 w-full max-w-full overflow-x-hidden min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2.5 sm:gap-3">
            <Megaphone className="h-7 w-7 sm:h-8 sm:w-8 text-primary shrink-0" /> Announcements
          </h1>
          <p className="text-muted-foreground mt-1 text-xs sm:text-sm">Manage public announcements on the landing page.</p>
        </div>
        <Button onClick={openNew} className="w-full sm:w-auto justify-center"><Plus className="mr-2 h-4 w-4" /> New Announcement</Button>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto w-full max-w-full min-w-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead className="hidden md:table-cell">Published</TableHead>
                <TableHead className="hidden lg:table-cell">Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8"><RefreshCw className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
              ) : announcements.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No announcements yet.</TableCell></TableRow>
              ) : announcements.map(ann => (
                <TableRow key={ann.id}>
                  <TableCell className="font-medium">{ann.title}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Badge variant={ann.is_published ? 'default' : 'outline'}>
                      {ann.is_published ? 'Published' : 'Draft'}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                    {ann.published_at ? format(new Date(ann.published_at), 'PP') : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(ann)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(ann.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Announcement' : 'New Announcement'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Announcement title" />
            </div>
            <div className="space-y-2">
              <Label>Body</Label>
              <Textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} rows={5} placeholder="Announcement content…" />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="published"
                checked={form.is_published}
                onChange={e => setForm(f => ({ ...f, is_published: e.target.checked }))}
                className="h-4 w-4 rounded border border-input"
              />
              <Label htmlFor="published" className="cursor-pointer">Publish immediately</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.title || !form.body}>
              {saving ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
