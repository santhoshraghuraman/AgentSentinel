import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { 
  Shield, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  ServerCrash, 
  Download, 
  Search, 
  ArrowRight,
  Users
} from 'lucide-react';
import { telemetryService, auditService, sessionService, reportService } from '../api/services';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { cn } from '../utils/cn';

import { GovernanceTimelineChart } from '../components/charts/GovernanceTimelineChart';

const STAGES = [
  { id: 'M2', name: 'Semantic Normalization' },
  { id: 'M5', name: 'Behavioral ML Inference' },
  { id: 'M6', name: 'Task Context Auth' },
  { id: 'M8', name: 'Runtime Policy Fusion' },
];

export function DashboardPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [timelineFilter, setTimelineFilter] = useState<'15m' | '1h' | '24h' | 'Live'>('Live');

  const { data: metrics, isLoading: isMetricsLoading, error: metricsError, refetch: refetchMetrics, isRefetching } = useQuery<any>({
    queryKey: ['metrics'],
    queryFn: () => telemetryService.getMetrics(),
    refetchInterval: 5000,
  });

  // Calculate since & bucket size based on filter
  const filterParams = useMemo(() => {
    let since: number | undefined;
    let bucketSize = 60;
    
    const now = Date.now();
    if (timelineFilter === '15m') {
      since = now - 15 * 60 * 1000;
      bucketSize = 60; // 1 min buckets
    } else if (timelineFilter === '1h') {
      since = now - 60 * 60 * 1000;
      bucketSize = 300; // 5 min buckets
    } else if (timelineFilter === '24h') {
      since = now - 24 * 60 * 60 * 1000;
      bucketSize = 1800; // 30 min buckets
    } else if (timelineFilter === 'Live') {
      since = now - 5 * 60 * 1000; // 5 min window for Live
      bucketSize = 10; // 10 second buckets
    }
    
    return { since, bucketSize };
  }, [timelineFilter]);

  const { data: auditEvents, isLoading: isAuditLoading, refetch: refetchAudit } = useQuery({
    queryKey: ['auditLogsAll', filterParams.since],
    queryFn: () => auditService.getAll(filterParams.since),
    refetchInterval: 5000,
  });

  const { data: timeseriesData, isLoading: isTimeseriesLoading, refetch: refetchTimeseries } = useQuery({
    queryKey: ['timeseries', filterParams.since, filterParams.bucketSize],
    queryFn: () => telemetryService.getTimeseries(filterParams.since, filterParams.bucketSize),
    refetchInterval: 5000,
  });

  const { data: sessions } = useQuery({
    queryKey: ['sessions'],
    queryFn: sessionService.listSessions,
    refetchInterval: 5000,
  });

  const handleRefresh = () => {
    refetchMetrics();
    refetchAudit();
    refetchTimeseries();
  };

  const filteredEvents = useMemo(() => {
    if (!auditEvents) return [];
    if (!searchTerm.trim()) return auditEvents.slice(0, 8);
    const q = searchTerm.toLowerCase();
    return auditEvents.filter(e => 
      e.tool_name?.toLowerCase().includes(q) ||
      e.session_id?.toLowerCase().includes(q) ||
      e.task_id?.toLowerCase().includes(q) ||
      e.decision?.toLowerCase().includes(q)
    ).slice(0, 8);
  }, [auditEvents, searchTerm]);

  // Aggregate event data for real timeline graph summary stats
  const timelineData = useMemo(() => {
    if (!timeseriesData || timeseriesData.length === 0) return { allow: 0, alert: 0, block: 0, total: 0 };
    const sums = timeseriesData.reduce((acc, curr) => ({
      allow: acc.allow + curr.allow,
      alert: acc.alert + curr.alert,
      block: acc.block + curr.block,
    }), { allow: 0, alert: 0, block: 0 });
    
    return {
      ...sums,
      total: sums.allow + sums.alert + sums.block
    };
  }, [timeseriesData]);

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto">
      {/* Top Banner / Breadcrumb & Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-bold font-mono tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              SYSTEM: OPERATIONAL
            </span>
            <span className="text-xs font-mono text-slate-400">SYNC_ID: #M8-RUNTIME</span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-slate-900">
            Overview Dashboard
          </h1>
          <p className="text-xs lg:text-sm text-slate-500 mt-1">
            Real-time autonomous agent telemetry, behavioral risk monitoring, and deterministic policy enforcement.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
            disabled={isMetricsLoading || isRefetching}
            className="h-9 text-xs font-semibold bg-white border-slate-200 text-slate-700 shadow-xs hover:bg-slate-50"
          >
            <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5", (isMetricsLoading || isRefetching) && "motion-safe:animate-spin")} />
            Sync Pipeline
          </Button>

          <a 
            href={reportService.getExportUrl('json')} 
            download="agent_sentinel_audit_export.json"
          >
            <Button 
              size="sm" 
              className="h-9 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Export Audit
            </Button>
          </a>
        </div>
      </div>

      {isMetricsLoading && !metrics ? (
        <div className="h-96 flex flex-col items-center justify-center text-slate-500 gap-3">
          <RefreshCw className="w-8 h-8 motion-safe:animate-spin text-blue-600" />
          <p className="text-sm font-medium">Connecting to M9 telemetry backend...</p>
        </div>
      ) : metricsError ? (
        <div className="h-96 flex flex-col items-center justify-center text-rose-600 gap-3 p-8 bg-rose-50/50 rounded-xl border border-rose-200">
          <ServerCrash className="w-10 h-10" />
          <h3 className="text-lg font-bold">Telemetry Offline</h3>
          <p className="text-xs text-rose-500 max-w-md text-center">Unable to load runtime metrics from M9 backend. Please verify FastAPI is running.</p>
          <Button variant="outline" size="sm" onClick={() => refetchMetrics()} className="mt-2">
            Retry Connection
          </Button>
        </div>
      ) : metrics ? (
        <div className="space-y-6">
          {/* Top 4 KPI Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Total Interceptions */}
            <Card className="p-5 flex flex-col justify-between border-slate-200 shadow-xs bg-white">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Interceptions</span>
                <div className="h-8 w-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                  <Shield className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3">
                <h3 className="text-3xl font-extrabold text-slate-900 tracking-tight font-mono">
                  {metrics.total_interceptions ?? 0}
                </h3>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500">Total Pipeline Events</span>
                <span className="font-semibold text-emerald-600 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Active
                </span>
              </div>
            </Card>

            {/* Card 2: Allowed */}
            <Card className="p-5 flex flex-col justify-between border-slate-200 shadow-xs bg-white">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Allowed</span>
                <div className="h-8 w-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3">
                <h3 className="text-3xl font-extrabold text-emerald-600 tracking-tight font-mono">
                  {metrics.decisions?.allow ?? 0}
                </h3>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500">Authorized Actions</span>
                <span className="font-semibold text-emerald-700 font-mono">
                  {metrics.total_interceptions ? `${Math.round(((metrics.decisions?.allow || 0) / metrics.total_interceptions) * 100)}%` : '0%'}
                </span>
              </div>
            </Card>

            {/* Card 3: Blocked */}
            <Card className="p-5 flex flex-col justify-between border-slate-200 shadow-xs bg-white">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Blocked</span>
                <div className="h-8 w-8 rounded-lg bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
                  <XCircle className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <h3 className="text-3xl font-extrabold text-rose-600 tracking-tight font-mono">
                  {metrics.decisions?.block ?? 0}
                </h3>
                <span className="text-xs font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                  Threats Blocked
                </span>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500">Alerted: {metrics.decisions?.alert ?? 0}</span>
                <span className="font-semibold text-rose-600 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                  M8 Enforced
                </span>
              </div>
            </Card>

            {/* Card 4: Active Agent Sessions */}
            <Card className="p-5 flex flex-col justify-between border-slate-200 shadow-xs bg-white">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Active Sessions</span>
                <div className="h-8 w-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                  <Users className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <h3 className="text-3xl font-extrabold text-slate-900 tracking-tight font-mono">
                  {sessions?.length ?? 0}
                </h3>
                <span className="text-xs font-medium text-slate-400 font-mono">
                  Local Runtime
                </span>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500">Local Agent Runtime</span>
                <span className="font-semibold text-blue-600 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  Tracked
                </span>
              </div>
            </Card>
          </div>

          {/* Middle Row: Runtime Activity Chart & Engine Health Matrix */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Runtime Governance Activity */}
            <Card className="lg:col-span-2 p-6 border-slate-200 shadow-xs bg-white flex flex-col justify-between">
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Runtime Governance Activity</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Real-time sequence of intercepted actions and security decisions.</p>
                  </div>

                  {/* Filter Pills */}
                  <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-medium">
                    {(['15m', '1h', '24h', 'Live'] as const).map((filter) => (
                      <button
                        key={filter}
                        type="button"
                        onClick={() => setTimelineFilter(filter)}
                        className={cn(
                          "px-2.5 py-1 rounded-md motion-safe:transition-all font-mono text-[11px]",
                          timelineFilter === filter 
                            ? "bg-white text-slate-900 shadow-xs font-bold" 
                            : "text-slate-500 hover:text-slate-900"
                        )}
                      >
                        {filter}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Legend & Real Stats */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-xs font-mono mt-4">
                    <div className="flex items-center gap-1.5 text-slate-600">
                      <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />
                      <span>Authorized ({timelineData.allow})</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-600">
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                      <span>Alerts ({timelineData.alert})</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-600">
                      <span className="h-2.5 w-2.5 rounded-full bg-rose-600" />
                      <span>Blocks ({timelineData.block})</span>
                    </div>
                  </div>
                </div>

                {/* Dynamic Recharts Timeline */}
                <div className="mt-6 mb-2 h-[220px]">
                  <GovernanceTimelineChart 
                    data={timeseriesData || []} 
                    bucketSize={filterParams.bucketSize} 
                    isLoading={isTimeseriesLoading && !timeseriesData}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-3 border-t border-slate-100">
                <span>Window: {timelineFilter}</span>
                <span className="text-slate-300">—</span>
                <span className="text-slate-300">—</span>
                <span className="text-slate-300">—</span>
                <span className="font-semibold text-slate-600">Resolution: {filterParams.bucketSize >= 60 ? filterParams.bucketSize / 60 + 'm' : filterParams.bucketSize + 's'}</span>
              </div>
            </Card>

            {/* Right 1 Col: Engine Health Matrix */}
            <Card className="p-6 border-slate-200 shadow-xs bg-white flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Engine Health Matrix</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Pipeline stage status</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] font-mono uppercase text-slate-400 block">PIPELINE STATUS</span>
                    <span className="text-sm font-extrabold text-emerald-600 font-mono">Active</span>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between text-xs bg-emerald-50/70 p-2.5 rounded-lg border border-emerald-200/80">
                  <span className="text-emerald-800 font-medium">Deterministic Invariants:</span>
                  <span className="font-bold font-mono text-emerald-700">ARMED (Nominal)</span>
                </div>

                <div className="grid grid-cols-1 gap-3 mt-4">
                  {STAGES.map((s) => (
                    <div 
                      key={s.id} 
                      className="p-3 rounded-lg border border-slate-100 bg-slate-50/60 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                        <span className="font-bold font-mono text-slate-800 text-[11px]">{s.id}</span>
                        <span className="text-slate-500 text-xs truncate">{s.name}</span>
                      </div>
                      <span className="font-bold font-mono text-emerald-700 text-[11px]">Active</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 text-[11px] font-mono text-slate-400 flex items-center justify-between">
                <span>Verified Intercept Sequence</span>
                <span className="text-emerald-600 font-semibold">100% Invariants Active</span>
              </div>
            </Card>
          </div>

          {/* Bottom Row: Recent Runtime Interceptions Table */}
          <Card className="border-slate-200 shadow-xs bg-white overflow-hidden">
            <CardHeader className="py-4 px-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <CardTitle className="text-base font-bold text-slate-900">Recent Runtime Interceptions</CardTitle>
                <Badge variant="outline" className="text-[11px] font-mono uppercase bg-slate-50 text-slate-600 border-slate-200">
                  Deterministic Rule Engine
                </Badge>
              </div>

              {/* Search Filter */}
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter by tool or session..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold font-mono uppercase text-slate-400 tracking-wider">
                      <th className="py-2.5 px-6">TIMESTAMP</th>
                      <th className="py-2.5 px-4">AGENT / SESSION</th>
                      <th className="py-2.5 px-4">TOOL CALL & PAYLOAD</th>
                      <th className="py-2.5 px-4">BEHAVIORAL RISK</th>
                      <th className="py-2.5 px-4">AUTH CONTEXT</th>
                      <th className="py-2.5 px-6 text-right">VERDICT</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredEvents.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400 font-mono">
                          {isAuditLoading ? 'Loading audit records...' : 'No runtime interceptions recorded yet.'}
                        </td>
                      </tr>
                    ) : (
                      filteredEvents.map((event) => {
                        const isBlock = event.decision === 'BLOCK';
                        const isAlert = event.decision === 'ALERT';
                        const riskScore = event.action_record?.risk_score;
                        
                        return (
                          <tr 
                            key={event.interception_id}
                            className={cn(
                              "motion-safe:transition-colors hover:bg-slate-50/70",
                              isBlock && "bg-rose-50/30"
                            )}
                          >
                            <td className="py-3 px-6 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                              {new Date(event.timestamp).toLocaleTimeString()}
                            </td>
                            <td className="py-3 px-4 font-mono font-medium text-slate-800 whitespace-nowrap">
                              <span className="text-[11px] truncate max-w-[140px] inline-block" title={event.session_id}>
                                {event.session_id.replace(/^session-/, '')}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-mono text-xs">
                              <span className={cn(
                                "font-bold",
                                isBlock ? "text-rose-700" : isAlert ? "text-amber-700" : "text-blue-600"
                              )}>
                                {event.tool_name || event.action?.normalized_name || 'unknown'}
                              </span>
                              <span className="text-slate-400 text-[11px] ml-1.5 truncate max-w-[180px] inline-block align-bottom">
                                ({event.arguments ? JSON.stringify(event.arguments).slice(0, 30) + '...' : ''})
                              </span>
                            </td>
                            <td className="py-3 px-4 font-mono">
                              {riskScore !== undefined ? (
                                <span className={cn(
                                  "inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold",
                                  riskScore > 0.7 
                                    ? "bg-rose-100 text-rose-800" 
                                    : riskScore > 0.4 
                                    ? "bg-amber-100 text-amber-800" 
                                    : "bg-emerald-100 text-emerald-800"
                                )}>
                                  {riskScore > 0.7 ? 'CRITICAL' : riskScore > 0.4 ? 'MED' : 'LOW'} ({riskScore})
                                </span>
                              ) : (
                                <span className="text-slate-400 text-[11px]">N/A</span>
                              )}
                            </td>
                            <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                              {event.action_record?.auth_status || event.task_id || 'ALLOWED_SCOPE'}
                            </td>
                            <td className="py-3 px-6 text-right whitespace-nowrap">
                              <Badge 
                                variant={event.decision.toLowerCase() as any}
                                className={cn(
                                  "font-bold font-mono text-[11px] tracking-wider uppercase px-2 py-0.5",
                                  isBlock ? "bg-rose-100 text-rose-800 border-rose-200" :
                                  isAlert ? "bg-amber-100 text-amber-800 border-amber-200" :
                                  "bg-emerald-100 text-emerald-800 border-emerald-200"
                                )}
                              >
                                {isBlock ? '● BLOCK' : isAlert ? 'ALERT' : '● ALLOW'}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Table Footer */}
              <div className="py-3 px-6 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-slate-500 font-mono text-[11px]">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 motion-safe:animate-pulse" />
                  <span>Streaming live runtime telemetry...</span>
                </div>
                <Link 
                  to="/audit" 
                  className="font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 motion-safe:transition-colors"
                >
                  View Full Audit Log
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
