import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { useTheme } from '@/components/theme-provider';
import { Moon, Sun, LogOut, LayoutDashboard, ClipboardList, Menu, X, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { logoutUser } from '@/lib/api';

import ThemeToggle from '@/components/ThemeToggle';

export default function GovernmentHeader() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pstTime, setPstTime] = useState('');

  // Read authenticated user state if present
  let user = null;
  try {
    user = JSON.parse(localStorage.getItem('user') || 'null');
    if (user && user.data && !user.role) {
      user = user.data;
    }
  } catch {
    user = null;
  }

  const isApplicant = user?.role === 'applicant';
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  // Live Philippine Standard Time (PST) ticker
  useEffect(() => {
    const updateTime = () => {
      try {
        const now = new Date();
        const formatted = new Intl.DateTimeFormat('en-PH', {
          timeZone: 'Asia/Manila',
          weekday: 'long',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        }).format(now);
        setPstTime(formatted);
      } catch {
        setPstTime(new Date().toLocaleString());
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    toast.success('Logged out successfully.');
    setMobileOpen(false);
    await logoutUser();
  };

  const initials = user?.full_name
    ? user.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : 'SP';

  const navLinks = [
    { label: 'Home', href: '#home' },
    { label: 'The Law', href: '#the-law' },
    { label: 'Categories', href: '#categories' },
    { label: 'Benefits', href: '#benefits' },
    { label: 'How to apply', href: '#how-to-apply' },
    { label: 'FAQ', href: '#faq' },
    { label: 'Contact', href: '#contact' },
  ];

  const handleNavClick = (e, href) => {
    setMobileOpen(false);
    if (location.pathname !== '/') {
      // If user is on another route, navigate to landing page with anchor
      return;
    }
    // Smooth scroll in current page
    if (href === '#home') {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const targetId = href.replace('#', '');
    const element = document.getElementById(targetId);
    if (element) {
      e.preventDefault();
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-white dark:bg-slate-900 border-b border-[#E5E5E5] dark:border-slate-800 shadow-xs font-roboto">
      {/* ── Tier 1: Top Navigation Bar (56–60px) ────────────────────────── */}
      <div className="w-full bg-white dark:bg-slate-900 border-b border-[#E5E5E5] dark:border-slate-800 h-14 sm:h-[56px] flex items-center">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl flex items-center justify-between">
          
          {/* Left: Navigation links */}
          <nav className="hidden lg:flex items-center gap-1 xl:gap-2">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={(e) => handleNavClick(e, link.href)}
                className="text-[14px] font-normal text-gray-700 dark:text-slate-300 hover:text-[#0e4b65] dark:hover:text-primary hover:bg-[#f0f4f8] dark:hover:bg-slate-800 px-3 py-1.5 rounded-md transition-colors"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Mobile view top brand indicator */}
          <div className="lg:hidden flex items-center gap-1.5 sm:gap-2 shrink-0">
            <img 
              src="/images/seal.gif" 
              alt="City of Butuan Seal" 
              className="h-6 w-6 object-contain shrink-0" 
            />
            <span className="hidden sm:inline font-bold text-[11px] sm:text-xs text-[#0e4b65] dark:text-white uppercase tracking-wider">
              City of Butuan
            </span>
          </div>

          {/* Right: Auth & Utilities */}
          <div className="flex items-center gap-1.5 sm:gap-3">
            {user ? (
              /* User is logged in: show dashboard link & user avatar menu */
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Button asChild size="sm" className="h-9 sm:h-8 px-2.5 sm:px-3 text-xs font-semibold bg-[#0e4b65] hover:bg-[#0b3c52] text-white rounded-xl shadow-xs">
                  <Link to={isAdmin ? "/admin" : "/portal/dashboard"}>
                    <LayoutDashboard className="h-3.5 w-3.5 mr-1" />
                    <span className="hidden xs:inline">{isAdmin ? "Admin Panel" : "My Portal"}</span>
                    <span className="xs:hidden">{isAdmin ? "Admin" : "Portal"}</span>
                  </Link>
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0" data-testid="user-menu">
                      <Avatar className="h-8 w-8 sm:h-8 sm:w-8">
                        <AvatarFallback className="bg-[#0e4b65] text-white text-xs font-medium">{initials}</AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56" align="end" forceMount>
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-semibold leading-none">{user.full_name}</p>
                        <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {isApplicant && (
                      <>
                        <DropdownMenuItem asChild>
                          <Link to="/portal/dashboard"><LayoutDashboard className="mr-2 h-4 w-4" />Dashboard</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to="/portal/my-application"><ClipboardList className="mr-2 h-4 w-4" />My Application</Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
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
              </div>
            ) : (
              /* Guest: Sign In & Register */
              <div className="flex items-center gap-1 sm:gap-2">
                <Link
                  to="/login"
                  className="text-xs sm:text-[14px] font-medium text-gray-700 dark:text-slate-200 hover:text-[#0e4b65] dark:hover:text-primary hover:bg-[#f0f4f8] dark:hover:bg-slate-800 px-2 sm:px-3.5 py-1.5 rounded-xl transition-colors whitespace-nowrap"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="hidden xs:inline-flex text-xs sm:text-[14px] font-medium text-white bg-[#0e4b65] hover:bg-[#0b3c52] dark:bg-primary dark:hover:bg-primary/90 px-2.5 sm:px-4 py-1.5 rounded-xl shadow-xs transition-colors whitespace-nowrap"
                >
                  Register
                </Link>
              </div>
            )}

            <ThemeToggle />

            {/* Mobile Hamburger Toggle */}
            <button
              type="button"
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden min-h-[44px] min-w-[44px] flex items-center justify-center p-2 rounded-xl text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors touch-manipulation cursor-pointer"
              aria-label="Toggle navigation"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>

        </div>
      </div>

      {/* ── Tier 2: Government Branding Bar (Responsive height & scales) ──── */}
      <div className="w-full bg-white dark:bg-slate-900 min-h-[72px] sm:h-[96px] py-2 sm:py-0 flex items-center border-b border-[#E5E5E5]/60 dark:border-slate-800/60">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl h-full flex items-center justify-between gap-3 sm:gap-4">
          
          {/* Official Logos and Department Identity */}
          <Link to="/" onClick={(e) => handleNavClick(e, '#home')} className="flex items-center gap-2.5 sm:gap-4 group text-left min-w-0">
            {/* Logos: City of Butuan Seal + CSWDD Logo */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <img 
                src="/images/seal.gif" 
                alt="City of Butuan Official Seal" 
                className="h-10 w-10 sm:h-14 sm:w-14 md:h-[62px] md:w-[62px] object-contain drop-shadow-xs" 
              />
              <img 
                src="/images/cswdd.jpg" 
                alt="CSWDD Logo" 
                className="h-10 w-10 sm:h-14 sm:w-14 md:h-[62px] md:w-[62px] object-contain rounded-full border border-[#E5E5E5] dark:border-slate-700 shadow-2xs bg-white" 
              />
            </div>

            {/* Subtle Divider */}
            <div className="hidden sm:block h-10 md:h-12 w-[1px] bg-[#E5E5E5] dark:bg-slate-800 mx-0.5 shrink-0" />

            {/* Department Text Hierarchy */}
            <div className="flex flex-col justify-center select-none min-w-0">
              <span className="text-[10px] sm:text-xs font-semibold tracking-wider text-gray-500 dark:text-slate-400 uppercase leading-none mb-0.5 sm:mb-1 truncate">
                City Government of Butuan
              </span>
              <span className="text-base sm:text-xl md:text-2xl font-bold tracking-tight text-[#0e4b65] dark:text-white leading-tight group-hover:text-[#0b3c52] transition-colors truncate">
                SOLO PARENT PORTAL
              </span>
              <span className="text-[10px] sm:text-xs md:text-sm font-medium text-gray-600 dark:text-slate-300 leading-tight mt-0.5 line-clamp-1 sm:line-clamp-none">
                City Social Welfare and Development Department
              </span>
            </div>
          </Link>

          {/* Right Side: Philippine Standard Time (Desktop) */}
          <div className="hidden md:flex flex-col items-end text-right font-roboto shrink-0 select-none">
            <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
              <Clock className="h-3.5 w-3.5 text-[#0e4b65] dark:text-primary" />
              <span>Philippine Standard Time</span>
            </div>
            <div className="text-xs sm:text-sm font-semibold text-gray-800 dark:text-slate-200 mt-0.5">
              {pstTime || 'Loading time...'}
            </div>
          </div>

        </div>
      </div>

      {/* ── Mobile Navigation Drawer (collapsible with touch-friendly links) ── */}
      {mobileOpen && (
        <div className="lg:hidden bg-white dark:bg-slate-900 border-t border-[#E5E5E5] dark:border-slate-800 px-4 py-3 space-y-1 shadow-lg animate-in slide-in-from-top-2 duration-200">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              onClick={(e) => handleNavClick(e, link.href)}
              className="flex items-center px-3.5 py-3 text-sm font-medium text-gray-700 dark:text-slate-200 hover:bg-[#f0f4f8] dark:hover:bg-slate-800 hover:text-[#0e4b65] rounded-xl transition-colors min-h-[44px] touch-manipulation"
            >
              {link.label}
            </a>
          ))}

          {!user && (
            <div className="pt-3 border-t border-[#E5E5E5] dark:border-slate-800 flex flex-col gap-2.5 mt-2">
              <Link
                to="/login"
                onClick={() => setMobileOpen(false)}
                className="w-full text-center py-2.5 text-sm font-semibold text-gray-700 dark:text-slate-200 hover:bg-[#f0f4f8] dark:hover:bg-slate-800 rounded-xl border border-[#E5E5E5] dark:border-slate-700 transition-colors min-h-[44px] flex items-center justify-center touch-manipulation"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                onClick={() => setMobileOpen(false)}
                className="w-full text-center py-2.5 text-sm font-semibold text-white bg-[#0e4b65] hover:bg-[#0b3c52] rounded-xl shadow-xs transition-colors min-h-[44px] flex items-center justify-center touch-manipulation"
              >
                Register for an Account
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
