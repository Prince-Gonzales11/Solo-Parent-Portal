import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { useTheme } from '@/components/theme-provider';
import { Moon, Sun, LogOut, LayoutDashboard, Bell, ClipboardList, Settings, LayoutGrid, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { api, logoutUser } from '@/lib/api';
import GovernmentHeader from './GovernmentHeader';

import ThemeToggle from '@/components/ThemeToggle';

function NavLink({ to, icon: Icon, label, location }) {
  // Use exact match for root paths (e.g. /admin) to prevent always-active
  const isRoot = to === '/admin' || to === '/portal/dashboard' || to === '/portal/services';
  const active = isRoot ? location.pathname === to : (location.pathname === to || location.pathname.startsWith(to + '/'));
  return (
    <Button asChild variant={active ? 'secondary' : 'ghost'} size="sm">
      <Link to={to} className="flex items-center gap-1.5">
        <Icon className="h-4 w-4" />
        <span className="hidden md:inline">{label}</span>
      </Link>
    </Button>
  );
}

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);

  const [user, setUser] = useState(() => {
    let u = JSON.parse(localStorage.getItem('user') || 'null');
    if (u && u.data && !u.role) {
      u = u.data;
    }
    return u;
  });

  useEffect(() => {
    const handleUserUpdate = () => {
      let u = JSON.parse(localStorage.getItem('user') || 'null');
      if (u && u.data && !u.role) {
        u = u.data;
      }
      setUser(u);
    };
    window.addEventListener('user-updated', handleUserUpdate);
    return () => window.removeEventListener('user-updated', handleUserUpdate);
  }, []);
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const isApplicant = user?.role === 'applicant';

  // Smart notification polling with visibility API
  useEffect(() => {
    if (!isApplicant) return;
    let intervalId = null;
    const POLL_INTERVAL = 30000; // 30s

    const fetchCounts = async () => {
      try {
        const [notifRes, msgRes] = await Promise.allSettled([
          api.get('/notifications/unread-count'),
          api.get('/messages/unread-count'),
        ]);
        if (notifRes.status === 'fulfilled') {
          setUnreadCount(notifRes.value.data?.count ?? 0);
        }
        if (msgRes.status === 'fulfilled') {
          setUnreadMessages(msgRes.value.data?.count ?? 0);
        }
      } catch {
        // silent
      }
    };

    const start = () => { if (!intervalId) intervalId = setInterval(fetchCounts, POLL_INTERVAL); };
    const stop = () => { if (intervalId) { clearInterval(intervalId); intervalId = null; } };
    const onVis = () => { document.hidden ? stop() : (fetchCounts(), start()); };

    fetchCounts();
    start();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [isApplicant]);

  const handleLogout = async () => {
    toast.success('Logged out successfully.');
    await logoutUser();
  };

  const initials = user?.full_name
    ? user.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : 'SP';

  if (location.pathname === '/') {
    return <GovernmentHeader />;
  }

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/90 backdrop-blur-md">
        <div className="container mx-auto flex h-14 sm:h-16 items-center justify-between px-3 sm:px-4">
          {/* Brand */}
          <Link to={isApplicant ? "/portal/dashboard" : isAdmin ? "/admin" : "/"} className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="flex -space-x-1.5 sm:-space-x-2">
              <img src="/images/seal.gif" alt="Butuan Seal" className="h-8 w-8 sm:h-9 sm:w-9 rounded-full border-2 border-background shadow-xs object-cover" />
              <img src="/images/cswdd.jpg" alt="CSWDD Logo" className="h-8 w-8 sm:h-9 sm:w-9 rounded-full border-2 border-background shadow-xs object-cover bg-white" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="font-bold text-sm sm:text-base md:text-lg text-[#0e4b65] dark:text-cyan-400" style={{ fontFamily: 'Outfit, sans-serif' }}>
                Solo Parent Portal
              </span>
              <span className="text-[10px] text-muted-foreground hidden xs:block">City Government of Butuan</span>
            </div>
          </Link>

        {/* Public nav */}
        {!user && (
          <nav className="hidden lg:flex items-center gap-6 text-sm font-medium">
            <a href="#how-it-works" className="text-muted-foreground hover:text-primary transition-colors">About</a>
            <a href="#the-law" className="text-muted-foreground hover:text-primary transition-colors">The Law</a>
            <a href="#categories" className="text-muted-foreground hover:text-primary transition-colors">Categories</a>
            <a href="#benefits" className="text-muted-foreground hover:text-primary transition-colors">Benefits</a>
            <a href="#process" className="text-muted-foreground hover:text-primary transition-colors">How to Apply</a>
            <a href="#faq" className="text-muted-foreground hover:text-primary transition-colors">FAQ</a>
            <a href="#contact" className="text-muted-foreground hover:text-primary transition-colors">Contact</a>
          </nav>
        )}

        {/* Applicant desktop nav: Dashboard | Services | My Application | Notifications | Messages */}
        {isApplicant && (
          <nav className="hidden md:flex items-center gap-1 sm:gap-1.5">
            <NavLink to="/portal/dashboard" icon={LayoutDashboard} label="Dashboard" location={location} />
            <NavLink to="/portal/services" icon={LayoutGrid} label="Services" location={location} />
            <NavLink to="/portal/my-application" icon={ClipboardList} label="My Application" location={location} />
            <div className="relative">
              <NavLink to="/portal/notifications" icon={Bell} label="Notifications" location={location} />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-danger text-danger-foreground text-white text-[9px] rounded-full h-4 w-4 flex items-center justify-center font-bold pointer-events-none">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </div>
            <div className="relative">
              <NavLink to="/portal/messages" icon={MessageSquare} label="Messages" location={location} />
              {unreadMessages > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-primary text-primary-foreground text-[9px] rounded-full h-4 w-4 flex items-center justify-center font-bold pointer-events-none animate-pulse">
                  {unreadMessages > 9 ? '9+' : unreadMessages}
                </span>
              )}
            </div>
          </nav>
        )}

        {/* Admin nav is handled by AdminSidebar — not shown here */}

        {/* Right: theme + user */}
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0" data-testid="user-menu">
                  <Avatar className="h-9 w-9">
                    {user.picture && (
                      <AvatarImage src={user.picture} alt={user.full_name || 'User'} className="object-cover" />
                    )}
                    <AvatarFallback className="bg-primary text-primary-foreground text-sm font-bold">{initials}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-semibold leading-none">{user.full_name}</p>
                    <p className="text-xs leading-none text-muted-foreground">{user.email || user.phone_number}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {isApplicant && (
                  <>
                    <DropdownMenuItem asChild>
                      <Link to="/portal/dashboard"><LayoutDashboard className="mr-2 h-4 w-4" />Dashboard</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/portal/services"><LayoutGrid className="mr-2 h-4 w-4" />Services</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/portal/my-application"><ClipboardList className="mr-2 h-4 w-4" />My Application</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/portal/messages"><MessageSquare className="mr-2 h-4 w-4" />Messages</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/portal/settings"><Settings className="mr-2 h-4 w-4" />Account Settings</Link>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="text-destructive focus:text-destructive cursor-pointer"
                  data-testid="logout-button"
                >
                  <LogOut className="mr-2 h-4 w-4" /> Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex items-center gap-2">
              <Button asChild variant="ghost" size="sm">
                <Link to="/login">Sign In</Link>
              </Button>
              <Button asChild size="sm" className="rounded-full">
                <Link to="/register">Register</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>

      {/* Applicant Mobile Bottom Navigation Bar (Rendered at root outside header so fixed bottom-0 is not trapped) */}
      {isApplicant && (
        <nav
          aria-label="Mobile Navigation"
          className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-t border-border shadow-[0_-4px_20px_rgba(0,0,0,0.08)] px-2 py-1 flex items-center justify-around pb-[max(0.35rem,env(safe-area-inset-bottom))]"
        >
          <Link
            to="/portal/dashboard"
            className={`flex flex-col items-center justify-center flex-1 py-1 px-1 min-h-[48px] rounded-xl text-[10px] font-semibold transition-all touch-manipulation active:scale-95 ${
              location.pathname === '/portal/dashboard'
                ? 'text-primary font-bold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <LayoutDashboard className={`h-5 w-5 mb-0.5 ${location.pathname === '/portal/dashboard' ? 'text-primary' : ''}`} />
            <span>Home</span>
          </Link>

          <Link
            to="/portal/services"
            className={`flex flex-col items-center justify-center flex-1 py-1 px-1 min-h-[48px] rounded-xl text-[10px] font-semibold transition-all touch-manipulation active:scale-95 ${
              location.pathname === '/portal/services'
                ? 'text-primary font-bold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <LayoutGrid className={`h-5 w-5 mb-0.5 ${location.pathname === '/portal/services' ? 'text-primary' : ''}`} />
            <span>Services</span>
          </Link>

          <Link
            to="/portal/my-application"
            className={`flex flex-col items-center justify-center flex-1 py-1 px-1 min-h-[48px] rounded-xl text-[10px] font-semibold transition-all touch-manipulation active:scale-95 relative ${
              location.pathname.startsWith('/portal/my-application')
                ? 'text-primary font-bold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <ClipboardList className={`h-5 w-5 mb-0.5 ${location.pathname.startsWith('/portal/my-application') ? 'text-primary' : ''}`} />
            <span>Application</span>
          </Link>

          <Link
            to="/portal/messages"
            className={`flex flex-col items-center justify-center flex-1 py-1 px-1 min-h-[48px] rounded-xl text-[10px] font-semibold transition-all touch-manipulation active:scale-95 relative ${
              location.pathname === '/portal/messages'
                ? 'text-primary font-bold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <div className="relative">
              <MessageSquare className={`h-5 w-5 mb-0.5 ${location.pathname === '/portal/messages' ? 'text-primary' : ''}`} />
              {unreadMessages > 0 && (
                <span className="absolute -top-1 -right-2 bg-primary text-primary-foreground text-[9px] rounded-full h-4 w-4 flex items-center justify-center font-bold animate-pulse">
                  {unreadMessages > 9 ? '9+' : unreadMessages}
                </span>
              )}
            </div>
            <span>Messages</span>
          </Link>

          <Link
            to="/portal/notifications"
            className={`flex flex-col items-center justify-center flex-1 py-1 px-1 min-h-[48px] rounded-xl text-[10px] font-semibold transition-all touch-manipulation active:scale-95 relative ${
              location.pathname === '/portal/notifications'
                ? 'text-primary font-bold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <div className="relative">
              <Bell className={`h-5 w-5 mb-0.5 ${location.pathname === '/portal/notifications' ? 'text-primary' : ''}`} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-2 bg-destructive text-destructive-foreground text-[9px] rounded-full h-4 w-4 flex items-center justify-center font-bold">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </div>
            <span>Notifs</span>
          </Link>
        </nav>
      )}
    </>
  );
}
