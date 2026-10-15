import React from 'react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/components/theme-provider';
import { Sun, Moon } from 'lucide-react';

/**
 * Reusable, touch-friendly theme toggle button for both desktop and mobile views.
 * Supports light and dark modes with high-contrast accessibility.
 */
export default function ThemeToggle({ className = '', variant = 'ghost', size = 'icon' }) {
  const { theme, setTheme } = useTheme();

  const isDark = theme === 'dark' || (theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const toggleTheme = (e) => {
    e?.stopPropagation();
    setTheme(isDark ? 'light' : 'dark');
  };

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={toggleTheme}
      data-testid="theme-toggle"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={`h-9 w-9 min-h-[38px] min-w-[38px] sm:min-h-[36px] sm:min-w-[36px] rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all touch-manipulation cursor-pointer active:scale-90 ${className}`}
    >
      {isDark ? (
        <Sun className="h-[18px] w-[18px] text-amber-400 transition-transform duration-200 rotate-0 hover:rotate-45" />
      ) : (
        <Moon className="h-[18px] w-[18px] text-slate-700 dark:text-slate-300 transition-transform duration-200 hover:-rotate-12" />
      )}
    </Button>
  );
}
