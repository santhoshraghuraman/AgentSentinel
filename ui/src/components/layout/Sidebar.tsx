import { Link, useLocation } from 'react-router-dom';
import { 
  Activity, 
  Radio, 
  Workflow, 
  Terminal, 
  GitFork, 
  Users, 
  FileKey2, 
  ShieldCheck, 
  FileText, 
  Database, 
  FileSpreadsheet, 
  Sliders,
  Target
} from 'lucide-react';
import { cn } from '../../utils/cn';

interface NavItem {
  number: string;
  name: string;
  href: string;
  icon: any;
  matchPaths?: string[];
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    title: 'MONITOR & OPERATE',
    items: [
      { number: '01.', name: 'Overview Dashboard', href: '/', matchPaths: ['/', '/dashboard'], icon: Activity },
      { number: '02.', name: 'Live Monitor', href: '/live', matchPaths: ['/live', '/monitor'], icon: Radio },
      { number: '03.', name: 'Decision Explorer', href: '/decision-explorer', matchPaths: ['/decision-explorer'], icon: Workflow },
      { number: '04.', name: 'Runtime Playground', href: '/playground', matchPaths: ['/playground'], icon: Terminal },
    ],
  },
  {
    title: 'AUDIT & TRACEABILITY',
    items: [
      { number: '05.', name: 'Trajectories', href: '/trajectories', matchPaths: ['/trajectories'], icon: GitFork },
      { number: '06.', name: 'Agents', href: '/agents', matchPaths: ['/agents'], icon: Users },
      { number: '07.', name: 'Policies', href: '/policies', matchPaths: ['/policies'], icon: FileKey2 },
      { number: '08.', name: 'Tasks', href: '/tasks', matchPaths: ['/tasks'], icon: ShieldCheck },
      { number: '09.', name: 'Audit Logs', href: '/audit', matchPaths: ['/audit'], icon: FileText },
    ],
  },
  {
    title: 'RESEARCH & GOVERNANCE',
    items: [
      { number: '10.', name: 'Datasets', href: '/datasets', matchPaths: ['/datasets'], icon: Database },
      { number: '11.', name: 'Evaluation', href: '/evaluation', matchPaths: ['/evaluation'], icon: Target },
      { number: '12.', name: 'Reports', href: '/reports', matchPaths: ['/reports'], icon: FileSpreadsheet },
      { number: '13.', name: 'Settings', href: '/settings', matchPaths: ['/settings'], icon: Sliders },
      { number: '14.', name: 'Diagnostics', href: '/system/diagnostics', matchPaths: ['/system/diagnostics'], icon: Activity },
    ],
  },
];

export function Sidebar() {
  const location = useLocation();

  const isItemActive = (item: NavItem) => {
    if (item.matchPaths) {
      return item.matchPaths.includes(location.pathname);
    }
    return location.pathname === item.href;
  };

  return (
    <aside className="flex h-full w-64 flex-col bg-white border-r border-slate-200 shrink-0 select-none">
      {/* Brand Header */}
      <div className="flex h-16 shrink-0 items-center justify-between px-5 border-b border-slate-100">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="h-8 w-8 flex items-center justify-center motion-safe:transition-colors opacity-90 group-hover:opacity-100">
            <img src="/logo-icon.png" alt="AgentSentinel Icon" className="h-8 w-8 object-contain drop-shadow-sm" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-sm text-slate-900 tracking-tight leading-none">AgentSentinel</span>
            <span className="text-[9px] font-mono font-semibold tracking-wider text-slate-400 mt-1 uppercase">
              // AI RUNTIME SECURITY
            </span>
          </div>
        </Link>
      </div>

      {/* Navigation Sections */}
      <div className="flex flex-1 flex-col overflow-y-auto px-3 py-4 space-y-5">
        {navSections.map((section) => (
          <div key={section.title} className="space-y-1">
            <h3 className="text-[11px] font-bold font-mono tracking-wider text-slate-400 uppercase px-3 mb-1.5">
              {section.title}
            </h3>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = isItemActive(item);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={cn(
                      'group flex items-center px-3 py-2 text-xs font-medium motion-safe:transition-all rounded-md',
                      active
                        ? 'bg-blue-50 text-blue-700 font-semibold border-l-2 border-blue-600 rounded-l-none pl-2.5'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    )}
                  >
                    {/* Render number via CSS pseudo element so it does not pollute textContent */}
                    <span 
                      data-step={item.number}
                      className={cn(
                        'font-mono text-[11px] mr-2 shrink-0 motion-safe:transition-colors before:content-[attr(data-step)]',
                        active ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'
                      )}
                    />
                    <Icon
                      className={cn(
                        'mr-2.5 shrink-0 h-4 w-4 motion-safe:transition-colors',
                        active ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'
                      )}
                      aria-hidden="true"
                    />
                    <span className="truncate">{item.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Sidebar Footer Status Card */}
      <div className="p-3 border-t border-slate-100 bg-slate-50/70">
        <div className="p-2.5 rounded-lg border border-slate-200/80 bg-white text-[11px] space-y-1.5 shadow-xs">
          <div className="flex items-center justify-between font-mono">
            <span className="text-slate-500">M8 Engine</span>
            <span className="font-semibold text-emerald-600 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 motion-safe:animate-pulse" />
              [ACTIVE]
            </span>
          </div>
          <div className="flex items-center justify-between font-mono text-[11px]">
            <span className="text-slate-400">Fail-Safe</span>
            <span className="text-slate-700 font-medium">ARMED</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
