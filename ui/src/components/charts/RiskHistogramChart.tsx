import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  CartesianGrid,
} from 'recharts';
import type { SafeAuditEventResponse } from '../../api/types';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Activity, ShieldAlert } from 'lucide-react';

interface RiskHistogramChartProps {
  auditEvents?: SafeAuditEventResponse[];
  isLoading?: boolean;
}

const BINS = [
  { label: '0.0-0.1', min: 0.0, max: 0.1, tier: 'LOW', color: '#10b981' },
  { label: '0.1-0.2', min: 0.1, max: 0.2, tier: 'LOW', color: '#10b981' },
  { label: '0.2-0.3', min: 0.2, max: 0.3, tier: 'LOW', color: '#10b981' },
  { label: '0.3-0.4', min: 0.3, max: 0.4, tier: 'LOW', color: '#10b981' },
  { label: '0.4-0.5', min: 0.4, max: 0.5, tier: 'MED', color: '#f59e0b' },
  { label: '0.5-0.6', min: 0.5, max: 0.6, tier: 'MED', color: '#f59e0b' },
  { label: '0.6-0.7', min: 0.6, max: 0.7, tier: 'MED', color: '#f59e0b' },
  { label: '0.7-0.8', min: 0.7, max: 0.8, tier: 'HIGH', color: '#e11d48' },
  { label: '0.8-0.9', min: 0.8, max: 0.9, tier: 'CRIT', color: '#e11d48' },
  { label: '0.9-1.0', min: 0.9, max: 1.01, tier: 'CRIT', color: '#be123c' },
];

export const RiskHistogramChart = React.memo(function RiskHistogramChart({
  auditEvents,
  isLoading,
}: RiskHistogramChartProps) {
  const { binData, totalScored, unscoredCount, meanScore, maxScore } = useMemo(() => {
    if (!auditEvents || auditEvents.length === 0) {
      return { binData: [], totalScored: 0, unscoredCount: 0, meanScore: 0, maxScore: 0 };
    }

    const scores: number[] = [];
    let unscored = 0;

    for (const e of auditEvents) {
      const score = e.action_record?.risk_score;
      if (typeof score === 'number' && !isNaN(score)) {
        scores.push(Math.max(0, Math.min(1, score)));
      } else {
        unscored++;
      }
    }

    if (scores.length === 0) {
      return { binData: [], totalScored: 0, unscoredCount: unscored, meanScore: 0, maxScore: 0 };
    }

    const counts = new Array(BINS.length).fill(0);
    let sum = 0;
    let max = 0;

    for (const s of scores) {
      sum += s;
      if (s > max) max = s;

      // Find appropriate bin
      for (let i = 0; i < BINS.length; i++) {
        if (s >= BINS[i].min && (i === BINS.length - 1 ? s <= BINS[i].max : s < BINS[i].max)) {
          counts[i]++;
          break;
        }
      }
    }

    const mean = sum / scores.length;

    const data = BINS.map((b, idx) => ({
      bin: b.label,
      count: counts[idx],
      percentage: Math.round((counts[idx] / scores.length) * 100),
      color: b.color,
      tier: b.tier,
      min: b.min,
      max: b.max,
    }));

    return {
      binData: data,
      totalScored: scores.length,
      unscoredCount: unscored,
      meanScore: mean,
      maxScore: max,
    };
  }, [auditEvents]);

  return (
    <Card className="border-slate-200 shadow-xs bg-white flex flex-col justify-between" data-testid="risk-histogram-card">
      <CardHeader className="pb-2 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-amber-600" />
            <div className="text-sm font-bold text-slate-900 leading-none">M5 Behavioral Risk Histogram</div>
          </div>
          <Badge variant="outline" className="text-[10px] font-mono uppercase bg-amber-50 text-amber-700 border-amber-200">
            Behavioral Risk Distribution
          </Badge>
        </div>
        <p className="text-[11px] text-slate-500 mt-1">
          Frequency of evaluated actions across behavioral risk intervals (0.0 to 1.0).
        </p>
      </CardHeader>

      <CardContent className="pt-4 flex-1 flex flex-col justify-between">
        {isLoading ? (
          <div className="h-48 flex flex-col items-center justify-center text-slate-400 gap-2">
            <div className="h-5 w-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-mono">Loading risk distributions...</span>
          </div>
        ) : totalScored === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center text-slate-400 gap-2 text-center p-4">
            <ShieldAlert className="h-8 w-8 text-slate-300" />
            <span className="text-xs font-medium text-slate-500">No behavioral risk scores evaluated yet.</span>
            <span className="text-[10px] text-slate-400 font-mono">
              {unscoredCount > 0 ? `${unscoredCount} events recorded without risk score telemetry.` : 'Execute agent actions to generate risk telemetry.'}
            </span>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Histogram Bar Chart */}
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={binData}
                  margin={{ top: 5, right: 10, left: -20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="bin"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 9, fill: '#64748b', fontFamily: 'monospace' }}
                    interval={1}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    allowDecimals={false}
                  />
                  <Tooltip content={<RiskTooltip total={totalScored} />} />
                  <Bar dataKey="count" radius={[3, 3, 0, 0]} maxBarSize={28}>
                    {binData.map((entry) => (
                      <Cell key={`bin-${entry.bin}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Statistical Summary Row */}
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-center font-mono">
              <div className="p-1.5 rounded-md bg-slate-50 border border-slate-100" data-testid="mean-risk-score">
                <span className="text-[10px] text-slate-400 block uppercase">MEAN SCORE</span>
                <span className="text-xs font-bold text-slate-800">{meanScore.toFixed(3)}</span>
              </div>
              <div className="p-1.5 rounded-md bg-slate-50 border border-slate-100" data-testid="peak-risk-score">
                <span className="text-[10px] text-slate-400 block uppercase">PEAK SCORE</span>
                <span className={meanScore > 0.7 ? "text-xs font-bold text-rose-600" : "text-xs font-bold text-slate-800"}>
                  {maxScore.toFixed(3)}
                </span>
              </div>
              <div className="p-1.5 rounded-md bg-slate-50 border border-slate-100" data-testid="scored-events-count">
                <span className="text-[10px] text-slate-400 block uppercase">SCORED EVENTS</span>
                <span className="text-xs font-bold text-slate-800">{totalScored}</span>
              </div>
            </div>
          </div>
        )}

        <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] font-mono text-slate-400">
          <span>Source: M5 Risk Assessment</span>
          <span>
            {unscoredCount > 0 ? (
              <span className="text-slate-400">Unscored: {unscoredCount}</span>
            ) : (
              <span className="text-emerald-600 font-medium">100% Evaluated</span>
            )}
          </span>
        </div>
      </CardContent>
    </Card>
  );
});

interface RiskTooltipProps {
  active?: boolean;
  payload?: any[];
  total: number;
}

const RiskTooltip = React.memo(function RiskTooltip({ active, payload, total }: RiskTooltipProps) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const pct = total > 0 ? ((data.count / total) * 100).toFixed(1) : '0';

    return (
      <div className="bg-white p-2.5 border border-slate-200 shadow-md rounded-md text-xs font-mono">
        <div className="flex items-center justify-between gap-3 mb-1">
          <span className="font-bold text-slate-800">Range: {data.bin}</span>
          <span
            className="px-1.5 py-0.2 rounded text-[10px] font-bold"
            style={{ color: data.color }}
          >
            {data.tier}
          </span>
        </div>
        <div className="text-slate-600">
          Events: <span className="font-bold text-slate-900">{data.count}</span> ({pct}%)
        </div>
      </div>
    );
  }
  return null;
});
