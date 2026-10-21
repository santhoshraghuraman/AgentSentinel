import React, { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { 
  Radio, 
  RefreshCw, 
  ServerCrash, 
  Pause, 
  Play, 
  Filter, 
  Trash2, 
  Download, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Clock, 
  ShieldCheck, 
  Code,
  SlidersHorizontal,
  ChevronRight
} from 'lucide-react';
import { auditService } from '../api/services';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { JsonViewer } from '../components/viz/JsonViewer';
import { EmptyState } from '../components/ui/EmptyState';
import { cn } from '../utils/cn';
import { formatTime } from '../utils/datetime';

import { BarChart, Bar, Cell, ResponsiveContainer, Tooltip } from 'recharts';

export function LiveMonitorPage() {
  const navigate = useNavigate();
  const [isPaused, setIsPaused] = useState(false);
  const [filterHighRisk, setFilterHighRisk] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [showRawJson, setShowRawJson] = useState(false);
  const [clearedBeforeTimestamp, setClearedBeforeTimestamp] = useState<number | null>(null);

  const { data: rawEvents, isLoading, error, refetch } = useQuery({
    queryKey: ['liveEvents'],
    queryFn: () => auditService.getLiveEvents(50),
    refetchInterval: isPaused ? false : 3000,
  });

  const visibleEvents = useMemo(() => {
    if (!rawEvents) return [];
    let list = rawEvents;
    if (clearedBeforeTimestamp) {
      list = list.filter(e => new Date(e.timestamp).getTime() > clearedBeforeTimestamp);
    }
    if (filterHighRisk) {
      list = list.filter(e => e.decision === 'BLOCK' || (e.action_record?.risk_score && e.action_record.risk_score > 0.6));
    }
    return list;
  }, [rawEvents, clearedBeforeTimestamp, filterHighRisk]);

  const selectedEvent = useMemo(() => {
    if (!visibleEvents || visibleEvents.length === 0 || !selectedEventId) return null;
    return visibleEvents.find(e => e.interception_id === selectedEventId) || null;
  }, [visibleEvents, selectedEventId]);

  // Derived Real Telemetry
  const uniqueSessions = useMemo(() => {
    if (!visibleEvents) return 0;
    return new Set(visibleEvents.map(e => e.session_id)).size;
  }, [visibleEvents]);

  const blockedCount = useMemo(() => {
    if (!visibleEvents) return 0;
    return visibleEvents.filter(e => e.decision === 'BLOCK').length;
  }, [visibleEvents]);

  const miniChartData = useMemo(() => {
    if (!visibleEvents) return [];
    const sorted = [...visibleEvents].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    return sorted.map((e, idx) => ({
      id: e.interception_id,
      index: idx,
      decision: e.decision,
      tool: e.tool_name || e.action?.normalized_name,
      value: 1, // Fixed height for sequence bars
      color: e.decision === 'BLOCK' ? '#dc2626' : e.decision === 'ALERT' ? '#f59e0b' : '#2563eb'
    }));
  }, [visibleEvents]);

  const handleClearBuffer = () => {
    setClearedBeforeTimestamp(Date.now());
  };

  const handleExportJson = () => {
    if (!visibleEvents) return;
    const blob = new Blob([JSON.stringify(visibleEvents, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agent_sentinel_live_stream_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-10">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-bold font-mono tracking-wider text-slate-400 uppercase">
              SYSTEM RUNTIME STREAM /
            </span>
            <span className="text-[11px] font-bold font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 motion-safe:animate-pulse" />
              ACTIVE RUNTIME INGESTION
            </span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-slate-900">
            Live Monitor
          </h1>
          <p className="text-xs lg:text-sm text-slate-500 mt-1">
            Real-time stream of intercepted tool calls, risk evaluations, and M8 enforcement decisions.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setIsPaused(!isPaused)}
            className="h-8 text-xs font-semibold bg-white border-slate-200 text-slate-700 shadow-xs"
          >
            {isPaused ? <Play className="w-3.5 h-3.5 mr-1 text-emerald-600" /> : <Pause className="w-3.5 h-3.5 mr-1 text-amber-600" />}
            {isPaused ? 'Resume Stream' : 'Pause Stream'}
          </Button>

          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setFilterHighRisk(!filterHighRisk)}
            className={cn(
              "h-8 text-xs font-semibold border-slate-200 shadow-xs motion-safe:transition-colors",
              filterHighRisk ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-white text-slate-700"
            )}
          >
            <Filter className="w-3.5 h-3.5 mr-1" />
            High-Risk Only
          </Button>

          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleClearBuffer}
            className="h-8 text-xs font-semibold bg-white border-slate-200 text-slate-700 shadow-xs"
          >
            <Trash2 className="w-3.5 h-3.5 mr-1 text-slate-400" />
            Clear Buffer
          </Button>

          <Button 
            size="sm" 
            onClick={handleExportJson}
            disabled={!visibleEvents || visibleEvents.length === 0}
            className="h-8 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
          >
            <Download className="w-3.5 h-3.5 mr-1" />
            Export Stream
          </Button>
        </div>
      </div>

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Overhead */}
        <Card className="p-4 border-slate-200 shadow-xs bg-white flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold font-mono text-slate-500 uppercase tracking-wider">INTERCEPT OVERHEAD</span>
            <div className="h-7 w-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold font-mono text-slate-900">N/A</span>
            <span className="text-[11px] font-bold text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
              No telemetry
            </span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
            Per-stage: N/A stored
          </div>
        </Card>

        {/* Card 2: Active Agent Sessions */}
        <Card className="p-4 border-slate-200 shadow-xs bg-white flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold font-mono text-slate-500 uppercase tracking-wider">ACTIVE SESSIONS</span>
            <div className="h-7 w-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Radio className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold font-mono text-slate-900">{uniqueSessions}</span>
            <span className="text-xs text-slate-500">Sessions</span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
            IPC Hooks: N/A
          </div>
        </Card>

        {/* Card 3: Stream Buffer */}
        <Card className="p-4 border-slate-200 shadow-xs bg-white flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold font-mono text-slate-500 uppercase tracking-wider">STREAM BUFFER</span>
            <div className="h-7 w-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <SlidersHorizontal className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold font-mono text-slate-900">{visibleEvents.length}</span>
            <span className="text-xs text-slate-500">/ 50 live events</span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 h-8">
            <MiniStreamChart data={miniChartData} />
          </div>
        </Card>

        {/* Card 4: Blocked Events */}
        <Card className="p-4 border-slate-200 shadow-xs bg-white flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold font-mono text-slate-500 uppercase tracking-wider">BLOCKED INTERCEPTIONS</span>
            <div className="h-7 w-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <XCircle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold font-mono text-rose-600">{blockedCount}</span>
            <span className="text-xs font-semibold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
              M8 Enforcement
            </span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
            Execution: BLOCKED
          </div>
        </Card>
      </div>

      {/* Main Stream Table */}
      <Card className="border-slate-200 shadow-xs bg-white overflow-hidden">
        <CardHeader className="py-3 px-6 border-b border-slate-100 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-bold text-slate-900 uppercase font-mono tracking-wider">
              Runtime Intercept Pipeline
            </CardTitle>
            <Badge variant="outline" className="text-[11px] font-mono text-slate-500 bg-slate-50">
              Auto-scroll: {isPaused ? 'OFF' : 'ON'}
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
            <span className={cn("h-2 w-2 rounded-full", isPaused ? "bg-amber-400" : "bg-emerald-500 motion-safe:animate-pulse")} />
            <span>{isPaused ? 'Stream Paused' : 'Live Ingestion: Active'}</span>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading && (!visibleEvents || visibleEvents.length === 0) ? (
            <div className="py-16 flex flex-col items-center justify-center text-slate-400 font-mono text-xs gap-2">
              <RefreshCw className="h-6 w-6 motion-safe:animate-spin text-blue-600" />
              <span>Connecting to live runtime event stream...</span>
            </div>
          ) : error ? (
            <div className="py-16 flex flex-col items-center justify-center text-rose-600 font-mono text-xs gap-2">
              <ServerCrash className="h-6 w-6" />
              <span>Failed to load live events.</span>
              <Button size="sm" variant="outline" onClick={() => refetch()}>Try Again</Button>
            </div>
          ) : visibleEvents.length === 0 ? (
            <div className="py-16">
              <EmptyState 
                icon={Radio}
                title="Waiting for runtime activity"
                description="Run an agent task in Runtime Playground. Tool calls and intercepts will stream in real-time."
              />
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[380px]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
                  <tr className="text-[11px] font-bold font-mono uppercase text-slate-400 tracking-wider">
                    <th className="py-2.5 px-5">TIMESTAMP</th>
                    <th className="py-2.5 px-4">AGENT / SESSION</th>
                    <th className="py-2.5 px-4">TOOL CALL & PAYLOAD SNIPPET</th>
                    <th className="py-2.5 px-4">BEHAVIORAL RISK</th>
                    <th className="py-2.5 px-4">AUTH CONTEXT</th>
                    <th className="py-2.5 px-4">DECISION</th>
                    <th className="py-2.5 px-5 text-right">STATUS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {visibleEvents.map((evt) => (
                    <EventTableRow 
                      key={evt.interception_id} 
                      evt={evt} 
                      isSelected={selectedEvent?.interception_id === evt.interception_id} 
                      onSelect={setSelectedEventId} 
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Selected Event Deep Inspection */}
      {selectedEvent && (
        <Card className="border-slate-200 shadow-xs bg-white overflow-hidden">
          <CardHeader className="py-3 px-6 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-mono">
              <span className="h-2 w-2 rounded-full bg-blue-600" />
              <CardTitle className="text-sm font-bold text-slate-900">
                Selected Event Deep Inspection
              </CardTitle>
              <span className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded text-[11px] font-bold">
                #{selectedEvent.interception_id.slice(0, 12)}
              </span>
              <span className="text-xs text-slate-500 font-bold">
                {selectedEvent.tool_name || selectedEvent.action?.normalized_name || (selectedEvent.action as any)?.tool_name}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowRawJson(!showRawJson)}
                className="h-7 text-[11px] font-mono bg-white border-slate-200"
              >
                <Code className="w-3 h-3 mr-1 text-slate-500" />
                {showRawJson ? 'Hide Raw Payload' : 'Raw Event Payload'}
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-6 space-y-6">
            {showRawJson ? (
              <div className="bg-code-surface text-slate-800 p-4 rounded-xl text-xs font-mono overflow-auto max-h-[350px] border border-slate-200">
                <JsonViewer data={selectedEvent} />
              </div>
            ) : (
              <>
                {/* 4 Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/60 font-mono text-xs">
                    <span className="text-[11px] uppercase font-bold text-slate-400 block mb-1">AGENT IDENTITY</span>
                    <p className="font-bold text-slate-800 truncate" title={selectedEvent.session_id}>
                      {selectedEvent.session_id}
                    </p>
                    <span className="text-[11px] text-slate-400">Task: {selectedEvent.task_id}</span>
                  </div>

                  <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/60 font-mono text-xs">
                    <span className="text-[11px] uppercase font-bold text-slate-400 block mb-1">RUNTIME EXECUTION</span>
                    <p className="font-bold text-slate-800">
                      {selectedEvent.execution_state}
                    </p>
                    <span className="text-[11px] text-slate-400">Seq #{selectedEvent.sequence_number}</span>
                  </div>

                  <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/60 font-mono text-xs">
                    <span className="text-[11px] uppercase font-bold text-slate-400 block mb-1">INTERCEPT ENFORCEMENT</span>
                    <p className="font-bold text-slate-800">
                      M8 Policy Fusion
                    </p>
                    <span className="text-[11px] text-slate-400">Auth: {selectedEvent.action_record?.auth_status || 'AUTHORIZED'}</span>
                  </div>

                  <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/60 font-mono text-xs">
                    <span className="text-[11px] uppercase font-bold text-slate-400 block mb-1">ACTION DISPATCHED</span>
                    <div className="flex items-center gap-1.5">
                      {selectedEvent.decision === 'BLOCK' ? (
                        <span className="font-bold text-rose-700 flex items-center gap-1">
                          <XCircle className="h-3.5 w-3.5" /> BLOCKED
                        </span>
                      ) : selectedEvent.decision === 'ALERT' ? (
                        <span className="font-bold text-amber-700 flex items-center gap-1">
                          <AlertTriangle className="h-3.5 w-3.5" /> ALERT (MONITORED)
                        </span>
                      ) : (
                        <span className="font-bold text-emerald-700 flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5" /> ALLOWED
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400">State: {selectedEvent.execution_state}</span>
                  </div>
                </div>

                {/* Invocation Signature Banner */}
                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 font-mono text-xs text-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-2">
                  <div className="overflow-x-auto">
                    <span className="text-slate-400 select-none mr-2">INTERCEPTED:</span>
                    <span className="font-bold text-blue-700">{selectedEvent.tool_name || selectedEvent.action?.normalized_name || (selectedEvent.action as any)?.tool_name}</span>
                    <span className="text-slate-600">({JSON.stringify(selectedEvent.arguments || {})})</span>
                    <span className="mx-2 text-slate-400">→</span>
                    <span className={cn(
                      "font-bold px-2 py-0.5 rounded text-[11px]",
                      selectedEvent.decision === 'BLOCK' ? "bg-rose-100 text-rose-800" :
                      selectedEvent.decision === 'ALERT' ? "bg-amber-100 text-amber-800" :
                      "bg-emerald-100 text-emerald-800"
                    )}>
                      VERDICT: {selectedEvent.decision}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 shrink-0">M8 Intercept Hook</span>
                </div>

                {/* Bottom Row: Behavioral Feature Vectors & Runtime State Guard */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Behavioral Vectors (Real 22 Features or extracted features) */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase font-mono tracking-wider text-slate-500">
                      Behavioral Feature Breakdown (M5 Model)
                    </h3>
                    <div className="space-y-2.5 p-4 rounded-xl border border-slate-100 bg-slate-50/50">
                      {selectedEvent.action_record?.features && Object.keys(selectedEvent.action_record.features).length > 0 ? (
                        Object.entries(selectedEvent.action_record.features).slice(0, 4).map(([feat, val]) => {
                          const numVal = typeof val === 'number' ? val : 0;
                          return (
                            <div key={feat} className="space-y-1">
                              <div className="flex justify-between text-xs font-mono">
                                <span className="text-slate-600">{feat}</span>
                                <span className="font-bold text-slate-800">{typeof val === 'number' ? val.toFixed(3) : String(val)}</span>
                              </div>
                              <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                                <div 
                                  className={cn(
                                    "h-1.5 rounded-full motion-safe:transition-all",
                                    numVal > 0.7 ? "bg-rose-600" : numVal > 0.4 ? "bg-amber-500" : "bg-blue-600"
                                  )}
                                  style={{ width: `${Math.min(100, Math.max(5, numVal * 100))}%` }}
                                />
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="space-y-2 font-mono text-xs">
                          <div className="flex justify-between">
                            <span className="text-slate-500">ML Risk Probability:</span>
                            <span className="font-bold text-slate-800">
                              {typeof selectedEvent.action_record?.ml_probability === 'number' 
                                ? selectedEvent.action_record.ml_probability.toFixed(4) 
                                : 'N/A'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Risk Score:</span>
                            <span className="font-bold text-slate-800">
                              {selectedEvent.action_record?.risk_score !== undefined 
                                ? selectedEvent.action_record.risk_score 
                                : 'N/A'}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Runtime State Protected / Action Links */}
                  <div className="flex flex-col justify-between p-4 rounded-xl border border-slate-100 bg-slate-50/50 space-y-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <ShieldCheck className="h-5 w-5 text-emerald-600" />
                        <h3 className="text-sm font-bold text-slate-900">Runtime Invariant Enforcement</h3>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {selectedEvent.decision === 'BLOCK'
                          ? 'M8 Runtime Interceptor prevented execution of this tool call. Sandbox state remains clean and untouched.'
                          : selectedEvent.decision === 'ALERT'
                          ? 'Action authorized with heightened security logging. Behavioral telemetry actively tracked.'
                          : 'Action authorized within Task Scope. Interceptor validated capability invariants.'}
                      </p>

                      {selectedEvent.action_record?.reasons && selectedEvent.action_record.reasons.length > 0 && (
                        <div className="mt-3 space-y-1">
                          {selectedEvent.action_record.reasons.map((r, i) => (
                            <div key={i} className="text-[11px] font-mono bg-white p-2 rounded border border-slate-200 text-slate-700">
                              <span className="font-bold text-blue-600 mr-1">[{r.rule_type}]</span>
                              {r.description}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => navigate('/playground')}
                        className="text-xs font-semibold bg-white border-slate-200"
                      >
                        Replay in Playground
                      </Button>
                      <Button 
                        size="sm" 
                        onClick={() => navigate('/decision-explorer')}
                        className="text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        Deep Decision Lineage
                        <ChevronRight className="h-3.5 w-3.5 ml-1" />
                      </Button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

const MiniStreamChartTooltip = React.memo(({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white text-slate-800 text-[10px] py-1 px-2 rounded border border-slate-200 shadow-sm">
        <span className="font-bold">{data.decision}</span>: {data.tool}
      </div>
    );
  }
  return null;
});

const MiniStreamChart = React.memo(({ data }: { data: any[] }) => {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }} barCategoryGap={1}>
        <Tooltip cursor={{ fill: 'transparent' }} content={<MiniStreamChartTooltip />} />
        <Bar dataKey="value" isAnimationActive={false}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}, (prevProps, nextProps) => {
  if (prevProps.data.length !== nextProps.data.length) return false;
  if (prevProps.data.length === 0) return true;
  
  const prevFirst = prevProps.data[0];
  const nextFirst = nextProps.data[0];
  const prevLast = prevProps.data[prevProps.data.length - 1];
  const nextLast = nextProps.data[nextProps.data.length - 1];
  
  return prevFirst.id === nextFirst.id && prevLast.id === nextLast.id;
});

const EventTableRow = React.memo(({ evt, isSelected, onSelect }: { evt: any, isSelected: boolean, onSelect: (id: string) => void }) => {
  const isBlock = evt.decision === 'BLOCK';
  const isAlert = evt.decision === 'ALERT';
  const toolName = evt.tool_name || evt.action?.normalized_name || (evt.action as any)?.tool_name || 'unknown';
  const risk = evt.action_record?.risk_score;

  const handleClick = useCallback(() => {
    onSelect(evt.interception_id);
  }, [onSelect, evt.interception_id]);

  return (
    <tr 
      onClick={handleClick}
      className={cn(
        "cursor-pointer motion-safe:transition-colors text-[11px]",
        isSelected ? "bg-blue-50/70 ring-1 ring-blue-500/30 font-medium" : "hover:bg-slate-50/80",
        isBlock && !isSelected && "bg-rose-50/40"
      )}
    >
      <td className="py-2.5 px-5 text-slate-500 whitespace-nowrap">
        {formatTime(evt.timestamp)}
      </td>
      <td className="py-2.5 px-4 whitespace-nowrap">
        <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[11px] font-semibold">
          {evt.session_id.replace(/^session-/, '').slice(0, 16)}
        </span>
      </td>
      <td className="py-2.5 px-4">
        <span className={cn(
          "font-bold mr-1.5",
          isBlock ? "text-rose-700" : isAlert ? "text-amber-700" : "text-blue-600"
        )}>
          {toolName}
        </span>
        <span className="text-slate-400 text-[11px] truncate max-w-[200px] inline-block align-bottom">
          ({evt.arguments ? JSON.stringify(evt.arguments).slice(0, 35) + '...' : ''})
        </span>
      </td>
      <td className="py-2.5 px-4 whitespace-nowrap">
        {risk !== undefined ? (
          <div className="flex items-center gap-1.5">
            <span className={cn(
              "h-1.5 w-1.5 rounded-full",
              risk > 0.7 ? "bg-rose-600" : risk > 0.4 ? "bg-amber-500" : "bg-emerald-500"
            )} />
            <span className={cn(
              "font-bold text-[11px]",
              risk > 0.7 ? "text-rose-700" : risk > 0.4 ? "text-amber-700" : "text-emerald-700"
            )}>
              {risk > 0.7 ? 'CRITICAL' : risk > 0.4 ? 'MED' : 'LOW'}
            </span>
            <span className="text-slate-500 text-[11px]">
              Risk: {risk}
            </span>
          </div>
        ) : (
          <span className="text-slate-400 text-[11px]">N/A</span>
        )}
      </td>
      <td className="py-2.5 px-4 text-slate-600 text-[11px] whitespace-nowrap">
        {evt.action_record?.auth_status || evt.task_id || 'ALLOWED_SCOPE'}
      </td>
      <td className="py-2.5 px-4 whitespace-nowrap">
        <Badge 
          variant={evt.decision.toLowerCase() as any}
          className={cn(
            "font-bold font-mono text-[11px] px-2 py-0.5",
            isBlock ? "bg-rose-100 text-rose-800 border-rose-200" :
            isAlert ? "bg-amber-100 text-amber-800 border-amber-200" :
            "bg-emerald-100 text-emerald-800 border-emerald-200"
          )}
        >
          {evt.decision}
        </Badge>
      </td>
      <td className="py-2.5 px-5 text-right text-slate-400 text-[11px] whitespace-nowrap">
        N/A
      </td>
    </tr>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.evt.interception_id === nextProps.evt.interception_id &&
    prevProps.isSelected === nextProps.isSelected
  );
});
