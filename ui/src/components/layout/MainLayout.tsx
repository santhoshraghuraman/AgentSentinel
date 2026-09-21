import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useQuery } from '@tanstack/react-query';
import { runtimeService } from '../../api/services';
import { ShieldAlert } from 'lucide-react';

export function MainLayout() {
  const { data: health, isError } = useQuery({
    queryKey: ['health'],
    queryFn: runtimeService.getHealth,
    refetchInterval: 30000, // Check every 30s
  });

  return (
    <div className="flex h-screen bg-[#F4F5FB] text-slate-900 overflow-hidden antialiased">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        {/* Top Operational Header */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6">
          <div className="flex items-center gap-3">
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
        <main className="flex-1 overflow-y-auto bg-[#F4F5FB] p-6 lg:p-8 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
