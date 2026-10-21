import React, { useCallback } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { format } from 'date-fns';
import { parseUtcDate } from '../../utils/datetime';

export interface TimelineDataPoint {
  time: string;
  allow: number;
  alert: number;
  block: number;
}

interface GovernanceTimelineChartProps {
  data: TimelineDataPoint[];
  bucketSize: number; // in seconds
  isLoading?: boolean;
}

export const GovernanceTimelineChart = React.memo(function GovernanceTimelineChart({ data, bucketSize, isLoading }: GovernanceTimelineChartProps) {
  // Format the X-axis differently based on bucket size (called unconditionally before early returns)
  const formatXAxis = useCallback((tickItem: string) => {
    try {
      const date = parseUtcDate(tickItem);
      if (bucketSize >= 3600) {
        return format(date, 'HH:mm');
      } else if (bucketSize >= 60) {
        return format(date, 'HH:mm');
      } else {
        return format(date, 'HH:mm:ss');
      }
    } catch {
      return tickItem;
    }
  }, [bucketSize]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full w-full text-slate-400">
        <div className="flex flex-col items-center gap-2">
          <svg className="animate-spin h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-sm font-medium">Loading telemetry...</span>
        </div>
      </div>
    );
  }

  const isEmpty = !data || data.length === 0 || data.every(d => d.allow === 0 && d.alert === 0 && d.block === 0);

  if (isEmpty) {
    return (
      <div className="flex items-center justify-center h-full w-full text-slate-500">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center mb-1">
            <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span className="text-sm font-medium">No governance events in this time window.</span>
        </div>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart
        data={data}
        margin={{
          top: 10,
          right: 10,
          left: -20,
          bottom: 0,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
        <XAxis 
          dataKey="time" 
          tickFormatter={formatXAxis} 
          tick={{ fontSize: 11, fill: '#64748b' }} 
          axisLine={false} 
          tickLine={false} 
          minTickGap={30}
        />
        <YAxis 
          tick={{ fontSize: 11, fill: '#64748b' }} 
          axisLine={false} 
          tickLine={false} 
          allowDecimals={false}
        />
        <Tooltip content={<CustomTooltip bucketSize={bucketSize} />} cursor={{ fill: '#f8fafc' }} />
        <Legend 
          iconType="circle" 
          wrapperStyle={{ fontSize: 12, paddingTop: '10px' }}
        />
        <Bar dataKey="allow" name="Allow" stackId="a" fill="#2563eb" maxBarSize={40} />
        <Bar dataKey="alert" name="Alert" stackId="a" fill="#f59e0b" maxBarSize={40} />
        <Bar dataKey="block" name="Block" stackId="a" fill="#dc2626" maxBarSize={40} />
      </ComposedChart>
    </ResponsiveContainer>
  );
});

const CustomTooltip = React.memo(({ active, payload, label, bucketSize }: any) => {
  if (active && payload && payload.length) {
    let timeStr = label;
    try {
      const date = parseUtcDate(label);
      timeStr = bucketSize >= 3600 ? format(date, 'MMM d, HH:mm') : format(date, 'HH:mm:ss');
    } catch {
      timeStr = label;
    }
    return (
      <div className="bg-white p-3 border border-slate-200 shadow-lg rounded-md text-sm">
        <p className="font-semibold text-slate-700 mb-2">{timeStr}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center justify-between gap-4 mb-1">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-slate-600 capitalize">{entry.name}</span>
            </div>
            <span className="font-medium text-slate-900">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
});
