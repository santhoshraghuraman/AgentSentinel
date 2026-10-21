import { useState, useEffect, useRef } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useQuery } from '@tanstack/react-query';
import { runtimeService } from '../../api/services';
import { ShieldAlert, Menu } from 'lucide-react';

export function MainLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const wasMobileOpenRef = useRef(false);

  const { data: health, isError } = useQuery({
    queryKey: ['health'],
    queryFn: runtimeService.getHealth,
    refetchInterval: 30000, // Check every 30s
  });

  useEffect(() => {
    if (mobileOpen) {
      wasMobileOpenRef.current = true;
      // Focus first focusable element inside drawer
      const focusables = drawerRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusables && focusables.length > 0) {
        focusables[0].focus();
      }

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setMobileOpen(false);
          return;
        }
        if (e.key === 'Tab' && drawerRef.current) {
          const items = drawerRef.current.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          if (items.length === 0) return;
          const first = items[0];
          const last = items[items.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    } else if (wasMobileOpenRef.current) {
      wasMobileOpenRef.current = false;
      menuButtonRef.current?.focus();
    }
  }, [mobileOpen]);

  return (
    <div className="flex h-screen bg-[#F4F5FB] text-slate-900 overflow-hidden antialiased">
      {/* Desktop Persistent Sidebar */}
      <Sidebar className="hidden md:flex" />

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div className="md:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-40 motion-safe:transition-opacity motion-reduce:transition-none"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          {/* Drawer Panel */}
          <div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation drawer"
            id="mobile-sidebar-drawer"
            className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] shadow-2xl motion-safe:transition-transform motion-reduce:transition-none"
          >
            <Sidebar isMobile onClose={() => setMobileOpen(false)} className="w-full h-full shadow-lg" />
          </div>
        </div>
      )}

      <div 
        className="flex flex-1 flex-col overflow-hidden min-w-0"
        aria-hidden={mobileOpen ? true : undefined}
      >
        {/* Top Operational Header */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6">
          <div className="flex items-center gap-3">
            {/* Mobile Hamburger Toggle Button */}
            <button
              ref={menuButtonRef}
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation menu"
              aria-expanded={mobileOpen}
              aria-controls="mobile-sidebar-drawer"
              className="md:hidden p-1.5 -ml-1 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 cursor-pointer"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Status Pills */}
            {isError ? (
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200">
                <ShieldAlert className="h-3.5 w-3.5" />
                <span>OFFLINE</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                <span className="h-2 w-2 rounded-full bg-emerald-500 motion-safe:animate-pulse" />
                <span>OPERATIONAL</span>
              </div>
            )}

            <div className="hidden md:flex items-center text-[11px] font-mono text-slate-500 divide-x divide-slate-200 gap-3">
              <span className="pl-2">Pipeline: <strong className={isError ? "font-semibold text-rose-700" : "font-semibold text-slate-700"}>{isError ? 'Offline' : 'Active'}</strong></span>
              <span className="pl-3">Engine: <strong className={isError || !health?.version ? "font-semibold text-rose-700" : "font-semibold text-emerald-700"}>{isError || !health?.version ? 'Offline' : `Engine Active (${health.version})`}</strong></span>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto bg-[#F4F5FB] p-4 sm:p-6 lg:p-8 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

