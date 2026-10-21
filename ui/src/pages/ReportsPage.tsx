import { useQuery } from '@tanstack/react-query';
import { reportService } from '../api/services';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { formatDateTime } from '../utils/datetime';
import { 
  Download, 
  AlertTriangle, 
  XCircle, 
  CheckCircle2, 
  FileSpreadsheet, 
  Database,
  Calendar,
  ShieldCheck,
  ShieldAlert
} from 'lucide-react';

export function ReportsPage() {
  const { data: report, isLoading, error } = useQuery({
    queryKey: ['complianceReport'],
    queryFn: reportService.getCompliance,
    refetchInterval: 10000,
  });

  return (
    <div className="flex flex-col gap-5 h-full pb-10">
      {/* Top Breadcrumbs & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono mb-1">
            <span className="text-slate-400 uppercase tracking-wider font-semibold">FORENSICS & COMPLIANCE</span>
            <span className="text-slate-300">//</span>
            <span className="text-blue-700 font-bold uppercase tracking-tight">REPORTS</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <span>Compliance & Governance Reports</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Automated regulatory posture audits, execution integrity records, and forensic data exports.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a href={reportService.getExportUrl('csv')} download>
            <Button variant="outline" className="h-8 text-xs font-semibold border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-xs gap-1.5 whitespace-nowrap">
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
              <span>Export Audit (CSV)</span>
            </Button>
          </a>
          <a href={reportService.getExportUrl('json')} download>
            <Button className="h-8 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs gap-1.5 whitespace-nowrap">
              <Download className="h-3.5 w-3.5" />
              <span>Export Report (JSON)</span>
            </Button>
          </a>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-1">
        {isLoading ? (
          <div className="p-12 text-center text-xs font-mono text-slate-400 bg-white rounded-xl border border-slate-200">
            Compiling compliance records...
          </div>
        ) : error ? (
          <div className="p-4 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 text-xs font-mono flex items-center gap-2">
            <ShieldAlert className="h-4 w-4" />
            <span>Error retrieving compliance data. API may be unreachable.</span>
          </div>
        ) : report ? (
          <div className="space-y-5">
            {/* Header Status Card */}
            <Card className="border-slate-200 shadow-xs bg-white">
              <CardContent className="p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <ShieldCheck className="h-5 w-5 text-emerald-600" />
                        {report.platform}
                      </h2>
                      <Badge variant="allow" className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[11px] font-mono uppercase tracking-wider font-bold">
                        {report.compliance_status}
                      </Badge>
                    </div>
                    <p className="text-[11px] font-mono text-slate-500 mt-1.5 font-medium">
                      Report Reference: {report.report_id}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono font-bold bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-md">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                    Generated: {formatDateTime(report.generated_at)}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Core Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="p-4 border-slate-200 shadow-xs bg-white flex flex-col justify-between items-center text-center">
                <Database className="h-6 w-6 text-slate-400 mb-2" />
                <p className="text-[11px] font-bold font-mono text-slate-500 uppercase tracking-wider">Total Interceptions</p>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold font-mono text-slate-900">
                    {report.posture.total_interceptions}
                  </span>
                </div>
                <div className="mt-2 text-[11px] font-mono text-slate-400">Governance events logged</div>
              </Card>

              <Card className="p-4 border-slate-200 shadow-xs bg-white flex flex-col justify-between items-center text-center">
                <CheckCircle2 className="h-6 w-6 text-emerald-600 mb-2" />
                <p className="text-[11px] font-bold font-mono text-slate-500 uppercase tracking-wider">Allowed Actions</p>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold font-mono text-emerald-600">
                    {report.posture.decisions.allow || 0}
                  </span>
                </div>
                <div className="mt-2 text-[11px] font-mono text-slate-400">Permitted operations</div>
              </Card>

              <Card className="p-4 border-slate-200 shadow-xs bg-white flex flex-col justify-between items-center text-center">
                <AlertTriangle className="h-6 w-6 text-amber-500 mb-2" />
                <p className="text-[11px] font-bold font-mono text-slate-500 uppercase tracking-wider">Alert Rate</p>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold font-mono text-amber-600">
                    {(report.posture.alert_rate * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="mt-2 text-[11px] font-mono text-slate-400">Monitored triggers</div>
              </Card>

              <Card className="p-4 border-slate-200 shadow-xs bg-white flex flex-col justify-between items-center text-center">
                <XCircle className="h-6 w-6 text-rose-500 mb-2" />
                <p className="text-[11px] font-bold font-mono text-slate-500 uppercase tracking-wider">Block Rate</p>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold font-mono text-rose-600">
                    {(report.posture.block_rate * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="mt-2 text-[11px] font-mono text-slate-400">Denied executions</div>
              </Card>
            </div>

            {/* Decisions & Execution Integrity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <Card className="border-slate-200 shadow-xs bg-white">
                <CardHeader className="p-4 border-b border-slate-100 bg-slate-50/50">
                  <CardTitle className="text-sm font-bold text-slate-900">Governance Decisions Distribution</CardTitle>
                  <CardDescription className="text-xs text-slate-500 mt-1">Outcome of M7 Policy Fusion across all runtime interceptions.</CardDescription>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-[11px] font-mono border-b border-slate-100 pb-2">
                      <span className="flex items-center gap-2 font-bold text-slate-600">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                        ALLOW (Authorized)
                      </span>
                      <span className="font-extrabold text-slate-900">{report.posture.decisions.allow || 0}</span>
                    </div>

                    <div className="flex justify-between items-center text-[11px] font-mono border-b border-slate-100 pb-2">
                      <span className="flex items-center gap-2 font-bold text-slate-600">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                        ALERT (Monitored Execution)
                      </span>
                      <span className="font-extrabold text-slate-900">{report.posture.decisions.alert || 0}</span>
                    </div>

                    <div className="flex justify-between items-center text-[11px] font-mono border-b border-slate-100 pb-2">
                      <span className="flex items-center gap-2 font-bold text-slate-600">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                        BLOCK (Zero-Execution Stop)
                      </span>
                      <span className="font-extrabold text-slate-900">{report.posture.decisions.block || 0}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200 shadow-xs bg-white">
                <CardHeader className="p-4 border-b border-slate-100 bg-slate-50/50">
                  <CardTitle className="text-sm font-bold text-slate-900">Execution Outcome Integrity</CardTitle>
                  <CardDescription className="text-xs text-slate-500 mt-1">Verified tool invocation lifecycle states.</CardDescription>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-[11px] font-mono border-b border-slate-100 pb-2">
                      <span className="flex items-center gap-2 font-bold text-slate-600">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                        EXECUTED (Success)
                      </span>
                      <span className="font-extrabold text-slate-900">{report.posture.execution_states.executed || 0}</span>
                    </div>

                    <div className="flex justify-between items-center text-[11px] font-mono border-b border-slate-100 pb-2">
                      <span className="flex items-center gap-2 font-bold text-slate-600">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                        BLOCKED (Callable executed 0 times)
                      </span>
                      <span className="font-extrabold text-slate-900">{report.posture.execution_states.blocked || 0}</span>
                    </div>

                    <div className="flex justify-between items-center text-[11px] font-mono border-b border-slate-100 pb-2">
                      <span className="flex items-center gap-2 font-bold text-slate-600">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                        EXECUTION FAILED (Tool Raised Exception)
                      </span>
                      <span className="font-extrabold text-slate-900">{report.posture.execution_states.execution_failed || 0}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* System Governance Posture */}
            <Card className="border-slate-200 shadow-xs bg-white">
              <CardHeader className="p-4 border-b border-slate-100 bg-slate-50/50">
                <CardTitle className="text-sm font-bold text-slate-900">Governance Rules & Empirical ML State</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-[11px] font-mono">
                  <div className="space-y-3">
                    <h4 className="font-bold text-slate-400 uppercase tracking-wider">Governance Setup</h4>
                    <div className="flex justify-between border-b border-slate-100 pb-1.5">
                      <span className="text-slate-600 font-semibold">Active Governance Policies</span>
                      <span className="font-extrabold text-slate-900">{report.governance.active_policies_count}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-100 pb-1.5">
                      <span className="text-slate-600 font-semibold">Registered Agent Sessions</span>
                      <span className="font-extrabold text-slate-900">{report.governance.total_registered_sessions}</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-bold text-slate-400 uppercase tracking-wider">Research Model Baseline</h4>
                    <div className="flex justify-between border-b border-slate-100 pb-1.5">
                      <span className="text-slate-600 font-semibold">Classifier</span>
                      <span className="font-extrabold text-blue-700">{report.ml_baseline.model_type}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-100 pb-1.5">
                      <span className="text-slate-600 font-semibold">Accuracy</span>
                      <span className="font-extrabold text-slate-900">
                        {report.ml_baseline.accuracy ? `${(report.ml_baseline.accuracy * 100).toFixed(1)}%` : 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-slate-100 pb-1.5">
                      <span className="text-slate-600 font-semibold">F1 Score</span>
                      <span className="font-extrabold text-slate-900">
                        {report.ml_baseline.f1_score ? report.ml_baseline.f1_score.toFixed(4) : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </div>
    </div>
  );
}
