import { useState, useMemo, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { auditService } from '../api/services';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { JsonViewer } from '../components/viz/JsonViewer';
import { ForensicStageDetail, type PipelineStageId } from '../components/viz/ForensicStageDetail';
import { 
  Workflow, 
  Download, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Activity, 
  Database, 
  Lock, 
  Cpu,
  ShieldCheck, 
  BarChart2, 
  ListTree,
  Link2,
  Play,
  Pause,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  History,
  FlaskConical
} from 'lucide-react';
import { CounterfactualSimulatorDrawer } from '../components/viz/CounterfactualSimulatorDrawer';
import { cn } from '../utils/cn';
import { formatTime } from '../utils/datetime';

interface PipelineStepItem {
  id: PipelineStageId;
  code: string;
  label: string;
  sub: string;
  statusBadge: string;
}

const PIPELINE_STEPS: PipelineStepItem[] = [
  { id: 'M1_M2', code: 'M1/M2', label: 'Semantic Ingest', sub: 'Normalization', statusBadge: 'NORM_OK' },
  { id: 'M3', code: 'M3', label: 'Context Cache', sub: 'Sequencing', statusBadge: 'SEQ_OK' },
  { id: 'M4', code: 'M4', label: 'Vectorization', sub: 'Feature Extract', statusBadge: '22_VEC' },
  { id: 'M5', code: 'M5', label: 'ML Inference', sub: 'Behavioral ML', statusBadge: 'ML_SIG' },
  { id: 'M6', code: 'M6', label: 'Static Rules', sub: 'Task Auth', statusBadge: 'AUTH_CHK' },
  { id: 'M7', code: 'M7', label: 'Decision Fusion', sub: 'Policy Check', statusBadge: 'BIND_M7' },
  { id: 'M8', code: 'M8', label: 'Enforcement Gate', sub: 'Runtime Intercept', statusBadge: 'EXEC_GATE' },
];

export function DecisionExplorerPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const sessionParam = searchParams.get('session');
  const interceptionParam = searchParams.get('interception');
  const stageParam = searchParams.get('stage');

  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedStageId, setSelectedStageId] = useState<PipelineStageId>('M1_M2');
  const [isCounterfactualOpen, setIsCounterfactualOpen] = useState<boolean>(false);

  const { data: auditEvents, isLoading } = useQuery({
    queryKey: ['auditLogsAll'],
    queryFn: () => auditService.getAll(),
    refetchInterval: 5000,
  });

  // Dual-identifier correlation validation
  const correlation = useMemo<{
    status: 'none' | 'incomplete' | 'unmatched' | 'matched';
    event: any | null;
  }>(() => {
    const hasSession = Boolean(sessionParam);
    const hasInterception = Boolean(interceptionParam);

    if (!hasSession && !hasInterception) {
      return { status: 'none', event: null };
    }
    if (!hasSession || !hasInterception) {
      return { status: 'incomplete', event: null };
    }
    if (!auditEvents) {
      return { status: 'none', event: null };
    }

    // Validate that interception belongs to the specified session
    const matched = auditEvents.find(
      (e: any) => e.session_id === sessionParam && e.interception_id === interceptionParam
    );

    if (matched) {
      return { status: 'matched', event: matched };
    }
    return { status: 'unmatched', event: null };
  }, [auditEvents, sessionParam, interceptionParam]);

  // Synchronize selection state when correlation matches
  useEffect(() => {
    if (correlation.status === 'matched' && correlation.event) {
      setSelectedEventId(correlation.event.interception_id);
      if (stageParam) {
        const normalizedStage = stageParam.toUpperCase() === 'M2' || stageParam.toUpperCase() === 'M1' ? 'M1_M2' : stageParam.toUpperCase();
        if (PIPELINE_STEPS.some((s) => s.id === normalizedStage)) {
          setSelectedStageId(normalizedStage as PipelineStageId);
        }
      }
    }
  }, [correlation.status, correlation.event, stageParam]);

  const selectedEvent = useMemo(() => {
    if (!auditEvents) return null;
    return auditEvents.find((e: any) => e.interception_id === selectedEventId) || null;
  }, [auditEvents, selectedEventId]);

  const { data: sessionEvents, isLoading: isSessionLoading } = useQuery({
    queryKey: ['auditSession', selectedEvent?.session_id],
    queryFn: () => auditService.getBySession(selectedEvent!.session_id),
    enabled: !!selectedEvent?.session_id,
  });

  // Stable chronological sorting using sequence_number, with timestamp as secondary evidence
  const sortedSessionEvents = useMemo(() => {
    if (!sessionEvents || sessionEvents.length === 0) return [];
    return [...sessionEvents].sort((a: any, b: any) => {
      const seqA = a.sequence_number ?? 0;
      const seqB = b.sequence_number ?? 0;
      if (seqA !== seqB) return seqA - seqB;
      const tsA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const tsB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return tsA - tsB;
    });
  }, [sessionEvents]);

  // Current replay index within session trajectory
  const currentReplayIndex = useMemo(() => {
    if (!selectedEvent || sortedSessionEvents.length === 0) return -1;
    return sortedSessionEvents.findIndex((e: any) => e.interception_id === selectedEvent.interception_id);
  }, [selectedEvent, sortedSessionEvents]);

  // Historical forensic replay state (Phase 4D.2)
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1000); // 1000ms or 2000ms

  // Synchronized event selection and URL query parameters
  const selectEventAndSyncUrl = useCallback((targetEvent: any) => {
    if (!targetEvent) return;
    setSelectedEventId(targetEvent.interception_id);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('session', targetEvent.session_id);
      next.set('interception', targetEvent.interception_id);
      if (selectedStageId) {
        next.set('stage', selectedStageId);
      }
      return next;
    }, { replace: true });
  }, [selectedStageId, setSearchParams]);

  // Replay navigation handlers
  const handlePrev = useCallback(() => {
    setIsPlaying(false);
    if (currentReplayIndex > 0) {
      selectEventAndSyncUrl(sortedSessionEvents[currentReplayIndex - 1]);
    }
  }, [currentReplayIndex, sortedSessionEvents, selectEventAndSyncUrl]);

  const handleNext = useCallback(() => {
    setIsPlaying(false);
    if (currentReplayIndex >= 0 && currentReplayIndex < sortedSessionEvents.length - 1) {
      selectEventAndSyncUrl(sortedSessionEvents[currentReplayIndex + 1]);
    }
  }, [currentReplayIndex, sortedSessionEvents, selectEventAndSyncUrl]);

  const handleReset = useCallback(() => {
    setIsPlaying(false);
    if (sortedSessionEvents.length > 0) {
      selectEventAndSyncUrl(sortedSessionEvents[0]);
    }
  }, [sortedSessionEvents, selectEventAndSyncUrl]);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      setIsPlaying(false);
    } else {
      if (currentReplayIndex >= sortedSessionEvents.length - 1) {
        if (sortedSessionEvents.length > 0) {
          selectEventAndSyncUrl(sortedSessionEvents[0]);
        }
        setIsPlaying(true);
      } else {
        setIsPlaying(true);
      }
    }
  }, [isPlaying, currentReplayIndex, sortedSessionEvents, selectEventAndSyncUrl]);

  // Timer cleanup on session change
  const currentSessionId = selectedEvent?.session_id;
  useEffect(() => {
    setIsPlaying(false);
  }, [currentSessionId]);

  // Playback timer with automatic stop at final event and complete cleanup
  useEffect(() => {
    if (!isPlaying) return;
    if (sortedSessionEvents.length <= 1) {
      setIsPlaying(false);
      return;
    }
    if (currentReplayIndex >= sortedSessionEvents.length - 1) {
      setIsPlaying(false);
      return;
    }

    const timer = setInterval(() => {
      if (currentReplayIndex < sortedSessionEvents.length - 1) {
        const nextEvt = sortedSessionEvents[currentReplayIndex + 1];
        selectEventAndSyncUrl(nextEvt);
      } else {
        setIsPlaying(false);
      }
    }, playbackSpeed);

    return () => clearInterval(timer);
  }, [isPlaying, playbackSpeed, currentReplayIndex, sortedSessionEvents, selectEventAndSyncUrl]);

  const handleExportJson = () => {
    if (!selectedEvent) return;
    const blob = new Blob([JSON.stringify(selectedEvent, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `decision-record-${selectedEvent.interception_id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getDecisionIcon = (decision?: string) => {
    const d = decision?.toUpperCase();
    if (d === 'ALLOW') return <CheckCircle2 className="h-5 w-5 text-emerald-600" />;
    if (d === 'BLOCK') return <XCircle className="h-5 w-5 text-rose-600" />;
    if (d === 'ALERT') return <AlertTriangle className="h-5 w-5 text-amber-600" />;
    return <ShieldCheck className="h-5 w-5 text-slate-400" />;
  };

  const selectStageAndSyncUrl = useCallback((stageId: PipelineStageId) => {
    setSelectedStageId(stageId);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('stage', stageId);
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const handleStageKeyDown = useCallback((e: React.KeyboardEvent, stageId: PipelineStageId) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      selectStageAndSyncUrl(stageId);
    }
  }, [selectStageAndSyncUrl]);

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-bold font-mono tracking-wider text-slate-400 uppercase">
              TECHNICAL DEEP DIVE //
            </span>
            {selectedEvent ? (
              <span className="text-[11px] font-bold font-mono text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                INTERCEPTION #{selectedEvent.interception_id.slice(0, 10)} [{selectedEvent.execution_state}]
              </span>
            ) : (
              <span className="text-[11px] font-mono text-slate-400">SELECT EVENT TO INSPECT</span>
            )}
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-slate-900">
            Decision Explorer
          </h1>
          <p className="text-xs lg:text-sm text-slate-500 mt-1">
            Sub-millisecond multi-stage pipeline breakdown and deterministic policy lineage.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            disabled={!selectedEvent}
            onClick={() => setIsCounterfactualOpen(true)}
            data-testid="open-counterfactual-drawer-btn"
            className="h-9 text-xs font-semibold bg-white border-slate-200 text-slate-700 shadow-xs cursor-pointer hover:bg-slate-50"
            aria-label="Open What-If Counterfactual Preview"
          >
            <FlaskConical className="h-3.5 w-3.5 mr-1.5 text-violet-600" />
            What-If / Counterfactual Preview
          </Button>

          <Button 
            variant="outline" 
            disabled={!selectedEvent}
            onClick={handleExportJson}
            className="h-9 text-xs font-semibold bg-white border-slate-200 text-slate-700 shadow-xs"
          >
            <Download className="h-3.5 w-3.5 mr-1.5 text-slate-500" />
            Export JSON Artifact
          </Button>
        </div>
      </div>

      {/* Correlation Notification Banners */}
      {correlation.status === 'matched' && (
        <div 
          data-testid="decision-correlation-banner"
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-xs font-mono text-blue-900 shadow-xs"
        >
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-blue-600 shrink-0" />
            <span>
              <strong>CORRELATED EVENT RECORD:</strong> Session <code className="bg-blue-100 px-1 py-0.5 rounded font-bold text-blue-800">{sessionParam}</code> &middot; Interception <code className="bg-blue-100 px-1 py-0.5 rounded font-bold text-blue-800">{interceptionParam}</code>
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSearchParams({})}
            className="self-start sm:self-auto text-[11px] font-medium text-blue-700 hover:text-blue-900 underline font-sans cursor-pointer"
          >
            Clear Correlation Filter
          </button>
        </div>
      )}

      {correlation.status === 'unmatched' && (
        <div 
          data-testid="decision-unmatched-banner"
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs font-mono text-amber-900 shadow-xs"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            <span>
              <strong>Correlation Notice:</strong> No audit record found matching session <code className="bg-amber-100 px-1 py-0.5 rounded font-bold">{sessionParam}</code> and interception <code className="bg-amber-100 px-1 py-0.5 rounded font-bold">{interceptionParam}</code>. Interception ID does not belong to specified session or does not exist.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSearchParams({})}
            className="self-start sm:self-auto text-[11px] font-medium text-amber-700 hover:text-amber-900 underline font-sans cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {correlation.status === 'incomplete' && (
        <div 
          data-testid="decision-incomplete-banner"
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs font-mono text-amber-900 shadow-xs"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            <span>
              <strong>Correlation Notice:</strong> Missing parameter — both <code className="bg-amber-100 px-1 py-0.5 rounded font-bold">session</code> and <code className="bg-amber-100 px-1 py-0.5 rounded font-bold">interception</code> query parameters are required for correlation.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSearchParams({})}
            className="self-start sm:self-auto text-[11px] font-medium text-amber-700 hover:text-amber-900 underline font-sans cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Event Selection Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
        <label className="text-xs font-bold font-mono uppercase text-slate-500 whitespace-nowrap">
          Select Interception Event:
        </label>
        <select 
          className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
          value={selectedEventId || ''}
          onChange={(e) => {
            setIsPlaying(false);
            const found = auditEvents?.find((ev: any) => ev.interception_id === e.target.value);
            if (found) {
              selectEventAndSyncUrl(found);
            } else {
              setSelectedEventId(null);
            }
          }}
        >
          <option value="">-- Select an Event --</option>
          {auditEvents?.map((event: any) => (
            <option key={event.interception_id} value={event.interception_id}>
              {formatTime(event.timestamp)} | {event.decision} | {event.tool_name || event.action?.normalized_name || (event.action as any)?.original_tool_name || 'action'} [{event.interception_id.slice(0, 8)}]
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="h-96 flex flex-col items-center justify-center text-slate-400 font-mono text-xs gap-2">
          <span>Loading events...</span>
        </div>
      ) : !selectedEvent ? (
        <div className="h-96 flex items-center justify-center">
          <EmptyState 
            icon={Workflow}
            title="No Event Selected" 
            description="Please select an interception event from the dropdown above to view its decision lineage."
          />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Top 4 Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Pipeline Status */}
            <Card className="p-4 border-slate-200 shadow-xs bg-white flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold font-mono text-slate-500 uppercase tracking-wider">PIPELINE STATUS</span>
                <Clock className="h-4 w-4 text-slate-400" />
              </div>
              <div className="mt-2">
                <p className="text-2xl font-extrabold font-mono text-slate-900">
                  {selectedEvent.execution_state ? `GATE: ${selectedEvent.execution_state.toUpperCase()}` : 'RECORDED'}
                </p>
              </div>
              <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] font-mono text-slate-500 flex items-center justify-between">
                <span>Sequence: {selectedEvent.sequence_number ?? 0} &middot; M1–M8 Telemetry</span>
                <span className={cn(
                  "font-semibold",
                  selectedEvent.execution_state?.toUpperCase() === 'BLOCKED' ? "text-rose-600" :
                  selectedEvent.execution_state?.toUpperCase() === 'EXECUTION_FAILED' ? "text-amber-600" :
                  "text-emerald-600"
                )}>
                  {selectedEvent.execution_state?.toUpperCase() === 'BLOCKED' ? 'Gate Enforced' :
                   selectedEvent.execution_state?.toUpperCase() === 'EXECUTION_FAILED' ? 'Execution Fault' :
                   selectedEvent.execution_state?.toUpperCase() === 'EXECUTED' ? 'Execution Verified' : 'Evaluated'}
                </span>
              </div>
            </Card>
            
            {/* Card 2: Risk Score */}
            <Card className="p-4 border-slate-200 shadow-xs bg-white flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold font-mono text-slate-500 uppercase tracking-wider">RISK SEVERITY SCORE</span>
                <Activity className="h-4 w-4 text-blue-600" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <p className="text-2xl font-extrabold font-mono text-slate-900">
                  {selectedEvent.action_record?.risk_score ?? 'N/A'}
                </p>
                <span className="text-xs text-slate-400 font-mono font-medium">/ 4 max</span>
                {selectedEvent.action_record?.risk_severity && (
                  <span className={cn(
                    "text-[11px] font-bold px-1.5 py-0.5 rounded border ml-auto",
                    selectedEvent.action_record.risk_severity === 'CRITICAL' ? "text-rose-700 bg-rose-50 border-rose-200" :
                    selectedEvent.action_record.risk_severity === 'HIGH' ? "text-amber-700 bg-amber-50 border-amber-200" :
                    selectedEvent.action_record.risk_severity === 'MEDIUM' ? "text-yellow-700 bg-yellow-50 border-yellow-200" :
                    "text-slate-700 bg-slate-50 border-slate-200"
                  )}>
                    {selectedEvent.action_record.risk_severity}
                  </span>
                )}
              </div>
              <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] font-mono text-slate-500 flex items-center justify-between">
                <span>Discrete Severity (0–4 Scale)</span>
                <span>ML P(unsafe): {typeof selectedEvent.action_record?.ml_probability === 'number' ? selectedEvent.action_record.ml_probability.toFixed(4) : 'N/A'}</span>
              </div>
            </Card>

            {/* Card 3: Auth Status */}
            <Card className="p-4 border-slate-200 shadow-xs bg-white flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold font-mono text-slate-500 uppercase tracking-wider">TASK AUTHORIZATION</span>
                <Lock className="h-4 w-4 text-slate-400" />
              </div>
              <div className="mt-2">
                <p className="text-2xl font-extrabold font-mono text-slate-900">
                  {selectedEvent.action_record?.auth_status ?? 'N/A'}
                </p>
              </div>
              <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] font-mono text-slate-500 truncate" title={selectedEvent.task_id}>
                Context: {selectedEvent.task_id}
              </div>
            </Card>

            {/* Card 4: Final Decision */}
            <Card className={cn(
              "p-4 border shadow-xs bg-white flex flex-col justify-between",
              selectedEvent.decision?.toUpperCase() === 'ALLOW' ? "border-emerald-200" :
              selectedEvent.decision?.toUpperCase() === 'BLOCK' ? "border-rose-200" : "border-amber-200"
            )}>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold font-mono text-slate-500 uppercase tracking-wider">ENFORCEMENT VERDICT</span>
                {getDecisionIcon(selectedEvent.decision)}
              </div>
              <div className="mt-2">
                <p className="text-xl font-bold tracking-tight">
                  {selectedEvent.decision}
                </p>
              </div>
              <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] font-mono text-slate-500">
                Execution: {selectedEvent.execution_state}
              </div>
            </Card>
          </div>

          {/* Historical Forensic Replay Controller (Phase 4D.2) */}
          <Card 
            data-testid="historical-forensic-replay-bar"
            className="p-4 border-slate-200 shadow-xs bg-white"
          >
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              {/* Title & Live Status */}
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0">
                  <History className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-bold font-mono uppercase text-slate-800 tracking-wider">
                      Historical Forensic Replay
                    </h3>
                    <Badge 
                      variant="outline"
                      data-testid="replay-status-badge"
                      className={cn(
                        "text-[10px] font-mono font-bold px-1.5 py-0",
                        isPlaying ? "bg-emerald-50 text-emerald-800 border-emerald-300 animate-pulse" :
                        currentReplayIndex >= sortedSessionEvents.length - 1 && sortedSessionEvents.length > 0 ? "bg-slate-100 text-slate-600 border-slate-200" :
                        "bg-blue-50 text-blue-700 border-blue-200"
                      )}
                    >
                      {isPlaying ? `PLAYING (${(playbackSpeed / 1000).toFixed(1)}s)` : 
                       currentReplayIndex >= sortedSessionEvents.length - 1 && sortedSessionEvents.length > 0 ? 'AT END' : 'PAUSED'}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Step-by-step chronological trajectory replay across pipeline stages
                  </p>
                </div>
              </div>

              {/* Controls Group */}
              <div className="flex items-center gap-2 self-start lg:self-auto flex-wrap sm:flex-nowrap">
                <Button
                  variant="outline"
                  size="sm"
                  aria-label="Reset replay to first event"
                  disabled={currentReplayIndex <= 0 || sortedSessionEvents.length <= 1}
                  onClick={handleReset}
                  className="h-8 px-2.5 text-xs font-mono bg-white border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-40"
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1" />
                  Reset
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  aria-label="Previous event"
                  disabled={currentReplayIndex <= 0}
                  onClick={handlePrev}
                  className="h-8 px-2.5 text-xs font-mono bg-white border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Prev
                </Button>

                <Button
                  size="sm"
                  aria-label={isPlaying ? "Pause replay" : "Play historical replay"}
                  disabled={sortedSessionEvents.length <= 1}
                  onClick={togglePlay}
                  className={cn(
                    "h-8 px-3.5 text-xs font-mono font-bold cursor-pointer text-white shadow-xs",
                    isPlaying ? "bg-amber-600 hover:bg-amber-700" : "bg-blue-600 hover:bg-blue-700"
                  )}
                >
                  {isPlaying ? (
                    <>
                      <Pause className="h-3.5 w-3.5 mr-1.5 fill-current" />
                      Pause
                    </>
                  ) : (
                    <>
                      <Play className="h-3.5 w-3.5 mr-1.5 fill-current" />
                      Play
                    </>
                  )}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  aria-label="Next event"
                  disabled={currentReplayIndex >= sortedSessionEvents.length - 1}
                  onClick={handleNext}
                  className="h-8 px-2.5 text-xs font-mono bg-white border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-40"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>

                {/* Interval Speed Selector (1s vs 2s) */}
                <div 
                  role="group" 
                  aria-label="Playback speed"
                  className="flex items-center ml-2 p-0.5 rounded-lg border border-slate-200 bg-slate-50 text-[11px] font-mono"
                >
                  <button
                    type="button"
                    aria-label="1 second interval"
                    aria-pressed={playbackSpeed === 1000}
                    onClick={() => setPlaybackSpeed(1000)}
                    className={cn(
                      "px-2 py-1 rounded cursor-pointer motion-safe:transition-all font-semibold",
                      playbackSpeed === 1000
                        ? "bg-white text-blue-700 shadow-xs border border-slate-200/80 font-bold"
                        : "text-slate-500 hover:text-slate-800"
                    )}
                  >
                    1.0s
                  </button>
                  <button
                    type="button"
                    aria-label="2 seconds interval"
                    aria-pressed={playbackSpeed === 2000}
                    onClick={() => setPlaybackSpeed(2000)}
                    className={cn(
                      "px-2 py-1 rounded cursor-pointer motion-safe:transition-all font-semibold",
                      playbackSpeed === 2000
                        ? "bg-white text-blue-700 shadow-xs border border-slate-200/80 font-bold"
                        : "text-slate-500 hover:text-slate-800"
                    )}
                  >
                    2.0s
                  </button>
                </div>
              </div>

              {/* Replay Position & Announcer */}
              <div className="flex items-center gap-3">
                <div className="text-right font-mono">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Replay Position</span>
                  <span className="text-xs font-bold text-slate-800" data-testid="replay-position-display">
                    Step {currentReplayIndex >= 0 ? currentReplayIndex + 1 : 0} of {sortedSessionEvents.length}
                  </span>
                </div>
                {/* Visual Step Progress Indicator */}
                <div className="w-24 bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                  <div 
                    className="bg-blue-600 h-full motion-safe:transition-all duration-300 rounded-full"
                    style={{
                      width: sortedSessionEvents.length > 0 
                        ? `${Math.max(5, ((currentReplayIndex + 1) / sortedSessionEvents.length) * 100)}%` 
                        : '0%'
                    }}
                  />
                </div>
              </div>

              {/* Screen reader live announcer */}
              <div role="status" aria-live="polite" className="sr-only">
                {selectedEvent ? (
                  `Replay position: Step ${currentReplayIndex + 1} of ${sortedSessionEvents.length}. Interception ${selectedEvent.interception_id}, Tool: ${selectedEvent.tool_name || selectedEvent.action?.normalized_name || 'action'}, Decision: ${selectedEvent.decision}`
                ) : (
                  'No event currently selected'
                )}
              </div>
            </div>
          </Card>

          {/* Sequential Execution Map (Interactive 7-Stage Stepper) */}
          <Card className="p-5 border-slate-200 shadow-xs bg-white">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-xs font-bold font-mono uppercase text-slate-500 tracking-wider">
                  Sequential Execution Map
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Pipeline Evaluation Lifecycle (Stage M1/M2 → M8) &middot; Click stage to inspect</p>
              </div>
              <div className="flex items-center gap-3 text-[11px] font-mono">
                <span className="flex items-center gap-1 text-slate-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Active Stage
                </span>
                <span className="flex items-center gap-1 text-slate-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                  Intercept Gate
                </span>
              </div>
            </div>

            <div 
              role="tablist"
              aria-label="Pipeline Stages"
              className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mt-4"
            >
              {PIPELINE_STEPS.map((step) => {
                const isActive = selectedStageId === step.id;
                return (
                  <button
                    type="button"
                    key={step.id} 
                    role="tab"
                    tabIndex={0}
                    aria-selected={isActive}
                    onClick={() => selectStageAndSyncUrl(step.id)}
                    onKeyDown={(e) => handleStageKeyDown(e, step.id)}
                    className={cn(
                      "p-3 rounded-lg border text-left flex flex-col justify-between space-y-2 cursor-pointer motion-safe:transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                      isActive
                        ? "bg-blue-50/90 border-blue-400 ring-2 ring-blue-500/20 shadow-xs"
                        : "bg-slate-50/70 border-slate-200/80 hover:bg-slate-100 hover:border-slate-300"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className={cn("font-bold font-mono text-xs", isActive ? "text-blue-700" : "text-blue-600")}>
                        {step.code}
                      </span>
                      <span className="text-[9px] font-mono text-slate-400">
                        {step.statusBadge}
                      </span>
                    </div>
                    <div>
                      <p className={cn("text-xs font-bold leading-tight", isActive ? "text-blue-900" : "text-slate-800")}>
                        {step.label}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">{step.sub}</p>
                    </div>
                    <div className="pt-1 border-t border-slate-200/60 flex items-center justify-between text-[11px] font-mono text-emerald-700">
                      <span>NORM_OK</span>
                      <span className={cn("h-1.5 w-1.5 rounded-full", isActive ? "bg-blue-600" : "bg-emerald-500")} />
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Active Stage Forensic Inspector */}
          <ForensicStageDetail 
            stageId={selectedStageId}
            event={selectedEvent}
            sessionEvents={sortedSessionEvents}
          />

          {/* 3 Deep Dive Panels (Preserved for existing assertions & layout) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Panel 1: Ingest & Normalization */}
            <Card className="border-slate-200 shadow-xs bg-white flex flex-col h-full overflow-hidden">
              <CardHeader className="py-3 px-5 border-b border-slate-100 bg-slate-50/60">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-blue-600" />
                  <CardTitle className="text-xs font-bold font-mono uppercase text-slate-700">
                    Phase 1: Ingest &amp; Normalization
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-5 flex-1 space-y-4 text-xs font-mono">
                <div>
                  <span className="text-[11px] uppercase font-bold text-slate-400 block mb-1">Tool Executed:</span>
                  <span className="font-semibold text-slate-900 bg-slate-100 px-2 py-1 rounded inline-block text-xs">
                    {selectedEvent.tool_name || selectedEvent.action?.normalized_name || (selectedEvent.action as any)?.original_tool_name || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] uppercase font-bold text-slate-400 block mb-1">Raw Arguments:</span>
                  <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-lg max-h-[140px] overflow-auto text-[11px]">
                    <JsonViewer data={selectedEvent.arguments || {}} />
                  </div>
                </div>
                {selectedEvent.action && (
                  <div>
                    <span className="text-[11px] uppercase font-bold text-slate-400 block mb-1">Normalized Action (M2):</span>
                    <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-lg space-y-1 text-[11px] text-slate-700">
                      <div><span className="text-slate-400">Category:</span> {selectedEvent.action.category}</div>
                      <div><span className="text-slate-400">Resource:</span> {selectedEvent.action.resource || 'N/A'}</div>
                      <div><span className="text-slate-400">Operation:</span> {selectedEvent.action.operation || 'N/A'}</div>
                      <div><span className="text-slate-400">Mutating:</span> {selectedEvent.action.is_mutating ? 'Yes' : 'No'}</div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Panel 2: ML Inference & Auth */}
            <Card className="border-slate-200 shadow-xs bg-white flex flex-col h-full overflow-hidden">
              <CardHeader className="py-3 px-5 border-b border-slate-100 bg-slate-50/60">
                <div className="flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-blue-600" />
                  <CardTitle className="text-xs font-bold font-mono uppercase text-slate-700">
                    Phase 2: ML Inference &amp; Auth
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-5 flex-1 space-y-4 text-xs font-mono">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-2.5 rounded-lg border border-slate-100 bg-slate-50">
                    <span className="text-[11px] uppercase font-bold text-slate-400 block mb-1">ML Probability (M5):</span>
                    <span className="font-bold text-slate-900 text-sm">
                      {typeof selectedEvent.action_record?.ml_probability === 'number'
                        ? selectedEvent.action_record.ml_probability.toFixed(4)
                        : 'N/A'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg border border-slate-100 bg-slate-50">
                    <span className="text-[11px] uppercase font-bold text-slate-400 block mb-1">Risk Severity:</span>
                    <span className="font-bold text-slate-900 text-sm">
                      {selectedEvent.action_record?.risk_severity ?? 'N/A'}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-[11px] uppercase font-bold text-slate-400 block mb-1">Extracted Behavioral Features:</span>
                  <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-lg max-h-[160px] overflow-auto text-[11px]">
                    <JsonViewer data={selectedEvent.action_record?.features || {}} />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Panel 3: Decision Fusion (M8) */}
            <Card className="border-slate-200 shadow-xs bg-white flex flex-col h-full overflow-hidden">
              <CardHeader className="py-3 px-5 border-b border-slate-100 bg-slate-50/60">
                <div className="flex items-center gap-2">
                  <Workflow className="h-4 w-4 text-blue-600" />
                  <CardTitle className="text-xs font-bold font-mono uppercase text-slate-700">
                    Phase 3: Decision Fusion (M8)
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-5 flex-1 space-y-4 text-xs font-mono">
                <div className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 bg-slate-50">
                  <span className="text-slate-500">M8 Enforced Decision:</span>
                  <Badge 
                    variant={selectedEvent.decision.toLowerCase() as any}
                    className="font-bold font-mono text-xs px-2.5 py-0.5 uppercase"
                  >
                    {selectedEvent.decision}
                  </Badge>
                </div>

                <div>
                  <span className="text-[11px] uppercase font-bold text-slate-400 block mb-1.5">Governance Reasons:</span>
                  {selectedEvent.action_record?.reasons && selectedEvent.action_record.reasons.length > 0 ? (
                    <div className="space-y-1.5 max-h-[160px] overflow-auto">
                      {selectedEvent.action_record.reasons.map((r: any, i: number) => (
                        <div key={i} className="bg-slate-50 border border-slate-200 p-2 rounded text-[11px]">
                          <span className="font-bold text-blue-600 block mb-0.5">[{r.rule_type}]</span>
                          <span className="text-slate-700">{r.description}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 bg-slate-50 rounded border border-slate-100 text-slate-400 italic text-[11px]">
                      No explicit governance overrides triggered.
                    </div>
                  )}
                </div>

                {selectedEvent.error_message && (
                  <div>
                    <span className="text-[11px] uppercase font-bold text-rose-500 block mb-1">Error Trace:</span>
                    <div className="bg-rose-50 border border-rose-200 text-rose-700 p-2 rounded text-[11px]">
                      {selectedEvent.error_message}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Bottom Grid: 22-Feature Risk Attribution & Session Trajectory Timeline */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: 22-Feature Risk Attribution */}
            <Card className="p-5 border-slate-200 shadow-xs bg-white flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="text-xs font-bold font-mono uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
                      <BarChart2 className="h-4 w-4 text-blue-600" />
                      22-Feature Risk Attribution
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">Behavioral risk vectors from Random Forest classifier</p>
                  </div>
                  <div className="text-right font-mono">
                    <span className="text-[11px] text-slate-400 uppercase block">Risk Score</span>
                    <span className="text-xs font-bold text-slate-800">
                      Score: {selectedEvent.action_record?.risk_score ?? 'N/A'}
                    </span>
                  </div>
                </div>

                <div className="mt-4 space-y-2.5">
                  {selectedEvent.action_record?.features && Object.keys(selectedEvent.action_record.features).length > 0 ? (
                    Object.entries(selectedEvent.action_record.features).slice(0, 6).map(([featureName, featureVal]) => {
                      const numVal = typeof featureVal === 'number' ? featureVal : 0;
                      return (
                        <div key={featureName} className="space-y-1">
                          <div className="flex justify-between text-[11px] font-mono">
                            <span className="text-slate-700 font-medium">{featureName}</span>
                            <span className="text-slate-500">
                              {typeof featureVal === 'number'
                                ? featureVal.toFixed(3)
                                : typeof featureVal === 'object' && featureVal !== null
                                  ? Array.isArray(featureVal)
                                    ? featureVal.join(', ')
                                    : Object.entries(featureVal).map(([k, v]) => `${k}: ${v}`).join(', ') || '{}'
                                  : String(featureVal ?? 'N/A')}
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
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
                    <div className="py-8 text-center text-slate-400 font-mono text-xs">
                      No feature vectors extracted for this event.
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 font-mono text-[11px] text-slate-500 flex items-center justify-between">
                <span>Model: Random Forest Baseline</span>
                <span>ML Probability: {typeof selectedEvent.action_record?.ml_probability === 'number' ? selectedEvent.action_record.ml_probability.toFixed(4) : 'N/A'}</span>
              </div>
            </Card>

            {/* Right: Session Trajectory Timeline */}
            <Card className="p-5 border-slate-200 shadow-xs bg-white flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="text-xs font-bold font-mono uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
                      <ListTree className="h-4 w-4 text-blue-600" />
                      Session Trajectory Timeline
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">Chronological action lineage for session</p>
                  </div>
                  <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                    Session: {selectedEvent.session_id.slice(0, 16)}
                  </span>
                </div>

                <div className="mt-4 space-y-2 max-h-[260px] overflow-y-auto pr-1">
                  {isSessionLoading ? (
                    <div className="py-8 text-center text-slate-400 font-mono text-xs">
                      Loading session trajectory...
                    </div>
                  ) : !sessionEvents || sessionEvents.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 font-mono text-xs">
                      No trajectory available.
                    </div>
                  ) : (
                    sortedSessionEvents.map((evt: any) => {
                      const isCurrent = evt.interception_id === selectedEvent.interception_id;
                      const isBlock = evt.decision?.toUpperCase() === 'BLOCK';
                      const isAlert = evt.decision?.toUpperCase() === 'ALERT';

                      return (
                        <div 
                          key={evt.interception_id} 
                          onClick={() => {
                            setIsPlaying(false);
                            selectEventAndSyncUrl(evt);
                          }}
                          className={cn(
                            "flex items-center justify-between p-2.5 rounded-lg border text-xs font-mono cursor-pointer motion-safe:transition-all",
                            isCurrent
                              ? "bg-blue-50/70 border-blue-300 ring-1 ring-blue-500/20 shadow-xs"
                              : "bg-slate-50/60 border-slate-200/80 hover:bg-slate-100/70"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-slate-400 font-bold w-6 shrink-0">#{evt.sequence_number}</span>
                            <Badge 
                              variant={evt.decision?.toLowerCase() as any}
                              className={cn(
                                "w-16 justify-center text-[11px] font-mono py-0.5",
                                isBlock ? "bg-rose-100 text-rose-800 border-rose-200" :
                                isAlert ? "bg-amber-100 text-amber-800 border-amber-200" :
                                "bg-emerald-100 text-emerald-800 border-emerald-200"
                              )}
                            >
                              {evt.decision}
                            </Badge>
                            {(() => {
                              const actionName = evt.tool_name || evt.action?.normalized_name || (evt.action as any)?.original_tool_name || 'action';
                              const resourceTarget = evt.action?.resource ? ` (${evt.action.resource})` : '';
                              return (
                                <span className="font-semibold text-slate-800 truncate max-w-[200px]" title={`${actionName}${resourceTarget}`}>
                                  {actionName}{resourceTarget}
                                </span>
                              );
                            })()}
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-slate-400">
                            <span>Risk: {evt.action_record?.risk_score ?? 'N/A'}</span>
                            <span>{formatTime(evt.timestamp)}</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 font-mono text-[11px] text-slate-400 flex items-center justify-between">
                <span>Deterministic Ordering Guaranteed</span>
                <span className="text-blue-600 font-semibold">{sessionEvents?.length ?? 0} Steps Monitored</span>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Counterfactual Policy Matrix Simulator Drawer (Phase 4D.3) */}
      <CounterfactualSimulatorDrawer
        isOpen={isCounterfactualOpen}
        onClose={() => setIsCounterfactualOpen(false)}
        event={selectedEvent}
      />
    </div>
  );
}
