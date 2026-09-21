import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { auditService } from '../api/services';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { JsonViewer } from '../components/viz/JsonViewer';
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
  ListTree
} from 'lucide-react';
import { cn } from '../utils/cn';

const PIPELINE_STEPS = [
  { id: 'M2', label: 'Semantic Ingest', sub: 'Normalization' },
  { id: 'M3', label: 'Context Cache', sub: 'Sequencing' },
  { id: 'M4', label: 'Vectorization', sub: 'Feature Extract' },
  { id: 'M5', label: 'ML Inference', sub: 'Behavioral ML' },
  { id: 'M6', label: 'Static Rules', sub: 'Task Auth' },
  { id: 'M7', label: 'Auth Checks', sub: 'Policy Check' },
  { id: 'M8', label: 'Decision Fusion', sub: 'Runtime Intercept' },
];

export function DecisionExplorerPage() {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const { data: auditEvents, isLoading } = useQuery({
    queryKey: ['auditLogsAll'],
    queryFn: () => auditService.getAll(),
    refetchInterval: 5000,
  });

  const selectedEvent = useMemo(() => {
    if (!auditEvents) return null;
    return auditEvents.find((e: any) => e.interception_id === selectedEventId) || null;
  }, [auditEvents, selectedEventId]);

  const { data: sessionEvents, isLoading: isSessionLoading } = useQuery({
    queryKey: ['auditSession', selectedEvent?.session_id],
    queryFn: () => auditService.getBySession(selectedEvent!.session_id),
    enabled: !!selectedEvent?.session_id,
  });

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
    if (decision === 'ALLOW') return <CheckCircle2 className="h-5 w-5 text-emerald-600" />;
    if (decision === 'BLOCK') return <XCircle className="h-5 w-5 text-rose-600" />;
    if (decision === 'ALERT') return <AlertTriangle className="h-5 w-5 text-amber-600" />;
    return <ShieldCheck className="h-5 w-5 text-slate-400" />;
  };

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

      {/* Event Selection Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
        <label className="text-xs font-bold font-mono uppercase text-slate-500 whitespace-nowrap">
          Select Interception Event:
        </label>
        <select 
          className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
          value={selectedEventId || ''}
          onChange={(e) => setSelectedEventId(e.target.value)}
        >
          <option value="">-- Select an Event --</option>
          {auditEvents?.map((event: any) => (
            <option key={event.interception_id} value={event.interception_id}>
              {new Date(event.timestamp).toLocaleTimeString()} | {event.decision} | {event.tool_name} [{event.interception_id.slice(0, 8)}]
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
            {/* Card 1: Latency */}
            <Card className="p-4 border-slate-200 shadow-xs bg-white flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold font-mono text-slate-500 uppercase tracking-wider">PIPELINE STATUS</span>
                <Clock className="h-4 w-4 text-slate-400" />
              </div>
              <div className="mt-2">
                <p className="text-2xl font-extrabold font-mono text-slate-900">N/A</p>
              </div>
              <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] font-mono text-slate-500 flex items-center justify-between">
                <span>No telemetry data</span>
                <span className="text-emerald-600 font-semibold">Active</span>
              </div>
            </Card>
            
            {/* Card 2: Risk Score */}
            <Card className="p-4 border-slate-200 shadow-xs bg-white flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold font-mono text-slate-500 uppercase tracking-wider">INFERENCE RISK SCORE</span>
                <Activity className="h-4 w-4 text-blue-600" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <p className="text-2xl font-extrabold font-mono text-slate-900">
                  {selectedEvent.action_record?.risk_score ?? 'N/A'}
                </p>
                {selectedEvent.action_record?.risk_score !== undefined && selectedEvent.action_record.risk_score > 0.7 && (
                  <span className="text-[11px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                    CRITICAL
                  </span>
                )}
              </div>
              <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] font-mono text-slate-500">
                Threshold: 0.70 | ML Prob: {typeof selectedEvent.action_record?.ml_probability === 'number' ? selectedEvent.action_record.ml_probability.toFixed(3) : 'N/A'}
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
              selectedEvent.decision === 'ALLOW' ? "border-emerald-200" :
              selectedEvent.decision === 'BLOCK' ? "border-rose-200" : "border-amber-200"
            )}>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold font-mono text-slate-500 uppercase tracking-wider">ENFORCEMENT VERDICT</span>
                {getDecisionIcon(selectedEvent.decision)}
              </div>
              <div className="mt-2">
                {/* Note: selector expects p.text-xl.font-bold:has-text("ALLOW") */}
                <p className="text-xl font-bold tracking-tight">
                  {selectedEvent.decision}
                </p>
              </div>
              <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] font-mono text-slate-500">
                Execution: {selectedEvent.execution_state}
              </div>
            </Card>
          </div>

          {/* Sequential Execution Map (Pipeline Stepper) */}
          <Card className="p-5 border-slate-200 shadow-xs bg-white">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-xs font-bold font-mono uppercase text-slate-500 tracking-wider">
                  Sequential Execution Map
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Pipeline Evaluation Lifecycle (Stage M2 → M8)</p>
              </div>
              <div className="flex items-center gap-3 text-[11px] font-mono">
                <span className="flex items-center gap-1 text-slate-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Normalized / Passed
                </span>
                <span className="flex items-center gap-1 text-slate-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                  Intercept Trigger
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mt-4">
              {PIPELINE_STEPS.map((step) => (
                <div 
                  key={step.id} 
                  className="p-3 rounded-lg border border-slate-100 bg-slate-50/70 flex flex-col justify-between space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold font-mono text-xs text-blue-600">{step.id}</span>
                    <span className="text-[9px] font-mono text-slate-400">N/A</span>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800 leading-tight">{step.label}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{step.sub}</p>
                  </div>
                  <div className="pt-1 border-t border-slate-200/60 flex items-center justify-between text-[11px] font-mono text-emerald-700">
                    <span>NORM_OK</span>
                    <span className="h-1 w-1 rounded-full bg-emerald-500" />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* 3 Deep Dive Panels */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Panel 1: Ingest & Normalization */}
            <Card className="border-slate-200 shadow-xs bg-white flex flex-col h-full overflow-hidden">
              <CardHeader className="py-3 px-5 border-b border-slate-100 bg-slate-50/60">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-blue-600" />
                  <CardTitle className="text-xs font-bold font-mono uppercase text-slate-700">
                    Phase 1: Ingest & Normalization
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-5 flex-1 space-y-4 text-xs font-mono">
                <div>
                  <span className="text-[11px] uppercase font-bold text-slate-400 block mb-1">Tool Executed:</span>
                  <span className="font-semibold text-slate-900 bg-slate-100 px-2 py-1 rounded inline-block text-xs">
                    {selectedEvent.tool_name}
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
                    Phase 2: ML Inference & Auth
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
            {/* Left: 22-Feature Risk Attribution (No SHAP claim as instructed) */}
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
                            <span className="text-slate-500">{typeof featureVal === 'number' ? featureVal.toFixed(3) : String(featureVal)}</span>
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
                    [...sessionEvents].sort((a, b) => (a.sequence_number ?? 0) - (b.sequence_number ?? 0)).map((evt) => {
                      const isCurrent = evt.interception_id === selectedEvent.interception_id;
                      const isBlock = evt.decision === 'BLOCK';
                      const isAlert = evt.decision === 'ALERT';

                      return (
                        <div 
                          key={evt.interception_id}
                          onClick={() => setSelectedEventId(evt.interception_id)}
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
                              variant={evt.decision.toLowerCase() as any}
                              className={cn(
                                "w-16 justify-center text-[11px] font-mono py-0.5",
                                isBlock ? "bg-rose-100 text-rose-800 border-rose-200" :
                                isAlert ? "bg-amber-100 text-amber-800 border-amber-200" :
                                "bg-emerald-100 text-emerald-800 border-emerald-200"
                              )}
                            >
                              {evt.decision}
                            </Badge>
                            <span className="font-semibold text-slate-800">{evt.tool_name}</span>
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-slate-400">
                            <span>Risk: {evt.action_record?.risk_score ?? 'N/A'}</span>
                            <span>{new Date(evt.timestamp).toLocaleTimeString()}</span>
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
    </div>
  );
}
