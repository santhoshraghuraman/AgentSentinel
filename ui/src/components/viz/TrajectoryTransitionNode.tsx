/**
 * TrajectoryTransitionNode — atomic node component for SecurityTrajectoryMap.
 *
 * Renders a single intercepted action step as a clickable, keyboard-accessible
 * styled box with:
 *  - Step sequence number
 *  - Tool name (tool_name from audit event — OBSERVED fact)
 *  - Action category (normalized by M2 — INFERRED classification)
 *  - Authoritative M7 decision badge (ALLOW/ALERT/BLOCK — DECIDED)
 *  - Execution outcome badge (EXECUTED/BLOCKED/EXECUTION_FAILED — OBSERVED)
 *  - Mutating / Destructive flags (M2 inference flags)
 *
 * Does NOT display any predicted future state or fabricated risk values.
 */

import React, { useCallback } from 'react';
import { cn } from '../../utils/cn';
import { formatTransitionDelta } from '../../utils/datetime';

export interface AuditEventLike {
  interception_id: string;
  sequence_number: number;
  timestamp: string;
  tool_name?: string;
  decision: string;
  execution_state: string;
  action?: {
    normalized_name?: string;
    category?: string;
    is_mutating?: boolean;
    is_destructive?: boolean;
    resource?: string;
  };
  action_record?: {
    risk_score?: number;
    ml_probability?: number;
    auth_status?: string;
    matched_policy_id?: string;
    reasons?: Array<{ description: string; matched_policy_id?: string }>;
  };
  error_message?: string;
}

interface TrajectoryTransitionNodeProps {
  evt: AuditEventLike;
  isSelected: boolean;
  onSelect: (id: string) => void;
  /** Incoming delta seconds from previous step. null = first step or unknown. */
  deltaSeconds: number | null;
  /** Visual position index for layout (0-based) */
  index: number;
  /** Whether this is the last node in the sequence (no outgoing edge) */
  isLast: boolean;
}

const DECISION_CONFIG = {
  ALLOW: {
    border: 'border-emerald-300',
    bg: 'bg-emerald-50',
    nodeDot: 'bg-emerald-500',
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    selectedRing: 'ring-emerald-400',
    edgeColor: '#10b981',
  },
  ALERT: {
    border: 'border-amber-300',
    bg: 'bg-amber-50',
    nodeDot: 'bg-amber-500',
    badge: 'bg-amber-100 text-amber-800 border-amber-300',
    selectedRing: 'ring-amber-400',
    edgeColor: '#f59e0b',
  },
  BLOCK: {
    border: 'border-rose-400',
    bg: 'bg-rose-50',
    nodeDot: 'bg-rose-600',
    badge: 'bg-rose-100 text-rose-800 border-rose-300',
    selectedRing: 'ring-rose-400',
    edgeColor: '#e11d48',
  },
} as const;

type DecisionKey = keyof typeof DECISION_CONFIG;

function getDecisionConfig(decision: string) {
  const key = decision.toUpperCase() as DecisionKey;
  return DECISION_CONFIG[key] ?? DECISION_CONFIG['ALLOW'];
}

function getExecStateBadge(state: string): { label: string; cls: string } {
  const s = state.toUpperCase();
  if (s === 'BLOCKED') return { label: 'BLOCKED', cls: 'bg-rose-100 text-rose-800 border border-rose-300' };
  if (s === 'EXECUTION_FAILED') return { label: 'FAULT', cls: 'bg-orange-100 text-orange-800 border border-orange-300' };
  if (s === 'EXECUTED') return { label: 'EXECUTED', cls: 'bg-slate-100 text-slate-700 border border-slate-200' };
  return { label: state, cls: 'bg-slate-100 text-slate-600 border border-slate-200' };
}

function getCategoryAbbr(category?: string): string {
  if (!category) return 'SYS';
  const c = category.toUpperCase();
  if (c.includes('FILE')) return 'FS';
  if (c.includes('NET')) return 'NET';
  if (c.includes('PROC')) return 'PROC';
  if (c.includes('DB') || c.includes('DATA')) return 'DB';
  if (c.includes('CODE') || c.includes('EXEC')) return 'EXEC';
  return c.slice(0, 4);
}

