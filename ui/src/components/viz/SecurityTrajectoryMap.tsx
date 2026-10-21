/**
 * SecurityTrajectoryMap — interactive Security Trajectory Map (Phase 4C).
 *
 * Renders a vertically-scrollable sequential node-and-edge map of an agent's
 * runtime interception trajectory. Each node represents one intercepted tool
 * call, with:
 *  - Directed edges between chronological steps (with actual Δt from timestamps)
 *  - M7 governance decision coloring (ALLOW / ALERT / BLOCK)
 *  - M2 normalized action semantics (category, mutation flags)
 *  - M8 execution outcome (EXECUTED / EXECUTION_FAILED / BLOCKED)
 *
 * Three-tier provenance model (displayed in legend):
 *  - OBSERVED: timestamps, tool_name, arguments, execution_result
 *  - DECIDED: M7 decision, matched policy, authorization verdict
 *  - INFERRED: M2 category/flags, M5 ML probability, M4 feature vector
 *
 * Constraints:
 *  - No new npm dependencies. Uses React + TypeScript + Tailwind CSS only.
 *  - All data sourced from SafeAuditEventResponse via GET /api/v1/audit/{session_id}.
 *  - Never fabricates events, scores, or decisions.
 *  - Transition delta seconds calculated from actual timestamps only.
 *    Returns null if either timestamp is invalid or missing.
 *  - Does not predict future agent behavior.
 */

import React, { useMemo } from 'react';
import { Network, AlertTriangle, Info } from 'lucide-react';
import { TrajectoryTransitionNode } from './TrajectoryTransitionNode';
import type { AuditEventLike } from './TrajectoryTransitionNode';
import { parseUtcDate } from '../../utils/datetime';
import { cn } from '../../utils/cn';

interface SecurityTrajectoryMapProps {
  events: AuditEventLike[];
  selectedEventId: string | null;
  onSelectEvent: (id: string) => void;
  className?: string;
}

/**
 * Compute delta seconds between two consecutive events using their timestamps.
 * Returns null if either timestamp is missing or unparseable.
 */
function computeDelta(prev: AuditEventLike, curr: AuditEventLike): number | null {
  try {
    const prevDate = parseUtcDate(prev.timestamp);
    const currDate = parseUtcDate(curr.timestamp);
    if (isNaN(prevDate.getTime()) || isNaN(currDate.getTime())) return null;
    const delta = (currDate.getTime() - prevDate.getTime()) / 1000;
    // Negative delta means clock skew or bad data — report unavailable
    if (delta < 0) return null;
    return delta;
  } catch {
    return null;
  }
}

/** Classify the overall trajectory security posture from event decisions */
function classifyPosture(events: AuditEventLike[]): {
  label: string;
  cls: string;
  description: string;
} {
  const hasBlock = events.some(e => e.decision.toUpperCase() === 'BLOCK');
  const hasAlert = events.some(e => e.decision.toUpperCase() === 'ALERT');
  const hasFault = events.some(e => e.execution_state.toUpperCase() === 'EXECUTION_FAILED');

  if (hasBlock) {
    return {
      label: 'THREAT NEUTRALIZED',
      cls: 'bg-rose-50 text-rose-700 border-rose-200',
      description: 'At least one action was blocked by M8 enforcement. The callable was never invoked for blocked steps.',
    };
  }
  if (hasAlert) {
    return {
      label: 'MONITORED',
      cls: 'bg-amber-50 text-amber-700 border-amber-200',
      description: 'At least one action triggered an alert. Execution proceeded under elevated monitoring.',
    };
  }
  if (hasFault) {
    return {
      label: 'FAULT ENCOUNTERED',
      cls: 'bg-orange-50 text-orange-800 border-orange-200',
      description: 'All actions were authorized. One or more actions failed during sandbox execution (governance was not violated).',
    };
  }
  return {
    label: 'NOMINAL',
    cls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    description: 'All actions were authorized and executed successfully.',
  };
}

