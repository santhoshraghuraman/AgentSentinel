import { useQuery } from '@tanstack/react-query';
import { systemService } from '../api/services';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Server, Database, Brain, Shield, Activity, ShieldAlert } from 'lucide-react';
import { cn } from '../utils/cn';

export function SettingsPage() {
  const { data: diagnostics, isLoading, isError } = useQuery({
    queryKey: ['systemDiagnostics'],
    queryFn: systemService.getDiagnostics,
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const getStatusBadge = (status?: string) => {
    if (!status) return <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-200 text-[11px] font-mono font-bold uppercase tracking-wider">UNKNOWN</Badge>;
    const normalized = status.toUpperCase();
    if (normalized.includes('HEALTHY') || normalized.includes('AVAILABLE') || normalized === 'MOCK_ACTIVE') {
      return <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[11px] font-mono font-bold uppercase tracking-wider">{normalized}</Badge>;
    }
    if (normalized.includes('DEGRADED') || normalized.includes('MISSING')) {
      return <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-200 text-[11px] font-mono font-bold uppercase tracking-wider">{normalized}</Badge>;
    }
    return <Badge variant="outline" className="bg-rose-100 text-rose-800 border-rose-200 text-[11px] font-mono font-bold uppercase tracking-wider">{normalized}</Badge>;
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center text-slate-400 gap-4">
          <Activity className="h-8 w-8 motion-safe:animate-pulse text-blue-600" />
          <p className="text-xs font-mono">Loading system diagnostics...</p>
        </div>
      </div>
    );
  }

  if (isError || !diagnostics) {
    return (
      <div className="h-full flex flex-col gap-6 pb-8">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono mb-1">
            <span className="text-slate-400 uppercase tracking-wider font-semibold">SYSTEM & CONFIG</span>
            <span className="text-slate-300">//</span>
            <span className="text-blue-700 font-bold uppercase tracking-tight">DIAGNOSTICS</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <span>System Diagnostics</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">Read-only view of runtime configuration and health.</p>
        </div>
        <Card className="border-rose-200 shadow-xs bg-rose-50">
          <CardContent className="p-6 flex flex-col items-center justify-center text-rose-700">
            <ShieldAlert className="h-10 w-10 mb-4 opacity-75" />
            <h2 className="text-lg font-bold mb-2">Backend Unavailable</h2>
            <p className="text-xs font-medium text-center max-w-md">
              Failed to reach the AgentSentinel backend. Please ensure the FastAPI server is running and reachable on port 8000.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 h-full pb-10">
      {/* Top Breadcrumbs & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono mb-1">
            <span className="text-slate-400 uppercase tracking-wider font-semibold">SYSTEM & CONFIG</span>
            <span className="text-slate-300">//</span>
            <span className="text-blue-700 font-bold uppercase tracking-tight">DIAGNOSTICS</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <span>System Diagnostics</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time, read-only configuration and telemetry extracted securely from the AgentSentinel runtime.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 overflow-y-auto pr-1">
        {/* System Health */}
        <Card className="border-slate-200 shadow-xs bg-white">
          <CardHeader className="p-4 border-b border-slate-100 bg-slate-50/50">
            <CardTitle className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <Server className="h-4 w-4 text-blue-600" />
              AgentSentinel Core
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">API Status</span>
              {getStatusBadge(diagnostics.health.status)}
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Version</span>
              <span className="font-mono text-xs font-bold text-slate-900">{diagnostics.health.version}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Milestone Target</span>
              <Badge variant="outline" className="font-mono text-[11px] font-bold bg-slate-100 text-slate-700 border-slate-200 uppercase tracking-wider">
                {diagnostics.health.milestone}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Database */}
        <Card className="border-slate-200 shadow-xs bg-white">
          <CardHeader className="p-4 border-b border-slate-100 bg-slate-50/50">
            <CardTitle className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <Database className="h-4 w-4 text-blue-600" />
              Persistence Layer
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-4 flex flex-col h-[calc(100%-52px)]">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Storage Engine</span>
              <span className="font-mono text-xs font-bold text-slate-900">{diagnostics.database.type}</span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Connection Status</span>
              {getStatusBadge(diagnostics.database.status)}
            </div>
            <div className="mt-auto p-3 bg-slate-50 rounded-lg border border-slate-200 text-[11px] text-slate-600 font-medium leading-relaxed shadow-sm">
              AgentSentinel telemetry, tasks, policies, and session states are securely stored in a local SQLite database.
            </div>
          </CardContent>
        </Card>

        {/* LLM Provider */}
        <Card className="border-slate-200 shadow-xs bg-white">
          <CardHeader className="p-4 border-b border-slate-100 bg-slate-50/50">
            <CardTitle className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <Brain className="h-4 w-4 text-blue-600" />
              Runtime Intelligence
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Provider</span>
              <span className="font-mono text-xs font-bold text-slate-900">{diagnostics.llm.provider}</span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Model</span>
              <Badge variant="outline" className="font-mono text-[11px] font-bold bg-blue-50 text-blue-700 border-blue-200 uppercase tracking-wider">
                {diagnostics.llm.model}
              </Badge>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Endpoint Host</span>
              <span className="font-mono text-[11px] text-slate-600 max-w-[200px] truncate" title={diagnostics.llm.host}>
                {diagnostics.llm.host}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Model Availability</span>
              {getStatusBadge(diagnostics.llm.status)}
            </div>
          </CardContent>
        </Card>

        {/* Governance Config */}
        <Card className="border-slate-200 shadow-xs bg-white">
          <CardHeader className="p-4 border-b border-slate-100 bg-slate-50/50">
            <CardTitle className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <Shield className="h-4 w-4 text-blue-600" />
              Governance & Security
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-4 flex flex-col h-[calc(100%-52px)]">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Fail-Safe Behavior</span>
              <Badge 
                variant="outline" 
                className={cn(
                  "font-mono text-[11px] font-bold uppercase tracking-wider", 
                  diagnostics.governance.fail_safe_enabled 
                    ? "text-emerald-800 bg-emerald-100 border-emerald-200" 
                    : "text-rose-800 bg-rose-100 border-rose-200"
                )}
              >
                {diagnostics.governance.fail_safe_enabled ? "ENABLED (BLOCK ON ERROR)" : "DISABLED"}
              </Badge>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Active Custom Policies</span>
              <span className="font-mono text-xs font-bold text-slate-900">{diagnostics.governance.active_policies}</span>
            </div>
            <div className="mt-auto p-3 bg-slate-50 rounded-lg border border-slate-200 text-[11px] text-slate-600 font-medium leading-relaxed shadow-sm">
              M8 Decision Fusion enforces all active static rules, ML probability thresholds, and explicit permission checks prior to any capability execution.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
