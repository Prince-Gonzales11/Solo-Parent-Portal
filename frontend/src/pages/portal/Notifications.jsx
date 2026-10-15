import React, { useEffect, useState } from 'react';
import { api, toastError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { Bell, CheckCheck, RefreshCw, Info, AlertTriangle, CheckCircle, RotateCcw, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

const TYPE_CONFIG = {
  application_submitted: { icon: FileText, color: 'text-info', bg: 'bg-info-soft border-info/30 dark:border-info/30' },
  status_update: { icon: CheckCircle, color: 'text-primary', bg: 'bg-primary/5 border-primary/10' },
  renewal_started: { icon: RotateCcw, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-950/20 border-purple-100 dark:border-purple-900' },
  renewal_reminder: { icon: AlertTriangle, color: 'text-warning', bg: 'bg-warning-soft border-warning/30' },
  document_request: { icon: FileText, color: 'text-warning', bg: 'bg-orange-50 dark:bg-orange-950/20 border-orange-100 dark:border-orange-900' },
  general: { icon: Info, color: 'text-muted-foreground', bg: 'bg-muted/50 border-border' },
};

function NotifIcon({ type }) {
  const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.general;
  const Icon = cfg.icon;
  return (
    <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${cfg.bg} border`}>
      <Icon className={`h-4 w-4 ${cfg.color}`} />
    </div>
  );
}

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data || []);
    } catch (err) {
      toastError(err, 'Could not load notifications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchNotifications(); }, []);

  const handleMarkRead = async (id) => {
    try {
      await api.post(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (err) {
      toastError(err, 'Could not mark notification as read.');
    }
  };

  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    try {
      await api.post('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      toast.success('All notifications marked as read.');
    } catch (err) {
      toastError(err, 'Could not mark all as read.');
    } finally {
      setMarkingAll(false);
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <RefreshCw className="h-8 w-8 animate-spin" />
          <p className="text-sm">Loading notifications…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 container px-3 sm:px-6 lg:px-8 py-4 sm:py-8 max-w-4xl mx-auto space-y-4 sm:space-y-6 w-full max-w-full overflow-x-hidden min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Bell className="h-6 w-6 sm:h-7 sm:w-7 text-primary" />
            Notifications
          </h1>
          <p className="text-muted-foreground mt-0.5 text-xs sm:text-sm md:text-base">
            {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : 'All caught up!'}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAllRead}
            disabled={markingAll}
            className="gap-2 min-h-[40px] px-3.5 self-start sm:self-auto"
          >
            {markingAll ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
            Mark all read
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="card-pop rounded-3xl p-8 sm:p-12 text-center">
          <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
            <Bell className="h-7 w-7 text-muted-foreground/50" />
          </div>
          <h3 className="font-bold text-base sm:text-lg">No Notifications</h3>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">You will receive updates about your application status here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map(n => (
            <div
              key={n.id}
              className={`card-pop rounded-2xl p-3.5 sm:p-5 transition-all flex items-start gap-3 sm:gap-4 ${
                !n.is_read ? 'border-primary/40 bg-primary/5 shadow-xs' : 'border-border/60'
              }`}
            >
              <NotifIcon type={n.type} />

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-bold text-sm sm:text-base text-foreground truncate">{n.title}</h4>
                  {!n.is_read && (
                    <Badge variant="default" className="text-[11px] h-5 px-2 rounded-full bg-primary font-bold shadow-2xs">New</Badge>
                  )}
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">{n.message}</p>
                <div className="flex flex-wrap items-center gap-3 mt-3 pt-2 border-t border-border/40">
                  {n.created_at && (
                    <span className="text-[11px] text-muted-foreground font-mono">
                      {format(new Date(n.created_at), 'MMM d, yyyy · h:mm a')}
                    </span>
                  )}
                  {n.link && (
                    <Link to={n.link} className="text-xs sm:text-sm text-primary hover:underline font-semibold inline-flex items-center gap-1 min-h-[36px]">
                      View details →
                    </Link>
                  )}
                  {!n.is_read && (
                    <button
                      onClick={() => handleMarkRead(n.id)}
                      className="text-xs text-muted-foreground hover:text-foreground font-medium transition-colors ml-auto hover:underline min-h-[36px] px-2 py-1 rounded-lg touch-manipulation"
                    >
                      Mark read
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