export const SecurityTrajectoryMap = React.memo(function SecurityTrajectoryMap({
  events,
  selectedEventId,
  onSelectEvent,
  className,
}: SecurityTrajectoryMapProps) {
  // Compute per-step deltas from actual timestamps
  const deltas = useMemo<Array<number | null>>(() => {
    return events.map((evt, i) => {
      if (i === 0) return null; // First step: no predecessor
      return computeDelta(events[i - 1], evt);
    });
  }, [events]);

  const posture = useMemo(() => classifyPosture(events), [events]);

  if (events.length === 0) {
    return (
      <div className={cn('flex flex-col items-center justify-center py-16 text-center', className)}>
        <Network className="h-10 w-10 text-slate-300 mb-3" />
        <p className="text-sm font-mono text-slate-400">No events to map</p>
        <p className="text-xs text-slate-300 mt-1">Select a session to view its trajectory</p>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {/* Map header: posture summary + evidence provenance legend */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
        {/* Posture badge */}
        <div className={cn('flex-shrink-0 px-3 py-2 rounded-lg border text-xs font-mono font-bold uppercase tracking-wider', posture.cls)}>
          {posture.label}
        </div>
        {/* Posture description */}
        <p className="text-xs text-slate-500 font-mono leading-relaxed pt-0.5 flex-1">
          {posture.description}
        </p>
      </div>

      {/* Three-tier provenance legend */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
        <div className="flex items-center gap-1.5 mb-1.5">
          <Info className="h-3 w-3 text-slate-400" />
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">
            Evidence Classification
          </span>
        </div>
        <div className="flex flex-wrap gap-3 text-[10px] font-mono text-slate-500">
          <span>
            <span className="inline-block w-2 h-2 rounded-full bg-blue-500 mr-1 align-middle" />
            <strong className="text-slate-700">OBSERVED</strong> — timestamps, tool name, arguments, execution result
          </span>
          <span>
            <span className="inline-block w-2 h-2 rounded-full bg-violet-500 mr-1 align-middle" />
            <strong className="text-slate-700">DECIDED</strong> — M7 decision, matched policy, M6 auth verdict
          </span>
          <span>
            <span className="inline-block w-2 h-2 rounded-full bg-amber-500 mr-1 align-middle" />
            <strong className="text-slate-700">INFERRED</strong> — M2 category, mutation flags, M5 ML probability
          </span>
        </div>
        <div className="mt-1.5 text-[10px] font-mono text-slate-400 flex items-center gap-1">
          <AlertTriangle className="h-3 w-3 text-amber-400 flex-shrink-0" />
          ML probability is risk evidence only. Authoritative outcome is the M7 governance decision.
        </div>
      </div>

      {/* Sequential node graph */}
      <div
        role="listbox"
        aria-label="Security Trajectory Map — sequential intercepted actions"
        className="flex flex-col items-stretch"
      >
        {events.map((evt, i) => (
          <div key={evt.interception_id}>
            <TrajectoryTransitionNode
              evt={evt}
              isSelected={evt.interception_id === selectedEventId}
              onSelect={onSelectEvent}
              deltaSeconds={deltas[i]}
              index={i}
              isLast={i === events.length - 1}
            />
          </div>
        ))}
      </div>

      {/* Summary footer */}
      <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-4 text-[10px] font-mono text-slate-400">
        <span>
          Total Steps: <strong className="text-slate-700">{events.length}</strong>
        </span>
        <span>
          Allow: <strong className="text-emerald-700">
            {events.filter(e => e.decision.toUpperCase() === 'ALLOW').length}
          </strong>
        </span>
        <span>
          Alert: <strong className="text-amber-700">
            {events.filter(e => e.decision.toUpperCase() === 'ALERT').length}
          </strong>
        </span>
        <span>
          Block: <strong className="text-rose-700">
            {events.filter(e => e.decision.toUpperCase() === 'BLOCK').length}
          </strong>
        </span>
        <span>
          Δt coverage: <strong className="text-slate-700">
            {deltas.filter((d, i) => i > 0 && d !== null).length}/{Math.max(0, events.length - 1)} transitions
          </strong>
        </span>
      </div>
    </div>
  );
});
