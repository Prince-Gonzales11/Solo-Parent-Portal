import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useTheme } from '@/components/theme-provider';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Menu, Moon, Sun, ChevronRight, Bell, CheckCircle, XCircle, FileText } from 'lucide-react';
import { api } from '@/lib/api';

/* ─── Breadcrumb route mapping ────────────────────────────── */
const ROUTE_LABELS = {
  '/admin': { group: null, label: 'Dashboard' },
  '/admin/applicants': { group: 'Application Management', label: 'Applicants' },
  '/admin/categories': { group: 'Application Management', label: 'Categories' },
  '/admin/barangays': { group: 'Management', label: 'Barangays' },
  '/admin/users': { group: 'Management', label: 'Users' },
  '/admin/announcements': { group: 'Communication', label: 'Announcements' },
  '/admin/reports': { group: 'Reporting & Monitoring', label: 'Reports' },
  '/admin/analytics': { group: 'Reporting & Monitoring', label: 'Analytics' },
  '/admin/audit-logs': { group: 'Reporting & Monitoring', label: 'Audit Logs' },
};

function getBreadcrumbs(pathname) {
  // Check exact match first
  if (ROUTE_LABELS[pathname]) {
    const r = ROUTE_LABELS[pathname];
    const crumbs = [];
    if (r.group) crumbs.push(r.group);
    crumbs.push(r.label);
    return crumbs;
  }

  // Handle nested routes like /admin/applicants/123
  if (pathname.startsWith('/admin/applicants/')) {
    return ['Application Management', 'Applicants', 'Applicant Details'];
  }
  if (pathname.startsWith('/admin/applications/')) {
    return ['Application Management', 'Application Review'];
  }

  return ['Dashboard'];
}

import ThemeToggle from '@/components/ThemeToggle';

function AdminNotificationsMenu() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const navigate = useNavigate();

  const fetchCount = async () => {
    try {
      const res = await api.get('/notifications/unread-count');
      setUnreadCount(res.data?.count || 0);
    } catch (e) {
      // ignore silently on poll
    }
  };

  const fetchNotifs = async () => {
    try {
      const [listRes, countRes] = await Promise.all([
        api.get('/notifications'),
        api.get('/notifications/unread-count'),
      ]);
      setNotifications(listRes.data || []);
      setUnreadCount(countRes.data?.count || 0);
    } catch (e) {
      // ignore silently
    }
  };

  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, 120000); // poll count every 2 min (lightweight)
    return () => clearInterval(interval);
  }, []);

  const handleMarkAllRead = async (e) => {
    e.stopPropagation();
    try {
      await api.post('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (e) {}
  };

  const handleItemClick = async (notif) => {
    if (!notif.is_read) {
      try {
        await api.post(`/notifications/${notif.id}/read`);
        setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
      } catch (e) {}
    }
    if (notif.link) {
      navigate(notif.link);
    }
  };

  return (
    <DropdownMenu onOpenChange={(open) => { if (open) fetchNotifs(); }}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 sm:h-9 sm:w-9 relative cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center touch-manipulation"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4 text-foreground" />
          {unreadCount > 0 && (
            <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-destructive animate-pulse ring-2 ring-background" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[calc(100vw-2rem)] max-w-sm sm:w-96 p-0 rounded-2xl shadow-xl border border-border/80 z-50">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 bg-muted/30">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-foreground">Notifications</span>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="text-[11px] px-1.5 py-0 h-4 font-semibold">
                {unreadCount} new
              </Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="text-xs text-primary hover:underline font-medium cursor-pointer"
            >
              Mark all read
            </button>
          )}
        </div>

        <div className="max-h-80 overflow-y-auto divide-y divide-border/40">
          {notifications.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-xs">
              <Bell className="h-6 w-6 mx-auto mb-2 opacity-30" />
              No notifications yet
            </div>
          ) : (
            notifications.slice(0, 10).map((n) => {
              const isApproved = n.title?.toLowerCase().includes('approved') || n.message?.toLowerCase().includes('approved');
              const isRejected = n.title?.toLowerCase().includes('not qualified') || n.title?.toLowerCase().includes('rejected');
              return (
                <div
                  key={n.id}
                  onClick={() => handleItemClick(n)}
                  className={`p-3.5 hover:bg-muted/40 transition-colors cursor-pointer flex items-start gap-3 ${
                    !n.is_read ? 'bg-primary/5' : ''
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    {isApproved ? (
                      <div className="h-7 w-7 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
                        <CheckCircle className="h-4 w-4" />
                      </div>
                    ) : isRejected ? (
                      <div className="h-7 w-7 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
                        <XCircle className="h-4 w-4" />
                      </div>
                    ) : (
                      <div className="h-7 w-7 rounded-full bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 flex items-center justify-center">
                        <FileText className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1.5">
                      <p className="text-xs font-bold text-foreground truncate">{n.title}</p>
                      {isApproved && (
                        <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-300 text-[10px] py-0 px-1 font-bold shrink-0">
                          Approved
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.message}</p>
                    <span className="text-[10px] text-muted-foreground/80 mt-1 block">
                      {n.created_at ? new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ADMIN TOP BAR
   ═══════════════════════════════════════════════════════════════ */
export default function AdminTopBar({ onMenuClick }) {
  const location = useLocation();
  const crumbs = getBreadcrumbs(location.pathname);

  let user = JSON.parse(localStorage.getItem('user') || 'null');
  if (user && user.data && !user.role) user = user.data;
  const initials = user?.full_name
    ? user.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : 'SA';

  return (
    <header className="sticky top-0 z-30 h-14 border-b border-border/40 bg-background/80 backdrop-blur-xl flex items-center justify-between px-3 sm:px-4 lg:px-6 shrink-0 w-full max-w-full overflow-x-hidden min-w-0">
      {/* Left: menu toggle + breadcrumbs */}
      <div className="flex items-center gap-3">
        {/* Mobile hamburger */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onMenuClick}
          className="h-10 w-10 min-h-[44px] min-w-[44px] flex items-center justify-center lg:hidden touch-manipulation cursor-pointer"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Breadcrumbs */}
        <nav className="flex items-center gap-1 text-sm">
          {crumbs.map((crumb, i) => (
            <React.Fragment key={i}>
              {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-50" />}
              <span
                className={
                  i === crumbs.length - 1
                    ? 'font-semibold text-foreground'
                    : 'text-muted-foreground hidden sm:inline'
                }
              >
                {crumb}
              </span>
            </React.Fragment>
          ))}
        </nav>
      </div>

      {/* Right: utilities */}
      <div className="flex items-center gap-1">
        <AdminNotificationsMenu />
        <ThemeToggle />
        <Avatar className="h-8 w-8 ml-1">
          <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
            {initials}
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
