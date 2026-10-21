import React from 'react';
import type { SafeAuditEventResponse } from '../../api/types';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { JsonViewer } from './JsonViewer';
import { formatTransitionDelta } from '../../utils/datetime';
import { cn } from '../../utils/cn';
import { 
  Database, 
  Clock, 
  BarChart2, 
  Cpu, 
  Lock, 
  Workflow, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle,
  Info
} from 'lucide-react';

export type PipelineStageId = 'M1_M2' | 'M3' | 'M4' | 'M5' | 'M6' | 'M7' | 'M8';

interface ForensicStageDetailProps {
  stageId: PipelineStageId;
  event: SafeAuditEventResponse;
  sessionEvents?: SafeAuditEventResponse[];
}

export function ProvenanceBadge({ type }: { type: 'RECORDED' | 'DERIVED' | 'UNAVAILABLE' }) {
  if (type === 'RECORDED') {
    return (
      <span 
        data-testid="badge-provenance-recorded"
        className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200"
      >
        RECORDED
      </span>
    );
  }
  if (type === 'DERIVED') {
    return (
      <span 
        data-testid="badge-provenance-derived"
        className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-blue-50 text-blue-800 border border-blue-200"
      >
        DERIVED
      </span>
    );
  }
  return (
    <span 
      data-testid="badge-provenance-unavailable"
      className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-slate-100 text-slate-500 border border-slate-200"
    >
      UNAVAILABLE
    </span>
  );
}

