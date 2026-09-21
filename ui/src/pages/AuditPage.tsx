import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { auditService } from '../api/services';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { EmptyState } from '../components/ui/EmptyState';
import { JsonViewer } from '../components/viz/JsonViewer';
import { Database, Search, Filter, ChevronDown, ChevronUp, Clock, Terminal, Activity } from 'lucide-react';
import { cn } from '../utils/cn';

export function AuditPage() {
  const [filterDecision, setFilterDecision] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: auditEvents, isLoading, error } = useQuery({
    queryKey: ['auditLogsAll'],
    queryFn: () => auditService.getAll(),
    refetchInterval: 5000,
  });

  const filteredEvents = useMemo(() => {
    return (auditEvents || []).filter((e) => {
      const matchesDecision = filterDecision === 'ALL' || e.decision.toUpperCase() === filterDecision;
      const query = searchQuery.toLowerCase();
      const matchesSearch = 
        !query ||
        (e.interception_id || '').toLowerCase().includes(query) ||
        (e.session_id || '').toLowerCase().includes(query) ||
        (e.task_id || '').toLowerCase().includes(query) ||
        (e.tool_name || '').toLowerCase().includes(query);
      return matchesDecision && matchesSearch;
    });
  }, [auditEvents, filterDecision, searchQuery]);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const totalCount = auditEvents?.length || 0;
  const filteredCount = filteredEvents.length;

  return (
    <div className="flex flex-col gap-5 h-full pb-10">
      {/* Top Breadcrumbs & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono mb-1">
            <span className="text-slate-400 uppercase tracking-wider font-semibold">FORENSICS & COMPLIANCE</span>
            <span className="text-slate-300">//</span>
            <span className="text-blue-700 font-bold uppercase tracking-tight">AUDIT LEDGER</span>
            <span className="text-slate-300">//</span>
            <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[11px]">
              EVENTS: {totalCount}
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <span>Audit Logs</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Immutable cryptographic records of all runtime interceptions, tool calls, and governance decisions.
          </p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <Input 
            placeholder="Search by Interception ID, Session, Task, or Tool..." 
            className="pl-8 h-8 text-xs font-mono bg-slate-50/50 border-slate-200"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-slate-400" />
          <span className="text-[11px] font-bold font-mono text-slate-500 uppercase tracking-wider">Decision:</span>
          <select 
            value={filterDecision} 
            onChange={(e) => setFilterDecision(e.target.value)}
            className="h-8 rounded-md border border-slate-200 bg-slate-50/50 px-2 text-xs font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="ALL">ALL ({totalCount})</option>
            <option value="ALLOW">ALLOW</option>
            <option value="ALERT">ALERT</option>
            <option value="BLOCK">BLOCK</option>
          </select>
        </div>
      </div>

      {/* Main List */}
      <div className="flex-1 overflow-y-auto pr-1">
        {isLoading ? (
          <div className="p-12 text-center text-xs font-mono text-slate-400 bg-white rounded-xl border border-slate-200">
            Loading audit logs...
          </div>
        ) : error ? (
          <div className="p-4 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 text-xs font-mono">
            Error loading audit logs. API may be unreachable.
          </div>
        ) : filteredCount === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center text-center text-xs font-mono text-slate-400 bg-white rounded-xl border border-slate-200">
            <EmptyState 
              icon={Database}
              title="No Matching Audit Events" 
              description="Run an agent from the Runtime Playground to see audit records appear here."
            />
          </div>
        ) : (
          <div className="space-y-3">
            {filteredEvents.map((e) => {
              const isExpanded = expandedId === e.interception_id;
              const isBlock = e.decision.toLowerCase() === 'block';
              const isAlert = e.decision.toLowerCase() === 'alert';

              return (
                <Card 
                  key={e.interception_id} 
                  className={cn(
                    "overflow-hidden border rounded-xl motion-safe:transition-colors bg-white hover:shadow-xs cursor-pointer",
                    isBlock ? "border-rose-200/90 hover:border-rose-300" :
                    isAlert ? "border-amber-200/90 hover:border-amber-300" :
                    "border-emerald-200/90 hover:border-emerald-300"
                  )}
                  onClick={() => toggleExpand(e.interception_id)}
                >
                  <div className="p-3 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 select-none">
                    <div className="flex items-start sm:items-center gap-3">
                      <Badge 
                        variant={e.decision.toLowerCase() as any}
                        className={cn(
                          "text-[11px] font-mono uppercase px-2 py-0.5 font-bold shrink-0",
                          isBlock ? "bg-rose-100 text-rose-800 border-rose-200" :
                          isAlert ? "bg-amber-100 text-amber-800 border-amber-200" :
                          "bg-emerald-100 text-emerald-800 border-emerald-200"
                        )}
                      >
                        {e.decision}
                      </Badge>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-sm font-mono text-slate-900 flex items-center gap-1.5">
                            <Terminal className="h-3.5 w-3.5 text-slate-400" />
                            {e.tool_name}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono text-[11px] font-bold border border-slate-200">
                            {e.execution_state}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 font-mono mt-1 flex items-center gap-2">
                          <span title={e.session_id}>Session: {e.session_id.substring(0,8)}...</span>
                          <span className="text-slate-300">|</span>
                          <span title={e.task_id}>Task: {e.task_id.substring(0,8)}...</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-[11px] font-mono text-slate-500 font-semibold">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(e.timestamp).toLocaleString()}
                      </span>
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </div>

                  {isExpanded && (
                    <CardContent 
                      className="border-t p-4 space-y-4 cursor-default bg-slate-50/50 border-slate-100"
                      onClick={(evt) => evt.stopPropagation()}
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[11px] font-mono">
                        <div className="bg-white p-2 rounded border border-slate-200">
                          <span className="text-slate-400 font-bold">Interception ID:</span>{' '}
                          <span className="text-slate-800">{e.interception_id}</span>
                        </div>
                        <div className="bg-white p-2 rounded border border-slate-200">
                          <span className="text-slate-400 font-bold">Sequence Number:</span>{' '}
                          <span className="text-slate-800">{e.sequence_number}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1.5">
                            <Activity className="h-3.5 w-3.5" />
                            Invocation Arguments
                          </p>
                          <div className="bg-white rounded-lg p-2.5 border border-slate-200 shadow-sm">
                            <JsonViewer data={e.arguments} />
                          </div>
                        </div>

                        {e.action && (
                          <div>
                            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1.5">
                              <Database className="h-3.5 w-3.5" />
                              Normalized Semantics (M2)
                            </p>
                            <div className="bg-white rounded-lg p-2.5 border border-slate-200 shadow-sm">
                              <JsonViewer data={e.action} />
                            </div>
                          </div>
                        )}
                      </div>

                      {e.execution_result && (
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                            Execution Outcome / Result
                          </p>
                          <pre className="text-[11px] font-mono bg-white border border-slate-200 rounded-lg p-3 whitespace-pre-wrap overflow-x-auto text-slate-700 shadow-sm">
                            {e.execution_result}
                          </pre>
                        </div>
                      )}

                      {e.error_message && (
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-wider text-rose-500 mb-1.5">
                            Execution Error Message
                          </p>
                          <pre className="text-[11px] font-mono bg-rose-50 text-rose-700 border border-rose-200 rounded-lg p-3 whitespace-pre-wrap shadow-sm">
                            {e.error_message}
                          </pre>
                        </div>
                      )}
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
