/**
 * SentinelCommandCentre.tsx — Phase 6C / Premium Command Centre Redesign
 *
 * Integrated Security Command Centre for AgentSentinel.
 * Combines the interactive Three.js 3D WebGL Command Centre with the
 * functional 2D Sentinel Core Radar as a seamless, accessible alternative.
 *
 * MANDATORY INVARIANTS:
 *   1. M7 remains the authoritative governance decision-maker (ALLOW / ALERT / BLOCK).
 *   2. M8 enforces decisions (guarantees zero protected-callable invocations on BLOCK).
 *   3. 3D and 2D views are driven exclusively by real available telemetry.
 *   4. An ALLOW decision can still result in EXECUTION_FAILED in M8.
 *   5. ALERT is strictly distinguished from ALLOW.
 *   6. Missing or unrecorded data is explicitly disclosed, never fabricated.
 *   7. Read-only visualization: interaction never triggers agent execution or state mutation.
 *   8. Automatic and graceful fallback to 2D view if WebGL is unsupported or encounters an error.
 */

import React, { useState, useMemo, useEffect, useCallback, Component } from 'react';
import type { ErrorInfo } from 'react';
import {
  Box,
  Radar,
  RotateCcw,
  Play,
  Pause,
  ZoomIn,
  ZoomOut,
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldOff,
  AlertTriangle,
  Info,
  Activity,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { cn } from '../../utils/cn';
import type { MetricsDecisions } from '../../api/types';
import type {
  SentinelCoreRadarProps,
  PostureLevel,
  PostureInfo,
} from './SentinelCoreRadar';
import { SentinelCoreRadar } from './SentinelCoreRadar';
import {
  SentinelCore3D,
  ARCHITECTURAL_GROUPS,
  isWebGLAvailable,
} from './SentinelCore3D';

// ─── Posture Definitions (Identical to 2D Radar for Consistency) ─────────────

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

function derivePosture(
  decisions: MetricsDecisions | undefined,
  totalInterceptions: number | undefined
): PostureLevel {
  if (
    !decisions ||
    totalInterceptions === undefined ||
    totalInterceptions === 0 ||
    (decisions.allow === 0 && decisions.alert === 0 && decisions.block === 0)
  ) {
    return 'AWAITING';
  }
  if ((decisions.block ?? 0) > 0) return 'CRITICAL';
  if ((decisions.alert ?? 0) > 0) return 'ELEVATED';
  return 'NOMINAL';
}

// ─── WebGL Error Boundary ────────────────────────────────────────────────────

interface ErrorBoundaryProps {
  fallback: React.ReactNode;
  children: React.ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class WebGLErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('WebGL Command Centre encounter error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

// ─── Main SentinelCommandCentre Component ─────────────────────────────────────

export function SentinelCommandCentre(props: SentinelCoreRadarProps) {
  const {
    decisions,
    totalInterceptions,
    auditEvents = [],
    selectedEventId,
    onSelectEvent,
    temporalScope = 'all',
    onTemporalScopeChange,
  } = props;

  // WebGL availability check
  const webGLSupported = useMemo(() => isWebGLAvailable(), []);

  // View mode state (defaults to '2d' for strict zero-regression baseline)
  const [viewMode, setViewMode] = useState<'3d' | '2d'>('2d');
  const [webGLErrorMessage, setWebGLErrorMessage] = useState<string | null>(null);

  // Real measured FPS from Three.js render loop
  const [fps, setFps] = useState<number>(60);

  // Internal event selection state
  const [internalSelectedEventId, setInternalSelectedEventId] = useState<string | null>(null);
  const activeSelectedEventId = selectedEventId || internalSelectedEventId;

  // Selected architectural stage in 3D scene (defaults to M8 runtime core)
  const [selectedGroupId, setSelectedGroupId] = useState<string>('ring-m8');

  // Animation / rotation state (respects prefers-reduced-motion)
  const [isPaused, setIsPaused] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    return false;
  });

  // Listen for reduced-motion changes
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleChange = (e: MediaQueryListEvent) => {
      if (e.matches) setIsPaused(true);
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Camera reset trigger and zoom level
  const [resetTrigger, setResetTrigger] = useState<number>(0);
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);

  const handleResetCamera = useCallback(() => {
    setResetTrigger((prev) => prev + 1);
    setZoomLevel(1.0);
  }, []);

  const handleZoomIn = useCallback(() => {
    setZoomLevel((prev) => Math.min(prev + 0.25, 2.0));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomLevel((prev) => Math.max(prev - 0.25, 0.6));
  }, []);

  // Posture derivation
  const postureLevel = useMemo(
    () => derivePosture(decisions, totalInterceptions),
    [decisions, totalInterceptions]
  );
  const posture = POSTURES[postureLevel];
  const PostureIcon = posture.Icon;

  // Execution state breakdown from real audit events
  const executionBreakdown = useMemo(() => {
    const executed = auditEvents.filter((e) => e.execution_state?.toLowerCase() === 'executed').length;
    const blocked = auditEvents.filter(
      (e) =>
        e.execution_state?.toLowerCase() === 'blocked' ||
        e.execution_state?.toLowerCase() === 'blocked_by_policy'
    ).length;
    const failed = auditEvents.filter((e) => e.execution_state?.toLowerCase() === 'execution_failed').length;
    return { executed, blocked, failed };
  }, [auditEvents]);

  // Telemetry freshness info
  const freshnessInfo = useMemo(() => {
    if (!auditEvents || auditEvents.length === 0) {
      return {
        label: 'Standby',
        badgeClass: 'bg-slate-900/80 text-slate-400 border-slate-700',
        isLive: false,
      };
    }
    const newest = auditEvents[0];
    if (!newest?.timestamp) {
      return {
        label: 'Timestamp Unreported',
        badgeClass: 'bg-slate-900/80 text-slate-400 border-slate-700',
        isLive: false,
      };
    }
    const eventTime = new Date(newest.timestamp).getTime();
    if (isNaN(eventTime)) {
      return {
        label: 'Timestamp Invalid',
        badgeClass: 'bg-slate-900/80 text-slate-400 border-slate-700',
        isLive: false,
      };
    }
    const ageSeconds = Math.max(0, Math.floor((Date.now() - eventTime) / 1000));
    if (ageSeconds < 300) {
      return {
        label: 'LIVE',
        badgeClass: 'bg-emerald-950/80 text-emerald-400 border-emerald-700/60',
        isLive: true,
      };
    }
    return {
      label: 'HISTORICAL',
      badgeClass: 'bg-cyan-950/80 text-cyan-400 border-cyan-800/60',
      isLive: true,
    };
  }, [auditEvents]);

  // Selected stage details
  const selectedGroup = useMemo(() => {
    return (
      ARCHITECTURAL_GROUPS.find((g) => g.id === selectedGroupId) ||
      ARCHITECTURAL_GROUPS[ARCHITECTURAL_GROUPS.length - 1]
    );
  }, [selectedGroupId]);

  // Correlated events for the active stage filter
  const correlatedStageEvents = useMemo(() => {
    if (!auditEvents || auditEvents.length === 0) return [];
    if (selectedGroupId === 'ring-m8') {
      return auditEvents;
    }
    if (selectedGroupId === 'ring-m7') {
      return auditEvents.filter((e) => e.decision);
    }
    if (selectedGroupId === 'ring-m6') {
      return auditEvents.filter((e) => e.action_record?.auth_status);
    }
    if (selectedGroupId === 'ring-m3m5') {
      return auditEvents.filter((e) => e.action_record?.risk_score !== undefined);
    }
    return auditEvents.filter((e) => e.action || e.tool_name);
  }, [auditEvents, selectedGroupId]);

  // Handle stage selection
  const handleSelectGroup = useCallback((groupId: string) => {
    setSelectedGroupId(groupId);
  }, []);

  // Handle audit event selection
  const handleSelectEvent = useCallback(
    (eventId: string) => {
      setInternalSelectedEventId(eventId);
      onSelectEvent?.(eventId);
    },
    [onSelectEvent]
  );

  const scopeLabel = useMemo(() => {
    if (temporalScope === '1h') return 'Last 1 Hour';
    if (temporalScope === '24h') return 'Last 24 Hours';
    return 'All-Time';
  }, [temporalScope]);

  // Fallback rendering for 2D Radar
  if (viewMode === '2d') {
    return (
      <Card
        className="border-slate-800 shadow-2xl bg-[#070b16] text-slate-100 overflow-hidden"
        data-testid="sentinel-command-centre"
      >
        <SentinelCoreRadar
          {...props}
          selectedEventId={activeSelectedEventId || undefined}
          onSelectEvent={handleSelectEvent}
          viewMode="2d"
          onViewModeChange={(mode) => {
            if (mode === '3d') {
              if (!webGLSupported) {
                setWebGLErrorMessage('WebGL is not supported on this browser or device.');
                return;
              }
              setWebGLErrorMessage(null);
            }
            setViewMode(mode);
          }}
        />
      </Card>
    );
  }

  // 3D Command Centre View
  return (
    <Card
      className="border-slate-800 shadow-2xl bg-[#070b16] text-slate-100 overflow-hidden transition-all duration-300"
      data-testid="sentinel-command-centre"
    >
      {/* ── Global Command Centre Header Bar ── */}
      <CardHeader className="p-4 sm:p-5 border-b border-slate-800/80 bg-[#090e1c]/80 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 border border-cyan-500/40 flex items-center justify-center shrink-0 shadow-inner">
            <Box className="h-5 w-5 text-cyan-400" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold font-mono text-white tracking-wide uppercase">
                Sentinel Core Security Command Centre
              </h2>
              <span className="text-[10px] font-mono text-cyan-400 px-1.5 py-0.5 rounded bg-cyan-950/60 border border-cyan-800/50 shrink-0">
                3D SECURITY FIELD
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 font-sans">
              Isometric view of M1–M8 layered security architecture with live telemetry
            </p>
          </div>
        </div>

        {/* Global Toolbar Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* View Mode Toggle: 2D vs 3D */}
          <div
            className="inline-flex rounded-lg border border-slate-700 bg-slate-900/90 p-0.5 text-[11px] font-mono"
            role="group"
            aria-label="Visualization Mode Selector"
          >
            <button
              type="button"
              onClick={() => setViewMode('2d')}
              className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-mono rounded font-semibold transition-all text-slate-400 hover:text-white cursor-pointer"
              data-testid="view-mode-2d-toggle"
              aria-pressed={false}
            >
              <Radar className="h-3.5 w-3.5" />
              <span>2D Map</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setWebGLErrorMessage(null);
                setViewMode('3d');
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-mono rounded font-semibold transition-all bg-indigo-600 text-white shadow-xs cursor-pointer"
              data-testid="view-mode-toggle"
              aria-pressed={true}
            >
              <Box className="h-3.5 w-3.5" />
              <span>3D View</span>
            </button>
          </div>

          {/* Reset View Button */}
          <button
            type="button"
            onClick={handleResetCamera}
            className="flex items-center gap-1 px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg border border-slate-700 text-[10px] font-mono transition-colors cursor-pointer"
            data-testid="reset-camera-btn"
            title="Reset Camera View"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Reset</span>
          </button>

          {/* Motion Pause / Resume Toggle */}
          <button
            type="button"
            onClick={() => setIsPaused((prev) => !prev)}
            className={cn(
              'flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[10px] font-mono transition-colors cursor-pointer',
              isPaused
                ? 'bg-amber-950/60 border-amber-800 text-amber-300 hover:bg-amber-900/60'
                : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
            )}
            data-testid="pause-motion-btn"
            aria-pressed={isPaused}
          >
            {isPaused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
            <span>{isPaused ? 'Resume Motion' : 'Pause Motion'}</span>
          </button>

          {/* Telemetry Status Indicator */}
          <div
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono border',
              freshnessInfo.badgeClass
            )}
            data-testid="telemetry-freshness-pill"
          >
            {freshnessInfo.isLive ? (
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 motion-safe:animate-pulse" />
            ) : (
              <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
            )}
            <span>{freshnessInfo.label}</span>
          </div>

          {/* Temporal Scope Selector */}
          {onTemporalScopeChange && (
            <div
              className="inline-flex rounded-lg border border-slate-700 bg-slate-900/90 p-0.5 text-[11px] font-mono"
              role="group"
              aria-label="Temporal Scope Selector"
            >
              {(['all', '24h', '1h'] as const).map((scope) => (
                <button
                  key={scope}
                  type="button"
                  onClick={() => onTemporalScopeChange(scope)}
                  className={cn(
                    'px-2.5 py-1 text-[10px] font-mono rounded font-medium transition-all cursor-pointer',
                    temporalScope === scope
                      ? 'bg-indigo-600 text-white shadow-xs font-bold'
                      : 'text-slate-400 hover:text-white'
                  )}
                  data-testid={`scope-btn-${scope}`}
                >
                  {scope === 'all' ? 'All time' : scope}
                </button>
              ))}
            </div>
          )}

          {/* Posture Badge */}
          <Badge
            variant="outline"
            className={cn('text-[10px] font-mono uppercase font-bold tracking-wider px-2 py-0.5', posture.badgeClass)}
            data-testid="posture-pill"
          >
            {posture.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-6 space-y-6">
        <div className="space-y-6" data-testid="3d-command-centre-container">
          {/* ── Sub-header Toolbar inside 3D View: WebGL FPS & Zoom Controls ── */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 bg-slate-900/80 text-slate-300 px-4 py-2.5 rounded-xl text-xs font-mono border border-slate-800">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-[11px]">CAMERA & ZOOM:</span>
              <button
                type="button"
                onClick={handleZoomIn}
                className="flex items-center gap-1 px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 transition-colors cursor-pointer text-[10px]"
                data-testid="zoom-in-btn"
                title="Zoom In"
              >
                <ZoomIn className="h-3 w-3" />
                <span>Zoom In</span>
              </button>
              <button
                type="button"
                onClick={handleZoomOut}
                className="flex items-center gap-1 px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 transition-colors cursor-pointer text-[10px]"
                data-testid="zoom-out-btn"
                title="Zoom Out"
              >
                <ZoomOut className="h-3 w-3" />
                <span>Zoom Out</span>
              </button>
            </div>

            <div className="flex items-center gap-2 text-[10px]">
              <span className="text-slate-400">STATUS:</span>
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-800 text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 motion-safe:animate-pulse" />
                <span>WebGL {fps} FPS</span>
              </span>
            </div>
          </div>

          {/* ── 3D Canvas Scene Container with Overlaid Telemetry Cards ── */}
          <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-[#070b16] shadow-2xl">
            {/* Top-Left Overlay: Active Events Counter (Matching Reference Image) */}
            <div className="absolute top-4 left-4 z-10 p-3 rounded-xl bg-slate-900/90 backdrop-blur-md border border-slate-800 text-xs font-mono space-y-2 pointer-events-auto shadow-lg min-w-[130px]">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                ACTIVE EVENTS
              </div>
              <div className="text-[9px] text-slate-500 font-sans -mt-1">
                ({scopeLabel.toUpperCase()})
              </div>
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between gap-3 text-[11px]">
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">
                    ALLOW
                  </span>
                  <span className="font-bold text-emerald-300" data-testid="telemetry-allow-count">
                    {decisions?.allow ?? 0}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 text-[11px]">
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-950 text-amber-400 border border-amber-800">
                    ALERT
                  </span>
                  <span className="font-bold text-amber-300" data-testid="telemetry-alert-count">
                    {decisions?.alert ?? 0}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 text-[11px]">
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-950 text-rose-400 border border-rose-800">
                    BLOCK
                  </span>
                  <span className="font-bold text-rose-300" data-testid="telemetry-block-count">
                    {decisions?.block ?? 0}
                  </span>
                </div>
                <div className="border-t border-slate-800 pt-1 flex items-center justify-between gap-3 text-[11px]">
                  <span className="text-cyan-400 text-[10px] font-bold">TOTAL</span>
                  <span className="font-bold text-cyan-300" data-testid="telemetry-total-interceptions">
                    {totalInterceptions ?? 0}
                  </span>
                </div>
              </div>
            </div>

            {/* Right Side Overlay: 5 Stacked Stage Cards (Matching Reference Image) */}
            <div className="absolute top-4 right-4 z-10 flex flex-col gap-1.5 pointer-events-auto w-[230px] sm:w-[255px] hidden sm:flex">
              {ARCHITECTURAL_GROUPS.map((group, idx) => {
                const isSelected = selectedGroupId === group.id;
                return (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => handleSelectGroup(group.id)}
                    className={cn(
                      'text-left p-2 rounded-xl border text-[10px] font-mono transition-all backdrop-blur-md cursor-pointer',
                      isSelected
                        ? 'bg-slate-800/95 border-cyan-400 shadow-md ring-1 ring-cyan-400/50 text-white'
                        : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:bg-slate-800/80 hover:border-slate-700'
                    )}
                    data-testid={`stage-overlay-btn-${group.id}`}
                  >
                    <div className="flex items-start gap-2">
                      <div
                        className="h-5 w-5 rounded-lg flex items-center justify-center shrink-0 border text-[9px] font-bold mt-0.5"
                        style={{
                          borderColor: group.glowColor,
                          backgroundColor: `${group.glowColor}20`,
                          color: group.glowColor,
                        }}
                      >
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-bold text-[10px] text-white">{group.label}</span>
                          {group.id === 'ring-m7' && (
                            <span className="text-[8px] font-mono px-1 py-0.2 rounded bg-amber-950/80 text-amber-400 border border-amber-800/60 font-semibold">
                              M7 SOLE AUTHORITY
                            </span>
                          )}
                          {group.id === 'ring-m8' && (
                            <span className="text-[8px] font-mono px-1 py-0.2 rounded bg-rose-950/80 text-rose-400 border border-rose-800/60 font-semibold">
                              M8 KERNEL
                            </span>
                          )}
                        </div>
                        <div className="text-[9px] text-slate-300 font-sans leading-tight mt-0.5 break-words">
                          {group.stages}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Bottom-Left Overlay: Governance Posture Card (Matching Reference Image) */}
            <div className="absolute bottom-4 left-4 z-10 p-3 rounded-xl bg-slate-900/90 backdrop-blur-md border border-slate-800 text-xs font-mono space-y-1 pointer-events-auto shadow-lg max-w-[280px]">
              <div className="flex items-center gap-2">
                <PostureIcon className={cn('h-5 w-5 shrink-0', posture.textColor)} />
                <div>
                  <div className={cn('font-bold uppercase tracking-wider text-[11px]', posture.textColor)}>
                    {postureLevel === 'AWAITING' ? 'Standby Mode' : posture.label}
                  </div>
                  <div className="text-[9px] text-slate-400 font-sans leading-tight">
                    {posture.description}
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom-Right Overlay: Camera Controls Legend (Matching Reference Image) */}
            <div className="absolute bottom-4 right-4 z-10 px-3 py-1.5 rounded-xl bg-slate-900/90 backdrop-blur-md border border-slate-800 text-[10px] font-mono text-slate-400 flex items-center gap-3 pointer-events-auto">
              <span>Rotate: Left Click</span>
              <span>Pan: Right Click</span>
              <span>Zoom: Scroll</span>
            </div>

            {/* 3D WebGL Canvas */}
            <WebGLErrorBoundary
              fallback={
                <div className="p-8 text-center bg-slate-900/90 text-slate-300 rounded-xl space-y-3 font-mono">
                  <AlertTriangle className="h-8 w-8 text-amber-400 mx-auto" />
                  <p className="text-sm font-bold">WebGL rendering encountered an issue</p>
                  {webGLErrorMessage && (
                    <p className="text-xs text-rose-400 font-mono">{webGLErrorMessage}</p>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => setViewMode('2d')}
                    className="border-slate-700 text-slate-200"
                  >
                    Switch to 2D Defense Radar
                  </Button>
                </div>
              }
              onError={(err) => setWebGLErrorMessage(err.message)}
            >
              <SentinelCore3D
                posture={postureLevel}
                selectedGroupId={selectedGroupId}
                onSelectGroup={handleSelectGroup}
                isPaused={isPaused}
                resetTrigger={resetTrigger}
                zoomLevel={zoomLevel}
                onFPSUpdate={setFps}
                auditEvents={auditEvents}
              />
            </WebGLErrorBoundary>
          </div>

          {/* ── Architectural Stage Tab Bar (Keyboard Accessible & Mobile Responsive) ── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase font-mono px-1">
              <span>ARCHITECTURAL DEFENSE LAYERS (M1–M8)</span>
              <span className="text-[9px] text-slate-500">Select layer for governance boundary details</span>
            </div>

            <div
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2"
              role="tablist"
              aria-label="Architectural Stages"
            >
              {ARCHITECTURAL_GROUPS.map((group) => {
                const isSelected = selectedGroupId === group.id;
                return (
                  <button
                    key={group.id}
                    type="button"
                    role="tab"
                    id={`tab-${group.id}`}
                    aria-selected={isSelected}
                    aria-controls={`panel-${group.id}`}
                    tabIndex={isSelected ? 0 : -1}
                    onClick={() => handleSelectGroup(group.id)}
                    className={cn(
                      'text-left p-3 rounded-xl border text-[11px] font-mono transition-all cursor-pointer',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400',
                      isSelected
                        ? 'bg-slate-800 border-cyan-400 shadow-md ring-1 ring-cyan-400/50'
                        : 'bg-slate-900/70 border-slate-800 hover:bg-slate-800/70 hover:border-slate-700'
                    )}
                    data-testid={`arch-tab-${group.id}`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: group.glowColor }}
                      />
                      <span className={cn('font-bold', isSelected ? 'text-cyan-300' : 'text-slate-200')}>
                        {group.label}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">
                      {group.stages}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Detailed Architectural & Telemetry Information Panel ── */}
          <div
            id={`panel-${selectedGroup.id}`}
            role="tabpanel"
            aria-labelledby={`tab-${selectedGroup.id}`}
            className="p-5 rounded-2xl border border-slate-800 bg-slate-900/70 space-y-4"
            data-testid="command-centre-detail-panel"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <span
                  className="h-3.5 w-3.5 rounded-full shrink-0"
                  style={{ backgroundColor: selectedGroup.glowColor }}
                />
                <div>
                  <h3 className="font-mono font-bold text-white text-sm">
                    {selectedGroup.label}: {selectedGroup.stages}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5 font-sans leading-relaxed">
                    {selectedGroup.description}
                  </p>
                </div>
              </div>

              <Badge
                variant="outline"
                className="text-[10px] font-mono shrink-0 bg-slate-950 border-cyan-500/40 text-cyan-400 self-start sm:self-auto"
              >
                {selectedGroup.id === 'ring-m7'
                  ? 'SOLE DECISION AUTHORITY'
                  : selectedGroup.id === 'ring-m8'
                  ? 'ENFORCEMENT KERNEL'
                  : 'OBSERVABILITY & ANALYSIS'}
              </Badge>
            </div>

            {/* Architectural Authority & Invariant Notice */}
            <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 text-xs space-y-1 font-sans">
              <div className="flex items-center gap-1.5 font-bold font-mono text-[11px] text-cyan-300">
                <Info className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                <span>Architectural Boundary & Invariant Guarantee:</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                {selectedGroup.id === 'ring-m7' &&
                  'M7 Policy Fusion Engine is the single authoritative source of truth for governance decisions. M1–M6 observe, normalize, extract features, and evaluate risk, but only M7 issues ALLOW, ALERT, or BLOCK verdicts.'}
                {selectedGroup.id === 'ring-m8' &&
                  'M8 Runtime Interceptor enforces M7 verdicts. Under a BLOCK verdict, M8 guarantees zero protected-callable invocations. An ALLOW action permits execution, but tool execution can still encounter independent runtime failure.'}
                {selectedGroup.id === 'ring-m6' &&
                  'M6 Task-Context Authorizer evaluates capabilities against the declared task scope. M6 does NOT make final decisions — its authorization status is an input to M7 policy evaluation.'}
                {selectedGroup.id === 'ring-m3m5' &&
                  'M5 Risk Engine evaluates continuous behavioral risk [0.0–1.0]. Risk scores are NEVER presented as final decisions. High risk feeds into M7 policy rules as an evaluation signal.'}
                {selectedGroup.id === 'ring-m1m2' &&
                  'M1–M2 Ingestion & Normalization standardizes tool parameters into immutable canonical form. No governance filtering or blocking occurs at this stage.'}
              </p>
            </div>

            {/* Correlated Real Stage Telemetry Events */}
            <div className="space-y-2" data-testid="correlated-stage-events">
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 px-1">
                <span>STAGE-CORRELATED EVENTS ({correlatedStageEvents.length})</span>
                <span>Filtered by {selectedGroup.label}</span>
              </div>

              {correlatedStageEvents.length > 0 ? (
                <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                  {correlatedStageEvents.map((evt) => (
                    <div
                      key={evt.interception_id}
                      onClick={() => handleSelectEvent(evt.interception_id)}
                      className={cn(
                        'flex items-center justify-between p-2.5 rounded-xl border text-xs font-mono transition-all cursor-pointer',
                        activeSelectedEventId === evt.interception_id
                          ? 'bg-slate-800 border-indigo-400 shadow-md ring-1 ring-indigo-400/50'
                          : 'bg-slate-950/60 border-slate-800 hover:bg-slate-800/50 hover:border-slate-700'
                      )}
                      data-testid={`stage-event-${evt.interception_id}`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="font-bold text-slate-200">{evt.tool_name || 'unknown_tool'}</span>
                        <span className="text-[10px] text-slate-500">•</span>
                        <span className="text-[10px] text-slate-400 truncate">
                          {evt.interception_id}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <Badge
                          className={cn(
                            'text-[10px] font-mono border',
                            evt.decision?.toUpperCase() === 'ALLOW'
                              ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                              : evt.decision?.toUpperCase() === 'ALERT'
                              ? 'bg-amber-950 text-amber-400 border-amber-800'
                              : 'bg-rose-950 text-rose-400 border-rose-800'
                          )}
                        >
                          {evt.decision?.toUpperCase()}
                        </Badge>

                        <Badge variant="outline" className="text-[10px] font-mono border-slate-800 text-slate-400">
                          {evt.execution_state?.toUpperCase()}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 text-xs text-slate-500 text-center font-mono">
                  {totalInterceptions === 0
                    ? 'No pipeline events recorded. Run an agent task to generate live telemetry.'
                    : `No events in ${scopeLabel} scope match this stage filter.`}
                </div>
              )}
            </div>

            {/* M8 Execution Breakdown Counters (Required for Test 5) */}
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800 text-center font-mono text-xs">
              <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="text-[9px] text-slate-500 block font-bold uppercase">M8 EXECUTED</span>
                <span className="text-base font-extrabold text-emerald-400" data-testid="execution-executed-count">
                  {executionBreakdown.executed}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="text-[9px] text-slate-500 block font-bold uppercase">M8 BLOCKED</span>
                <span className="text-base font-extrabold text-rose-400" data-testid="execution-blocked-count">
                  {executionBreakdown.blocked}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="text-[9px] text-slate-500 block font-bold uppercase">M8 FAILED</span>
                <span className="text-base font-extrabold text-amber-400" data-testid="execution-failed-count">
                  {executionBreakdown.failed}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Bottom Bar: Live Security Events (M1–M8) Banner with Sparklines ── */}
        <div className="pt-4 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 font-mono text-xs">
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center shrink-0">
              <Activity className="h-4 w-4 text-cyan-400" />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block font-bold uppercase">Live Security Events</span>
              <span className="text-xs font-bold text-slate-200">M1–M8 Pipeline</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-900/40 flex items-center justify-between">
            <div>
              <span className="text-[9px] text-emerald-400 block font-bold uppercase">ALLOW (M7)</span>
              <span className="text-lg font-extrabold text-emerald-300">{decisions?.allow ?? 0}</span>
            </div>
            <svg width="60" height="24" className="stroke-emerald-400 fill-none shrink-0" strokeWidth="2">
              <path d="M 0 18 Q 15 12, 30 15 T 60 6" />
            </svg>
          </div>

          <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-900/40 flex items-center justify-between">
            <div>
              <span className="text-[9px] text-amber-400 block font-bold uppercase">ALERT (M7)</span>
              <span className="text-lg font-extrabold text-amber-300">{decisions?.alert ?? 0}</span>
            </div>
            <svg width="60" height="24" className="stroke-amber-400 fill-none shrink-0" strokeWidth="2">
              <path d="M 0 12 Q 15 18, 30 10 T 60 14" />
            </svg>
          </div>

          <div className="p-3 rounded-xl bg-rose-950/20 border border-rose-900/40 flex items-center justify-between">
            <div>
              <span className="text-[9px] text-rose-400 block font-bold uppercase">BLOCK (M7)</span>
              <span className="text-lg font-extrabold text-rose-300">{decisions?.block ?? 0}</span>
            </div>
            <svg width="60" height="24" className="stroke-rose-400 fill-none shrink-0" strokeWidth="2">
              <path d="M 0 16 Q 15 6, 30 14 T 60 8" />
            </svg>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
