/**
 * SentinelCoreRadar.tsx — Phase 5C / Phase 6C Premium Redesign
 *
 * An interactive defense-in-depth 2D security perimeter radar visualizing
 * the AgentSentinel M1–M8 governance pipeline architecture.
 *
 * ARCHITECTURAL STAGES & GROUPINGS:
 *   - M1–M2: Ingestion & Action Normalization (raw tool capture, normalization)
 *   - M3–M5: Behavioral Sequence, Feature Extraction & Risk Assessment
 *   - M6: Task-Context Authorization (capability boundary verification)
 *   - M7: Authoritative Governance Decision (sole source of ALLOW / ALERT / BLOCK)
 *   - M8: Runtime Interception & Execution Outcome (enforcement, zero-call invariant)
 *
 * DATA SOURCES & DETERMINISTIC POSTURE DERIVATION:
 *   - MetricsResponse.decisions: { allow, alert, block } — aggregate M7 verdicts.
 *   - MetricsResponse.total_interceptions — total pipeline events.
 *   - SafeAuditEventResponse[] — individual correlated audit records with per-event
 *     M7 decision, M8 execution_state, M5 risk_score, and M2 action category.
 *
 * POSTURE DERIVATION RULES (deterministic, from aggregate M7 decisions):
 *   - "NOMINAL":  total_interceptions > 0 AND block === 0 AND alert === 0.
 *   - "ELEVATED": total_interceptions > 0 AND block === 0 AND alert > 0.
 *   - "CRITICAL": total_interceptions > 0 AND block > 0.
 *   - "AWAITING": total_interceptions === 0 OR metrics unavailable / unevaluable.
 *
 * NON-NEGOTIABLE INVARIANTS:
 *   - M7 remains the authoritative source of ALLOW / ALERT / BLOCK.
 *   - M5 risk score is a heuristic risk signal [0.0–1.0], NEVER a final decision.
 *   - M8 enforces decisions: under BLOCK, zero protected-callable invocations occur.
 *   - Zero events is honestly presented as "Awaiting Telemetry", never fabricated.
 *   - Read-only visualization: zero execution side-effects.
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldOff,
  AlertTriangle,
  Info,
  ChevronLeft,
  ChevronRight,
  Activity,
  Box,
  Radar,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { cn } from '../../utils/cn';
import type { MetricsDecisions, SafeAuditEventResponse } from '../../api/types';

// ─── Types ──────────────────────────────────────────────────────────────────

export type PostureLevel = 'NOMINAL' | 'ELEVATED' | 'CRITICAL' | 'AWAITING';

export interface PostureInfo {
  level: PostureLevel;
  label: string;
  description: string;
  coreColor: string;
  coreGlow: string;
  textColor: string;
  bgClass: string;
  borderClass: string;
  badgeClass: string;
  Icon: React.ElementType;
}

export interface PerimeterRing {
  id: string;
  label: string;
  stages: string;
  description: string;
  radiusFraction: number; // 0–1 fraction of outer radius
  strokeColor: string;
  fillColor: string;
  hoverStroke: string;
}

export interface SentinelCoreRadarProps {
  decisions?: MetricsDecisions;
  totalInterceptions?: number;
  auditEvents?: SafeAuditEventResponse[];
  selectedEventId?: string;
  onSelectEvent?: (eventId: string) => void;
  isLoading?: boolean;
  temporalScope?: 'all' | '24h' | '1h';
  onTemporalScopeChange?: (scope: 'all' | '24h' | '1h') => void;
  viewMode?: '2d' | '3d';
  onViewModeChange?: (mode: '2d' | '3d') => void;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const POSTURES: Record<PostureLevel, PostureInfo> = {
  NOMINAL: {
    level: 'NOMINAL',
    label: 'Nominal',
    description: 'All evaluated actions authorized. Zero blocks or alerts recorded.',
    coreColor: '#059669',
    coreGlow: '#10b981',
    textColor: 'text-emerald-400',
    bgClass: 'bg-emerald-950/40',
    borderClass: 'border-emerald-800/60',
    badgeClass: 'bg-emerald-950/80 text-emerald-400 border-emerald-700/60',
    Icon: ShieldCheck,
  },
  ELEVATED: {
    level: 'ELEVATED',
    label: 'Elevated',
    description: 'Alert-level actions detected. No blocks recorded. Heightened monitoring active.',
    coreColor: '#d97706',
    coreGlow: '#f59e0b',
    textColor: 'text-amber-400',
    bgClass: 'bg-amber-950/40',
    borderClass: 'border-amber-800/60',
    badgeClass: 'bg-amber-950/80 text-amber-400 border-amber-700/60',
    Icon: ShieldAlert,
  },
  CRITICAL: {
    level: 'CRITICAL',
    label: 'Critical',
    description: 'At least one action blocked by authoritative M7 governance. M8 enforcement prevented callable invocation.',
    coreColor: '#dc2626',
    coreGlow: '#ef4444',
    textColor: 'text-rose-400',
    bgClass: 'bg-rose-950/40',
    borderClass: 'border-rose-800/60',
    badgeClass: 'bg-rose-950/80 text-rose-400 border-rose-700/60',
    Icon: ShieldOff,
  },
  AWAITING: {
    level: 'AWAITING',
    label: 'Awaiting Telemetry',
    description: 'No runtime interceptions recorded or telemetry unavailable. Execute agent actions to populate pipeline telemetry.',
    coreColor: '#64748b',
    coreGlow: '#94a3b8',
    textColor: 'text-slate-400',
    bgClass: 'bg-slate-900/40',
    borderClass: 'border-slate-800',
    badgeClass: 'bg-slate-900 text-slate-400 border-slate-700',
    Icon: Shield,
  },
};

export const PERIMETER_RINGS: PerimeterRing[] = [
  {
    id: 'ring-m1m2',
    label: 'M1–M2',
    stages: 'Ingestion & Normalization',
    description:
      'Raw tool capture and semantic action normalization into structured parameters.',
    radiusFraction: 1.0,
    strokeColor: '#06b6d4',
    fillColor: 'rgba(6, 182, 212, 0.04)',
    hoverStroke: '#38bdf8',
  },
  {
    id: 'ring-m3m5',
    label: 'M3–M5',
    stages: 'Sequence & Risk Assessment',
    description:
      'Sequential behavior modeling, feature extraction, and ML risk assessment.',
    radiusFraction: 0.80,
    strokeColor: '#8b5cf6',
    fillColor: 'rgba(139, 92, 246, 0.05)',
    hoverStroke: '#a78bfa',
  },
  {
    id: 'ring-m6',
    label: 'M6',
    stages: 'Task-Context Authorization',
    description:
      'Verification of action category and resource scope against declared task boundaries.',
    radiusFraction: 0.60,
    strokeColor: '#0284c7',
    fillColor: 'rgba(2, 132, 199, 0.06)',
    hoverStroke: '#38bdf8',
  },
  {
    id: 'ring-m7',
    label: 'M7',
    stages: 'Authoritative Governance Decision',
    description:
      'Authoritative rule and policy evaluation engine. Sole source of ALLOW, ALERT, and BLOCK verdicts. Governs execution based on combined risk, authorization, and policy constraints.',
    radiusFraction: 0.42,
    strokeColor: '#f59e0b',
    fillColor: 'rgba(245, 158, 11, 0.08)',
    hoverStroke: '#fbbf24',
  },
  {
    id: 'ring-m8',
    label: 'M8',
    stages: 'Runtime Interception & Enforcement',
    description:
      'Runtime interception kernel. Enforces M7 decisions. A BLOCK decision strictly prevents protected callable invocation (zero calls). Guarantees zero protected-callable invocations on BLOCK. Permitted actions execute but can fail independently.',
    radiusFraction: 0.25,
    strokeColor: '#ef4444',
    fillColor: 'rgba(239, 68, 68, 0.12)',
    hoverStroke: '#f87171',
  },
];

// ─── Posture Derivation Function ─────────────────────────────────────────────

function derivePosture(
  decisions: MetricsDecisions | undefined,
  totalInterceptions: number | undefined
): PostureLevel {
  if (
    !decisions ||
    totalInterceptions === undefined ||
    totalInterceptions === 0 ||
    typeof totalInterceptions !== 'number' ||
    isNaN(totalInterceptions)
  ) {
    return 'AWAITING';
  }
  if ((decisions.block ?? 0) > 0) return 'CRITICAL';
  if ((decisions.alert ?? 0) > 0) return 'ELEVATED';
  return 'NOMINAL';
}

/** Compute recent category breakdown from audit events for the radar arc indicators */
function computeCategoryBreakdown(
  events?: SafeAuditEventResponse[]
): Array<{ category: string; count: number }> {
  if (!events || events.length === 0) return [];
  const counts: Record<string, number> = {};
  for (const e of events) {
    const cat = e.action?.category || 'UNKNOWN';
    counts[cat] = (counts[cat] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}

// ─── Component ──────────────────────────────────────────────────────────────

export const SentinelCoreRadar = React.memo(function SentinelCoreRadar({
  decisions,
  totalInterceptions,
  auditEvents,
  selectedEventId,
  onSelectEvent,
  isLoading,
  temporalScope = 'all',
  onTemporalScopeChange,
  viewMode = '2d',
  onViewModeChange,
}: SentinelCoreRadarProps) {
  const [focusedRing, setFocusedRing] = useState<string | null>(null);
  const [internalEventIndex, setInternalEventIndex] = useState<number>(0);

  const scopeLabel = useMemo(() => {
    if (temporalScope === '1h') return 'Last 1 Hour';
    if (temporalScope === '24h') return 'Last 24 Hours';
    return 'All-Time Cumulative';
  }, [temporalScope]);

  // Truthful Telemetry Freshness & Activity Status (derived from newest audit event)
  const freshnessInfo = useMemo(() => {
    if (!auditEvents || auditEvents.length === 0) {
      return {
        status: 'AWAITING',
        label: 'Awaiting Telemetry',
        description: 'Zero recorded telemetry events in active database.',
        badgeClass: 'bg-slate-900/80 text-slate-400 border-slate-700',
        isLive: false,
      };
    }
    const newest = auditEvents[0];
    if (!newest.timestamp) {
      return {
        status: 'UNAVAILABLE',
        label: 'Timestamp Unreported',
        description: 'Audit records present but timestamp field is absent.',
        badgeClass: 'bg-slate-900/80 text-slate-400 border-slate-700',
        isLive: false,
      };
    }
    const eventTime = new Date(newest.timestamp).getTime();
    if (isNaN(eventTime)) {
      return {
        status: 'UNAVAILABLE',
        label: 'Timestamp Invalid',
        description: 'Timestamp is not a valid ISO date string.',
        badgeClass: 'bg-slate-900/80 text-slate-400 border-slate-700',
        isLive: false,
      };
    }
    const ageSeconds = Math.max(0, Math.floor((Date.now() - eventTime) / 1000));
    if (ageSeconds < 300) {
      return {
        status: 'LIVE',
        label: 'Live Telemetry',
        description: `Active telemetry received ${ageSeconds}s ago.`,
        badgeClass: 'bg-emerald-950/80 text-emerald-400 border-emerald-700/60',
        isLive: true,
      };
    }
    const mins = Math.max(1, Math.floor(ageSeconds / 60));
    return {
      status: 'HISTORICAL',
      label: 'Idle Telemetry',
      description: `Idle Telemetry — ${mins}m ago`,
      badgeClass: 'bg-cyan-950/80 text-cyan-400 border-cyan-800/60',
      isLive: false,
    };
  }, [auditEvents]);

  // Deterministic Posture derivation
  const postureLevel = useMemo(
    () => derivePosture(decisions, totalInterceptions),
    [decisions, totalInterceptions]
  );
  const posture = POSTURES[postureLevel];
  const PostureIcon = posture.Icon;

  // Category breakdown for radar arcs
  const categoryBreakdown = useMemo(
    () => computeCategoryBreakdown(auditEvents),
    [auditEvents]
  );

  // Active correlated audit event
  const activeEvent = useMemo(() => {
    if (!auditEvents || auditEvents.length === 0) return null;
    if (selectedEventId) {
      return auditEvents.find((e) => e.interception_id === selectedEventId) || auditEvents[0];
    }
    return auditEvents[internalEventIndex] || auditEvents[0];
  }, [auditEvents, selectedEventId, internalEventIndex]);

  // Event pagination handlers
  const handlePrevEvent = useCallback(() => {
    if (!auditEvents || auditEvents.length === 0) return;
    setInternalEventIndex((prev) => {
      const next = Math.max(0, prev - 1);
      if (onSelectEvent && auditEvents[next]) {
        onSelectEvent(auditEvents[next].interception_id);
      }
      return next;
    });
  }, [auditEvents, onSelectEvent]);

  const handleNextEvent = useCallback(() => {
    if (!auditEvents || auditEvents.length === 0) return;
    setInternalEventIndex((prev) => {
      const next = Math.min(auditEvents.length - 1, prev + 1);
      if (onSelectEvent && auditEvents[next]) {
        onSelectEvent(auditEvents[next].interception_id);
      }
      return next;
    });
  }, [auditEvents, onSelectEvent]);

  // Ring interaction handler
  const handleRingSelect = useCallback((ringId: string) => {
    setFocusedRing((prev) => (prev === ringId ? null : ringId));
  }, []);

  // Event distribution percentages
  const eventDistribution = useMemo(() => {
    const total = totalInterceptions ?? 0;
    const allowCount = decisions?.allow ?? 0;
    const alertCount = decisions?.alert ?? 0;
    const blockCount = decisions?.block ?? 0;

    const allowPct = total > 0 ? ((allowCount / total) * 100).toFixed(1) : '0.0';
    const alertPct = total > 0 ? ((alertCount / total) * 100).toFixed(1) : '0.0';
    const blockPct = total > 0 ? ((blockCount / total) * 100).toFixed(1) : '0.0';

    return {
      allowCount,
      alertCount,
      blockCount,
      total,
      allowPct,
      alertPct,
      blockPct,
    };
  }, [decisions, totalInterceptions]);

  // SVG Geometry constants
  const svgSize = 440;
  const cx = svgSize / 2;
  const cy = svgSize / 2;
  const maxRadius = 185;

  return (
    <Card
      className="border-slate-800 shadow-2xl bg-[#070b16] text-slate-100 overflow-hidden"
      data-testid="sentinel-core-radar"
    >
      {/* ── Top Header Bar ── */}
      <CardHeader className="p-4 sm:p-5 border-b border-slate-800/80 bg-[#090e1c]/80 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 border border-cyan-500/40 flex items-center justify-center shrink-0 shadow-inner">
            <Radar className="h-5 w-5 text-cyan-400" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold font-mono text-white tracking-wide uppercase">
                Sentinel Core Radar — M1–M8 Defense Perimeter
              </h2>
              <span className="text-[10px] font-mono text-cyan-400 px-1.5 py-0.5 rounded bg-cyan-950/60 border border-cyan-800/50 shrink-0">
                2D SECURITY FIELD
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 font-sans">
              Top-down view of M1–M8 defense-in-depth architecture and live event distribution
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Temporal Scope Selector */}
          {onTemporalScopeChange && (
            <div
              className="inline-flex rounded-lg border border-slate-700 bg-slate-900/90 p-0.5 text-[11px] font-mono"
              role="group"
              aria-label="Temporal Scope Selector"
              data-testid="radar-temporal-scope"
            >
              {(['all', '24h', '1h'] as const).map((scope) => (
                <button
                  key={scope}
                  type="button"
                  onClick={() => onTemporalScopeChange(scope)}
                  className={cn(
                    'px-2.5 py-1 rounded text-[10px] font-semibold transition-all cursor-pointer',
                    temporalScope === scope
                      ? 'bg-indigo-600 text-white shadow-xs font-bold'
                      : 'text-slate-400 hover:text-white'
                  )}
                  data-testid={`scope-button-${scope}`}
                  aria-pressed={temporalScope === scope}
                >
                  {scope === 'all' ? 'All-Time' : scope === '24h' ? 'Last 24h' : 'Last 1h'}
                </button>
              ))}
            </div>
          )}

          {/* Visualization View Mode Toggle */}
          {onViewModeChange && (
            <div
              className="inline-flex rounded-lg border border-slate-700 bg-slate-900/90 p-0.5 text-[11px] font-mono"
              role="group"
              aria-label="Visualization Mode Selector"
            >
              <button
                type="button"
                onClick={() => onViewModeChange('2d')}
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-semibold transition-all cursor-pointer',
                  viewMode === '2d'
                    ? 'bg-indigo-600 text-white shadow-xs font-bold'
                    : 'text-slate-400 hover:text-white'
                )}
                data-testid="view-mode-2d-toggle"
                aria-pressed={viewMode === '2d'}
              >
                <Radar className="h-3 w-3" />
                <span>2D Map</span>
              </button>
              <button
                type="button"
                onClick={() => onViewModeChange('3d')}
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-semibold transition-all cursor-pointer',
                  viewMode === '3d'
                    ? 'bg-indigo-600 text-white shadow-xs font-bold'
                    : 'text-slate-400 hover:text-white'
                )}
                data-testid="view-mode-toggle"
                aria-pressed={viewMode === '3d'}
              >
                <Box className="h-3 w-3" />
                <span>3D View</span>
              </button>
            </div>
          )}

          {/* Freshness Badge */}
          <div
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono border',
              freshnessInfo.badgeClass
            )}
            data-testid="telemetry-freshness-badge"
            title={freshnessInfo.description}
          >
            {freshnessInfo.isLive ? (
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 motion-safe:animate-pulse" />
            ) : (
              <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
            )}
            <span>{freshnessInfo.label}</span>
            {freshnessInfo.status === 'HISTORICAL' && (
              <span className="text-slate-400 font-normal">({freshnessInfo.description.replace('Idle Telemetry — ', '')})</span>
            )}
          </div>

          {/* Posture Badge */}
          <Badge
            variant="outline"
            className={cn('text-[10px] font-mono uppercase font-bold tracking-wider px-2 py-0.5', posture.badgeClass)}
            data-testid="posture-badge"
          >
            {posture.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-6 space-y-6">
        {isLoading ? (
          <div className="h-[380px] flex flex-col items-center justify-center text-slate-500 gap-2">
            <div className="h-6 w-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-mono">Loading defense perimeter telemetry...</span>
          </div>
        ) : (
          <div className="space-y-6">
            {/* ── Main Layout: Stage Cards Column + SVG Radar Column + Side Panels ── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: 5 Stage Navigation Cards (Matching Reference Left Sidebar) */}
              <div className="lg:col-span-3 space-y-2">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase font-mono px-1">
                  <span>DEFENSE PERIMETERS</span>
                  <span className="text-[9px] text-slate-500">M1–M8</span>
                </div>

                <div className="space-y-1.5">
                  {PERIMETER_RINGS.map((ring) => {
                    const isFocused = focusedRing === ring.id;
                    return (
                      <button
                        key={ring.id}
                        type="button"
                        data-testid={`ring-legend-${ring.id}`}
                        onClick={() => handleRingSelect(ring.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleRingSelect(ring.id);
                          }
                        }}
                        className={cn(
                          'w-full text-left p-2.5 rounded-xl border text-[11px] font-mono transition-all cursor-pointer',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400',
                          isFocused
                            ? 'bg-slate-800/90 border-cyan-400 shadow-lg shadow-cyan-950/40 ring-1 ring-cyan-400/50'
                            : 'bg-slate-900/60 border-slate-800 hover:bg-slate-800/60 hover:border-slate-700'
                        )}
                        aria-label={`${ring.label}: ${ring.stages}. ${ring.description}`}
                        aria-pressed={isFocused}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className="h-6 w-6 rounded-lg flex items-center justify-center shrink-0 border"
                            style={{
                              borderColor: ring.strokeColor,
                              backgroundColor: `${ring.strokeColor}15`,
                            }}
                          >
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: ring.strokeColor }}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className={cn('font-bold', isFocused ? 'text-cyan-300' : 'text-slate-200')}>
                                {ring.label}
                              </span>
                              {ring.id === 'ring-m7' && (
                                <span className="text-[8px] px-1 py-0.2 rounded bg-amber-950 text-amber-400 border border-amber-800 font-mono">
                                  SOLE AUTHORITY
                                </span>
                              )}
                              {ring.id === 'ring-m8' && (
                                <span className="text-[8px] px-1 py-0.2 rounded bg-rose-950 text-rose-400 border border-rose-800 font-mono">
                                  KERNEL
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate mt-0.5">
                              {ring.stages}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Selected Stage Expanded Detail */}
                {focusedRing && (
                  <div
                    className="p-3 bg-slate-900/90 rounded-xl border border-cyan-500/40 text-xs text-slate-300 transition-all shadow-inner"
                    data-testid="selected-ring-detail"
                  >
                    {(() => {
                      const r = PERIMETER_RINGS.find((x) => x.id === focusedRing);
                      if (!r) return null;
                      return (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 font-mono font-bold text-cyan-300 text-xs">
                            <span
                              className="h-2 w-2 rounded-full shrink-0"
                              style={{ backgroundColor: r.strokeColor }}
                            />
                            <span>
                              {r.label}: {r.stages}
                            </span>
                          </div>
                          <p className="text-[11px] font-sans text-slate-300 leading-relaxed">
                            {r.description}
                          </p>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* Middle Column: Dark Cybernetic SVG Radar */}
              <div className="lg:col-span-5 flex flex-col items-center justify-center min-w-0">
                <div
                  className="relative mx-auto rounded-2xl p-2 bg-[#050811] border border-slate-800 shadow-2xl overflow-hidden max-w-[420px] w-full aspect-square flex items-center justify-center"
                >
                  <svg
                    viewBox={`0 0 ${svgSize} ${svgSize}`}
                    role="img"
                    aria-label={`Sentinel Core Perimeter Radar. Current posture: ${posture.label}. ${posture.description}`}
                    className="w-full h-full select-none"
                    data-testid="radar-svg"
                  >
                    <title>Sentinel Core Perimeter Radar — Posture: {posture.label}</title>
                    <desc>{posture.description}</desc>

                    {/* Defs for Glow Filters */}
                    <defs>
                      <filter id="cyanGlow" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="3" result="blur" />
                        <feMerge>
                          <feMergeNode in="blur" />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>
                      <filter id="coreHalo" x="-40%" y="-40%" width="180%" height="180%">
                        <feGaussianBlur stdDeviation="5" result="blur" />
                        <feMerge>
                          <feMergeNode in="blur" />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>
                      <radialGradient id="radarPlateGrad" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="#0c1428" stopOpacity="0.8" />
                        <stop offset="70%" stopColor="#070c18" stopOpacity="0.95" />
                        <stop offset="100%" stopColor="#04060d" stopOpacity="1" />
                      </radialGradient>
                    </defs>

                    {/* Background Circular Plate */}
                    <circle
                      cx={cx}
                      cy={cy}
                      r={maxRadius}
                      fill="url(#radarPlateGrad)"
                      stroke="#1e293b"
                      strokeWidth="1.5"
                    />

                    {/* Subtle Radial Coordinate Lines */}
                    {[0, 45, 90, 135].map((deg) => {
                      const rad = (deg * Math.PI) / 180;
                      const x1 = cx - maxRadius * Math.cos(rad);
                      const y1 = cy - maxRadius * Math.sin(rad);
                      const x2 = cx + maxRadius * Math.cos(rad);
                      const y2 = cy + maxRadius * Math.sin(rad);
                      return (
                        <line
                          key={`axis-${deg}`}
                          x1={x1}
                          y1={y1}
                          x2={x2}
                          y2={y2}
                          stroke="#1e293b"
                          strokeWidth="0.75"
                          strokeDasharray={deg % 90 === 0 ? 'none' : '3 3'}
                        />
                      );
                    })}

                    {/* Concentric Perimeter Rings (M1-M2 -> M3-M5 -> M6 -> M7 -> M8) */}
                    {PERIMETER_RINGS.map((ring) => {
                      const r = maxRadius * ring.radiusFraction;
                      const isFocused = focusedRing === ring.id;
                      return (
                        <g key={ring.id} data-testid={`svg-ring-group-${ring.id}`}>
                          {/* Inner glowing area */}
                          <circle
                            cx={cx}
                            cy={cy}
                            r={r}
                            fill={ring.fillColor}
                            stroke={isFocused ? '#ffffff' : ring.strokeColor}
                            strokeWidth={isFocused ? 2.5 : 1.2}
                            strokeDasharray={ring.radiusFraction === 1.0 ? '4 3' : 'none'}
                            className="cursor-pointer motion-safe:transition-all"
                            onClick={() => handleRingSelect(ring.id)}
                            role="button"
                            tabIndex={0}
                            aria-label={`Perimeter ring ${ring.label}: ${ring.stages}`}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                handleRingSelect(ring.id);
                              }
                            }}
                          />

                          {/* Floating Pill Label at Top of Ring */}
                          <g className="pointer-events-none select-none">
                            <rect
                              x={cx - 50}
                              y={cy - r - 8}
                              width={100}
                              height={16}
                              rx={8}
                              fill="rgba(7, 12, 26, 0.9)"
                              stroke={isFocused ? '#ffffff' : ring.strokeColor}
                              strokeWidth={1}
                            />
                            <text
                              x={cx}
                              y={cy - r + 3}
                              fontSize="8"
                              fontFamily="JetBrains Mono, monospace"
                              fontWeight="bold"
                              fill={isFocused ? '#ffffff' : ring.strokeColor}
                              textAnchor="middle"
                            >
                              {ring.label}
                            </text>
                          </g>
                        </g>
                      );
                    })}

                    {/* Category Arc Indicators (Telemetry dots on M1-M2 outer perimeter) */}
                    {postureLevel !== 'AWAITING' &&
                      categoryBreakdown.map((cat, i) => {
                        const total = categoryBreakdown.reduce((s, c) => s + c.count, 0);
                        const angle =
                          (i / Math.max(categoryBreakdown.length, 1)) * 2 * Math.PI - Math.PI / 2;
                        const indicatorR = maxRadius * 0.90;
                        const x = cx + indicatorR * Math.cos(angle);
                        const y = cy + indicatorR * Math.sin(angle);
                        const dotRadius = Math.max(3, Math.min(6, (cat.count / total) * 14));

                        return (
                          <g key={`cat-${cat.category}`}>
                            <circle
                              cx={x}
                              cy={y}
                              r={dotRadius}
                              fill={posture.coreGlow}
                              opacity={0.65}
                              className="motion-safe:transition-transform"
                            />
                            <title>
                              {cat.category}: {cat.count} actions
                            </title>
                          </g>
                        );
                      })}

                    {/* Compass Rose in Top-Right Corner */}
                    <g transform={`translate(${cx + maxRadius * 0.65}, ${cy - maxRadius * 0.65})`} className="pointer-events-none select-none">
                      <circle cx={0} cy={0} r={18} fill="none" stroke="#334155" strokeWidth="0.75" />
                      <line x1={0} y1={-22} x2={0} y2={22} stroke="#475569" strokeWidth="0.75" />
                      <line x1={-22} y1={0} x2={22} y2={0} stroke="#475569" strokeWidth="0.75" />
                      <text x={0} y={-24} fontSize="7" fontFamily="JetBrains Mono, monospace" fill="#94a3b8" textAnchor="middle">N</text>
                      <text x={26} y={2.5} fontSize="7" fontFamily="JetBrains Mono, monospace" fill="#64748b" textAnchor="start">E</text>
                      <text x={0} y={29} fontSize="7" fontFamily="JetBrains Mono, monospace" fill="#64748b" textAnchor="middle">S</text>
                      <text x={-26} y={2.5} fontSize="7" fontFamily="JetBrains Mono, monospace" fill="#64748b" textAnchor="end">W</text>
                    </g>

                    {/* Radar Sweep Line */}
                    {postureLevel !== 'AWAITING' && (
                      <g className="pointer-events-none" data-testid="radar-sweep-group">
                        <line
                          x1={cx}
                          y1={cy}
                          x2={cx + maxRadius}
                          y2={cy}
                          stroke={posture.coreGlow}
                          strokeWidth="1.5"
                          opacity="0.45"
                          className="animate-radar-sweep"
                          style={{ transformOrigin: `${cx}px ${cy}px` }}
                        />
                      </g>
                    )}

                    {/* Plotted Real Audit Event Markers along rings */}
                    {auditEvents &&
                      auditEvents.slice(0, 16).map((evt, idx) => {
                        const dec = evt.decision?.toUpperCase();
                        const color =
                          dec === 'ALLOW' ? '#10b981' : dec === 'ALERT' ? '#f59e0b' : '#ef4444';
                        
                        // Select appropriate ring radius fraction based on event state
                        const targetFraction =
                          dec === 'BLOCK'
                            ? 0.25 // M8
                            : dec === 'ALERT'
                            ? 0.42 // M7
                            : (evt.action_record?.risk_score ?? 0) > 0.4
                            ? 0.80 // M3-M5
                            : 0.60; // M6

                        const r = maxRadius * targetFraction;
                        const angle = (idx / 16) * 2 * Math.PI - Math.PI / 4;
                        const x = cx + r * Math.cos(angle);
                        const y = cy + r * Math.sin(angle);

                        return (
                          <g
                            key={`radar-marker-${evt.interception_id}-${idx}`}
                            className="cursor-pointer"
                            onClick={() => onSelectEvent?.(evt.interception_id)}
                          >
                            <circle
                              cx={x}
                              cy={y}
                              r={4.5}
                              fill={color}
                              stroke="#ffffff"
                              strokeWidth={1}
                              filter="url(#cyanGlow)"
                            />
                            <title>
                              {evt.interception_id} • {evt.decision} • {evt.execution_state}
                            </title>
                          </g>
                        );
                      })}

                    {/* Center Sentinel Core Hub (M8 Kernel) */}
                    <g
                      data-testid="radar-core-hub"
                      role="group"
                      aria-label={`Sentinel Core Hub. Posture: ${posture.label}`}
                    >
                      <circle
                        cx={cx}
                        cy={cy}
                        r={24}
                        fill={posture.coreColor}
                        opacity={0.15}
                        filter="url(#coreHalo)"
                      />
                      <circle
                        cx={cx}
                        cy={cy}
                        r={15}
                        fill={posture.coreColor}
                        opacity={0.35}
                      />
                      <circle
                        cx={cx}
                        cy={cy}
                        r={8}
                        fill={posture.coreColor}
                        className={cn(postureLevel !== 'AWAITING' && 'motion-safe:animate-pulse')}
                      />
                      {/* Inner mini shield icon mark */}
                      <path
                        d={`M ${cx} ${cy - 5} L ${cx + 4} ${cy - 3} L ${cx + 4} ${cy + 1} Q ${cx + 4} ${cy + 4} ${cx} ${cy + 6} Q ${cx - 4} ${cy + 4} ${cx - 4} ${cy + 1} L ${cx - 4} ${cy - 3} Z`}
                        fill="#ffffff"
                        opacity={0.9}
                      />
                    </g>
                  </svg>
                </div>
              </div>

              {/* Right Column: Event Distribution & Status Summary */}
              <div className="lg:col-span-4 space-y-4">
                {/* ── Posture Status Banner ── */}
                <div
                  className={cn(
                    'p-4 rounded-xl border flex items-start gap-3 text-xs shadow-md',
                    posture.bgClass,
                    posture.borderClass
                  )}
                  data-testid="posture-status-banner"
                >
                  <PostureIcon className={cn('h-5 w-5 shrink-0 mt-0.5', posture.textColor)} />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className={cn('font-bold font-mono uppercase text-xs tracking-wider', posture.textColor)}>
                        Governance Posture: {posture.label} ({scopeLabel})
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        {totalInterceptions !== undefined && totalInterceptions > 0
                          ? `${totalInterceptions} events evaluated`
                          : 'Zero events recorded'}
                      </span>
                    </div>
                    <p className="text-[11px] leading-relaxed mt-1 font-sans text-slate-300">
                      {posture.description}
                    </p>
                    <div className="mt-2 text-[10px] font-mono text-slate-400 border-t border-slate-800/80 pt-1.5 flex flex-wrap items-center justify-between gap-1">
                      <span>Scope: {scopeLabel} ({postureLevel === 'CRITICAL' ? `${decisions?.block ?? 0} BLOCKS recorded` : postureLevel === 'ELEVATED' ? `${decisions?.alert ?? 0} ALERTS recorded` : '0 Blocks / Alerts'})</span>
                      <span>Activity: {freshnessInfo.label}</span>
                    </div>
                  </div>
                </div>

                {/* ── Event Distribution Breakdown (Matching Reference Overlay) ── */}
                <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/70 font-mono text-xs space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-300 uppercase">
                    <span>EVENT DISTRIBUTION ({scopeLabel.toUpperCase()})</span>
                    <span className="text-cyan-400 font-bold">{eventDistribution.total} TOTAL</span>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between p-1.5 rounded bg-slate-950/60 border border-slate-800/80">
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">
                          ALLOW
                        </span>
                        <span className="text-slate-300">{eventDistribution.allowCount}</span>
                      </div>
                      <span className="text-emerald-400 font-bold">{eventDistribution.allowPct}%</span>
                    </div>

                    <div className="flex items-center justify-between p-1.5 rounded bg-slate-950/60 border border-slate-800/80">
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-950 text-amber-400 border border-amber-800">
                          ALERT
                        </span>
                        <span className="text-slate-300">{eventDistribution.alertCount}</span>
                      </div>
                      <span className="text-amber-400 font-bold">{eventDistribution.alertPct}%</span>
                    </div>

                    <div className="flex items-center justify-between p-1.5 rounded bg-slate-950/60 border border-slate-800/80">
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-950 text-rose-400 border border-rose-800">
                          BLOCK
                        </span>
                        <span className="text-slate-300">{eventDistribution.blockCount}</span>
                      </div>
                      <span className="text-rose-400 font-bold">{eventDistribution.blockPct}%</span>
                    </div>
                  </div>
                </div>

                {/* ── M7 Aggregate Decision Summary Cards ── */}
                {postureLevel !== 'AWAITING' && decisions && (
                  <div
                    className="grid grid-cols-3 gap-2 text-center font-mono text-xs"
                    data-testid="radar-decision-summary"
                  >
                    <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-800/60 shadow-xs">
                      <span className="text-[9px] text-emerald-400 block font-bold uppercase tracking-wider">
                        ALLOW (M7)
                      </span>
                      <span className="text-base font-extrabold text-emerald-300 mt-0.5 block">
                        {decisions.allow ?? 0}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-800/60 shadow-xs">
                      <span className="text-[9px] text-amber-400 block font-bold uppercase tracking-wider">
                        ALERT (M7)
                      </span>
                      <span className="text-base font-extrabold text-amber-300 mt-0.5 block">
                        {decisions.alert ?? 0}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-800/60 shadow-xs">
                      <span className="text-[9px] text-rose-400 block font-bold uppercase tracking-wider">
                        BLOCK (M7)
                      </span>
                      <span className="text-base font-extrabold text-rose-300 mt-0.5 block">
                        {decisions.block ?? 0}
                      </span>
                    </div>
                  </div>
                )}

                {/* ── Status Legend (Matching Reference Overlay) ── */}
                <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/60 flex items-center justify-between text-[11px] font-mono text-slate-300">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    <span>ALLOW</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-amber-400" />
                    <span>ALERT</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-rose-400" />
                    <span>BLOCK</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-cyan-400" />
                    <span>Event Trace</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Correlated Evidence & Architectural Invariants Section ── */}
            <div className="pt-4 border-t border-slate-800 space-y-3">
              {/* BLOCK Architectural Invariant Callout */}
              <div
                className={cn(
                  'p-3.5 rounded-xl border text-xs',
                  (decisions?.block ?? 0) > 0
                    ? 'bg-rose-950/30 border-rose-800/60'
                    : 'bg-slate-900/40 border-slate-800'
                )}
                data-testid="block-invariant-banner"
              >
                <div className="flex items-start gap-2.5">
                  <AlertTriangle
                    className={cn(
                      'h-4 w-4 shrink-0 mt-0.5',
                      (decisions?.block ?? 0) > 0 ? 'text-rose-400' : 'text-slate-500'
                    )}
                  />
                  <div>
                    <span
                      className={cn(
                        'font-bold font-mono uppercase text-[11px] tracking-wider block',
                        (decisions?.block ?? 0) > 0 ? 'text-rose-300' : 'text-slate-300'
                      )}
                    >
                      Architectural Invariant: Zero Protected-Callable Invocations on BLOCK
                    </span>
                    <p
                      className={cn(
                        'text-[11px] mt-0.5 font-sans leading-relaxed',
                        (decisions?.block ?? 0) > 0 ? 'text-rose-200/90' : 'text-slate-400'
                      )}
                    >
                      A BLOCK decision issued by M7 guarantees zero execution invocations of the protected tool
                      in M8. This is enforced exclusively by the backend runtime interceptor, not by this
                      frontend visualization.
                      {(decisions?.block ?? 0) > 0
                        ? ` Currently, ${decisions!.block} recorded event${(decisions!.block ?? 0) === 1 ? '' : 's'} met this enforcement invariant.`
                        : ' No blocked invocations recorded in active telemetry.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Correlated Event Inspector (when audit events exist) */}
              {activeEvent && (
                <div
                  className="p-3.5 rounded-xl border border-indigo-900/60 bg-indigo-950/20 text-xs space-y-2.5"
                  data-testid="correlated-event-inspector"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-indigo-900/50 pb-2">
                    <div className="flex items-center gap-2">
                      <Activity className="h-3.5 w-3.5 text-cyan-400" />
                      <span className="font-bold font-mono text-[11px] text-cyan-300">
                        Correlated Telemetry Trace: {activeEvent.interception_id}
                      </span>
                    </div>

                    {/* Pagination / navigation between audit events */}
                    {auditEvents && auditEvents.length > 1 && (
                      <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400">
                        <div className="sr-only" aria-live="polite" aria-atomic="true">
                          Showing audit event {internalEventIndex + 1} of {auditEvents.length}: Interception {activeEvent.interception_id}, Decision {activeEvent.decision}, Execution {activeEvent.execution_state}
                        </div>
                        <span>
                          Event {internalEventIndex + 1} of {auditEvents.length}
                        </span>
                        <div className="flex items-center gap-0.5">
                          <button
                            type="button"
                            onClick={handlePrevEvent}
                            disabled={internalEventIndex <= 0}
                            className="p-1 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                            aria-label="Previous audit event"
                          >
                            <ChevronLeft className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={handleNextEvent}
                            disabled={internalEventIndex >= auditEvents.length - 1}
                            className="p-1 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                            aria-label="Next audit event"
                          >
                            <ChevronRight className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 5-Stage Correlated Proof Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] font-mono">
                    <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                      <span className="text-slate-500 block text-[9px] uppercase font-bold">M1–M2 ACTION</span>
                      <span className="font-bold text-slate-200 truncate block">
                        {activeEvent.tool_name || activeEvent.action?.normalized_name || 'N/A'}
                      </span>
                      <span className="text-[9px] text-slate-400">
                        Cat: {activeEvent.action?.category || 'UNKNOWN'}
                      </span>
                    </div>

                    <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                      <span className="text-slate-500 block text-[9px] uppercase font-bold">M5 RISK SCORE</span>
                      <span className="font-bold text-cyan-400 block text-xs">
                        {activeEvent.action_record?.risk_score !== undefined
                          ? Number(activeEvent.action_record.risk_score).toFixed(3)
                          : 'N/A'}
                      </span>
                      <span className="text-[8px] text-slate-400 block">
                        Heuristic (Not Decision)
                      </span>
                    </div>

                    <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                      <span className="text-slate-500 block text-[9px] uppercase font-bold">M7 VERDICT</span>
                      <span
                        className={cn(
                          'font-bold block text-xs',
                          activeEvent.decision === 'ALLOW' && 'text-emerald-400',
                          activeEvent.decision === 'ALERT' && 'text-amber-400',
                          activeEvent.decision === 'BLOCK' && 'text-rose-400'
                        )}
                      >
                        {activeEvent.decision || 'UNKNOWN'}
                      </span>
                      <span className="text-[8px] text-slate-400 block truncate">
                        {activeEvent.action_record?.matched_policy_id || 'Default Policy'}
                      </span>
                    </div>

                    <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                      <span className="text-slate-500 block text-[9px] uppercase font-bold">M8 OUTCOME</span>
                      <span
                        className={cn(
                          'font-bold block text-[10px] truncate',
                          activeEvent.execution_state === 'EXECUTED' && 'text-emerald-400',
                          activeEvent.execution_state === 'BLOCKED_BY_POLICY' && 'text-rose-400',
                          activeEvent.execution_state === 'EXECUTION_FAILED' && 'text-amber-400'
                        )}
                      >
                        {activeEvent.execution_state || 'UNREPORTED'}
                      </span>
                      <span className="text-[8px] text-slate-400 block truncate">
                        Enforcement Status
                      </span>
                    </div>
                  </div>

                  {/* Stage M7 vs M8 Specific Correlation Explanation */}
                  <div className="text-[10px] text-slate-300 bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 font-sans">
                    {activeEvent.decision === 'BLOCK' && (
                      <span className="text-rose-300 font-medium">
                        <strong>Correlated Enforcement Proof:</strong> Event {activeEvent.interception_id} received authoritative M7 BLOCK verdict. Backend runtime recorded execution_state='{activeEvent.execution_state}'. Zero protected-callable invocations occurred.
                      </span>
                    )}
                    {activeEvent.decision === 'ALLOW' && activeEvent.execution_state === 'EXECUTION_FAILED' && (
                      <span className="text-amber-300 font-medium">
                        <strong>Decision vs Execution Outcome:</strong> M7 authorized this action (ALLOW), but runtime execution in M8 recorded failure ({activeEvent.execution_state}). Illustrates that governance authorization is distinct from operational execution outcome.
                      </span>
                    )}
                    {activeEvent.decision === 'ALLOW' && activeEvent.execution_state === 'EXECUTED' && (
                      <span className="text-emerald-300">
                        <strong>Authorized & Executed:</strong> M7 authorized action (ALLOW); M8 successfully permitted and executed the protected callable.
                      </span>
                    )}
                    {activeEvent.decision === 'ALERT' && (
                      <span className="text-amber-300">
                        <strong>Alert & Executed:</strong> M7 generated ALERT signal; action was logged for audit and permitted to execute in M8.
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ── Footer Provenance ── */}
            <div className="pt-2 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between text-[10px] font-mono text-slate-400 gap-1">
              <div className="flex items-center gap-1.5">
                <Info className="h-3 w-3 shrink-0 text-cyan-400" />
                <span>Provenance: M9 Telemetry aggregate decisions + correlated M8 execution audit records [{scopeLabel}]</span>
              </div>
              <div className="flex items-center gap-2">
                <span>Stream: {freshnessInfo.label}</span>
                <span>•</span>
                {postureLevel === 'AWAITING' ? (
                  <span className="text-amber-400 font-medium">Status: Awaiting runtime telemetry</span>
                ) : (
                  <span>Status: Deterministic derivation active</span>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
});
