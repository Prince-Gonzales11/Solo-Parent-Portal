import React, { useEffect, useState } from 'react';
import { api, toastError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Users, Plus, RefreshCw, Search, Shield, UserCheck, UserX,
  KeyRound, Pencil, ChevronLeft, ChevronRight, CheckCircle, AlertCircle, FileText, MapPin
} from 'lucide-react';

const ROLE_CONFIG = {
  applicant:   { label: 'Applicant',   color: 'bg-info-soft text-info dark:bg-info-soft dark:text-info' },
  admin:       { label: 'Admin',        color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' },
  super_admin: { label: 'Super Admin',  color: 'bg-warning-soft text-warning dark:bg-warning-soft dark:text-warning' },
};

function RoleBadge({ role }) {
  const cfg = ROLE_CONFIG[role] || { label: role, color: 'bg-gray-100 text-gray-600' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

export default function AdminUsers() {
  const [users, setUsers]               = useState([]);
  const [meta, setMeta]                 = useState({ current_page: 1, last_page: 1, total: 0 });
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState('');
  const [roleFilter, setRoleFilter]     = useState('all');
  const [page, setPage]                 = useState(1);

  // Dialogs
  const [createOpen, setCreateOpen]     = useState(false);
  const [roleDialog, setRoleDialog]     = useState(null); // { user }
  const [resetDialog, setResetDialog]   = useState(null); // { user }
  const [tempPassword, setTempPassword] = useState(null);
  const [saving, setSaving]             = useState(false);

  // Create admin form
  const [form, setForm] = useState({ full_name: '', email: '', role: 'admin', password: '' });

  const load = async (pg = page) => {
    setLoading(true);
    try {
      const params = { page: pg };
      if (search) params.search = search;
      if (roleFilter !== 'all') params.role = roleFilter;
      const res = await api.get('/admin/users', { params });
      const data = res.data;
      setUsers(data.data || []);
      setMeta({ current_page: data.current_page, last_page: data.last_page, total: data.total });
    } catch (err) {
      toastError(err, 'Failed to load users.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(1); setPage(1); }, [search, roleFilter]);
  useEffect(() => { load(page); }, [page]);

  const handleStatusToggle = async (user) => {
    try {
      await api.put(`/admin/users/${user.id}/status`, { is_active: !user.is_active });
      toast.success(user.is_active ? 'Account suspended.' : 'Account activated.');
      load(page);
    } catch (err) {
      toastError(err, 'Failed to update account status.');
    }
  };

  const handleRoleChange = async (newRole) => {
    setSaving(true);
    try {
      await api.put(`/admin/users/${roleDialog.user.id}/role`, { role: newRole });
      toast.success('Role updated successfully.');
      setRoleDialog(null);
      load(page);
    } catch (err) {
      toastError(err, 'Failed to update role.');
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async () => {
    setSaving(true);
    try {
      const res = await api.post(`/admin/users/${resetDialog.user.id}/reset-password`);
      setTempPassword(res.data.temporary_password);
      toast.success('Password reset successfully.');
      setResetDialog(null);
    } catch (err) {
      toastError(err, 'Failed to reset password.');
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async () => {
    if (!form.full_name || !form.email || !form.password) {
      toast.error('All fields are required.');
      return;
    }
    setSaving(true);
    try {
      await api.post('/admin/users', form);
      toast.success('Admin account created successfully.');
      setCreateOpen(false);
      setForm({ full_name: '', email: '', role: 'admin', password: '' });
      load(page);
    } catch (err) {
      toastError(err, 'Failed to create account.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6 w-full max-w-full overflow-x-hidden min-w-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2.5 sm:gap-3">
            <Users className="h-7 w-7 sm:h-8 sm:w-8 text-primary shrink-0" /> User Management
          </h1>
          <p className="text-muted-foreground mt-1 text-xs sm:text-sm">
            Manage applicant accounts, admin accounts, roles, and access control.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="w-full sm:w-auto min-h-[44px] font-semibold">
          <Plus className="mr-2 h-4 w-4" /> Create Admin Account
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3">
        <div className="relative flex-1 max-w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9 h-10 text-sm"
            placeholder="Search by name or email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-full sm:w-44 h-10 text-xs sm:text-sm">
              <SelectValue placeholder="All roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="applicant">Applicants</SelectItem>
              <SelectItem value="admin">Admins</SelectItem>
              <SelectItem value="super_admin">Super Admins</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" className="h-10 w-10 shrink-0" onClick={() => load(page)}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Mobile User Cards List (< md) */}
      <div className="block md:hidden space-y-3">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground bg-card rounded-2xl border">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
            Loading accounts…
          </div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground bg-card rounded-2xl border">
            No users found.
          </div>
        ) : users.map(u => (
          <div key={u.id} className="p-4 rounded-2xl border bg-card space-y-3 shadow-xs">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-bold text-sm text-foreground truncate">{u.full_name}</p>
                <p className="text-xs text-muted-foreground truncate">{u.email}</p>
              </div>
              <RoleBadge role={u.role} />
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              {u.is_active !== false ? (
                <span className="text-xs text-success font-semibold flex items-center gap-1 bg-success/10 px-2 py-0.5 rounded-full">
                  <UserCheck className="h-3.5 w-3.5" /> Active
                </span>
              ) : (
                <span className="text-xs text-destructive font-semibold flex items-center gap-1 bg-destructive/10 px-2 py-0.5 rounded-full">
                  <UserX className="h-3.5 w-3.5" /> Suspended
                </span>
              )}

              {u.role === 'applicant' && (
                u.profile_complete ? (
                  <span className="text-xs text-success font-medium flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" /> Profile Done
                  </span>
                ) : (
                  <span className="text-xs text-warning font-medium flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> Profile Incomplete
                  </span>
                )
              )}

              {u.barangay_name && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {u.barangay_name}
                </span>
              )}
            </div>

            <div className="pt-2 border-t border-border/60 flex flex-wrap items-center justify-end gap-2">
              <Button size="sm" variant="outline" className="min-h-[40px] px-3 text-xs gap-1.5 flex-1 sm:flex-initial justify-center"
                onClick={() => setRoleDialog({ user: u, newRole: u.role })}>
                <Shield className="h-3.5 w-3.5" /> Role
              </Button>
              <Button size="sm" variant="outline" className="min-h-[40px] px-3 text-xs gap-1.5 flex-1 sm:flex-initial justify-center"
                onClick={() => setResetDialog({ user: u })}>
                <KeyRound className="h-3.5 w-3.5" /> Reset Pwd
              </Button>
              <Button size="sm" variant="outline" className={`min-h-[40px] px-3 text-xs gap-1.5 flex-1 sm:flex-initial justify-center ${u.is_active ? 'text-destructive border-destructive/30 hover:bg-destructive/10' : 'text-success border-success/30 hover:bg-success/10'}`}
                onClick={() => handleStatusToggle(u)}>
                {u.is_active ? <><UserX className="h-3.5 w-3.5" /> Suspend</> : <><UserCheck className="h-3.5 w-3.5" /> Activate</>}
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Table (>= md) */}
      <Card className="hidden md:block overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead className="hidden md:table-cell">Role</TableHead>
              <TableHead className="hidden lg:table-cell">Profile</TableHead>
              <TableHead className="hidden xl:table-cell">Barangay</TableHead>
              <TableHead className="hidden lg:table-cell">Registered</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-12">
                <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-muted-foreground" />
              </TableCell></TableRow>
            ) : users.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                No users found.
              </TableCell></TableRow>
            ) : users.map(u => (
              <TableRow key={u.id} className="hover:bg-muted/50 transition-colors">
                <TableCell>
                  <div>
                    <p className="font-medium text-sm">{u.full_name}</p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <RoleBadge role={u.role} />
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  {u.role === 'applicant' ? (
                    u.profile_complete
                      ? <span className="text-xs text-success font-medium flex items-center gap-1"><CheckCircle className="h-3 w-3" />Complete</span>
                      : <span className="text-xs text-warning font-medium flex items-center gap-1"><AlertCircle className="h-3 w-3" />Incomplete</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="hidden xl:table-cell">
                  {u.barangay_name
                    ? <span className="text-xs flex items-center gap-1"><MapPin className="h-3 w-3 text-muted-foreground" />{u.barangay_name}</span>
                    : <span className="text-xs text-muted-foreground">—</span>
                  }
                </TableCell>
                <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                  {u.created_at ? format(new Date(u.created_at), 'PP') : '—'}
                </TableCell>
                <TableCell className="text-center">
                  {u.is_active !== false
                    ? <span className="text-xs text-success font-medium flex items-center justify-center gap-1"><UserCheck className="h-3.5 w-3.5" />Active</span>
                    : <span className="text-xs text-destructive font-medium flex items-center justify-center gap-1"><UserX className="h-3.5 w-3.5" />Suspended</span>}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button size="sm" variant="ghost" title="Change Role" className="h-9 w-9 min-h-[36px] min-w-[36px]"
                      onClick={() => setRoleDialog({ user: u, newRole: u.role })}>
                      <Shield className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" title="Reset Password" className="h-9 w-9 min-h-[36px] min-w-[36px]"
                      onClick={() => setResetDialog({ user: u })}>
                      <KeyRound className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" title={u.is_active ? 'Suspend' : 'Activate'}
                      className={`h-9 w-9 min-h-[36px] min-w-[36px] ${u.is_active ? 'text-warning hover:text-warning' : 'text-success hover:text-success'}`}
                      onClick={() => handleStatusToggle(u)}>
                      {u.is_active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Pagination */}
      {meta.last_page > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm text-muted-foreground">
          <span>{meta.total} total users</span>
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

      {/* Create Admin Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Admin Account</DialogTitle>
            <DialogDescription>Create a new CSWDD staff account with admin access.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2"><Label>Full Name</Label>
              <Input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="e.g. Maria Santos" /></div>
            <div className="space-y-2"><Label>Email Address</Label>
              <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="admin@cswdd.gov.ph" /></div>
            <div className="space-y-2"><Label>Role</Label>
              <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Temporary Password</Label>
              <Input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Min. 8 characters" /></div>
          </div>
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setCreateOpen(false)} className="w-full sm:w-auto">Cancel</Button>
            <Button onClick={handleCreate} disabled={saving} className="w-full sm:w-auto">
              {saving ? <><RefreshCw className="mr-2 h-4 w-4 animate-spin" />Creating…</> : 'Create Account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Role Change Dialog */}
      {roleDialog && (
        <Dialog open={!!roleDialog} onOpenChange={() => setRoleDialog(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Change Role</DialogTitle>
              <DialogDescription>Changing role for: {roleDialog.user.full_name}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              {['applicant', 'admin', 'super_admin'].map(r => (
                <button key={r}
                  className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-colors ${roleDialog.newRole === r ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
                  onClick={() => setRoleDialog(d => ({ ...d, newRole: r }))}>
                  <RoleBadge role={r} />
                  <p className="text-xs text-muted-foreground mt-1">
                    {r === 'applicant' ? 'Standard portal access only.' : r === 'admin' ? 'Full admin panel access.' : 'All admin access + user management.'}
                  </p>
                </button>
              ))}
            </div>
            <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setRoleDialog(null)} className="w-full sm:w-auto">Cancel</Button>
              <Button onClick={() => handleRoleChange(roleDialog.newRole)} disabled={saving} className="w-full sm:w-auto">
                {saving ? <><RefreshCw className="mr-2 h-4 w-4 animate-spin" />Saving…</> : 'Save Role'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Reset Password Dialog */}
      {resetDialog && (
        <Dialog open={!!resetDialog} onOpenChange={() => setResetDialog(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Reset Password</DialogTitle>
              <DialogDescription>
                A new temporary password will be generated for <strong>{resetDialog.user.full_name}</strong>. You must relay this to the user manually.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setResetDialog(null)} className="w-full sm:w-auto">Cancel</Button>
              <Button variant="destructive" onClick={handleResetPassword} disabled={saving} className="w-full sm:w-auto">
                {saving ? <><RefreshCw className="mr-2 h-4 w-4 animate-spin" />Resetting…</> : 'Reset Password'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Temporary Password Display Dialog */}
      {tempPassword && (
        <Dialog open={!!tempPassword} onOpenChange={() => setTempPassword(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Password Reset Successful</DialogTitle>
            </DialogHeader>
            <div className="py-4 space-y-3">
              <p className="text-sm text-muted-foreground">The temporary password for this account is:</p>
              <div className="bg-muted rounded-lg p-4 font-mono text-lg font-bold text-center tracking-widest select-all">
                {tempPassword}
              </div>
              <p className="text-xs text-warning">⚠️ Copy this now — it will not be shown again. Relay it to the user securely.</p>
            </div>
            <DialogFooter>
              <Button onClick={() => { navigator.clipboard.writeText(tempPassword); toast.success('Copied!'); }}>
                Copy to Clipboard
              </Button>
              <Button variant="outline" onClick={() => setTempPassword(null)}>Done</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
