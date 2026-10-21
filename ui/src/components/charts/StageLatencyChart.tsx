import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import type { SafeAuditEventResponse } from '../../api/types';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Clock, Info, TimerReset } from 'lucide-react';
import { parseUtcDate, formatTransitionDelta } from '../../utils/datetime';

interface StageLatencyChartProps {
  auditEvents?: SafeAuditEventResponse[];
  isLoading?: boolean;
}

export const StageLatencyChart = React.memo(function StageLatencyChart({
  auditEvents,
  isLoading,
}: StageLatencyChartProps) {
  // Compute transition intervals between consecutive chronological events
  const { transitionSeries, meanMs, maxMs, validTransitions } = useMemo(() => {
    if (!auditEvents || auditEvents.length < 2) {
      return { transitionSeries: [], meanMs: 0, maxMs: 0, validTransitions: 0 };
    }

    // Sort ascending by sequence number and timestamp
    const sorted = [...auditEvents].sort((a, b) => {
      const tA = parseUtcDate(a.timestamp).getTime();
      const tB = parseUtcDate(b.timestamp).getTime();
      if (tA !== tB) return tA - tB;
      return (a.sequence_number || 0) - (b.sequence_number || 0);
    });

    const series: Array<{
      step: string;
      toolName: string;
      deltaMs: number;
      deltaFormatted: string;
      timestamp: string;
    }> = [];

    let sum = 0;
    let min = Infinity;
    let max = -Infinity;

    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];

      const tPrev = parseUtcDate(prev.timestamp).getTime();
      const tCurr = parseUtcDate(curr.timestamp).getTime();

      // Only evaluate if timestamps are valid numbers and delta >= 0 (suppress negative clock skew)
      if (!isNaN(tPrev) && !isNaN(tCurr) && tCurr >= tPrev) {
        const deltaMs = tCurr - tPrev;
        sum += deltaMs;
        if (deltaMs < min) min = deltaMs;
        if (deltaMs > max) max = deltaMs;

        series.push({
          step: `#${curr.sequence_number ?? i + 1}`,
          toolName: curr.tool_name || curr.action?.normalized_name || 'step',
          deltaMs: deltaMs,
          deltaFormatted: formatTransitionDelta(deltaMs / 1000) || `${deltaMs} ms`,
          timestamp: curr.timestamp,
        });
      }
    }

    // Take the most recent 12 transitions for clean visual presentation
    const recent = series.slice(-12);

    return {
      transitionSeries: recent,
      meanMs: series.length > 0 ? Math.round(sum / series.length) : 0,
      maxMs: series.length > 0 ? max : 0,
      minMs: series.length > 0 ? min : 0,
      validTransitions: series.length,
    };
  }, [auditEvents]);

  return (
    <Card className="border-slate-200 shadow-xs bg-white flex flex-col justify-between" data-testid="stage-latency-card">
      <CardHeader className="pb-2 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-indigo-600" />
            <div className="text-sm font-bold text-slate-900 leading-none">Inter-Action Transition Timing</div>
          </div>
          <Badge variant="outline" className="text-[10px] font-mono uppercase bg-indigo-50 text-indigo-700 border-indigo-200">
            Temporal Observability
          </Badge>
        </div>
        <p className="text-[11px] text-slate-500 mt-1">
          Measured transition latency (Δt) between sequential agent tool executions.
        </p>
      </CardHeader>

      <CardContent className="pt-4 flex-1 flex flex-col justify-between">
        {isLoading ? (
          <div className="h-48 flex flex-col items-center justify-center text-slate-400 gap-2">
            <div className="h-5 w-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-mono">Loading timing telemetry...</span>
          </div>
        ) : validTransitions === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center text-slate-400 gap-2 text-center p-4">
            <TimerReset className="h-8 w-8 text-slate-300" />
            <span className="text-xs font-medium text-slate-500">Insufficient sequential events for transition delta.</span>
            <span className="text-[10px] text-slate-400 font-mono">Requires ≥ 2 chronological actions to measure Δt.</span>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Sequential Transition Area Chart */}
            <div className="h-36 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={transitionSeries}
                  margin={{ top: 5, right: 10, left: -20, bottom: 5 }}
                >
                  <defs>
                    <linearGradient id="latencyGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="step"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: '#64748b', fontFamily: 'monospace' }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: '#64748b' }}
                  />
                  <Tooltip content={<LatencyTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="deltaMs"
                    stroke="#4f46e5"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#latencyGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Truthful Provenance Banner: Sub-stage microsecond profiling is not persisted */}
            <div className="flex items-start gap-1.5 p-2 rounded-lg bg-amber-50/70 border border-amber-200/80 text-[10px] text-amber-800">
              <Info className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold font-mono">SUB-STAGE PROFILING: UNAVAILABLE</span>
                <span className="block text-amber-700 leading-tight mt-0.5">
                  Internal M1–M8 microsecond breakdown is not persisted in the database schema. Displaying empirical inter-action Δt derived from verified event timestamps.
                </span>
              </div>
            </div>

            {/* Timing Summary Row */}
            <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-100 text-center font-mono">
              <div className="p-1 rounded-md bg-slate-50 border border-slate-100" data-testid="mean-transition-delta">
                <span className="text-[9px] text-slate-400 block uppercase">MEAN Δt</span>
                <span className="text-xs font-bold text-slate-800">
                  {formatTransitionDelta(meanMs / 1000) || `${meanMs} ms`}
                </span>
              </div>
              <div className="p-1 rounded-md bg-slate-50 border border-slate-100" data-testid="peak-transition-delta">
                <span className="text-[9px] text-slate-400 block uppercase">PEAK Δt</span>
                <span className="text-xs font-bold text-slate-800">
                  {formatTransitionDelta(maxMs / 1000) || `${maxMs} ms`}
                </span>
              </div>
              <div className="p-1 rounded-md bg-slate-50 border border-slate-100" data-testid="measured-transitions-count">
                <span className="text-[9px] text-slate-400 block uppercase">MEASURED</span>
                <span className="text-xs font-bold text-slate-800">{validTransitions}</span>
              </div>
            </div>
          </div>
        )}

        <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] font-mono text-slate-400">
          <span>Source: Verified Timestamps</span>
          <span className="text-slate-500 font-medium">Resolution: Millisecond</span>
        </div>
      </CardContent>
    </Card>
  );
});

interface LatencyTooltipProps {
  active?: boolean;
  payload?: any[];
}

const LatencyTooltip = React.memo(function LatencyTooltip({ active, payload }: LatencyTooltipProps) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;

    return (
      <div className="bg-white p-2.5 border border-slate-200 shadow-md rounded-md text-xs font-mono">
        <div className="font-bold text-slate-800 mb-1">{data.toolName} ({data.step})</div>
        <div className="text-slate-600">
          Transition Δt: <span className="font-bold text-indigo-600">{data.deltaFormatted}</span> ({data.deltaMs} ms)
        </div>
      </div>
    );
  }
  return null;
});
