import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { sessionService, auditService, systemService } from '../api/services';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { EmptyState } from '../components/ui/EmptyState';
import { 
  Users, 
  Server, 
  Activity, 
  ArrowRight, 
  Shield, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Search,
  Terminal,
  Layers,
  ShieldCheck
} from 'lucide-react';
import { cn } from '../utils/cn';

const getStatusBadge = (status: string, hasBlock: boolean = false) => {
  const s = status.toUpperCase();
  return (
    <div className="flex items-center gap-1.5">
      {hasBlock && (
        <span className="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 uppercase">
          SEV-1
        </span>
      )}
      {s === 'ACTIVE' ? (
        <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 motion-safe:animate-pulse" />
          ACTIVE
        </span>
      ) : s === 'COMPLETED' ? (
        <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 uppercase">
          COMPLETED
        </span>
      ) : s === 'FAILED' ? (
        <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 uppercase">
          FAILED
        </span>
      ) : (
        <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 uppercase">
          {s}
        </span>
      )}
    </div>
  );
};

export function AgentsPage() {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed' | 'failed'>('all');
  const [isLivePolling, setIsLivePolling] = useState(true);

  // Fetch all sessions from real API
  const { data: sessions, isLoading: isSessionsLoading } = useQuery({
    queryKey: ['sessions'],
    queryFn: sessionService.listSessions,
    refetchInterval: isLivePolling ? 5000 : false,
  });

  // Fetch diagnostics for health overview
  const { data: diagnostics } = useQuery({
    queryKey: ['systemDiagnostics'],
    queryFn: systemService.getDiagnostics,
  });

  // Filtered sessions
  const filteredSessions = useMemo(() => {
    if (!sessions) return [];
    return sessions.filter(s => {
      const matchQuery = 
        s.session_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.task_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.agent_id.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchStatus = 
        statusFilter === 'all' || 
        s.status.toLowerCase() === statusFilter.toLowerCase();

      return matchQuery && matchStatus;
    });
  }, [sessions, searchQuery, statusFilter]);

  const selectedSession = useMemo(() => {
    return sessions?.find(s => s.session_id === selectedSessionId) || null;
  }, [sessions, selectedSessionId]);

  // Fetch audit events for selected session
  const { data: sessionEvents, isLoading: isEventsLoading } = useQuery({
    queryKey: ['auditSession', selectedSessionId],
    queryFn: () => auditService.getBySession(selectedSessionId!),
    enabled: !!selectedSessionId,
    refetchInterval: isLivePolling && selectedSession?.status === 'active' ? 3000 : false,
  });

  // Calculate real top-level metrics
  const totalEventsCount = useMemo(() => {
    if (!sessions) return 0;
    return sessions.reduce((sum, s) => sum + (s.total_events || 0), 0);
  }, [sessions]);

  const meanStepsPerSession = useMemo(() => {
    if (!sessions || sessions.length === 0) return '0.0';
    return (totalEventsCount / sessions.length).toFixed(1);
  }, [sessions, totalEventsCount]);

  const totalBlockedSessions = useMemo(() => {
    if (!sessions) return 0;
    return sessions.filter(s => (s.verdict_counts?.['BLOCK'] || 0) > 0).length;
  }, [sessions]);



  const getDecisionIcon = (decision: string) => {
    const d = decision.toUpperCase();
    if (d === 'ALLOW') return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
    if (d === 'BLOCK') return <XCircle className="h-4 w-4 text-rose-600" />;
    if (d === 'ALERT') return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    return <Shield className="h-4 w-4 text-slate-400" />;
  };

  const sortedEvents = useMemo(() => {
    if (!sessionEvents) return [];
    return [...sessionEvents].sort((a, b) => (a.sequence_number ?? 0) - (b.sequence_number ?? 0));
  }, [sessionEvents]);

  return (
    <div className="flex flex-col gap-5 h-full pb-10">
      {/* Top Header & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono mb-1">
            <span className="text-slate-400 uppercase tracking-wider font-semibold">AUDIT & TRACEABILITY</span>
            <span className="text-slate-300">//</span>
            <span className="text-blue-700 font-bold uppercase tracking-tight">AGENT FLEET & ACTIVE SESSIONS</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <span>Agents & Sessions</span>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              100% Monitored
            </span>
          </h1>
        </div>

        <div className="flex items-center gap-3 font-mono text-xs">
          <div className="bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-xs flex items-center gap-2">
            <span className="text-slate-400">Model:</span>
            <span className="font-bold text-slate-800">{diagnostics?.llm?.model || 'Local Model'}</span>
          </div>
          <div className="bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-xs flex items-center gap-2">
            <span className="text-slate-400">Enforcement:</span>
            <span className="font-bold text-blue-700">M8 Active</span>
          </div>
        </div>
      </div>

      {/* Top 4 KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <Card className="p-4 border-slate-200 shadow-xs bg-white flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold font-mono text-slate-500 uppercase tracking-wider">
              ACTIVE SESSIONS
            </span>
            <Users className="h-4 w-4 text-slate-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold font-mono text-slate-900">
              {sessions?.length || 0}
            </span>
            <span className="text-xs font-mono text-emerald-600 font-semibold">Monitored</span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] font-mono text-slate-500">
            Sessions currently registered in store
          </div>
        </Card>

        {/* Metric 2 */}
        <Card className="p-4 border-slate-200 shadow-xs bg-white flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold font-mono text-slate-500 uppercase tracking-wider">
              MONITORED INTERCEPTIONS
            </span>
            <Layers className="h-4 w-4 text-slate-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold font-mono text-slate-900">
              {totalEventsCount}
            </span>
            {totalBlockedSessions > 0 && (
              <span className="text-xs font-mono text-rose-600 font-semibold">
                {totalBlockedSessions} with Block
              </span>
            )}
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] font-mono text-slate-500">
            Total operations evaluated by pipeline
          </div>
        </Card>

        {/* Metric 3 */}
        <Card className="p-4 border-slate-200 shadow-xs bg-white flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold font-mono text-slate-500 uppercase tracking-wider">
              MEAN STEPS / SESSION
            </span>
            <Activity className="h-4 w-4 text-slate-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold font-mono text-slate-900">
              {meanStepsPerSession}
            </span>
            <span className="text-xs font-mono text-slate-500">steps/trajectory</span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] font-mono text-slate-500">
            Sequential action depth per runtime session
          </div>
        </Card>

        {/* Metric 4 */}
        <Card className="p-4 border-slate-200 shadow-xs bg-white flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold font-mono text-slate-500 uppercase tracking-wider">
              ENFORCEMENT INTEGRITY
            </span>
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold font-mono text-emerald-600">
              M8 Active
            </span>
            <span className="text-xs font-mono text-slate-500 font-semibold">Fail-Safe ON</span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] font-mono text-slate-500">
            Deterministic intercept on policy tripwire
          </div>
        </Card>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <Input 
              placeholder="Search by session ID, task, or agent..." 
              className="pl-8 h-8 text-xs font-mono bg-slate-50/50 border-slate-200"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Status Filter */}
          <select
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
          >
            <option value="all">All Statuses</option>
            <option value="active">Filter: Active</option>
            <option value="completed">Filter: Completed</option>
            <option value="failed">Filter: Failed</option>
          </select>
        </div>

        {/* Live Poll Toggle */}
        <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
          <button
            type="button"
            onClick={() => setIsLivePolling(!isLivePolling)}
            className={cn(
              "px-2.5 py-1 rounded text-[11px] font-semibold border motion-safe:transition-colors",
              isLivePolling 
                ? "bg-blue-50 border-blue-200 text-blue-700" 
                : "bg-slate-100 border-slate-200 text-slate-500"
            )}
          >
            {isLivePolling ? "Live Poll (5s): ON" : "Live Poll: OFF"}
          </button>
        </div>
      </div>

      {/* Main Master-Detail Workload Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left 5 Cols: Active Workload Sessions List */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between pb-1">
            <h2 className="text-xs font-bold font-mono uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
              <Server className="h-4 w-4 text-blue-600" />
              All Sessions ({filteredSessions.length})
            </h2>
            <span className="text-[11px] font-mono text-slate-400">
              Deterministic Session Store
            </span>
          </div>

          <div className="space-y-2.5 max-h-[640px] overflow-y-auto pr-1">
            {isSessionsLoading ? (
              <div className="text-slate-400 text-xs font-mono text-center py-12 bg-white rounded-xl border border-slate-200">
                Loading sessions...
              </div>
            ) : filteredSessions.length === 0 ? (
              <div className="text-slate-400 text-xs font-mono text-center py-12 bg-white rounded-xl border border-slate-200">
                No sessions found matching criteria.
              </div>
            ) : (
              filteredSessions.map((s) => {
                const isSelected = s.session_id === selectedSessionId;
                // const hasBlock = (s.verdict_counts?.['BLOCK'] || 0) > 0;
                // const allow = s.verdict_counts?.['ALLOW'] || 0;
                // const alert = s.verdict_counts?.['ALERT'] || 0;
                // const block = s.verdict_counts?.['BLOCK'] || 0;

                return (
                  <SessionCard 
                    key={s.session_id} 
                    session={s} 
                    isSelected={isSelected} 
                    onClick={() => setSelectedSessionId(s.session_id)} 
                    getStatusBadge={getStatusBadge} 
                  />
                );
              })
            )}
          </div>
        </div>

        {/* Right 7 Cols: Selected Session Inspector */}
        <div className="lg:col-span-7 space-y-4">
          {!selectedSession ? (
            <div className="h-[400px] flex items-center justify-center bg-white rounded-xl border border-slate-200">
              <EmptyState 
                icon={Activity}
                title="No Session Selected"
                description="Select an agent session from the list to inspect its cumulative verdicts and chronological runtime timeline."
              />
            </div>
          ) : (
            <Card className="border-slate-200 shadow-xs bg-white rounded-xl overflow-hidden">
              {/* Session Header */}
              <div className="p-5 border-b border-slate-100 bg-slate-50/60">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                  <div>
                    <span className="text-[11px] font-bold font-mono text-slate-400 uppercase tracking-wider block">
                      SELECTED SESSION INSPECTOR
                    </span>
                    <h2 className="text-base font-bold font-mono text-slate-900 truncate mt-0.5">
                      {selectedSession.session_id}
                    </h2>
                    <p className="text-xs font-mono text-slate-500 mt-0.5">
                      Task Context: <strong className="text-slate-800">{selectedSession.task_id}</strong> | Agent: <strong className="text-slate-800">{selectedSession.agent_id}</strong>
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-1.5">
                    {getStatusBadge(selectedSession.status, (selectedSession.verdict_counts?.['BLOCK'] || 0) > 0)}
                    <span className="text-[11px] font-mono text-slate-400">
                      Started: {new Date(selectedSession.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                </div>

                {/* Cumulative Verdict Segmented Bar */}
                <div className="mt-4 pt-3 border-t border-slate-200/70">
                  <div className="flex items-center justify-between text-xs font-mono mb-1.5">
                    <span className="font-bold text-slate-700 uppercase text-[11px]">
                      Cumulative Step Verdicts
                    </span>
                    <span className="text-slate-400 text-[11px]">
                      Total {selectedSession.total_events || 0} Actions
                    </span>
                  </div>

                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden flex">
                    <div 
                      className="bg-emerald-500 h-full motion-safe:transition-all"
                      style={{ 
                        width: `${(selectedSession.total_events || 0) > 0 
                          ? ((selectedSession.verdict_counts?.['ALLOW'] || 0) / selectedSession.total_events!) * 100 
                          : 100}%` 
                      }}
                    />
                    <div 
                      className="bg-amber-500 h-full motion-safe:transition-all"
                      style={{ 
                        width: `${(selectedSession.total_events || 0) > 0 
                          ? ((selectedSession.verdict_counts?.['ALERT'] || 0) / selectedSession.total_events!) * 100 
                          : 0}%` 
                      }}
                    />
                    <div 
                      className="bg-rose-600 h-full motion-safe:transition-all"
                      style={{ 
                        width: `${(selectedSession.total_events || 0) > 0 
                          ? ((selectedSession.verdict_counts?.['BLOCK'] || 0) / selectedSession.total_events!) * 100 
                          : 0}%` 
                      }}
                    />
                  </div>

                  <div className="flex justify-between text-[11px] font-mono mt-2">
                    <span className="text-emerald-700 font-bold flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      {selectedSession.verdict_counts?.['ALLOW'] || 0} Allowed
                    </span>
                    <span className="text-amber-700 font-bold flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                      {selectedSession.verdict_counts?.['ALERT'] || 0} Alerts
                    </span>
                    <span className="text-rose-700 font-bold flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-rose-600" />
                      {selectedSession.verdict_counts?.['BLOCK'] || 0} Blocked
                    </span>
                  </div>
                </div>

                {/* KPI cards for Total Interceptions & Quick stats */}
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <div className="p-3 bg-white rounded-lg border border-slate-200/80 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-600">Total Interceptions</span>
                    <span className="font-mono font-extrabold text-slate-900 text-lg">
                      {selectedSession.total_events || 0}
                    </span>
                  </div>

                  <div className="p-3 bg-white rounded-lg border border-slate-200/80 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-600">Security Invariants</span>
                    <span className="font-mono font-bold text-emerald-600 text-sm">
                      {(selectedSession.verdict_counts?.['BLOCK'] || 0) > 0 ? 'TRIPPED' : 'PASSED'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Timeline Items */}
              <div className="p-5 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <h3 className="text-xs font-bold font-mono uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
                    <Activity className="h-4 w-4 text-blue-600" />
                    Runtime Timeline
                  </h3>
                  <Link
                    to="/decision-explorer"
                    className="text-xs font-mono font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                  >
                    <span>Inspect in Decision Explorer</span>
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>

                {isEventsLoading ? (
                  <div className="text-center py-10 font-mono text-xs text-slate-400">
                    Loading timeline events...
                  </div>
                ) : !sessionEvents || sessionEvents.length === 0 ? (
                  <div className="text-center py-10 font-mono text-xs text-slate-400">
                    No interceptions recorded for this session.
                  </div>
                ) : (
                  <div className="relative pl-6 border-l-2 border-slate-200 space-y-3 max-h-[380px] overflow-y-auto pr-1">
                    {sortedEvents.map((evt) => {
                      const isBlk = evt.decision.toUpperCase() === 'BLOCK';
                      const isAlr = evt.decision.toUpperCase() === 'ALERT';

                      return (
                        <div key={evt.interception_id} className="relative">
                          {/* Node Icon */}
                          <div className="absolute -left-[33px] top-2 bg-white rounded-full p-0.5 border border-slate-200 shadow-xs">
                            {getDecisionIcon(evt.decision)}
                          </div>

                          <div className={cn(
                            "p-3 rounded-lg border text-xs font-mono motion-safe:transition-all",
                            isBlk ? "bg-rose-50/40 border-rose-200" :
                            isAlr ? "bg-amber-50/30 border-amber-200" :
                            "bg-white border-slate-200 hover:border-slate-300"
                          )}>
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900">{evt.tool_name}</span>
                                <Badge 
                                  variant={evt.decision.toLowerCase() as any}
                                  className="text-[11px] font-mono uppercase px-1.5 py-0.5"
                                >
                                  {evt.decision}
                                </Badge>
                                <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                                  {evt.execution_state}
                                </span>
                              </div>

                              <Link 
                                to="/decision-explorer"
                                className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-0.5"
                              >
                                <span>Deep Dive</span>
                                <ArrowRight className="h-3 w-3" />
                              </Link>
                            </div>

                            <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                              <span>{new Date(evt.timestamp).toLocaleTimeString()}</span>
                              <span>Risk: {typeof evt.action_record?.risk_score === 'number' ? evt.action_record.risk_score : 'N/A'}</span>
                              {evt.action && <span>Category: {evt.action.category}</span>}
                              {evt.action_record?.auth_status && <span>Auth: {evt.action_record.auth_status}</span>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

const SessionCard = React.memo(({ session: s, isSelected, onClick, getStatusBadge }: any) => {
  const hasBlock = (s.verdict_counts?.['BLOCK'] || 0) > 0;
  const allow = s.verdict_counts?.['ALLOW'] || 0;
  const alert = s.verdict_counts?.['ALERT'] || 0;
  const block = s.verdict_counts?.['BLOCK'] || 0;

  return (
    <Card
      onClick={onClick}
      className={cn(
        "p-3.5 border motion-safe:transition-all cursor-pointer rounded-xl bg-white",
        isSelected 
          ? "border-blue-500 ring-1 ring-blue-500/20 shadow-sm" 
          : "border-slate-200/80 hover:border-slate-300 hover:shadow-xs",
        hasBlock && "border-rose-200 bg-rose-50/10"
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <div className={cn(
            "p-1.5 rounded-md",
            hasBlock ? "bg-rose-50 text-rose-700" : "bg-blue-50 text-blue-700"
          )}>
            <Terminal className="h-3.5 w-3.5" />
          </div>
          <div>
            <span className="font-mono text-xs font-bold text-slate-900 truncate block">
              {s.session_id}
            </span>
            <span className="text-[11px] font-mono text-slate-400 block">
              Agent: {s.agent_id} | Task: {s.task_id}
            </span>
          </div>
        </div>

        <div>
          {getStatusBadge(s.status, hasBlock)}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-100 font-mono text-[11px]">
        <div>
          <span className="text-slate-400 block">TOTAL:</span>
          <span className="font-bold text-slate-800">{s.total_events || 0}</span>
        </div>
        <div>
          <span className="text-slate-400 block">ALLOW:</span>
          <span className="font-bold text-emerald-600">{allow}</span>
        </div>
        <div>
          <span className="text-slate-400 block">ALERT:</span>
          <span className="font-bold text-amber-600">{alert}</span>
        </div>
        <div>
          <span className="text-slate-400 block">BLOCK:</span>
          <span className={cn("font-bold", block > 0 ? "text-rose-600" : "text-slate-400")}>
            {block}
          </span>
        </div>
      </div>

      <div className="mt-1 flex items-center justify-between text-[11px] font-mono text-slate-400 pt-1">
        <div className="flex gap-2">
          <span className="text-emerald-700 font-semibold">ALL: {allow}</span>
          <span className="text-amber-700 font-semibold">ALR: {alert}</span>
          <span className="text-rose-700 font-semibold">BLK: {block}</span>
        </div>
        <span>{new Date(s.created_at).toLocaleTimeString()}</span>
      </div>
    </Card>
  );
});
