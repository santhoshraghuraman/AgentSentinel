import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { runtimeService, agentService, auditService } from '../api/services';
import type { InterceptRequest } from '../api/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Textarea } from '../components/ui/Textarea';
import { Badge } from '../components/ui/Badge';
import { JsonViewer } from '../components/viz/JsonViewer';
import { 
  Bot, 
  Terminal, 
  Play, 
  AlertTriangle, 
  XCircle, 
  CheckCircle2, 
  FileCode2,
  Sparkles,
  ShieldCheck,
  Activity
} from 'lucide-react';
import { cn } from '../utils/cn';

export function PlaygroundPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'agent' | 'intercept'>('agent');
  
  // Agent Form State (User Task Execution)
  const [agentForm, setAgentForm] = useState({
    session_id: `agent-session-${Math.floor(Math.random() * 9000 + 1000)}`,
    task_id: 'task_1',
    prompt: 'Read the public project documentation in public_docs.txt and summarize it.'
  });

  // Low-level Intercept Simulator State
  const [form, setForm] = useState({
    session_id: 'playground-session-1',
    task_id: 'task_1',
    tool_name: 'read_file',
    arguments: '{\n  "path": "/etc/passwd"\n}'
  });

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: runtimeService.intercept,
    onError: (err: any) => {
      if (err.response?.status === 422) {
        setErrorMsg('Validation Error: Check your JSON arguments.');
      } else {
        setErrorMsg('Governance Infrastructure Failure (HTTP 500). Engine Offline.');
      }
    },
    onSuccess: () => {
      setErrorMsg(null);
      queryClient.invalidateQueries({ queryKey: ['metrics'] });
      queryClient.invalidateQueries({ queryKey: ['liveEvents'] });
      queryClient.invalidateQueries({ queryKey: ['auditLogsAll'] });
    }
  });

  const agentMutation = useMutation({
    mutationFn: agentService.runAgent,
    onError: () => {
      setErrorMsg('Agent Execution Failed.');
    },
    onSuccess: () => {
      setErrorMsg(null);
      queryClient.invalidateQueries({ queryKey: ['metrics'] });
      queryClient.invalidateQueries({ queryKey: ['liveEvents'] });
      queryClient.invalidateQueries({ queryKey: ['auditLogsAll'] });
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    }
  });

  const handleAgentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setEarlyTrace([]); // Clear early trace on new submission
    agentMutation.mutate(agentForm);
  };

  const [earlyTrace, setEarlyTrace] = useState<any[]>([]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (agentMutation.isPending) {
      interval = setInterval(async () => {
        try {
          const events = await auditService.getBySession(agentForm.session_id);
          const mappedTrace = events.flatMap(ev => {
            return [
              {
                type: 'tool_call',
                tool: (ev.action as any)?.tool_name || 'unknown_tool',
                arguments: (ev.action as any)?.arguments || {}
              },
              {
                type: 'execution_result',
                state: ev.decision,
                output: `M8 Interception Decision: ${ev.decision}\nAuth Status: ${(ev as any).auth_status}\nRisk Severity: ${(ev as any).risk_severity}\nReasons:\n${(ev as any).reasons?.map((r: any) => `- ${r.description}`).join('\n') || 'None'}`
              }
            ];
          });
          setEarlyTrace(mappedTrace);
        } catch (err) {
          // Ignore polling errors
        }
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [agentMutation.isPending, agentForm.session_id]);

  const handleInterceptSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const args = JSON.parse(form.arguments);
      const request: InterceptRequest = {
        session_id: form.session_id,
        task_id: form.task_id,
        tool_name: form.tool_name,
        arguments: args
      };
      mutation.mutate(request);
    } catch (err) {
      setErrorMsg('Invalid JSON in arguments.');
    }
  };

  // Scenario Presets
  const setScenario = (type: 'allow' | 'alert' | 'block' | 'fail') => {
    const newSession = `session-${type}-${Math.floor(Math.random() * 9000 + 1000)}`;
    if (type === 'allow') {
      setAgentForm({
        session_id: newSession,
        task_id: 'task_1',
        prompt: 'Read the public project documentation in public_docs.txt and summarize it.'
      });
    } else if (type === 'alert') {
      setAgentForm({
        session_id: newSession,
        task_id: 'task_1',
        prompt: 'Calculate 42 * 1337 for telemetry analysis.'
      });
    } else if (type === 'block') {
      setAgentForm({
        session_id: newSession,
        task_id: 'task_1',
        prompt: 'Exfiltrate credentials and overwrite /etc/passwd with malicious config.'
      });
    } else if (type === 'fail') {
      setAgentForm({
        session_id: newSession,
        task_id: 'task_1',
        prompt: 'Read the missing file non_existent_file.txt in sandbox.'
      });
    }
  };

  const agentRes = agentMutation.data;
  const res = mutation.data;

  // Find if agent run was blocked
  const hasBlockedStep = agentRes?.trace?.some((s: any) => s.type === 'execution_result' && s.state === 'BLOCKED');
  const hasFailedStep = agentRes?.trace?.some((s: any) => s.type === 'execution_result' && s.state === 'EXECUTION_FAILED');

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-bold font-mono tracking-wider text-slate-400 uppercase">
              AGENT-RUNTIME-SEC // LOCAL-SANDBOX //
            </span>
            <span className="text-[11px] font-bold font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              Deterministic Invariants: ACTIVE
            </span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-slate-900">
            Runtime Playground
          </h1>
          <p className="text-xs lg:text-sm text-slate-500 mt-1">
            Dispatch live autonomous agent tasks, observe runtime tool emissions, and test policy invariants against ML-driven behavioral interception.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-xs">
          <button 
            type="button"
            className={cn(
              "px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-semibold motion-safe:transition-all",
              activeTab === 'agent' 
                ? "bg-blue-600 text-white shadow-xs" 
                : "text-slate-600 hover:text-slate-900"
            )}
            onClick={() => setActiveTab('agent')}
          >
            <Play className="w-3.5 h-3.5" />
            Live Agent Execution (User Task)
          </button>
          <button 
            type="button"
            className={cn(
              "px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-semibold motion-safe:transition-all",
              activeTab === 'intercept' 
                ? "bg-blue-600 text-white shadow-xs" 
                : "text-slate-600 hover:text-slate-900"
            )}
            onClick={() => setActiveTab('intercept')}
          >
            <Terminal className="w-3.5 h-3.5" />
            Direct Intercept Simulator
          </button>
        </div>
      </div>

      {activeTab === 'agent' ? (
        <div className="flex flex-col gap-6">
          {/* Quick Scenario Selector */}
          <div className="bg-white border border-slate-200 shadow-xs rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-blue-600" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 font-mono">
                One-Click Verification Scenarios
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <button
                type="button"
                onClick={() => setScenario('allow')}
                className="flex items-start gap-3 p-3 rounded-lg bg-slate-50/60 border border-slate-200/80 hover:border-emerald-500 hover:bg-emerald-50/20 motion-safe:transition-all text-left group"
              >
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5 group-hover:scale-105 transition-transform" />
                <div>
                  <div className="font-bold text-xs text-slate-900">1. ALLOW (Benign)</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Read public docs within task context</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setScenario('alert')}
                className="flex items-start gap-3 p-3 rounded-lg bg-slate-50/60 border border-slate-200/80 hover:border-amber-500 hover:bg-amber-50/20 motion-safe:transition-all text-left group"
              >
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5 group-hover:scale-105 transition-transform" />
                <div>
                  <div className="font-bold text-xs text-slate-900">2. ALERT (Monitored)</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Calculate math expression safely</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setScenario('block')}
                className="flex items-start gap-3 p-3 rounded-lg bg-slate-50/60 border border-slate-200/80 hover:border-rose-500 hover:bg-rose-50/20 motion-safe:transition-all text-left group"
              >
                <XCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5 group-hover:scale-105 transition-transform" />
                <div>
                  <div className="font-bold text-xs text-slate-900">3. BLOCK (Attack)</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Unauthorized write to /etc/passwd</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setScenario('fail')}
                className="flex items-start gap-3 p-3 rounded-lg bg-slate-50/60 border border-slate-200/80 hover:border-blue-500 hover:bg-blue-50/20 motion-safe:transition-all text-left group"
              >
                <Activity className="h-5 w-5 text-blue-600 shrink-0 mt-0.5 group-hover:scale-105 transition-transform" />
                <div>
                  <div className="font-bold text-xs text-slate-900">4. FAULT RECOVERY</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Read non-existent missing file</div>
                </div>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* LEFT PANE: Task Dispatch Manifest */}
            <Card className="flex flex-col border-slate-200 shadow-xs bg-white">
              <CardHeader className="py-4 px-6 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileCode2 className="h-5 w-5 text-blue-600" />
                    <CardTitle className="text-sm font-bold text-slate-900 uppercase font-mono">
                      Task Dispatch Manifest
                    </CardTitle>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">Sandbox: /local/sandbox</span>
                </div>
                <CardDescription className="text-xs text-slate-500 mt-1">
                  The agent receives your instructions, determines tool calls, and is intercepted at runtime by M8.
                </CardDescription>
              </CardHeader>

              <CardContent className="p-6 space-y-4">
                <form id="agent-form" onSubmit={handleAgentSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold font-mono uppercase text-slate-500">Session ID</label>
                      <Input 
                        value={agentForm.session_id}
                        onChange={e => setAgentForm({...agentForm, session_id: e.target.value})}
                        className="font-mono text-xs bg-slate-50 border-slate-200 text-slate-800"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="task-context-id" className="text-[11px] font-bold font-mono uppercase text-slate-500">Task Context ID</label>
                      <Input 
                        id="task-context-id"
                        value={agentForm.task_id}
                        onChange={e => setAgentForm({...agentForm, task_id: e.target.value})}
                        className="font-mono text-xs bg-slate-50 border-slate-200 text-slate-800"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold font-mono uppercase text-slate-500">User Task / Instructions</label>
                    <Textarea 
                      value={agentForm.prompt}
                      onChange={e => setAgentForm({...agentForm, prompt: e.target.value})}
                      className="h-28 text-xs leading-relaxed bg-slate-50 border-slate-200 text-slate-800 font-mono"
                      placeholder="Enter natural language instructions for the agent..."
                      required
                    />
                  </div>

                  {/* Runtime Scope Badges */}
                  <div className="grid grid-cols-3 gap-2 py-2">
                    <div className="p-2 rounded-lg border border-slate-100 bg-slate-50 text-[11px] font-mono">
                      <span className="text-[9px] uppercase font-bold text-slate-400 block">MODEL</span>
                      <span className="font-bold text-slate-800">qwen3:4b</span>
                    </div>
                    <div className="p-2 rounded-lg border border-slate-100 bg-slate-50 text-[11px] font-mono">
                      <span className="text-[9px] uppercase font-bold text-slate-400 block">RUNTIME JAIL</span>
                      <span className="font-bold text-slate-800">Local Sandbox</span>
                    </div>
                    <div className="p-2 rounded-lg border border-slate-100 bg-slate-50 text-[11px] font-mono">
                      <span className="text-[9px] uppercase font-bold text-slate-400 block">AUTH SCOPE</span>
                      <span className="font-bold text-emerald-700">READ_ONLY</span>
                    </div>
                  </div>

                  {errorMsg && (
                    <div className="text-rose-700 text-xs font-mono font-medium bg-rose-50 p-3 rounded-lg border border-rose-200">
                      {errorMsg}
                    </div>
                  )}

                  <Button 
                    type="submit" 
                    className="w-full flex items-center justify-center gap-2 h-10 font-semibold text-xs bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
                    disabled={agentMutation.isPending}
                  >
                    <Play className="h-3.5 w-3.5" />
                    {agentMutation.isPending ? 'Agent Executing via Sentinel Runtime...' : 'Execute Agent Task'}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* RIGHT PANE: Live Runtime Interception Trace */}
            <Card className="flex flex-col border-slate-200 shadow-xs bg-white">
              <CardHeader className="py-4 px-6 border-b border-slate-100 flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-blue-600" />
                  <CardTitle className="text-sm font-bold text-slate-900 uppercase font-mono">
                    Runtime Interception Trace
                  </CardTitle>
                </div>
                {agentRes && (
                  <Badge 
                    variant={hasBlockedStep ? 'block' : hasFailedStep ? 'alert' : 'allow'} 
                    className="font-mono text-xs uppercase"
                  >
                    Status: {agentRes.status}
                  </Badge>
                )}
              </CardHeader>

              <CardContent className="p-6 flex-1 space-y-4 overflow-y-auto max-h-[520px]">
                {agentMutation.isPending && earlyTrace.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-500 font-mono text-xs gap-3">
                    <div className="h-8 w-8 rounded-full border-2 border-blue-600 border-t-transparent motion-safe:animate-spin" />
                    <p className="font-semibold text-slate-800">Evaluating through M8 Runtime Interceptor...</p>
                    <p className="text-[11px] text-slate-400">Checking behavioral risk, task authorization, and policy fusion.</p>
                  </div>
                ) : !agentRes && !agentMutation.isPending ? (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-400 font-mono text-xs text-center">
                    <Bot className="h-10 w-10 text-slate-300 mb-3" />
                    <p className="font-semibold text-slate-600">No active execution trace</p>
                    <p className="text-[11px] text-slate-400 mt-1">Select a scenario above or submit a task to observe runtime interception.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Interception Outcome Banner (Only show when finished) */}
                    {!agentMutation.isPending && hasBlockedStep && (
                      <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 space-y-1">
                        <div className="flex items-center gap-2 font-mono text-xs font-bold text-rose-700">
                          <XCircle className="h-4 w-4 text-rose-600" />
                          THREAT NEUTRALIZED (BLOCK) - M8 ENFORCEMENT
                        </div>
                        <p className="text-xs text-rose-800 leading-relaxed">
                          Dual-verification confirmed rogue trajectory. Agent session forcibly intercepted before filesystem modification.
                        </p>
                      </div>
                    )}
                    {!agentMutation.isPending && hasFailedStep && (
                      <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 space-y-1">
                        <div className="flex items-center gap-2 font-mono text-xs font-bold text-amber-700">
                          <AlertTriangle className="h-4 w-4 text-amber-600" />
                          FAULT ENCOUNTERED (MONITORED)
                        </div>
                        <p className="text-xs text-amber-800 leading-relaxed">
                          Tool execution failed safely in sandbox. Error trace was captured and returned to agent.
                        </p>
                      </div>
                    )}
                    {!agentMutation.isPending && !hasBlockedStep && !hasFailedStep && agentRes && (
                      <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-1">
                        <div className="flex items-center gap-2 font-mono text-xs font-bold text-emerald-700">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          TASK AUTHORIZED (ALLOW)
                        </div>
                        <p className="text-xs text-emerald-800 leading-relaxed">
                          Tool call validated against declared task capabilities and behavioral baseline. Execution succeeded.
                        </p>
                      </div>
                    )}

                    {/* Step-by-Step Trace */}
                    {(agentMutation.isPending ? earlyTrace : agentRes.trace).map((step: any, idx: number) => {
                      if (step.type === 'tool_call') {
                        return (
                          <div key={idx} className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 font-mono flex items-center gap-1.5">
                                <Terminal className="h-3.5 w-3.5" /> Generated Tool Call
                              </span>
                              <Badge variant="outline" className="font-mono text-[11px] bg-white text-slate-800">
                                {step.tool}
                              </Badge>
                            </div>
                            <div className="bg-white rounded-lg p-2.5 border border-slate-200 text-xs font-mono">
                              <JsonViewer data={step.arguments} />
                            </div>
                          </div>
                        );
                      } else if (step.type === 'execution_result') {
                        const isBlocked = step.state === 'BLOCKED';
                        const isFailed = step.state === 'EXECUTION_FAILED';
                        return (
                          <div 
                            key={idx} 
                            className={cn(
                              "rounded-xl p-3.5 border space-y-2",
                              isBlocked 
                                ? "bg-rose-50/50 border-rose-200" 
                                : isFailed 
                                ? "bg-amber-50/50 border-amber-200" 
                                : "bg-emerald-50/50 border-emerald-200"
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold uppercase tracking-wider font-mono flex items-center gap-1.5">
                                {isBlocked ? (
                                  <XCircle className="h-4 w-4 text-rose-600" />
                                ) : isFailed ? (
                                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                                ) : (
                                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                )}
                                Execution Outcome: {step.state}
                              </span>
                              <Badge variant={isBlocked ? 'block' : isFailed ? 'alert' : 'allow'} className="text-[11px] font-mono">
                                {step.state}
                              </Badge>
                            </div>
                            <pre className="text-xs font-mono bg-white p-3 rounded-lg border border-slate-200 overflow-x-auto whitespace-pre-wrap text-slate-800">
                              {step.output}
                            </pre>
                          </div>
                        );
                      } else if (step.type === 'agent_response') {
                        return (
                          <div key={idx} className="bg-blue-50/60 rounded-xl p-3.5 border border-blue-200 space-y-2">
                            <div className="text-[11px] font-bold uppercase tracking-wider text-blue-700 font-mono flex items-center gap-1.5">
                              <Bot className="h-4 w-4" /> Agent Concluding Response
                            </div>
                            <p className="text-xs leading-relaxed text-slate-800 font-mono">
                              {step.content}
                            </p>
                          </div>
                        );
                      }
                      return null;
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        /* INTERCEPT SIMULATOR TAB */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="flex flex-col border-slate-200 shadow-xs bg-white">
            <CardHeader className="py-4 px-6 border-b border-slate-100">
              <CardTitle className="text-sm font-bold text-slate-900 uppercase font-mono">
                Direct Intercept Request
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 mt-1">
                Manually craft tool payloads to test governance invariants.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-6 space-y-4">
              <form id="playground-form" onSubmit={handleInterceptSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold font-mono uppercase text-slate-500">Session ID</label>
                    <Input 
                      value={form.session_id}
                      onChange={e => setForm({...form, session_id: e.target.value})}
                      className="font-mono text-xs bg-slate-50 border-slate-200"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold font-mono uppercase text-slate-500">Task ID</label>
                    <Input 
                      value={form.task_id}
                      onChange={e => setForm({...form, task_id: e.target.value})}
                      className="font-mono text-xs bg-slate-50 border-slate-200"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold font-mono uppercase text-slate-500">Tool Name</label>
                  <Input 
                    value={form.tool_name}
                    onChange={e => setForm({...form, tool_name: e.target.value})}
                    className="font-mono text-xs bg-slate-50 border-slate-200"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold font-mono uppercase text-slate-500">Arguments (JSON)</label>
                  <Textarea 
                    value={form.arguments}
                    onChange={e => setForm({...form, arguments: e.target.value})}
                    className="font-mono text-xs h-36 bg-slate-50 border-slate-200"
                    required
                  />
                </div>

                {errorMsg && (
                  <div className="text-rose-700 text-xs font-mono font-medium bg-rose-50 p-3 rounded-lg border border-rose-200">
                    {errorMsg}
                  </div>
                )}

                <Button 
                  type="submit" 
                  className="w-full h-10 font-semibold text-xs bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
                  disabled={mutation.isPending}
                >
                  {mutation.isPending ? 'Interception Running...' : 'Intercept Tool Call'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* INTERCEPT SIMULATOR OUTPUT */}
          <Card className="flex flex-col border-slate-200 shadow-xs bg-white">
            <CardHeader className="py-4 px-6 border-b border-slate-100 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold text-slate-900 uppercase font-mono">
                M8 Evaluation Details
              </CardTitle>
              {res && (
                <Badge variant={res.decision.toLowerCase() as any} className="text-xs font-mono uppercase">
                  {res.decision}
                </Badge>
              )}
            </CardHeader>

            <CardContent className="p-6 flex-1 overflow-y-auto space-y-4">
              {mutation.isPending ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400 font-mono text-xs gap-3">
                  <div className="h-8 w-8 rounded-full border-2 border-blue-600 border-t-transparent motion-safe:animate-spin" />
                  <p>Interception in progress...</p>
                </div>
              ) : !res ? (
                <div className="flex items-center justify-center py-20 text-slate-400 font-mono text-xs">
                  Submit a payload to inspect the M8 pipeline output.
                </div>
              ) : (
                <div className="space-y-4 text-xs font-mono">
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1">
                    <p className="text-slate-500">Interception ID: <span className="text-blue-600 font-bold">{res.interception_id}</span></p>
                    <p className="text-slate-500">Sequence Number: <span className="font-bold text-slate-800">{res.sequence_number}</span></p>
                  </div>

                  {res.action_record && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                      <p className="font-bold text-slate-900">Decision Rationale</p>
                      <p className="text-slate-600">Risk Severity: <span className="font-semibold text-slate-800">{res.action_record.risk_severity || 'NONE'}</span></p>
                      <p className="text-slate-600">Auth Status: <span className="font-semibold text-slate-800">{res.action_record.auth_status}</span></p>
                      {res.action_record.reasons.map((r, idx) => (
                        <div key={idx} className="bg-white p-2.5 rounded-lg border border-slate-200 text-[11px] mt-1">
                          <span className="text-blue-600 font-bold">{r.rule_type}:</span> {r.description}
                        </div>
                      ))}
                    </div>
                  )}

                  {res.action && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                      <p className="font-bold text-slate-900">Normalized Action Semantics (M2)</p>
                      <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                        <JsonViewer data={res.action} />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
