import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from 'recharts';
import type { SafeAuditEventResponse } from '../../api/types';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Layers, Terminal } from 'lucide-react';

interface ToolCategoryDistributionChartProps {
  actionsByCategory?: Record<string, number>;
  auditEvents?: SafeAuditEventResponse[];
  isLoading?: boolean;
}

const CATEGORY_COLORS: Record<string, string> = {
  FILE_SYSTEM_READ: '#0284c7', // Sky 600
  FILE_SYSTEM_WRITE: '#6366f1', // Indigo 500
  NETWORK_QUERY: '#8b5cf6', // Purple 500
  DATABASE_MUTATION: '#d97706', // Amber 600
  SYSTEM_COMMAND: '#dc2626', // Red 600
  OS_INTERACTION: '#e11d48', // Rose 600
  UNKNOWN: '#64748b', // Slate 500
};

function formatCategoryLabel(rawKey: string): string {
  if (!rawKey) return 'Unknown';
  const upper = rawKey.toUpperCase();
  switch (upper) {
    case 'FILE_SYSTEM_READ': return 'FS Read';
    case 'FILE_SYSTEM_WRITE': return 'FS Write';
    case 'NETWORK_QUERY': return 'Network';
    case 'DATABASE_MUTATION': return 'Database';
    case 'SYSTEM_COMMAND': return 'System Cmd';
    case 'OS_INTERACTION': return 'OS Inter.';
    default:
      return upper.replace(/_/g, ' ').slice(0, 12);
  }
}

export const ToolCategoryDistributionChart = React.memo(function ToolCategoryDistributionChart({
  actionsByCategory,
  auditEvents,
  isLoading,
}: ToolCategoryDistributionChartProps) {
  // Aggregate category counts from actionsByCategory or auditEvents
  const { chartData, totalActions } = useMemo(() => {
    const counts: Record<string, number> = {};

    if (actionsByCategory && Object.keys(actionsByCategory).length > 0) {
      for (const [k, v] of Object.entries(actionsByCategory)) {
        const normKey = k.toUpperCase();
        counts[normKey] = (counts[normKey] || 0) + (Number(v) || 0);
      }
    } else if (auditEvents && auditEvents.length > 0) {
      for (const event of auditEvents) {
        const cat = (event.action?.category || event.action_record?.features?.category || 'UNKNOWN').toUpperCase();
        counts[cat] = (counts[cat] || 0) + 1;
      }
    }

    const total = Object.values(counts).reduce((a, b) => a + b, 0);

    const sorted = Object.entries(counts)
      .map(([key, count]) => ({
        key,
        name: formatCategoryLabel(key),
        fullName: key,
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0,
        color: CATEGORY_COLORS[key] || '#64748b',
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6); // Top 6 categories

    return { chartData: sorted, totalActions: total };
  }, [actionsByCategory, auditEvents]);

  return (
    <Card className="border-slate-200 shadow-xs bg-white flex flex-col justify-between" data-testid="tool-category-card">
      <CardHeader className="pb-2 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-blue-600" />
            <div className="text-sm font-bold text-slate-900 leading-none">M2 Tool Categories</div>
          </div>
          <Badge variant="outline" className="text-[10px] font-mono uppercase bg-blue-50 text-blue-700 border-blue-200">
            Semantic Normalization
          </Badge>
        </div>
        <p className="text-[11px] text-slate-500 mt-1">
          Frequency of intercepted actions normalized into standard security categories.
        </p>
      </CardHeader>

      <CardContent className="pt-4 flex-1 flex flex-col justify-between">
        {isLoading ? (
          <div className="h-48 flex flex-col items-center justify-center text-slate-400 gap-2">
            <div className="h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-mono">Loading tool categories...</span>
          </div>
        ) : totalActions === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center text-slate-400 gap-2 text-center p-4">
            <Terminal className="h-8 w-8 text-slate-300" />
            <span className="text-xs font-medium text-slate-500">No tool actions categorized yet.</span>
            <span className="text-[10px] text-slate-400 font-mono">Agent tool calls will appear here when intercepted.</span>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Horizontal Bar Chart */}
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ top: 5, right: 25, left: 10, bottom: 5 }}
                >
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="name"
                    type="category"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: '#475569', fontFamily: 'monospace' }}
                    width={75}
                  />
                  <Tooltip content={<CategoryTooltip total={totalActions} />} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={18}>
                    {chartData.map((entry) => (
                      <Cell key={`cat-${entry.key}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Top Category Badges */}
            <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-100">
              {chartData.map((item) => (
                <span
                  key={item.key}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-50 text-slate-700 border border-slate-200"
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span>{item.name}:</span>
                  <span className="font-bold text-slate-900">{item.count}</span>
                  <span className="text-slate-400">({item.percentage}%)</span>
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] font-mono text-slate-400">
          <span>Source: M2 NormalizedAction</span>
          <span className="font-semibold text-slate-600">Total: {totalActions} calls</span>
        </div>
      </CardContent>
    </Card>
  );
});

interface CategoryTooltipProps {
  active?: boolean;
  payload?: any[];
  total: number;
}

const CategoryTooltip = React.memo(function CategoryTooltip({ active, payload, total }: CategoryTooltipProps) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const pct = total > 0 ? ((data.count / total) * 100).toFixed(1) : '0';

    return (
      <div className="bg-white p-2.5 border border-slate-200 shadow-md rounded-md text-xs font-mono">
        <div className="flex items-center gap-2 mb-1">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: data.color }} />
          <span className="font-bold text-slate-800">{data.fullName}</span>
        </div>
        <div className="text-slate-600">
          Invocations: <span className="font-bold text-slate-900">{data.count}</span> ({pct}%)
        </div>
      </div>
    );
  }
  return null;
});
