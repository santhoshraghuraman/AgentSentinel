import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from 'recharts';
import type { MetricsDecisions } from '../../api/types';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { CheckCircle2, AlertTriangle, XCircle, PieChart as PieChartIcon } from 'lucide-react';

interface DecisionDistributionChartProps {
  decisions?: MetricsDecisions;
  isLoading?: boolean;
}

const DECISION_CONFIG = [
  { key: 'allow', label: 'Allow (Authorized)', color: '#10b981', icon: CheckCircle2, bgClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { key: 'alert', label: 'Alert (Flagged)', color: '#f59e0b', icon: AlertTriangle, bgClass: 'bg-amber-50 text-amber-700 border-amber-200' },
  { key: 'block', label: 'Block (Neutralized)', color: '#e11d48', icon: XCircle, bgClass: 'bg-rose-50 text-rose-700 border-rose-200' },
] as const;

export const DecisionDistributionChart = React.memo(function DecisionDistributionChart({
  decisions,
  isLoading,
}: DecisionDistributionChartProps) {
  const chartData = useMemo(() => {
    if (!decisions) return [];
    const total = (decisions.allow || 0) + (decisions.alert || 0) + (decisions.block || 0);
    if (total === 0) return [];

    return DECISION_CONFIG.map((cfg) => {
      const val = decisions[cfg.key] || 0;
      const pct = total > 0 ? Math.round((val / total) * 100) : 0;
      return {
        key: cfg.key,
        name: cfg.label,
        value: val,
        percentage: pct,
        color: cfg.color,
      };
    });
  }, [decisions]);

  const totalDecisions = useMemo(() => {
    if (!decisions) return 0;
    return (decisions.allow || 0) + (decisions.alert || 0) + (decisions.block || 0);
  }, [decisions]);

  return (
    <Card className="border-slate-200 shadow-xs bg-white flex flex-col justify-between" data-testid="decision-distribution-card">
      <CardHeader className="pb-2 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PieChartIcon className="h-4 w-4 text-emerald-600" />
            <div className="text-sm font-bold text-slate-900 leading-none">M7 Policy Decisions</div>
          </div>
          <Badge variant="outline" className="text-[10px] font-mono uppercase bg-emerald-50 text-emerald-700 border-emerald-200">
            Authoritative Invariants
          </Badge>
        </div>
        <p className="text-[11px] text-slate-500 mt-1">
          Distribution of authoritative verdicts (ALLOW / ALERT / BLOCK) evaluated by the policy engine.
        </p>
      </CardHeader>

      <CardContent className="pt-4 flex-1 flex flex-col justify-between">
        {isLoading ? (
          <div className="h-48 flex flex-col items-center justify-center text-slate-400 gap-2">
            <div className="h-5 w-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-mono">Loading decision metrics...</span>
          </div>
        ) : totalDecisions === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center text-slate-400 gap-2 text-center p-4">
            <PieChartIcon className="h-8 w-8 text-slate-300" />
            <span className="text-xs font-medium text-slate-500">No policy verdicts recorded yet.</span>
            <span className="text-[10px] text-slate-400 font-mono">Execute agent actions or run scenarios to record decisions.</span>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Donut Chart with Centered Total */}
            <div className="relative h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={68}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="#ffffff"
                    strokeWidth={2}
                  >
                    {chartData.map((entry) => (
                      <Cell key={`cell-${entry.key}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<DecisionTooltip total={totalDecisions} />} />
                </PieChart>
              </ResponsiveContainer>

              {/* Centered Total Label */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-lg font-extrabold font-mono text-slate-800 leading-none">
                  {totalDecisions}
                </span>
                <span className="text-[10px] uppercase font-mono text-slate-400 mt-0.5">
                  Verdicts
                </span>
              </div>
            </div>

            {/* Breakdown Legend with Badges */}
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100">
              {DECISION_CONFIG.map((cfg) => {
                const count = decisions ? decisions[cfg.key] || 0 : 0;
                const pct = totalDecisions > 0 ? Math.round((count / totalDecisions) * 100) : 0;
                const Icon = cfg.icon;

                return (
                  <div
                    key={cfg.key}
                    data-testid={`decision-stat-${cfg.key}`}
                    className="p-2 rounded-lg bg-slate-50/80 border border-slate-100 flex flex-col items-start gap-1"
                  >
                    <div className="flex items-center gap-1">
                      <Icon className="h-3 w-3" style={{ color: cfg.color }} />
                      <span className="text-[10px] font-bold font-mono uppercase text-slate-600 truncate">
                        {cfg.key}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-sm font-bold font-mono text-slate-900">{count}</span>
                      <span className="text-[10px] font-mono text-slate-400">({pct}%)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] font-mono text-slate-400">
          <span>Source: M7 Baseline Matrix</span>
          <span className="font-semibold text-slate-600">Total: {totalDecisions}</span>
        </div>
      </CardContent>
    </Card>
  );
});

interface DecisionTooltipProps {
  active?: boolean;
  payload?: any[];
  total: number;
}

const DecisionTooltip = React.memo(function DecisionTooltip({ active, payload, total }: DecisionTooltipProps) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const pct = total > 0 ? ((data.value / total) * 100).toFixed(1) : '0';

    return (
      <div className="bg-white p-2.5 border border-slate-200 shadow-md rounded-md text-xs font-mono">
        <div className="flex items-center gap-2 mb-1">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: data.color }} />
          <span className="font-bold text-slate-800">{data.name}</span>
        </div>
        <div className="text-slate-600">
          Count: <span className="font-bold text-slate-900">{data.value}</span> ({pct}%)
        </div>
      </div>
    );
  }
  return null;
});
