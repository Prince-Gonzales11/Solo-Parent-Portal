import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import {
  LayoutDashboard, ClipboardList, FileText, MapPin, Users2,
  Megaphone, BarChart2, TrendingUp, Shield, FolderOpen,
  LogOut, PanelLeftClose, PanelLeft, ChevronRight, MessageSquare,
  RotateCcw, AlertTriangle, Layers
} from 'lucide-react';
import { toast } from 'sonner';
import { logoutUser } from '@/lib/api';
import ThemeToggle from '@/components/ThemeToggle';

/* ─── Navigation configuration ────────────────────────────── */
const NAV_GROUPS = [
  {
    label: 'Main',
    items: [
      { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', exact: true },
    ],
  },
  {
    label: 'Applications',
    items: [
      { to: '/admin/applicants?type=new', icon: ClipboardList, label: 'New Solo Parent ID' },
      { to: '/admin/applicants?type=renewal', icon: RotateCcw, label: 'Renewal' },
      { to: '/admin/applicants?type=loss_spic', icon: AlertTriangle, label: 'Loss of SPIC' },
      { to: '/admin/applicants', icon: Layers, label: 'All Registry' },
      { to: '/admin/categories', icon: FileText, label: 'Categories' },
    ],
  },
  {
    label: 'Communication',
    items: [
      { to: '/admin/messages', icon: MessageSquare, label: 'Messages' },
      { to: '/admin/announcements', icon: Megaphone, label: 'Announcements' },
      { to: '/admin/resources', icon: FolderOpen, label: 'Resources' },
    ],
  },
  {
    label: 'Management',
    items: [
      { to: '/admin/barangays', icon: MapPin, label: 'Barangays' },
      { to: '/admin/users', icon: Users2, label: 'Users & Admins' },
    ],
  },
  {
    label: 'Reporting & Monitoring',
    items: [
      { to: '/admin/reports', icon: BarChart2, label: 'Reports' },
      { to: '/admin/analytics', icon: TrendingUp, label: 'Analytics' },
      { to: '/admin/audit-logs', icon: Shield, label: 'Audit Logs' },
    ],
  },
];

/* ─── Single nav item ─────────────────────────────────────── */
function SidebarNavItem({ item, collapsed, location }) {
  const currentFull = location.pathname + location.search;
  const active = item.exact
    ? currentFull === item.to
    : (item.to.includes('?')
        ? currentFull === item.to
        : (location.pathname === item.to && !location.search));

  const Icon = item.icon;

  const content = (
    <Link
      to={item.to}
      className={`
        group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium
        transition-all duration-150 outline-none
        ${active
          ? 'bg-[hsl(var(--sidebar-accent))] text-primary font-semibold'
          : 'text-[hsl(var(--sidebar-foreground))] opacity-75 hover:opacity-100 hover:bg-[hsl(var(--sidebar-muted))]'
        }
        ${collapsed ? 'justify-center px-0 mx-1' : ''}
      `}
    >
      {/* Active indicator bar */}
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-primary" />
      )}
      <Icon className={`h-[18px] w-[18px] shrink-0 ${active ? 'text-primary' : ''}`} />
      {!collapsed && (
        <span className="truncate">{item.label}</span>
      )}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="right" className="font-medium">
          {item.label}
        </TooltipContent>
      </Tooltip>
    );
  }

  return content;
}

/* ═══════════════════════════════════════════════════════════════
   ADMIN SIDEBAR
   ═══════════════════════════════════════════════════════════════ */
