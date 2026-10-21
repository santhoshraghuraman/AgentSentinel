import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { auditService, sessionService, taskService, systemService } from '../api/services';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { SecurityTrajectoryMap } from '../components/viz/SecurityTrajectoryMap';
import { 
  Search, 
  Shield, 
  Terminal, 
  AlertTriangle, 
  ArrowRight, 
  Download, 
  Copy, 
  Check, 
  Layers,
  Activity,
  Network,
  List,
  FileText
} from 'lucide-react';
import { cn } from '../utils/cn';
import { formatTime } from '../utils/datetime';

export function TrajectoriesPage() {
  const [sessionSearch, setSessionSearch] = useState('');
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [decisionFilter, setDecisionFilter] = useState<'ALL' | 'ALLOW' | 'ALERT' | 'BLOCK'>('ALL');
  const [hasCopied, setHasCopied] = useState(false);
  /** Phase 4C: view mode toggle — 'map' shows SecurityTrajectoryMap, 'trace' shows legacy timeline */
  const [viewMode, setViewMode] = useState<'map' | 'trace'>('map');

  // Fetch available sessions for quick selector
  const { data: availableSessions } = useQuery({
    queryKey: ['sessionsList'],
    queryFn: sessionService.listSessions,
    refetchInterval: 10000,
  });

  // Fetch all tasks to lookup task descriptions
  const { data: allTasks } = useQuery({
    queryKey: ['tasksAll'],
    queryFn: taskService.listTasks,
  });

  // Fetch diagnostics for active LLM info
  const { data: diagnostics } = useQuery({
    queryKey: ['systemDiagnostics'],
    queryFn: systemService.getDiagnostics,
  });

  // Auto-select first session if none selected and sessions exist
  useEffect(() => {
    if (!activeSession && availableSessions && availableSessions.length > 0) {
      setActiveSession(availableSessions[0].session_id);
    }
  }, [availableSessions, activeSession]);

  // Fetch audit events for the active session
  const { data: rawEvents, isFetching, isError } = useQuery({
    queryKey: ['audit', activeSession],
    queryFn: () => auditService.getBySession(activeSession!),
    enabled: !!activeSession,
    retry: false
  });

  // Sort events deterministically by sequence_number
  const events = useMemo(() => {
    if (!rawEvents) return [];
    return [...rawEvents].sort((a, b) => (a.sequence_number ?? 0) - (b.sequence_number ?? 0));
  }, [rawEvents]);

  // Filtered events based on decision tab
  const filteredEvents = useMemo(() => {
    if (decisionFilter === 'ALL') return events;
    return events.filter(e => e.decision.toUpperCase() === decisionFilter);
  }, [events, decisionFilter]);

  // Active selected session object
  const activeSessionMeta = useMemo(() => {
    return availableSessions?.find(s => s.session_id === activeSession) || null;
  }, [availableSessions, activeSession]);

  // Look up task description
  const activeTaskMeta = useMemo(() => {
    if (!activeSessionMeta) return null;
    return allTasks?.find(t => t.task_id === activeSessionMeta.task_id) || null;
  }, [activeSessionMeta, allTasks]);

  // Auto-select first event in session if not set
  useEffect(() => {
    if (events.length > 0) {
      if (!selectedEventId || !events.some(e => e.interception_id === selectedEventId)) {
        setSelectedEventId(events[0].interception_id);
      }
    } else {
      setSelectedEventId(null);
    }
  }, [events, selectedEventId]);

  // Selected event for Deep Inspection Drawer
  const selectedEvent = useMemo(() => {
    return events.find(e => e.interception_id === selectedEventId) || null;
  }, [events, selectedEventId]);

  // Counts
  const allowCount = useMemo(() => events.filter(e => e.decision.toUpperCase() === 'ALLOW').length, [events]);
  const alertCount = useMemo(() => events.filter(e => e.decision.toUpperCase() === 'ALERT').length, [events]);
  const blockCount = useMemo(() => events.filter(e => e.decision.toUpperCase() === 'BLOCK').length, [events]);
  const securityQuorumPct = useMemo(() => {
    if (events.length === 0) return '100.0';
    return ((allowCount / events.length) * 100).toFixed(1);
  }, [events, allowCount]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (sessionSearch.trim()) {
      setActiveSession(sessionSearch.trim());
    }
  };

  const handleCopyPayload = () => {
    if (!selectedEvent) return;
    const payload = JSON.stringify({
      interception_id: selectedEvent.interception_id,
      sequence_number: selectedEvent.sequence_number,
      tool_name: selectedEvent.tool_name,
      arguments: selectedEvent.arguments,
      decision: selectedEvent.decision,
      execution_state: selectedEvent.execution_state,
      action_record: selectedEvent.action_record,
    }, null, 2);
    navigator.clipboard.writeText(payload);
    setHasCopied(true);
    setTimeout(() => setHasCopied(false), 2000);
  };

  const handleExportTraceJson = () => {
    if (!events || events.length === 0) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(events, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `trajectory_${activeSession || 'trace'}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="flex flex-col gap-5 h-full pb-10">
      {/* Top Breadcrumb & Status Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
          <span className="text-slate-400 uppercase tracking-wider font-semibold">AUDIT & TRACEABILITY</span>
          <span className="text-slate-300">//</span>
          <h1 className="text-sm font-bold text-slate-900 uppercase tracking-tight">Trajectories // Session Trajectory Inspector</h1>
          {activeSession && (
            <>
              <span className="text-slate-300">//</span>
              <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200 font-bold">
                {activeSession}
              </span>
            </>
          )}
        </div>

        {activeSession && (
          <div className="flex items-center gap-2 font-mono text-xs">
            {blockCount > 0 ? (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-rose-50 text-rose-700 border border-rose-200 font-bold">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-600 motion-safe:animate-pulse" />
                BLOCK DETECTED ({blockCount})
              </span>
            ) : alertCount > 0 ? (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-50 text-amber-700 border border-amber-200 font-bold">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                ALERT FLAGGED ({alertCount})
              </span>
            ) : (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                NOMINAL / AUTHORIZED
              </span>
            )}
            <span className="text-slate-400 hidden md:inline">|</span>
            <span className="text-slate-500 text-[11px] hidden md:inline">
              Events: <strong className="text-slate-800">{events.length}</strong>
            </span>
            <span className="text-slate-400 hidden md:inline">|</span>
            <span className="text-slate-500 text-[11px] hidden md:inline">
              Enforcement: <strong className="text-slate-800">M8 Active</strong>
            </span>
          </div>
        )}
      </div>

      {/* Main Session Context Card & Security Quorum */}
      {activeSession && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left 2 Cols: Session Identity & Scope */}
          <Card className="p-5 border-slate-200 shadow-xs bg-white lg:col-span-2 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-blue-50 border border-blue-100 text-blue-700">
                    <Terminal className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold font-mono text-slate-900 flex items-center gap-2">
                      <span>{activeSession}</span>
                      <span className="text-xs font-normal text-slate-400 font-sans">
                        ({activeSessionMeta?.agent_id || 'Runtime Agent'})
                      </span>
                    </h2>
                    <p className="text-[11px] font-mono text-slate-400">
                      Task Bound: {activeSessionMeta?.task_id || 'Direct Session'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <Badge 
                    variant={activeSessionMeta?.status === 'active' ? 'outline' : 'secondary'}
                    className="font-mono text-[11px] uppercase tracking-wider"
                  >
                    {activeSessionMeta?.status || 'MONITORED'}
                  </Badge>
                </div>
              </div>

              {/* Task Objective Quote */}
              <div className="mt-3.5 p-3 rounded-lg bg-slate-50 border border-slate-200/70 text-xs text-slate-700 italic">
                "{activeTaskMeta?.task_description || `Deterministic session executing under task context ${activeSessionMeta?.task_id || activeSession}.`}"
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-slate-500">
              <div className="flex flex-wrap items-center gap-3">
                <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-700">
                  Model: {diagnostics?.llm?.model || 'Local Model (M10)'}
                </span>
                <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-700">
                  Persona: {activeSessionMeta?.task_id || 'Standard Security'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-blue-700 font-semibold">
                <Shield className="h-3.5 w-3.5" />
                <span>M8 Invariant Enforcement Active</span>
              </div>
            </div>
          </Card>

          {/* Right Col: Security Quorum & Verdict Metrics */}
          <Card className="p-5 border-slate-200 shadow-xs bg-white flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-[11px] font-bold font-mono text-slate-500 uppercase tracking-wider">
                  SECURITY QUORUM
                </span>
                <span className={cn(
                  "text-[11px] font-bold font-mono px-1.5 py-0.5 rounded uppercase",
                  blockCount > 0 ? "bg-rose-50 text-rose-700 border border-rose-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                )}>
                  {blockCount > 0 ? "FAULT DETECTED" : "HEALTHY"}
                </span>
              </div>

              <div className="mt-3 flex items-baseline justify-between">
                <span className="text-3xl font-extrabold font-mono text-slate-900 tracking-tight">
                  {securityQuorumPct}%
                </span>
                <span className="text-[11px] font-mono text-slate-500">
                  Pass Ratio
                </span>
              </div>

              {/* Segmented verdict progress bar */}
              <div className="mt-3 w-full bg-slate-100 rounded-full h-2 overflow-hidden flex">
                <div 
                  className="bg-emerald-500 h-full motion-safe:transition-all"
                  style={{ width: `${events.length > 0 ? (allowCount / events.length) * 100 : 100}%` }}
                />
                <div 
                  className="bg-amber-500 h-full motion-safe:transition-all"
                  style={{ width: `${events.length > 0 ? (alertCount / events.length) * 100 : 0}%` }}
                />
                <div 
                  className="bg-rose-600 h-full motion-safe:transition-all"
                  style={{ width: `${events.length > 0 ? (blockCount / events.length) * 100 : 0}%` }}
                />
              </div>

              <div className="mt-2 flex justify-between text-[11px] font-mono text-slate-500">
                <span className="text-emerald-700 font-semibold">{allowCount} Allowed</span>
                <span className="text-amber-700 font-semibold">{alertCount} Alerts</span>
                <span className="text-rose-700 font-semibold">{blockCount} Blocked</span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] font-mono text-slate-500 grid grid-cols-2 gap-2">
              <div>
                <span className="text-[11px] text-slate-400 block">Active Policy:</span>
                <span className="font-bold text-slate-800 truncate block">
                  {selectedEvent?.action_record?.matched_policy_id || 'Default Policy'}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block">System Logs:</span>
                <span className="font-bold text-slate-800 truncate block">
                  Unavailable
                </span>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Session Selection & Search Control Bar */}
      <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center flex-1">
          {/* Quick Session Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-slate-500 uppercase whitespace-nowrap">
              Session:
            </span>
            <select
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 max-w-[220px]"
              value={activeSession || ''}
              onChange={(e) => {
                setActiveSession(e.target.value);
                setSessionSearch('');
              }}
            >
              <option value="">-- Select Session --</option>
              {availableSessions?.map(s => (
                <option key={s.session_id} value={s.session_id}>
                  {s.session_id.slice(0, 20)} ({s.status})
                </option>
              ))}
            </select>
          </div>

          {/* Search Form (Ensures Playwright e2e.spec.ts works seamlessly) */}
          <form onSubmit={handleSearch} className="flex gap-2 flex-1">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <Input 
                placeholder="Enter Session ID..." 
                className="pl-8 h-8 text-xs font-mono bg-slate-50/50 border-slate-200"
                value={sessionSearch}
                onChange={e => setSessionSearch(e.target.value)}
              />
            </div>
            <Button 
              type="submit" 
              size="sm" 
              className="h-8 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs whitespace-nowrap"
              disabled={isFetching}
            >
              {isFetching ? 'Analyzing...' : 'Analyze Session'}
            </Button>
          </form>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1 border-t lg:border-t-0 pt-2 lg:pt-0 border-slate-100">
          <Button
            variant={decisionFilter === 'ALL' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setDecisionFilter('ALL')}
            className={cn("h-7 text-[11px] font-mono px-2.5", decisionFilter === 'ALL' ? "bg-slate-800 text-white" : "text-slate-600")}
          >
            All ({events.length})
          </Button>
          <Button
            variant={decisionFilter === 'ALLOW' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setDecisionFilter('ALLOW')}
            className={cn("h-7 text-[11px] font-mono px-2.5", decisionFilter === 'ALLOW' ? "bg-emerald-600 text-white" : "text-emerald-700")}
          >
            Allow ({allowCount})
          </Button>
          <Button
            variant={decisionFilter === 'ALERT' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setDecisionFilter('ALERT')}
            className={cn("h-7 text-[11px] font-mono px-2.5", decisionFilter === 'ALERT' ? "bg-amber-500 text-white" : "text-amber-700")}
          >
            Alert ({alertCount})
          </Button>
          <Button
            variant={decisionFilter === 'BLOCK' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setDecisionFilter('BLOCK')}
            className={cn("h-7 text-[11px] font-mono px-2.5", decisionFilter === 'BLOCK' ? "bg-rose-600 text-white" : "text-rose-700")}
          >
            Block ({blockCount})
          </Button>

          {/* Phase 4C: view mode toggle — Map vs Trace */}
          <div className="flex items-center gap-0.5 ml-2 border-l border-slate-200 pl-2">
            <Button
              variant={viewMode === 'map' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('map')}
              className={cn(
                "h-7 text-[11px] font-mono px-2 gap-1",
                viewMode === 'map' ? "bg-blue-700 text-white" : "text-slate-500"
              )}
              aria-label="Switch to Security Trajectory Map view"
              aria-pressed={viewMode === 'map'}
            >
              <Network className="h-3 w-3" />
              Map
            </Button>
            <Button
              variant={viewMode === 'trace' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('trace')}
              className={cn(
                "h-7 text-[11px] font-mono px-2 gap-1",
                viewMode === 'trace' ? "bg-slate-800 text-white" : "text-slate-500"
              )}
              aria-label="Switch to Trace view"
              aria-pressed={viewMode === 'trace'}
            >
              <List className="h-3 w-3" />
              Trace
            </Button>
          </div>
        </div>
      </div>

      {/* Main Execution Timeline & Deep Inspector */}
      {!activeSession ? (
        <div className="h-80 flex items-center justify-center">
          <EmptyState 
            icon={Search}
            title="Enter a Session ID"
            description="Select a session from the dropdown above or enter an ID to view its complete chronological runtime trajectory."
          />
        </div>
      ) : isError ? (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 text-xs font-mono">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <p className="font-semibold">Failed to retrieve session data for "{activeSession}". The session may not exist or the API is offline.</p>
        </div>
      ) : events.length === 0 ? (
        <div className="h-80 flex items-center justify-center">
          <EmptyState 
            icon={Activity}
            title="No Audit Records"
            description={`No runtime interceptions were recorded for session: ${activeSession}`}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left 7 Cols: Trajectory view — Map or Trace depending on viewMode */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between pb-1">
              <h3 className="text-xs font-bold font-mono uppercase text-slate-500 tracking-wider flex items-center gap-2">
                {viewMode === 'map'
                  ? <><Network className="h-4 w-4 text-blue-600" />Security Trajectory Map</>
                  : <><Layers className="h-4 w-4 text-blue-600" />Trajectory Execution Trace</>
                }
              </h3>
              <span className="text-[11px] font-mono text-slate-400">
                {filteredEvents.length} Discrete Operations
              </span>
            </div>

            {viewMode === 'map' ? (
              /* Phase 4C: Security Trajectory Map view */
              <Card className="p-4 border-slate-200 shadow-xs bg-white overflow-y-auto max-h-[72vh]">
                <SecurityTrajectoryMap
                  events={filteredEvents}
                  selectedEventId={selectedEventId}
                  onSelectEvent={setSelectedEventId}
                />
              </Card>
            ) : (
              /* Trace view: existing timeline list */
              <>
                <div className="relative pl-6 border-l-2 border-slate-200 space-y-4">
                  {filteredEvents.map((evt) => (
                    <TimelineEventCard 
                      key={evt.interception_id}
                      evt={evt}
                      isSelected={evt.interception_id === selectedEventId}
                      onSelect={setSelectedEventId}
                    />
                  ))}
                </div>

                {/* Behavioral Risk Profile Sparkline */}
                <Card className="p-4 border-slate-200 shadow-xs bg-white mt-6">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <span className="text-xs font-mono font-bold uppercase text-slate-500 tracking-wider">
                      Behavioral Drift Profile Across Trajectory
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">
                      Risk Metric per Sequential Step
                    </span>
                  </div>
                  <div className="flex items-end gap-2 h-16 pt-3 px-2">
                    {events.map((evt) => (
                      <SparklineNode 
                        key={evt.interception_id}
                        evt={evt}
                        isSelected={evt.interception_id === selectedEventId}
                        onSelect={setSelectedEventId}
                      />
                    ))}
                  </div>
                </Card>
              </>
            )}
          </div>

          {/* Right 5 Cols: Deep Inspection Drawer */}
          <div className="lg:col-span-5 space-y-4 sticky top-6">
            <Card className="border-slate-200 shadow-sm bg-white overflow-hidden">
              {/* Drawer Header */}
              <div className="p-4 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold font-mono text-slate-400 uppercase tracking-wider block">
                    DEEP INSPECTION DRAWER
                  </span>
                  <h4 className="text-xs font-bold font-mono text-slate-900 truncate mt-0.5">
                    Step {selectedEvent?.sequence_number ?? 0}: {selectedEvent?.tool_name || 'No Selection'}
                  </h4>
                </div>
                {selectedEvent && (
                  <Badge 
                    variant={selectedEvent.decision.toLowerCase() as any}
                    className="text-[11px] font-mono uppercase"
                  >
                    {selectedEvent.decision}
                  </Badge>
                )}
              </div>

              {selectedEvent ? (
                <div className="p-4 space-y-4">
                  {/* Abstract Syntax Tree / Payload */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5 text-xs font-mono">
                      <span className="text-slate-500 font-semibold uppercase text-[11px]">
                        INVOCATION PAYLOAD & ARGUMENTS
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCopyPayload}
                        className="h-6 px-2 text-[11px] font-mono text-slate-500 hover:text-slate-900"
                      >
                        {hasCopied ? <Check className="h-3 w-3 mr-1 text-emerald-600" /> : <Copy className="h-3 w-3 mr-1" />}
                        {hasCopied ? 'Copied' : 'Copy'}
                      </Button>
                    </div>
                    <pre className="p-3 bg-code-surface text-slate-800 rounded-lg text-[11px] font-mono overflow-x-auto max-h-48 border border-slate-200">
                      {JSON.stringify({
                        tool: selectedEvent.tool_name,
                        arguments: selectedEvent.arguments || {},
                        execution_result: selectedEvent.execution_result || null,
                        category: selectedEvent.action?.category || 'system'
                      }, null, 2)}
                    </pre>
                  </div>

                    {/* Behavioral Feature Breakdown (M4) */}
                    <div>
                      <span className="text-slate-500 font-semibold uppercase text-[11px] font-mono block mb-2">
                        BEHAVIORAL FEATURE VECTOR BREAKDOWN
                      </span>
                      {selectedEvent.action_record?.features && Object.keys(selectedEvent.action_record.features).length > 0 ? (
                        <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                          {Object.entries(selectedEvent.action_record.features).slice(0, 6).map(([name, val]) => {
                            const isTime = name.includes('time') || name.includes('latency');
                            const isCount = (name.includes('count') || name.includes('repeated') || name.includes('transitions')) && typeof val === 'number';
                            const isProb = typeof val === 'number' && (name.includes('prob') || name.includes('ratio') || (val >= 0 && val <= 1 && (name.includes('score') || name.includes('risk'))));
                            const num = typeof val === 'number' ? val : 0;
                            const displayVal = typeof val === 'number'
                              ? isTime
                                ? (val < 1 ? `${(val * 1000).toFixed(0)} ms` : `${val.toFixed(2)} s`)
                                : isProb
                                  ? val.toFixed(4)
                                  : Number.isInteger(val) ? `${val}` : val.toFixed(3)
                              : typeof val === 'object' && val !== null
                                ? Object.entries(val).map(([k, v]) => `${k}: ${v}`).join(', ') || '{}'
                                : String(val ?? 'Unavailable');
                            const unitLabel = isCount ? 'count' : undefined;

                            return (
                              <div key={name} className="space-y-1 text-[11px] font-mono">
                                <div className="flex justify-between items-center">
                                  <span className="text-slate-600 truncate max-w-[180px]" title={name}>{name}</span>
                                  <div className="flex items-center gap-1 font-bold text-slate-800">
                                    <span>{displayVal}</span>
                                    {unitLabel && <span className="text-[10px] text-slate-400 font-normal">({unitLabel})</span>}
                                  </div>
                                </div>
                                {isProb && (
                                  <div className="w-full bg-slate-100 rounded-full h-1 overflow-hidden">
                                    <div 
                                      className={cn("h-1 rounded-full", num > 0.7 ? "bg-rose-600" : num > 0.4 ? "bg-amber-500" : "bg-blue-600")}
                                      style={{ width: `${Math.min(100, Math.max(0, num * 100))}%` }}
                                    />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                      <div className="p-2.5 rounded bg-slate-50 border border-slate-100 font-mono text-[11px] text-slate-500 flex justify-between">
                        <span>ML Risk Probability:</span>
                        <span className="font-bold text-slate-800">
                          {typeof selectedEvent.action_record?.ml_probability === 'number' 
                            ? selectedEvent.action_record.ml_probability.toFixed(4) 
                            : 'N/A'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Runtime Receipt */}
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/70 font-mono text-[11px] space-y-1.5">
                    <div className="flex justify-between text-slate-500">
                      <span>Interception ID:</span>
                      <span className="text-slate-800 font-bold">{selectedEvent.interception_id.slice(0, 12)}...</span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>Execution State:</span>
                      <span className="text-slate-800 font-semibold">{selectedEvent.execution_state}</span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>Auth Context:</span>
                      <span className="text-slate-800 font-semibold">{selectedEvent.action_record?.auth_status || 'AUTHORIZED'}</span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <Link
                      to={`/decision-explorer?session=${encodeURIComponent(selectedEvent.session_id)}&interception=${encodeURIComponent(selectedEvent.interception_id)}&stage=M1_M2`}
                      className="w-full inline-flex items-center justify-center h-8 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs gap-1.5 motion-safe:transition-colors"
                    >
                      <span>Deep Dive in Decision Explorer</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>

                    <Link
                      to={`/audit?session=${encodeURIComponent(selectedEvent.session_id)}&interception=${encodeURIComponent(selectedEvent.interception_id)}`}
                      className="w-full inline-flex items-center justify-center h-8 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 shadow-xs gap-1.5 motion-safe:transition-colors"
                    >
                      <FileText className="h-3.5 w-3.5 text-slate-500" />
                      <span>View in Audit Ledger</span>
                    </Link>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleExportTraceJson}
                      className="w-full h-8 text-xs font-semibold bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-xs gap-1.5"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Export Trace JSON
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-slate-400 font-mono text-xs">
                  Select a step from the execution trace to inspect runtime payload.
                </div>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

const TimelineEventCard = React.memo(({ evt, isSelected, onSelect }: { evt: any, isSelected: boolean, onSelect: (id: string) => void }) => {
  const isBlock = evt.decision.toUpperCase() === 'BLOCK';
  const isAlert = evt.decision.toUpperCase() === 'ALERT';

  const handleClick = useCallback(() => {
    onSelect(evt.interception_id);
  }, [onSelect, evt.interception_id]);

  return (
    <div className="relative group">
      {/* Node Dot */}
      <div 
        className={cn(
          "absolute -left-[31px] top-3.5 h-3.5 w-3.5 rounded-full border-2 border-white shadow-xs transition-transform",
          isBlock ? "bg-rose-600" : isAlert ? "bg-amber-500" : "bg-emerald-500",
          isSelected ? "scale-125 ring-2 ring-blue-400" : "group-hover:scale-110"
        )}
      />

      {/* Step Card */}
      <Card
        onClick={handleClick}
        className={cn(
          "p-3.5 border motion-safe:transition-all cursor-pointer rounded-xl bg-white",
          isSelected 
            ? "border-blue-400 ring-1 ring-blue-500/20 shadow-sm" 
            : "border-slate-200/80 hover:border-slate-300 hover:shadow-xs",
          isBlock && "border-rose-200/90 bg-rose-50/20"
        )}
      >
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="text-slate-400 font-bold">
              STEP {String(evt.sequence_number).padStart(2, '0')}
            </span>
            <span className="text-[11px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
              {formatTime(evt.timestamp)}
            </span>
            <span className="font-bold text-slate-900 truncate">
              {evt.tool_name || evt.action?.normalized_name || 'unknown_tool'}
            </span>
          </div>

          <Badge 
            variant={evt.decision.toLowerCase() as any}
            className={cn(
              "font-mono text-[11px] py-0.5 px-2 uppercase font-bold",
              isBlock ? "bg-rose-100 text-rose-800 border-rose-200" :
              isAlert ? "bg-amber-100 text-amber-800 border-amber-200" :
              "bg-emerald-100 text-emerald-800 border-emerald-200"
            )}
          >
            {evt.decision}
          </Badge>
        </div>

        {/* Sub-row telemetry */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100 font-mono text-[11px] text-slate-500">
          <div>
            <span className="text-slate-400 block">Latency:</span>
            <span className="font-semibold text-slate-700">Unavailable</span>
          </div>
          <div>
            <span className="text-slate-400 block">Risk Score:</span>
            <span className={cn(
              "font-semibold",
              evt.action_record?.risk_score && evt.action_record.risk_score > 0.6 ? "text-rose-600 font-bold" : "text-slate-700"
            )}>
              {typeof evt.action_record?.risk_score === 'number' ? evt.action_record.risk_score : 'N/A'}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block">Auth Context:</span>
            <span className="font-semibold text-slate-700 truncate block">
              {evt.action_record?.auth_status || 'AUTHORIZED'}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block">Execution:</span>
            <span className="font-semibold text-slate-700 truncate block">
              {evt.execution_state || 'EXECUTED'}
            </span>
          </div>
        </div>

        {/* Invariant violation message if BLOCK or ALERT */}
        {(isBlock || isAlert) && (
          <div className="mt-2.5 p-2 rounded bg-rose-50/80 border border-rose-200/80 text-[11px] font-mono text-rose-800 flex items-start gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-rose-600 shrink-0 mt-0.5" />
            <span>
              {evt.action_record?.reasons?.[0]?.description || 
               evt.error_message || 
               "Runtime policy invariant triggered M8 Enforcement."}
            </span>
          </div>
        )}
      </Card>
    </div>
  );
});

const SparklineNode = React.memo(({ evt, isSelected, onSelect }: { evt: any, isSelected: boolean, onSelect: (id: string) => void }) => {
  const score = typeof evt.action_record?.risk_score === 'number' 
    ? evt.action_record.risk_score 
    : evt.decision === 'BLOCK' ? 0.9 : evt.decision === 'ALERT' ? 0.5 : 0.1;
  const isBlk = evt.decision === 'BLOCK';

  const handleClick = useCallback(() => {
    onSelect(evt.interception_id);
  }, [onSelect, evt.interception_id]);

  return (
    <div 
      onClick={handleClick}
      className="flex-1 flex flex-col items-center gap-1 cursor-pointer group"
    >
      <div className="w-full bg-slate-100 rounded-t h-12 flex items-end overflow-hidden">
        <div 
          className={cn(
            "w-full motion-safe:transition-all",
            isBlk ? "bg-rose-600" : score > 0.4 ? "bg-amber-500" : "bg-blue-600",
            isSelected ? "ring-2 ring-blue-500" : "group-hover:opacity-80"
          )}
          style={{ height: `${Math.max(15, Math.min(100, score * 100))}%` }}
        />
      </div>
      <span className={cn("text-[9px] font-mono", isSelected ? "font-bold text-blue-600" : "text-slate-400")}>
        {String(evt.sequence_number).padStart(2, '0')}
      </span>
    </div>
  );
});