export const ForensicStageDetail = React.memo(function ForensicStageDetail({
  stageId,
  event,
  sessionEvents = [],
}: ForensicStageDetailProps) {
  // Sort session events chronologically
  const sortedSession = [...sessionEvents].sort(
    (a, b) => (a.sequence_number ?? 0) - (b.sequence_number ?? 0)
  );
  const currentIndex = sortedSession.findIndex((e) => e.interception_id === event.interception_id);

  // M3 derived values
  const priorExecutedCount = sortedSession
    .slice(0, currentIndex >= 0 ? currentIndex : 0)
    .filter((e) => e.execution_state === 'EXECUTED').length;

  let transitionDeltaLabel: string | null = null;
  if (currentIndex > 0) {
    const prevTs = new Date(sortedSession[currentIndex - 1].timestamp).getTime();
    const currTs = new Date(event.timestamp).getTime();
    if (!isNaN(prevTs) && !isNaN(currTs)) {
      transitionDeltaLabel = formatTransitionDelta((currTs - prevTs) / 1000);
    }
  }

  // M8 derived callable invocations invariant
  const isBlock = event.decision?.toUpperCase() === 'BLOCK';
  const isFault = event.execution_state?.toUpperCase() === 'EXECUTION_FAILED';
  const isExecuted = event.execution_state?.toUpperCase() === 'EXECUTED';
  const hasEstablishedInvocations = isBlock || isExecuted || isFault;
  const callableInvocations = isBlock ? 0 : (isExecuted || isFault ? 1 : null);

  return (
    <Card className="border-slate-200 shadow-xs bg-white overflow-hidden">
      {/* Stage Header */}
      <CardHeader className="py-3 px-5 border-b border-slate-100 bg-slate-50/70 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          {stageId === 'M1_M2' && <Database className="h-4 w-4 text-blue-600" />}
          {stageId === 'M3' && <Clock className="h-4 w-4 text-blue-600" />}
          {stageId === 'M4' && <BarChart2 className="h-4 w-4 text-blue-600" />}
          {stageId === 'M5' && <Cpu className="h-4 w-4 text-blue-600" />}
          {stageId === 'M6' && <Lock className="h-4 w-4 text-blue-600" />}
          {stageId === 'M7' && <Workflow className="h-4 w-4 text-blue-600" />}
          {stageId === 'M8' && <ShieldCheck className="h-4 w-4 text-blue-600" />}
          <div>
            <CardTitle className="text-xs font-bold font-mono uppercase text-slate-800">
              {stageId === 'M1_M2' && 'Stage M1/M2: Ingestion & Action Normalization'}
              {stageId === 'M3' && 'Stage M3: Behavioral Sequence & Temporal Context'}
              {stageId === 'M4' && 'Stage M4: 22-Dimensional Feature Extraction'}
              {stageId === 'M5' && 'Stage M5: Behavioral Risk Engine (ML Risk Signal)'}
              {stageId === 'M6' && 'Stage M6: Task-Context Authorization'}
              {stageId === 'M7' && 'Stage M7: Policy Fusion Engine (Authoritative Verdict)'}
              {stageId === 'M8' && 'Stage M8: Runtime Interceptor & Execution Gate'}
            </CardTitle>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500">
          <span className="font-semibold uppercase tracking-wider">Provenance Legend:</span>
          <ProvenanceBadge type="RECORDED" />
          <ProvenanceBadge type="DERIVED" />
          <ProvenanceBadge type="UNAVAILABLE" />
        </div>
      </CardHeader>

      <CardContent className="p-5 space-y-4 text-xs font-mono">
        {/* ──────── STAGE M1/M2 ──────── */}
        {stageId === 'M1_M2' && (
          <div className="space-y-4">
            <p className="text-[11px] text-slate-500 font-sans leading-relaxed">
              <strong>M1 (Ingestion)</strong> validates raw inbound JSON schemas into standard execution events. 
              <strong>M2 (Action Normalizer)</strong> translates diverse tool APIs into the unified semantic ontology.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-bold uppercase text-[10px]">Tool Name</span>
                    <ProvenanceBadge type="RECORDED" />
                  </div>
                  <div className="font-bold text-slate-900 text-sm">{event.tool_name || event.action?.normalized_name || (event.action as any)?.original_tool_name || 'N/A'}</div>
                </div>

                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-bold uppercase text-[10px]">Normalized Action (M2)</span>
                    <ProvenanceBadge type="RECORDED" />
                  </div>
                  <div className="space-y-1 text-[11px] text-slate-700">
                    <div><span className="text-slate-400">Category:</span> <strong className="text-slate-900">{event.action?.category || 'N/A'}</strong></div>
                    <div><span className="text-slate-400">Normalized Name:</span> <strong className="text-slate-900">{event.action?.normalized_name || 'N/A'}</strong></div>
                    <div><span className="text-slate-400">Target Resource:</span> <strong className="text-slate-900">{event.action?.resource || 'N/A'}</strong></div>
                    <div><span className="text-slate-400">Operation:</span> <strong className="text-slate-900">{event.action?.operation || 'N/A'}</strong></div>
                    <div>
                      <span className="text-slate-400">Inference Flags:</span>{' '}
                      <span className={cn("px-1 py-0.5 rounded text-[10px] font-bold mr-1", event.action?.is_mutating ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600")}>
                        {event.action?.is_mutating ? 'MUTATING' : 'NON-MUTATING'}
                      </span>
                      <span className={cn("px-1 py-0.5 rounded text-[10px] font-bold", event.action?.is_destructive ? "bg-rose-100 text-rose-800" : "bg-slate-100 text-slate-600")}>
                        {event.action?.is_destructive ? 'DESTRUCTIVE' : 'NON-DESTRUCTIVE'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-bold uppercase text-[10px]">Tool Arguments</span>
                    <ProvenanceBadge type="RECORDED" />
                  </div>
                  <div className="bg-white border border-slate-200 p-2.5 rounded max-h-36 overflow-auto text-[11px]">
                    <JsonViewer data={event.arguments || {}} />
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-dashed border-slate-200 bg-slate-50/30 text-slate-400 text-[11px] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold uppercase text-[10px]">Raw Network Byte Stream</span>
                    <ProvenanceBadge type="UNAVAILABLE" />
                  </div>
                  <p className="text-[10px]">Wire-level transport frames and raw socket headers are discarded after schema validation; not persisted in SQLite.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ──────── STAGE M3 ──────── */}
        {stageId === 'M3' && (
          <div className="space-y-4">
            <p className="text-[11px] text-slate-500 font-sans leading-relaxed">
              <strong>M3 (Behavioral Sequence)</strong> maintains chronological sliding-window trajectory state.
              Only successfully executed prior actions alter the environment and accumulate into behavioral context.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-bold uppercase text-[10px]">Step Sequence Number</span>
                  <ProvenanceBadge type="RECORDED" />
                </div>
                <div className="text-xl font-bold text-slate-900">Step #{event.sequence_number}</div>
                <span className="text-[10px] text-slate-400 block">Session position: {currentIndex + 1} of {sortedSession.length}</span>
              </div>

              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-bold uppercase text-[10px]">Transition Interval (Δt)</span>
                  <ProvenanceBadge type="DERIVED" />
                </div>
                <div className="text-xl font-bold text-slate-900">
                  {transitionDeltaLabel ?? (currentIndex === 0 ? 'Initial Step' : 'Unavailable')}
                </div>
                <span className="text-[10px] text-slate-400 block">Relative to Step #{currentIndex > 0 ? sortedSession[currentIndex - 1].sequence_number : 0}</span>
              </div>

              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-bold uppercase text-[10px]">Executed Prior Actions</span>
                  <ProvenanceBadge type="DERIVED" />
                </div>
                <div className="text-xl font-bold text-slate-900">{priorExecutedCount} actions</div>
                <span className="text-[10px] text-slate-400 block">Excludes BLOCKED &amp; FAULT</span>
              </div>
            </div>

            <div className="p-3 rounded-lg border border-dashed border-slate-200 bg-slate-50/30 text-slate-400 text-[11px] space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold uppercase text-[10px]">Internal Ring-Buffer Pointer</span>
                <ProvenanceBadge type="UNAVAILABLE" />
              </div>
              <p className="text-[10px]">The Python process in-memory sliding window deque is ephemeral; history is reconstructed from SQLite audit records.</p>
            </div>
          </div>
        )}

        {/* ──────── STAGE M4 ──────── */}
        {stageId === 'M4' && (
          <div className="space-y-4">
            <p className="text-[11px] text-slate-500 font-sans leading-relaxed">
              <strong>M4 (Feature Extraction)</strong> calculates a 22-dimensional numerical vector summarizing transition velocities, destructive intensity, repetition patterns, and categorical ratios.
            </p>

            <div className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-800">Behavioral Feature Dimensions:</span>
                <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold text-[11px]">
                  {event.action_record?.features ? Object.keys(event.action_record.features).length : 0} of 22 Captured
                </span>
              </div>
              <ProvenanceBadge type="RECORDED" />
            </div>

            {event.action_record?.features && Object.keys(event.action_record.features).length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                {Object.entries(event.action_record.features).map(([name, val]) => {
                  const isTime = name.includes('time') || name.includes('latency');
                  const isCount = (name.includes('count') || name.includes('repeated') || name.includes('transitions')) && typeof val === 'number';
                  const isProb = typeof val === 'number' && (name.includes('prob') || name.includes('ratio') || (val >= 0 && val <= 1 && (name.includes('score') || name.includes('risk'))));
                  const displayVal = typeof val === 'number'
                    ? isTime
                      ? (val < 1 ? `${(val * 1000).toFixed(0)} ms` : `${val.toFixed(2)} s`)
                      : isProb
                        ? val.toFixed(4)
                        : Number.isInteger(val) ? `${val}` : val.toFixed(3)
                    : typeof val === 'object' && val !== null
                      ? Array.isArray(val)
                        ? val.join(', ')
                        : Object.entries(val).map(([k, v]) => `${k}: ${v}`).join(', ') || '{}'
                      : String(val ?? 'N/A');

                  return (
                    <div key={name} className="p-2 rounded bg-slate-50 border border-slate-200 flex justify-between items-center text-[11px]">
                      <span className="text-slate-600 truncate max-w-[200px]" title={name}>{name}</span>
                      <span className="font-bold text-slate-800 font-mono">
                        {displayVal} {isCount && <span className="text-[10px] text-slate-400 font-normal">(count)</span>}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-6 text-center text-slate-400 bg-slate-50 rounded-lg border border-slate-200 italic">
                No feature vector captured for this event.
              </div>
            )}

            <div className="p-3 rounded-lg border border-dashed border-slate-200 bg-slate-50/30 text-slate-400 text-[11px] space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold uppercase text-[10px]">StandardScaler Internal Baseline Constants</span>
                <ProvenanceBadge type="UNAVAILABLE" />
              </div>
              <p className="text-[10px]">Feature z-score mean and scale vectors are bundled inside `risk_model.joblib`; not exported over the REST API boundary.</p>
            </div>
          </div>
        )}

        {/* ──────── STAGE M5 ──────── */}
        {stageId === 'M5' && (
          <div className="space-y-4">
            <p className="text-[11px] text-slate-500 font-sans leading-relaxed">
              <strong>M5 (Behavioral Risk Engine)</strong> evaluates the 22-D feature vector through a Random Forest classifier.
              <strong className="text-blue-700 ml-1">Architectural Invariant:</strong> ML probability is an empirical risk signal, NOT the final binding verdict.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-bold uppercase text-[10px]">ML Probability P(unsafe)</span>
                  <ProvenanceBadge type="RECORDED" />
                </div>
                <div className="text-2xl font-bold text-slate-900">
                  {typeof event.action_record?.ml_probability === 'number'
                    ? (event.action_record.ml_probability * 100).toFixed(1) + '%'
                    : 'N/A (Policy Gate)'}
                </div>
                <span className="text-[10px] text-slate-400 block font-mono">
                  Continuous Model Signal: {typeof event.action_record?.ml_probability === 'number' ? event.action_record.ml_probability.toFixed(4) : 'N/A'} [0.0–1.0]
                </span>
              </div>

              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-bold uppercase text-[10px]">Risk Severity Tier</span>
                  <ProvenanceBadge type="RECORDED" />
                </div>
                <div className="text-2xl font-bold text-slate-900">
                  {event.action_record?.risk_severity ?? 'NONE'}
                </div>
                <span className="text-[10px] text-slate-400 block">Qualitative threshold partition tier</span>
              </div>

              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-bold uppercase text-[10px]">Composite Risk Score</span>
                  <ProvenanceBadge type="RECORDED" />
                </div>
                <div className="text-2xl font-bold text-slate-900">
                  {event.action_record?.risk_score !== undefined && event.action_record?.risk_score !== null
                    ? `${event.action_record.risk_score} / 4`
                    : 'N/A'}
                </div>
                <span className="text-[10px] text-slate-400 block">Discrete Severity Weight (NONE=0, LOW=1, MED=2, HIGH=3, CRIT=4)</span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-amber-50/60 border border-amber-200 text-amber-900 text-[11px] flex items-start gap-2">
              <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong>Developmental Calibration Note:</strong> Evaluated on internal development ATBench partitions (ROC-AUC 0.7813). 
                Threshold partitions (0.40 LOW, 0.55 MEDIUM, 0.70 HIGH, 0.85 CRITICAL) reflect internal sensitivity sweeps, not external held-out generalization.
              </div>
            </div>

            <div className="p-3 rounded-lg border border-dashed border-slate-200 bg-slate-50/30 text-slate-400 text-[11px] space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold uppercase text-[10px]">Feature Importance &amp; SHAP Attributions</span>
                <ProvenanceBadge type="UNAVAILABLE" />
              </div>
              <p className="text-[10px]">Tree-level SHAP values or individual feature contributions are not computed or exposed over the REST API boundary.</p>
            </div>
          </div>
        )}

        {/* ──────── STAGE M6 ──────── */}
        {stageId === 'M6' && (
          <div className="space-y-4">
            <p className="text-[11px] text-slate-500 font-sans leading-relaxed">
              <strong>M6 (Task-Context Authorization)</strong> deterministically checks whether requested actions fall within authorized capability boundaries.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-bold uppercase text-[10px]">Authorization Verdict</span>
                  <ProvenanceBadge type="RECORDED" />
                </div>
                <div className={cn(
                  "text-2xl font-bold uppercase",
                  event.action_record?.auth_status === 'AUTHORIZED' ? 'text-emerald-700' :
                  event.action_record?.auth_status === 'UNAUTHORIZED' ? 'text-rose-700' : 'text-amber-700'
                )}>
                  {event.action_record?.auth_status || 'UNEVALUABLE'}
                </div>
                <span className="text-[10px] text-slate-400 block">Deterministic task constraint evaluation</span>
              </div>

              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-bold uppercase text-[10px]">Active Task Context ID</span>
                  <ProvenanceBadge type="RECORDED" />
                </div>
                <div className="text-lg font-bold text-slate-900 truncate" title={event.task_id}>
                  {event.task_id || 'Global / Unspecified'}
                </div>
                <span className="text-[10px] text-slate-400 block">Session bound context</span>
              </div>
            </div>

            <div className="p-3 rounded-lg border border-dashed border-slate-200 bg-slate-50/30 text-slate-400 text-[11px] space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold uppercase text-[10px]">Raw Task Capability Definition Schemas</span>
                <ProvenanceBadge type="UNAVAILABLE" />
              </div>
              <p className="text-[10px]">`GET /tasks` serializes capability counts (`allowed_capability_count`), omitting raw rule JSON objects for boundary safety.</p>
            </div>
          </div>
        )}

        {/* ──────── STAGE M7 ──────── */}
        {stageId === 'M7' && (
          <div className="space-y-4">
            <p className="text-[11px] text-slate-500 font-sans leading-relaxed">
              <strong>M7 (Policy Fusion Engine)</strong> is the <strong className="text-slate-900">sole authoritative governance decision engine</strong>.
              It synthesizes M5 behavioral risk, M6 task authorization, and deterministic policy rules into the final binding verdict.
            </p>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Authoritative Binding Verdict</span>
                <div className="flex items-center gap-2">
                  <Badge 
                    variant={event.decision.toLowerCase() as any}
                    className="text-sm font-bold font-mono px-3 py-1 uppercase"
                  >
                    {event.decision}
                  </Badge>
                  <span className="text-[11px] text-slate-600 font-medium">
                    {event.decision === 'ALLOW' && 'Permitted under active policy rules'}
                    {event.decision === 'BLOCK' && 'Execution strictly prohibited by M7 governance gate'}
                    {event.decision === 'ALERT' && 'Permitted under heightened logging & monitoring'}
                  </span>
                </div>
              </div>
              <ProvenanceBadge type="RECORDED" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-bold uppercase text-[10px]">Matched Policy Rule</span>
                  <ProvenanceBadge type="RECORDED" />
                </div>
                <div className="font-bold text-slate-900 text-sm">
                  {event.action_record?.matched_policy_id || 'None (Baseline Decision Matrix)'}
                </div>
              </div>

              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-bold uppercase text-[10px]">Governance Reasons</span>
                  <ProvenanceBadge type="RECORDED" />
                </div>
                {event.action_record?.reasons && event.action_record.reasons.length > 0 ? (
                  <div className="space-y-1">
                    {event.action_record.reasons.map((r, i) => (
                      <div key={i} className="text-[11px]">
                        <span className="font-bold text-blue-600">[{r.rule_type}]</span> {r.description}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-slate-400 text-[11px] italic">Evaluated via deterministic baseline matrix.</div>
                )}
              </div>
            </div>

            <div className="p-3 rounded-lg border border-dashed border-slate-200 bg-slate-50/30 text-slate-400 text-[11px] space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold uppercase text-[10px]">Policy Condition Expression AST</span>
                <ProvenanceBadge type="UNAVAILABLE" />
              </div>
              <p className="text-[10px]">`GET /policies` omits condition expressions from REST responses to maintain boundary encapsulation.</p>
            </div>
          </div>
        )}

        {/* ──────── STAGE M8 ──────── */}
        {stageId === 'M8' && (
          <div className="space-y-4">
            <p className="text-[11px] text-slate-500 font-sans leading-relaxed">
              <strong>M8 (Runtime Interceptor)</strong> enforces the execution gate.
              <strong className="text-rose-700 ml-1">Architectural Invariant:</strong> A BLOCK decision guarantees zero callable invocations. An execution failure (FAULT) is an environment error, never a governance BLOCK.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-bold uppercase text-[10px]">Execution Outcome State</span>
                  <ProvenanceBadge type="RECORDED" />
                </div>
                <div className="flex items-center gap-2">
                  {isBlock && <XCircle className="h-5 w-5 text-rose-600" />}
                  {isFault && <AlertTriangle className="h-5 w-5 text-amber-600" />}
                  {isExecuted && <CheckCircle2 className="h-5 w-5 text-emerald-600" />}
                  <span className="text-lg font-bold text-slate-900">{event.execution_state}</span>
                </div>
              </div>

              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-bold uppercase text-[10px]">Protected Callable Invocations</span>
                  {hasEstablishedInvocations ? (
                    <ProvenanceBadge type="DERIVED" />
                  ) : (
                    <ProvenanceBadge type="UNAVAILABLE" />
                  )}
                </div>
                <div className="text-2xl font-bold text-slate-900 font-mono">
                  {callableInvocations !== null
                    ? `${callableInvocations} ${callableInvocations === 1 ? 'Invocation' : 'Invocations'}`
                    : 'UNAVAILABLE'}
                </div>
                <span className="text-[10px] text-slate-400 block">
                  {isBlock
                    ? 'Guaranteed 0 by M8 interceptor'
                    : isExecuted
                    ? 'Executed inside sandbox'
                    : isFault
                    ? 'Invocation attempted (failed with error)'
                    : 'Invocation state cannot be verified from telemetry'}
                </span>
              </div>
            </div>

            {event.error_message && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-rose-700 font-bold uppercase text-[10px]">Error Trace / Denial Rationale</span>
                  <ProvenanceBadge type="RECORDED" />
                </div>
                <pre className="text-xs font-mono text-rose-800 whitespace-pre-wrap">{event.error_message}</pre>
              </div>
            )}

            {event.execution_result && (
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-700 font-bold uppercase text-[10px]">Execution Result Payload</span>
                  <ProvenanceBadge type="RECORDED" />
                </div>
                <pre className="text-xs font-mono text-slate-800 whitespace-pre-wrap max-h-32 overflow-auto">{event.execution_result}</pre>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
});
