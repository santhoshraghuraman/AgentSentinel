import { useQuery } from '@tanstack/react-query';
import { systemService } from '../api/services';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { AlertCircle, Server, Database, Shield, Zap } from 'lucide-react';

export function DiagnosticsPage() {
  const { data: diagnostics, isLoading, isError } = useQuery({
    queryKey: ['system-diagnostics'],
    queryFn: () => systemService.getDiagnostics(),
    refetchInterval: 5000,
  });

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (isError || !diagnostics) {
    return (
      <div className="flex h-[50vh] items-center justify-center text-destructive">
        <AlertCircle className="h-5 w-5 mr-2" />
        Failed to load diagnostics.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">System Diagnostics</h1>
        <p className="text-sm text-slate-500 mt-1">Real-time health and configuration status of AgentSentinel components.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Core Health</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{diagnostics.health.status}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Version {diagnostics.health.version} ({diagnostics.health.milestone})
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Database Status</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{diagnostics.database.status}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Provider: {diagnostics.database.type}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">LLM Provider</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold truncate" title={diagnostics.llm.status}>
              {diagnostics.llm.status}
            </div>
            <p className="text-xs text-muted-foreground mt-1 truncate" title={diagnostics.llm.host}>
              {diagnostics.llm.provider} - {diagnostics.llm.model}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Governance Engine</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <div className="text-2xl font-bold">{diagnostics.governance.active_policies}</div>
              <span className="text-sm text-muted-foreground">Active Policies</span>
            </div>
            <div className="mt-2">
              {diagnostics.governance.fail_safe_enabled ? (
                <Badge variant="default" className="bg-green-500/10 text-green-500 border-green-500/20">Fail-Safe Enabled</Badge>
              ) : (
                <Badge variant="destructive">Fail-Safe Disabled</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