export default function AdminSidebar({ collapsed, onToggle, mobileOpen, onMobileClose }) {
  const location = useLocation();
  const navigate = useNavigate();

  let user = JSON.parse(localStorage.getItem('user') || 'null');
  if (user && user.data && !user.role) user = user.data;

  const initials = user?.full_name
    ? user.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : 'SA';

  const roleLabel = user?.role === 'super_admin' ? 'Super Administrator' : 'Administrator';

  const handleLogout = async () => {
    toast.success('Logged out successfully.');
    await logoutUser();
  };

  // Close mobile drawer when a nav item is clicked
  const handleNavClick = () => {
    if (mobileOpen && onMobileClose) onMobileClose();
  };

  return (
    <TooltipProvider>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={onMobileClose}
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 z-50 h-screen flex flex-col
          bg-[hsl(var(--sidebar))] border-r border-[hsl(var(--sidebar-border))]
          transition-all duration-300 ease-in-out
          ${collapsed ? 'w-[var(--sidebar-collapsed-width)]' : 'w-[var(--sidebar-width)] max-w-[85vw]'}
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
        onClick={handleNavClick}
      >
        {/* ── Branding ─────────────────────────────────────── */}
        <div className={`flex items-center gap-3 px-4 h-16 shrink-0 ${collapsed ? 'justify-center px-2' : ''}`}>
          {!collapsed && (
            <>
              <div className="flex -space-x-1.5 shrink-0">
                <img src="/images/seal.gif" alt="Butuan Seal" className="h-8 w-8 rounded-full border-2 border-[hsl(var(--sidebar))] shadow-sm object-cover" />
                <img src="/images/cswdd.jpg" alt="CSWDD" className="h-8 w-8 rounded-full border-2 border-[hsl(var(--sidebar))] shadow-sm object-cover bg-white" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-[hsl(var(--sidebar-foreground))] truncate" style={{ fontFamily: 'Outfit, sans-serif' }}>
                  Solo Parent Portal
                </p>
                <p className="text-xs text-[hsl(var(--sidebar-foreground))] opacity-70 truncate font-medium">
                  Admin Console
                </p>
              </div>
            </>
          )}
          {collapsed && (
            <div className="flex -space-x-1 shrink-0">
              <img src="/images/seal.gif" alt="Seal" className="h-8 w-8 rounded-full border-2 border-[hsl(var(--sidebar))] shadow-sm object-cover" />
            </div>
          )}
        </div>

        <Separator className="bg-[hsl(var(--sidebar-border))]" />

        {/* ── Navigation ───────────────────────────────────── */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-3 space-y-6 scrollbar-thin">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              {!collapsed && (
                <p className="px-3 mb-2 text-xs font-bold uppercase tracking-wider text-[hsl(var(--sidebar-foreground))] opacity-60">
                  {group.label}
                </p>
              )}
              {collapsed && (
                <div className="w-8 mx-auto mb-2 border-t border-[hsl(var(--sidebar-border))]" />
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <SidebarNavItem
                    key={item.to}
                    item={item}
                    collapsed={collapsed}
                    location={location}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>

        <Separator className="bg-[hsl(var(--sidebar-border))]" />

        {/* ── Account Section ──────────────────────────────── */}
        <div
          className={`shrink-0 p-3 ${collapsed ? 'flex flex-col items-center gap-2' : ''}`}
          onClick={(e) => e.stopPropagation()}
        >
          {!collapsed ? (
            <div className="flex items-center gap-3 px-2 py-2">
              <Avatar className="h-9 w-9 shrink-0">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[hsl(var(--sidebar-foreground))] truncate">
                  {user?.full_name || 'Administrator'}
                </p>
                <p className="text-xs text-[hsl(var(--sidebar-foreground))] opacity-70 truncate font-medium">
                  {roleLabel}
                </p>
              </div>
              <ThemeToggle className="h-8 w-8 shrink-0 opacity-70 hover:opacity-100" />
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleLogout}
                    className="h-8 w-8 shrink-0 text-[hsl(var(--sidebar-foreground))] opacity-50 hover:opacity-100 hover:text-destructive"
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Sign Out</TooltipContent>
              </Tooltip>
            </div>
          ) : (
            <>
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <Avatar className="h-9 w-9 cursor-pointer">
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p className="font-semibold">{user?.full_name}</p>
                  <p className="text-xs opacity-75">{roleLabel}</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleLogout}
                    className="h-8 w-8 text-[hsl(var(--sidebar-foreground))] opacity-50 hover:opacity-100 hover:text-destructive"
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Sign Out</TooltipContent>
              </Tooltip>
            </>
          )}
        </div>

        {/* ── Collapse Toggle (desktop) ────────────────────── */}
        <div className="hidden lg:block shrink-0 px-3 pb-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => { e.stopPropagation(); onToggle(); }}
            className={`w-full gap-2 text-[hsl(var(--sidebar-foreground))] opacity-50 hover:opacity-100 ${collapsed ? 'justify-center px-0' : 'justify-start'}`}
          >
            {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            {!collapsed && <span className="text-xs">Collapse</span>}
          </Button>
        </div>
      </aside>
    </TooltipProvider>
  );
}
