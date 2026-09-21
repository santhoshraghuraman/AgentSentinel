import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { taskService } from '../api/services';
import type { CreateTaskRequest } from '../api/types';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Textarea } from '../components/ui/Textarea';
import { Badge } from '../components/ui/Badge';
import { 
  ShieldAlert, 
  Plus, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  ShieldCheck, 
  Terminal, 
  Lock, 
  Check 
} from 'lucide-react';
import { cn } from '../utils/cn';

export function TasksPage() {
  const queryClient = useQueryClient();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const { data: tasks, isError, isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: taskService.listTasks
  });

  // Auto-select first task when loaded
  useEffect(() => {
    if (!selectedTaskId && tasks && tasks.length > 0) {
      setSelectedTaskId(tasks[0].task_id);
    }
  }, [tasks, selectedTaskId]);

  const selectedTask = useMemo(() => {
    return tasks?.find(t => t.task_id === selectedTaskId) || (tasks && tasks.length > 0 ? tasks[0] : null);
  }, [tasks, selectedTaskId]);

  const [form, setForm] = useState({
    task_id: '',
    task_description: '',
    allowed_capabilities: '[\n  {"tool": "read_file"},\n  {"tool": "calculate"}\n]',
    denied_capabilities: '[\n  {"tool": "write_file"},\n  {"tool": "execute_command"}\n]'
  });

  const mutation = useMutation({
    mutationFn: taskService.createTask,
    onSuccess: (newTask) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setSelectedTaskId(newTask.task_id);
      setStatusMessage({ type: 'success', text: `Task Context "${newTask.task_id}" registered successfully.` });
      setForm({
        task_id: '',
        task_description: '',
        allowed_capabilities: '[\n  \n]',
        denied_capabilities: '[\n  \n]'
      });
      setTimeout(() => setStatusMessage(null), 4000);
    },
    onError: (err: any) => {
      setStatusMessage({ type: 'error', text: err?.response?.data?.detail || "Failed to register task context." });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const allowed = JSON.parse(form.allowed_capabilities);
      const denied = JSON.parse(form.denied_capabilities);

      if (!Array.isArray(allowed) || !Array.isArray(denied)) {
        setStatusMessage({ type: 'error', text: "Capabilities must be JSON arrays." });
        return;
      }
      
      const req: CreateTaskRequest = {
        task_id: form.task_id.trim(),
        task_description: form.task_description.trim(),
        allowed_capabilities: allowed,
        denied_capabilities: denied
      };
      mutation.mutate(req);
    } catch (err) {
      setStatusMessage({ type: 'error', text: "Invalid JSON format in capabilities array." });
    }
  };

  const totalTasks = tasks?.length || 0;

  return (
    <div className="flex flex-col gap-5 h-full pb-10">
      {/* Top Breadcrumb & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono mb-1">
            <span className="text-slate-400 uppercase tracking-wider font-semibold">RESEARCH & GOVERNANCE</span>
            <span className="text-slate-300">//</span>
            <span className="text-blue-700 font-bold uppercase tracking-tight">TASK-CONTEXT AUTHORIZATION BOUNDARIES</span>
            <span className="text-slate-300">//</span>
            <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[11px]">
              Active Contexts: {totalTasks}
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <span>Task Authorization Contexts</span>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              M6 Zero-Trust
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Restricting autonomous agent tool permissions strictly to verified task objectives.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => {
              const el = document.getElementById('task-register-box');
              el?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="h-8 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Register Task Context</span>
          </Button>
        </div>
      </div>

      {/* Task Context Selector Carousel */}
      <div className="space-y-2">
        <span className="text-[11px] font-mono font-bold uppercase text-slate-400 tracking-wider">
          REGISTERED TASK CONTEXTS ({totalTasks})
        </span>

        {isLoading ? (
          <div className="p-6 text-center text-xs font-mono text-slate-400 bg-white rounded-xl border border-slate-200">
            Loading task contexts...
          </div>
        ) : isError ? (
          <div className="p-4 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 text-xs font-mono flex items-center gap-2">
            <ShieldAlert className="h-4 w-4" />
            <span>Failed to load task contexts. Backend API may be unreachable.</span>
          </div>
        ) : tasks && tasks.length === 0 ? (
          <div className="p-6 text-center text-xs font-mono text-slate-400 bg-white rounded-xl border border-slate-200">
            No task contexts registered. Use the registration form below to seed a task.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {tasks?.map((t) => {
              const isSelected = t.task_id === selectedTaskId;
              return (
                <Card
                  key={t.task_id}
                  onClick={() => setSelectedTaskId(t.task_id)}
                  className={cn(
                    "p-3.5 border motion-safe:transition-all cursor-pointer rounded-xl bg-white",
                    isSelected 
                      ? "border-blue-500 ring-1 ring-blue-500/20 shadow-sm" 
                      : "border-slate-200 hover:border-slate-300 hover:shadow-xs"
                  )}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="font-mono text-xs font-bold text-slate-900 truncate">
                      {t.task_id}
                    </span>
                    <Badge 
                      variant={isSelected ? "default" : "secondary"}
                      className={cn(
                        "text-[9px] font-mono uppercase px-1.5 py-0.2",
                        isSelected ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"
                      )}
                    >
                      {isSelected ? "Active" : "Loaded"}
                    </Badge>
                  </div>

                  <p className="text-[11px] text-slate-500 truncate mb-2.5">
                    {t.task_description || 'No description'}
                  </p>

                  <div className="flex items-center gap-2 text-[11px] font-mono pt-2 border-t border-slate-100">
                    <span className="text-emerald-700 font-semibold flex items-center gap-0.5">
                      <CheckCircle2 className="h-3 w-3" />
                      {t.allowed_capability_count} permitted
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="text-rose-700 font-semibold flex items-center gap-0.5">
                      <XCircle className="h-3 w-3" />
                      {t.denied_capability_count} restricted
                    </span>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Selected Task Detail View */}
      {selectedTask && (
        <div className="space-y-5">
          {/* Objective Scope Banner */}
          <Card className="p-5 border-slate-200 shadow-xs bg-white rounded-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-blue-50 text-blue-700 border border-blue-100">
                  <Terminal className="h-4 w-4" />
                </div>
                <div>
                  <span className="text-[11px] font-mono font-bold uppercase text-slate-400 tracking-wider block">
                    TASK OBJECTIVE CONTEXT SCOPE
                  </span>
                  <h3 className="text-sm font-mono font-bold text-slate-900">
                    {selectedTask.task_id}
                  </h3>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
                <span className="px-2.5 py-1 rounded bg-slate-100 text-slate-700">
                  Allowed: <strong className="text-emerald-600">{selectedTask.allowed_capability_count}</strong>
                </span>
                <span className="px-2.5 py-1 rounded bg-slate-100 text-slate-700">
                  Denied: <strong className="text-rose-600">{selectedTask.denied_capability_count}</strong>
                </span>
                <span className="px-2.5 py-1 rounded bg-blue-50 text-blue-700 border border-blue-200 font-bold">
                  M6 DETERMINISTIC INVARIANT
                </span>
              </div>
            </div>

            <div className="mt-3.5 p-3 rounded-lg bg-slate-50 border border-slate-200/70 text-xs text-slate-800 font-medium italic">
              "{selectedTask.task_description || 'Deterministic task context boundary enforced across agent runtime execution.'}"
            </div>
          </Card>

          {/* Two Main Invariant Columns: PERMITTED vs PROHIBITED */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Left: Permitted Invariants */}
            <Card className="p-5 border-slate-200 shadow-xs bg-white rounded-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    <h3 className="text-xs font-bold font-mono uppercase text-slate-700 tracking-wider">
                      PERMITTED INVARIANTS (ALLOWED)
                    </h3>
                  </div>
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 font-mono text-[11px]">
                    {selectedTask.allowed_capability_count} Permitted
                  </Badge>
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5 mb-4 font-mono">
                  Strictly bounded actions verified to correlate directly with verified task objectives.
                </p>

                {selectedTask.allowed_capability_count > 0 ? (
                  <div className="space-y-2">
                    {Array.from({ length: selectedTask.allowed_capability_count }).map((_, idx) => (
                      <div 
                        key={idx}
                        className="p-3 rounded-lg bg-emerald-50/40 border border-emerald-200/70 flex items-center justify-between text-xs font-mono"
                      >
                        <div className="flex items-center gap-2.5">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                          <span className="font-bold text-emerald-950">
                            Authorized Capability Token #{idx + 1}
                          </span>
                        </div>
                        <span className="text-[11px] text-emerald-700 font-semibold bg-emerald-100/60 px-2 py-0.5 rounded">
                          M6 PERMITTED
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-xs font-mono text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                    No explicit permitted capabilities registered for this task.
                  </div>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] font-mono text-slate-400 flex items-center justify-between">
                <span>Evaluator: M6 Task Authorization</span>
                <span className="text-emerald-600 font-bold">Authorized Execution Allowed</span>
              </div>
            </Card>

            {/* Right: Prohibited Invariants */}
            <Card className="p-5 border-slate-200 shadow-xs bg-white rounded-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-rose-600" />
                    <h3 className="text-xs font-bold font-mono uppercase text-slate-700 tracking-wider">
                      STRICTLY PROHIBITED INVARIANTS (DENIED)
                    </h3>
                  </div>
                  <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 font-mono text-[11px]">
                    {selectedTask.denied_capability_count} Prohibited
                  </Badge>
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5 mb-4 font-mono">
                  Dangerous runtime actions locked down for this task context regardless of prompt steering.
                </p>

                {selectedTask.denied_capability_count > 0 ? (
                  <div className="space-y-2">
                    {Array.from({ length: selectedTask.denied_capability_count }).map((_, idx) => (
                      <div 
                        key={idx}
                        className="p-3 rounded-lg bg-rose-50/40 border border-rose-200/70 flex items-center justify-between text-xs font-mono"
                      >
                        <div className="flex items-center gap-2.5">
                          <XCircle className="h-4 w-4 text-rose-600 shrink-0" />
                          <span className="font-bold text-rose-950">
                            Forbidden Invariant #{idx + 1}
                          </span>
                        </div>
                        <span className="text-[11px] text-rose-700 font-bold bg-rose-100/60 px-2 py-0.5 rounded">
                          M6 DENIED
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-xs font-mono text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                    No explicit restricted capabilities registered for this task.
                  </div>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] font-mono text-slate-400 flex items-center justify-between">
                <span>Enforcement: M8 Interception</span>
                <span className="text-rose-600 font-bold">Hard Block on Invariant Breach</span>
              </div>
            </Card>
          </div>

          {/* Context Boundary Verification Pipeline */}
          <Card className="p-5 border-slate-200 shadow-xs bg-white rounded-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-xs font-bold font-mono uppercase text-slate-600 tracking-wider">
                  Context Boundary Verification Pipeline
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Visualizing deterministic runtime interception from Agent Action Proposal to M8 Enforcement
                </p>
              </div>
              <span className="text-[11px] font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                M6 ➔ M7 ➔ M8
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              {/* Step 1 */}
              <div className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/50 flex flex-col items-center text-center space-y-2">
                <div className="p-2 rounded-lg bg-blue-50 text-blue-700">
                  <Terminal className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-[11px] font-mono text-slate-400 uppercase font-bold">STEP 01</span>
                  <h4 className="text-xs font-bold text-slate-900 font-mono">Agent Tool Invocation</h4>
                  <p className="text-[11px] text-slate-500 mt-1">Proposed tool arguments and action payload</p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="p-4 rounded-xl border border-blue-300 bg-blue-50/40 flex flex-col items-center text-center space-y-2 relative">
                <div className="p-2 rounded-lg bg-blue-600 text-white shadow-xs">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-[11px] font-mono text-blue-600 uppercase font-bold">STEP 02</span>
                  <h4 className="text-xs font-bold text-slate-900 font-mono">M6 Task Invariant Verification</h4>
                  <p className="text-[11px] text-slate-500 mt-1">Checking capability matrix for {selectedTask.task_id}</p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/50 flex flex-col items-center text-center space-y-2">
                <div className="p-2 rounded-lg bg-slate-100 text-slate-700">
                  <Lock className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-[11px] font-mono text-slate-400 uppercase font-bold">STEP 03</span>
                  <h4 className="text-xs font-bold text-slate-900 font-mono">M8 Runtime Enforcement</h4>
                  <p className="text-[11px] text-slate-500 mt-1">Deterministic ALLOW or execution BLOCK</p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Task Context Registration Form */}
      <div id="task-register-box" className="pt-2">
        <Card className="border-slate-200 shadow-sm bg-white rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/70">
            <span className="text-[11px] font-bold font-mono text-slate-400 uppercase tracking-wider block">
              TASK AUTHORIZATION REGISTRATION
            </span>
            <h3 className="text-xs font-bold font-mono text-slate-900 mt-0.5">
              Seed a New Task Boundary
            </h3>
          </div>

          <CardContent className="p-5">
            {statusMessage && (
              <div className={cn(
                "p-3 rounded-lg text-xs font-mono mb-4 flex items-start gap-2",
                statusMessage.type === 'success' 
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200" 
                  : "bg-rose-50 text-rose-800 border border-rose-200"
              )}>
                {statusMessage.type === 'success' ? <Check className="h-4 w-4 shrink-0 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />}
                <span>{statusMessage.text}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-mono font-bold text-slate-600 uppercase">
                    Task ID
                  </label>
                  <Input 
                    required 
                    value={form.task_id} 
                    onChange={e => setForm({...form, task_id: e.target.value})} 
                    placeholder="e.g. task_code_compilation"
                    className="h-8 text-xs font-mono bg-slate-50/50"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-mono font-bold text-slate-600 uppercase">
                    Description
                  </label>
                  <Input 
                    value={form.task_description} 
                    onChange={e => setForm({...form, task_description: e.target.value})} 
                    placeholder="e.g. Autonomous build and test execution sandbox"
                    className="h-8 text-xs bg-slate-50/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-[11px] font-mono font-bold text-slate-600 uppercase">
                      Allowed Capabilities (JSON Array)
                    </label>
                    <span className="text-[11px] font-mono text-slate-400">Array of Objects</span>
                  </div>
                  <Textarea 
                    required 
                    value={form.allowed_capabilities} 
                    onChange={e => setForm({...form, allowed_capabilities: e.target.value})} 
                    className="font-mono text-xs h-24 bg-slate-50/50 border-slate-200 resize-none"
                    placeholder={'[\n  {"tool": "read_file"}\n]'}
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-[11px] font-mono font-bold text-slate-600 uppercase">
                      Denied Capabilities (JSON Array)
                    </label>
                    <span className="text-[11px] font-mono text-slate-400">Array of Objects</span>
                  </div>
                  <Textarea 
                    required 
                    value={form.denied_capabilities} 
                    onChange={e => setForm({...form, denied_capabilities: e.target.value})} 
                    className="font-mono text-xs h-24 bg-slate-50/50 border-slate-200 resize-none"
                    placeholder={'[\n  {"tool": "write_file"}\n]'}
                  />
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full sm:w-auto h-8 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs px-6"
                disabled={mutation.isPending}
              >
                {mutation.isPending ? 'Registering...' : 'Register Task Context'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