export const TrajectoryTransitionNode = React.memo(function TrajectoryTransitionNode({
  evt,
  isSelected,
  onSelect,
  deltaSeconds,
  isLast,
}: TrajectoryTransitionNodeProps) {
  const cfg = getDecisionConfig(evt.decision);
  const execBadge = getExecStateBadge(evt.execution_state);
  const categoryAbbr = getCategoryAbbr(evt.action?.category);
  const isBlock = evt.decision.toUpperCase() === 'BLOCK';
  const isAlert = evt.decision.toUpperCase() === 'ALERT';
  const isMutating = evt.action?.is_mutating ?? false;
  const isDestructive = evt.action?.is_destructive ?? false;

  const handleClick = useCallback(() => {
    onSelect(evt.interception_id);
  }, [onSelect, evt.interception_id]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onSelect(evt.interception_id);
      }
    },
    [onSelect, evt.interception_id]
  );

  const deltaLabel = formatTransitionDelta(deltaSeconds);

  return (
    <div className="flex flex-col items-center">
      {/* Transition edge from previous node */}
      {deltaLabel !== null && (
        <div className="flex flex-col items-center gap-0 py-1" aria-hidden="true">
          <div className="w-0.5 h-3" style={{ backgroundColor: cfg.edgeColor }} />
          <span className="text-[9px] font-mono text-slate-400 bg-white border border-slate-200 rounded px-1 leading-4 whitespace-nowrap">
            {deltaLabel}
          </span>
          <div className="w-0.5 h-3" style={{ backgroundColor: cfg.edgeColor }} />
        </div>
      )}

      {/* Node card */}
      <div
        role="option"
        tabIndex={0}
        aria-selected={isSelected}
        aria-label={`Step ${evt.sequence_number}: ${evt.tool_name || 'unknown tool'}, Decision: ${evt.decision}, Execution: ${evt.execution_state}`}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={cn(
          'relative w-full rounded-xl border-2 p-3 cursor-pointer select-none',
          'motion-safe:transition-all focus:outline-none focus-visible:ring-2',
          cfg.border,
          cfg.bg,
          isSelected
            ? `ring-2 ${cfg.selectedRing} shadow-md`
            : 'hover:shadow-sm',
        )}
      >
        {/* Header row: step number + category + decision */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">
            STEP {String(evt.sequence_number).padStart(2, '0')}
          </span>
          <div className="flex items-center gap-1">
            <span
              className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 uppercase"
              title={`Action Category: ${evt.action?.category || 'unknown'} (M2 inference)`}
            >
              {categoryAbbr}
            </span>
            <span
              className={cn(
                'text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider',
                cfg.badge
              )}
            >
              {evt.decision.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Tool name (OBSERVED) */}
        <div className="mb-1">
          <span className="text-sm font-bold font-mono text-slate-900 break-all leading-tight">
            {evt.tool_name || evt.action?.normalized_name || 'unknown_tool'}
          </span>
        </div>

        {/* Normalized semantic name (M2 INFERRED), only if different from tool_name */}
        {evt.action?.normalized_name && evt.action.normalized_name !== evt.tool_name && (
          <div className="mb-1">
            <span className="text-[10px] font-mono text-slate-400 italic">
              {evt.action.normalized_name}
            </span>
          </div>
        )}

        {/* Execution state + mutation flags */}
        <div className="flex flex-wrap items-center gap-1 mt-1.5">
          <span className={cn('text-[9px] font-mono px-1.5 py-0.5 rounded uppercase tracking-wider', execBadge.cls)}>
            {execBadge.label}
          </span>
          {isMutating && !isDestructive && (
            <span
              className="text-[9px] font-mono px-1 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 uppercase"
              title="Mutating action — modifies state (M2 inference)"
            >
              MUT
            </span>
          )}
          {isDestructive && (
            <span
              className="text-[9px] font-mono px-1 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 uppercase"
              title="Destructive action — irreversible deletion (M2 inference)"
            >
              DESTR
            </span>
          )}
        </div>

        {/* Invariant violation reason (BLOCK or ALERT) */}
        {(isBlock || isAlert) && evt.action_record?.reasons && evt.action_record.reasons.length > 0 && (
          <div className="mt-2 pt-2 border-t border-slate-200/60 text-[10px] font-mono text-rose-700 leading-snug">
            {evt.action_record.reasons[0].description}
          </div>
        )}

        {/* Selected indicator */}
        {isSelected && (
          <div
            className={cn('absolute top-2 left-2 h-2 w-2 rounded-full', cfg.nodeDot)}
            aria-hidden="true"
          />
        )}
      </div>

      {/* Tail edge connector (no delta label, just a short line before next node) */}
      {!isLast && deltaLabel === null && (
        <div className="flex flex-col items-center" aria-hidden="true">
          <div className="w-0.5 h-4" style={{ backgroundColor: cfg.edgeColor }} />
        </div>
      )}
    </div>
  );
});
