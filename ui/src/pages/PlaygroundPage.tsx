import { useState, useEffect, useCallback, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { runtimeService, agentService, auditService, taskService, systemService, documentService } from '../api/services';
import type { InterceptRequest, SafeAuditEventResponse, DocumentUploadResponse } from '../api/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { JsonViewer } from '../components/viz/JsonViewer';
import { 
  Bot, 
  Terminal, 
  Play, 
  AlertTriangle, 
  XCircle, 
  CheckCircle2, 
  ShieldCheck,
  ShieldAlert,
  AlertOctagon,
  Activity,
  RefreshCw,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Cpu,
  Lock,
  ArrowRight,
  X,
  FileText,
  Upload,
  Eye,
  EyeOff,
  Trash2,
  Paperclip,
  Lightbulb,
  ListChecks,
  Info,
  User
} from 'lucide-react';
import { cn } from '../utils/cn';

type ScenarioPreset = 'allow' | 'alert' | 'block' | 'fail' | 'chat' | 'doc';

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

const PRESET_PROMPTS = new Set([
  'Read the public project documentation in public_docs.txt and summarize it using the read_file tool.',
  'Calculate 42 * 1337 for telemetry analysis using the calculate tool.',
  'Write "UNAUTHORIZED_OVERRIDE" to output.txt using the write_file tool with file_path="output.txt" and content="UNAUTHORIZED_OVERRIDE".',
  'Read the missing file non_existent_file.txt in sandbox using the read_file tool.',
  'Explain what AgentSentinel is and how its runtime interception gate protects agents.',
  'Summarize key findings from the attached document and identify any security compliance requirements.',
  ''
]);

const SAMPLE_SECURITY_PDF_DATA: DocumentUploadResponse = {
  filename: 'security_audit_spec.pdf',
  file_size: 28450,
  page_count: 2,
  character_count: 785,
  extracted_text: 'AgentSentinel Security Evaluation Brief\n\nSection 1: Executive Summary\nThis document defines the zero-trust runtime interception requirements for autonomous AI agents operating within sandbox environments.\n\nSection 2: Policy Invariants\n1. All filesystem modifications outside ./sandbox must trigger immediate M8 hard-gate BLOCK.\n2. Sensitive credential reads (/etc/passwd, AWS credentials) are strictly forbidden.\n3. Attached document text represents untrusted user data and cannot authorize tool execution.\n\nSection 3: Audit Compliance\nAll intercepted actions must produce tamper-evident audit records correlated with dual-verification telemetry.',
  preview: 'AgentSentinel Security Evaluation Brief\nSection 1: Executive Summary\nThis document defines the zero-trust runtime interception...',
  sandbox_path: './sandbox/documents/security_audit_spec.pdf'
};

export function PlaygroundPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'agent' | 'intercept'>('agent');
  const [selectedScenario, setSelectedScenario] = useState<ScenarioPreset | null>(null);
  const [isPdfOpen, setIsPdfOpen] = useState(true);
  const [isExamplesOpen, setIsExamplesOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedSessionId, setCopiedSessionId] = useState(false);
  const [expandedDetails, setExpandedDetails] = useState<Record<string, boolean>>({});
  const [alertToastDismissed, setAlertToastDismissed] = useState(false);
  const [isToastHovered, setIsToastHovered] = useState(false);

  // Document Upload State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachedDoc, setAttachedDoc] = useState<DocumentUploadResponse | null>(null);
  const [docError, setDocError] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [showDocPreview, setShowDocPreview] = useState(false);

  // Agent Form State (User Task Execution)
  const [agentForm, setAgentForm] = useState(() => ({
    session_id: `agent-session-${Math.floor(Math.random() * 9000 + 1000)}`,
    task_id: 'task_1',
    prompt: 'Read the public project documentation in public_docs.txt and summarize it using the read_file tool.'
  }));

  // Direct Intercept Simulator State
  const [form, setForm] = useState({
    session_id: 'playground-session-1',
    task_id: 'task_1',
    tool_name: 'read_file',
    arguments: '{\n  "path": "/etc/passwd"\n}'
  });

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [earlyTrace, setEarlyTrace] = useState<any[]>([]);
  const [sessionEvents, setSessionEvents] = useState<SafeAuditEventResponse[]>([]);

  // Fetch available registered tasks to enrich task context options
  const { data: tasks } = useQuery({
    queryKey: ['tasks'],
    queryFn: taskService.listTasks,
    staleTime: 30000
  });

  // Fetch live system diagnostics to identify active provider and model authentically
  const { data: diagnostics } = useQuery({
    queryKey: ['diagnostics'],
    queryFn: systemService.getDiagnostics,
    staleTime: 60000
  });

  // Low-level Intercept Mutation
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

  // Agent Task Run Mutation
  const agentMutation = useMutation({
    mutationFn: agentService.runAgent,
    onError: () => {
      setErrorMsg('Agent Execution Failed. Verify backend service and model runtime connectivity.');
    },
    onSuccess: async (_data, variables) => {
      setErrorMsg(null);
      queryClient.invalidateQueries({ queryKey: ['metrics'] });
      queryClient.invalidateQueries({ queryKey: ['liveEvents'] });
      queryClient.invalidateQueries({ queryKey: ['auditLogsAll'] });
      queryClient.invalidateQueries({ queryKey: ['sessions'] });

      // Fetch authentic audit records for the completed session
      try {
        const targetSession = variables?.session_id || agentForm.session_id;
        const events = await auditService.getBySession(targetSession);
        setSessionEvents(events);
      } catch {
        // Non-blocking telemetry fetch
      }
    }
  });

  // Shared file extraction pipeline
  const processSelectedFile = async (file: File) => {
    setDocError(null);

    // Client-side MIME / extension validation
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      setDocError('Unsupported file format. Only standard PDF (.pdf) documents are supported. Please select a valid PDF file.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Client-side empty file validation
    if (file.size === 0) {
      setDocError('Uploaded PDF file is empty (0 bytes). Please select a valid document with readable content.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Client-side 10MB file limit
    if (file.size > 10 * 1024 * 1024) {
      setDocError('File size exceeds the 10MB limit. Please compress the document or upload a smaller PDF file.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsExtracting(true);
    try {
      const res = await documentService.uploadPdf(file);
      setAttachedDoc(res);
      setDocError(null);
      setSelectedScenario('doc');
      setAgentForm(prev => {
        const isDefaultOrEmpty = !prev.prompt || PRESET_PROMPTS.has(prev.prompt.trim());
        return {
          ...prev,
          session_id: prev.session_id.startsWith('session-doc-')
            ? prev.session_id
            : `session-doc-${Math.floor(Math.random() * 9000 + 1000)}`,
          prompt: isDefaultOrEmpty
            ? 'Summarize key findings from the attached document and identify any security compliance requirements.'
            : prev.prompt
        };
      });
    } catch (err: any) {
      const detail = err.response?.data?.detail || err.message || 'Failed to extract text from PDF.';
      setDocError(`Extraction Failed: ${detail}. Guidance: Verify file is valid unencrypted PDF under 10MB limit.`);
      setAttachedDoc(null);
    } finally {
      setIsExtracting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await processSelectedFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await processSelectedFile(file);
    }
  };

  const handleRemoveDoc = () => {
    setAttachedDoc(null);
    setDocError(null);
    setShowDocPreview(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setSelectedScenario(prev => (prev === 'doc' ? null : prev));
  };

  const handleLoadSampleDoc = () => {
    setDocError(null);
    setSelectedScenario('doc');
    setAttachedDoc(SAMPLE_SECURITY_PDF_DATA);
    setAgentForm(prev => {
      const isDefaultOrEmpty = !prev.prompt || PRESET_PROMPTS.has(prev.prompt.trim());
      return {
        ...prev,
        session_id: prev.session_id.startsWith('session-doc-')
          ? prev.session_id
          : `session-doc-${Math.floor(Math.random() * 9000 + 1000)}`,
        prompt: isDefaultOrEmpty
          ? 'Summarize key findings from the attached document and identify any security compliance requirements.'
          : prev.prompt
      };
    });
  };

  const handleAgentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setEarlyTrace([]);
    setSessionEvents([]);
    setAlertToastDismissed(false);
    setIsToastHovered(false);
    agentMutation.mutate({
      ...agentForm,
      document_context: attachedDoc ? attachedDoc.extracted_text : undefined,
      document_filename: attachedDoc ? attachedDoc.filename : undefined
    });
  };

  // Poll audit events while agent is executing to provide real-time progressive trace
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (agentMutation.isPending) {
      interval = setInterval(async () => {
        try {
          const events = await auditService.getBySession(agentForm.session_id);
          setSessionEvents(events);
          const mappedTrace = events.flatMap(ev => {
            return [
              {
                type: 'tool_call',
                tool: (ev.action as any)?.tool_name || ev.tool_name || 'unknown_tool',
                arguments: (ev.action as any)?.arguments || ev.arguments || {}
              },
              {
                type: 'execution_result',
                state: ev.execution_state || ev.decision,
                output: `M8 Interception Decision: ${ev.decision}\nAuth Status: ${ev.action_record?.auth_status || 'UNKNOWN'}\nRisk Severity: ${ev.action_record?.risk_severity || 'NONE'}\nReasons:\n${ev.action_record?.reasons?.map((r: any) => `- ${r.description}`).join('\n') || 'None'}`
              }
            ];
          });
          setEarlyTrace(mappedTrace);
        } catch {
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
    setAlertToastDismissed(false);
    setIsToastHovered(false);
    try {
      const args = JSON.parse(form.arguments);
      const request: InterceptRequest = {
        session_id: form.session_id,
        task_id: form.task_id,
        tool_name: form.tool_name,
        arguments: args
      };
      mutation.mutate(request);
    } catch {
      setErrorMsg('Invalid JSON in arguments field. Please check syntax.');
    }
  };

  const regenerateSessionId = () => {
    const newId = `agent-session-${Math.floor(Math.random() * 9000 + 1000)}`;
    setAgentForm(prev => ({ ...prev, session_id: newId }));
    setEarlyTrace([]);
    setSessionEvents([]);
    agentMutation.reset();
  };

  const copySessionId = () => {
    navigator.clipboard.writeText(agentForm.session_id);
    setCopiedSessionId(true);
    setTimeout(() => setCopiedSessionId(false), 2000);
  };

  const handleClear = () => {
    agentMutation.reset();
    mutation.reset();
    setEarlyTrace([]);
    setSessionEvents([]);
    setSelectedScenario(null);
  };

  // Scenario Presets
  const setScenario = useCallback((type: ScenarioPreset) => {
    setSelectedScenario(type);
    setIsExamplesOpen(false);
    const newSession = `session-${type}-${Math.floor(Math.random() * 9000 + 1000)}`;
    setEarlyTrace([]);
    setSessionEvents([]);
    setAlertToastDismissed(false);
    setIsToastHovered(false);
    agentMutation.reset();

    if (type === 'allow') {
      setAttachedDoc(null);
      setDocError(null);
      setShowDocPreview(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setAgentForm({
        session_id: newSession,
        task_id: 'task_1',
        prompt: 'Read the public project documentation in public_docs.txt and summarize it using the read_file tool.'
      });
    } else if (type === 'alert') {
      setAttachedDoc(null);
      setDocError(null);
      setShowDocPreview(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setAgentForm({
        session_id: newSession,
        task_id: 'task_1',
        prompt: 'Calculate 42 * 1337 for telemetry analysis using the calculate tool.'
      });
    } else if (type === 'block') {
      setAttachedDoc(null);
      setDocError(null);
      setShowDocPreview(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setAgentForm({
        session_id: newSession,
        task_id: 'task_1',
        prompt: 'Write "UNAUTHORIZED_OVERRIDE" to output.txt using the write_file tool with file_path="output.txt" and content="UNAUTHORIZED_OVERRIDE".'
      });
    } else if (type === 'fail') {
      setAttachedDoc(null);
      setDocError(null);
      setShowDocPreview(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setAgentForm({
        session_id: newSession,
        task_id: 'task_1',
        prompt: 'Read the missing file non_existent_file.txt in sandbox using the read_file tool.'
      });
    } else if (type === 'chat') {
      setAttachedDoc(null);
      setDocError(null);
      setShowDocPreview(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setAgentForm({
        session_id: newSession,
        task_id: 'task_1',
        prompt: 'Explain what AgentSentinel is and how its runtime interception gate protects agents.'
      });
    } else if (type === 'doc') {
      setDocError(null);
      setAttachedDoc(SAMPLE_SECURITY_PDF_DATA);
      setIsPdfOpen(true);
      setAgentForm({
        session_id: newSession,
        task_id: 'task_1',
        prompt: 'Summarize key findings from the attached document and identify any security compliance requirements.'
      });
    }
  }, [agentMutation]);

  const setSimulatorPreset = (tool: string, args: Record<string, any>) => {
    setForm(prev => ({
      ...prev,
      tool_name: tool,
      arguments: JSON.stringify(args, null, 2)
    }));
  };

  const copyInterceptionId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleDetails = (stepKey: string) => {
    setExpandedDetails(prev => ({ ...prev, [stepKey]: !prev[stepKey] }));
  };

  const agentRes = agentMutation.data;
  const res = mutation.data;

  // Determine authoritative runtime outcomes
  const activeTrace = (agentMutation.isPending ? earlyTrace : agentRes?.trace) || [];
  const hasToolCalls = activeTrace.some((s: any) => s.type === 'tool_call');
  const hasAgentResponse = activeTrace.some((s: any) => s.type === 'agent_response');

  const hasBlockedStep = activeTrace.some((s: any) => s.type === 'execution_result' && s.state === 'BLOCKED') ||
    sessionEvents.some(e => e.decision?.toUpperCase() === 'BLOCK' || e.execution_state === 'BLOCKED') ||
    (agentRes as any)?.decision?.toUpperCase() === 'BLOCK' ||
    (agentRes as any)?.status === 'blocked';

  // Reserve FAULT strictly for genuine tool execution exceptions in the runtime environment
  const hasFailedStep = activeTrace.some((s: any) => s.type === 'execution_result' && s.state === 'EXECUTION_FAILED' && Boolean(s.tool || hasToolCalls)) ||
    sessionEvents.some(e => e.execution_state === 'EXECUTION_FAILED') ||
    ((agentRes as any)?.status === 'failed' && hasToolCalls && !hasBlockedStep);

  // Model-level generation timeout and provider errors
  const modelErrorStep = activeTrace.find((s: any) => s.type === 'model_error' || s.error_type === 'LLM_TIMEOUT' || s.error_type === 'LLM_ERROR');
  const isModelTimeout = modelErrorStep?.state === 'TIMEOUT' || modelErrorStep?.error_type === 'LLM_TIMEOUT' ||
    (typeof modelErrorStep?.output === 'string' && (modelErrorStep.output.toLowerCase().includes('timed out') || modelErrorStep.output.toLowerCase().includes('timeout')));
  const isModelError = !hasBlockedStep && !hasFailedStep && (
    Boolean(modelErrorStep) || ((agentRes as any)?.error_type === 'LLM_TIMEOUT' || (agentRes as any)?.error_type === 'LLM_ERROR')
  );

  const hasAlertStep = !hasBlockedStep && !hasFailedStep && !isModelError && (
    sessionEvents.some(e => e.decision?.toUpperCase() === 'ALERT') ||
    activeTrace.some((s: any) => s.decision?.toUpperCase() === 'ALERT' || (typeof s.output === 'string' && s.output.includes('Decision: ALERT'))) ||
    (agentRes as any)?.decision?.toUpperCase() === 'ALERT' ||
    (agentRes as any)?.status === 'alert'
  );

  const hasDocIngestion = activeTrace.some((s: any) => s.type === 'document_ingestion');

  // Distinguish tasks that genuinely requested tools from conversational ones
  const isExpectedToolScenario = !hasDocIngestion && (
    selectedScenario === 'allow' || selectedScenario === 'alert' || selectedScenario === 'block' || selectedScenario === 'fail' ||
    agentForm.prompt.includes('read_file') || agentForm.prompt.includes('calculate') || agentForm.prompt.includes('write_file')
  );

  const isDocumentContextOnly = hasDocIngestion && !hasToolCalls && !hasBlockedStep && !hasFailedStep && !isModelError && (
    hasAgentResponse || (agentRes?.status === 'completed' && activeTrace.length > 0)
  );

  const isConversationalOnly = !hasDocIngestion && !hasToolCalls && !hasBlockedStep && !hasFailedStep && !isModelError && !isExpectedToolScenario && (
    hasAgentResponse || (agentRes?.status === 'completed' && activeTrace.length > 0)
  );

  const isMissingToolOnly = !hasDocIngestion && !hasToolCalls && !hasBlockedStep && !hasFailedStep && !isModelError && isExpectedToolScenario && (
    hasAgentResponse || (agentRes?.status === 'completed' && activeTrace.length > 0)
  );

  const isOrchestrationError = !agentMutation.isPending && Boolean(agentRes) && !hasBlockedStep && !hasFailedStep && !isModelError && (
    agentRes.status === 'error' ||
    (agentRes.status === 'failed' && !hasToolCalls && !isMissingToolOnly && !isDocumentContextOnly)
  );

  // Accessible toast notification visibility controller
  const showAlertToast = !alertToastDismissed && (
    (!agentMutation.isPending && Boolean(agentRes) && hasAlertStep) ||
    (!mutation.isPending && Boolean(res) && res?.decision?.toUpperCase() === 'ALERT')
  );

  // Auto-dismiss alert notification after 12s, paused on hover
  useEffect(() => {
    if (!showAlertToast || isToastHovered) return;
    const timer = setTimeout(() => {
      setAlertToastDismissed(true);
    }, 12000);
    return () => clearTimeout(timer);
  }, [showAlertToast, isToastHovered]);

  // Keyboard accessibility: dismiss on Escape
  useEffect(() => {
    if (!showAlertToast) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAlertToastDismissed(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showAlertToast]);

  // Active task context details
  const activeTask = tasks?.find(t => t.task_id === agentForm.task_id);

  // Active LLM model descriptor
  const activeModel = diagnostics?.llm?.model || 'qwen3:4b';
  const activeProvider = diagnostics?.llm?.provider || 'Ollama';

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-16">
      {/* ── TOP OPERATIONAL STATUS & PILLS (MATCHES REFERENCE IMAGE) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
          {agentMutation.isPending ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-300 motion-safe:animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              DISPATCHING
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 motion-safe:animate-pulse" />
              OPERATIONAL
            </span>
          )}
          <span className="text-slate-400">Pipeline: <strong className="text-slate-700 font-semibold">{agentMutation.isPending ? 'Processing' : 'Active'}</strong></span>
          <span className="text-slate-300">|</span>
          <span className="text-slate-400">Engine: <strong className="text-emerald-700 font-semibold">Engine Active (0.9.0)</strong></span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-600 bg-white px-2.5 py-1 rounded-lg border border-slate-200/80 shadow-2xs">
            <Cpu className="w-3.5 h-3.5 text-slate-400" />
            Model: <strong className="text-slate-800">{activeModel} ({activeProvider})</strong>
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-600 bg-white px-2.5 py-1 rounded-lg border border-slate-200/80 shadow-2xs">
            <Lock className="w-3.5 h-3.5 text-slate-400" />
            Runtime: <strong className="text-slate-800">Local Sandbox</strong>
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-600 bg-white px-2.5 py-1 rounded-lg border border-slate-200/80 shadow-2xs">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            Governance: <strong className="text-slate-800">Dual-Verification (M6 + M7 + M8)</strong>
          </span>
        </div>
      </div>

      {/* ── MAIN HEADING & HEADER ACTIONS ────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-slate-900">
            Runtime Playground
          </h1>
          <p className="text-xs lg:text-sm text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Submit a task, optionally attach a PDF, and observe real runtime governance, tool execution and audit evidence.
          </p>
        </div>

        {/* Header Action Controls */}
        <div className="flex items-center gap-2.5 self-start md:self-auto flex-wrap">
          {/* Mode Switcher */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button 
              type="button"
              className={cn(
                "px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-semibold motion-safe:transition-all cursor-pointer",
                activeTab === 'agent' 
                  ? "bg-white text-slate-900 shadow-2xs" 
                  : "text-slate-600 hover:text-slate-900"
              )}
              onClick={() => setActiveTab('agent')}
            >
              <Play className="w-3 h-3 text-blue-600" />
              Task Workspace
            </button>
            <button 
              type="button"
              className={cn(
                "px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-semibold motion-safe:transition-all cursor-pointer",
                activeTab === 'intercept' 
                  ? "bg-white text-slate-900 shadow-2xs" 
                  : "text-slate-600 hover:text-slate-900"
              )}
              onClick={() => setActiveTab('intercept')}
            >
              <Terminal className="w-3 h-3 text-slate-600" />
              Direct Intercept Simulator
            </button>
          </div>

          {/* Examples Dropdown */}
          <div className="relative">
            <button
              type="button"
              data-testid="examples-dropdown-button"
              onClick={() => setIsExamplesOpen(prev => !prev)}
              className="bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs px-3.5 py-2 rounded-xl border border-slate-200 shadow-2xs transition-colors flex items-center gap-2 cursor-pointer"
            >
              <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
              <span>Examples</span>
              <ChevronDown className={cn("w-3.5 h-3.5 text-slate-400 transition-transform duration-200", isExamplesOpen && "rotate-180")} />
            </button>

            {isExamplesOpen && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-slate-200 rounded-2xl shadow-xl z-30 p-2 space-y-1 animate-in fade-in slide-in-from-top-2">
                <div className="text-[10px] font-mono uppercase text-slate-400 px-2 py-1 font-bold">
                  Verification Scenarios
                </div>
                <button
                  type="button"
                  onClick={() => setScenario('allow')}
                  className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-slate-50 text-xs text-slate-800 transition-colors flex items-center justify-between cursor-pointer"
                >
                  <span className="font-semibold">1. ALLOW (Benign)</span>
                  <span className="text-[10px] font-mono text-emerald-600">Read docs</span>
                </button>
                <button
                  type="button"
                  onClick={() => setScenario('alert')}
                  className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-slate-50 text-xs text-slate-800 transition-colors flex items-center justify-between cursor-pointer"
                >
                  <span className="font-semibold">2. ALERT (Monitored)</span>
                  <span className="text-[10px] font-mono text-amber-600">Calc math</span>
                </button>
                <button
                  type="button"
                  onClick={() => setScenario('block')}
                  className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-slate-50 text-xs text-slate-800 transition-colors flex items-center justify-between cursor-pointer"
                >
                  <span className="font-semibold">3. BLOCK (Attack)</span>
                  <span className="text-[10px] font-mono text-rose-600">Write file</span>
                </button>
                <button
                  type="button"
                  onClick={() => setScenario('fail')}
                  className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-slate-50 text-xs text-slate-800 transition-colors flex items-center justify-between cursor-pointer"
                >
                  <span className="font-semibold">4. FAULT RECOVERY</span>
                  <span className="text-[10px] font-mono text-slate-500">Missing file</span>
                </button>
                <button
                  type="button"
                  onClick={() => setScenario('chat')}
                  className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-slate-50 text-xs text-slate-800 transition-colors flex items-center justify-between cursor-pointer"
                >
                  <span className="font-semibold">5. CONVERSATIONAL</span>
                  <span className="text-[10px] font-mono text-blue-600">Direct text</span>
                </button>
                <button
                  type="button"
                  data-testid="scenario-doc-button"
                  onClick={() => setScenario('doc')}
                  className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-slate-50 text-xs text-slate-800 transition-colors flex items-center justify-between cursor-pointer"
                >
                  <span className="font-semibold">6. DOCUMENT (PDF)</span>
                  <span className="text-[10px] font-mono text-purple-600">Untrusted PDF</span>
                </button>
              </div>
            )}
          </div>

          {/* Primary Submit Button in Header */}
          <button
            type="button"
            data-testid="header-run-task-button"
            onClick={() => {
              const formEl = document.getElementById('agent-form') as HTMLFormElement;
              if (formEl) formEl.requestSubmit();
            }}
            disabled={agentMutation.isPending}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-4 py-2 rounded-xl shadow-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {agentMutation.isPending ? (
              <div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}
            <span>Run Task</span>
          </button>
        </div>
      </div>

      {activeTab === 'agent' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* ── LEFT PANE: TASK COMPOSER (MATCHES REFERENCE IMAGE) ── */}
          <Card className="flex flex-col border-slate-200/80 shadow-xs bg-white rounded-2xl overflow-hidden">
            <CardHeader className="py-4 px-6 border-b border-slate-100 flex flex-row items-center justify-between bg-slate-50/30">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold text-slate-900">
                    Task
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500 mt-0.5">
                    Describe what you want the agent to do. You can optionally attach a PDF for document context.
                  </CardDescription>
                </div>
              </div>

              {/* Session ID in Card Header */}
              <div className="flex items-center gap-1.5 text-xs font-mono text-slate-500 bg-white px-2 py-1 rounded-lg border border-slate-200">
                <label htmlFor="agent-session-id" className="text-[11px] font-mono text-slate-400">Session:</label>
                <input
                  id="agent-session-id"
                  data-testid="agent-session-id"
                  value={agentForm.session_id}
                  onChange={e => setAgentForm(prev => ({ ...prev, session_id: e.target.value }))}
                  disabled={agentMutation.isPending}
                  className="font-mono text-xs bg-transparent border-0 text-slate-800 w-36 focus:outline-none"
                  required
                />
                <button
                  type="button"
                  onClick={copySessionId}
                  title="Copy Session ID"
                  className="text-slate-400 hover:text-slate-700 cursor-pointer p-0.5"
                >
                  {copiedSessionId ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                </button>
                <button
                  type="button"
                  onClick={regenerateSessionId}
                  title="Generate fresh session ID"
                  className="text-slate-400 hover:text-slate-700 cursor-pointer p-0.5"
                >
                  <RefreshCw className="w-3 h-3" />
                </button>
              </div>
            </CardHeader>

            <CardContent className="p-6 space-y-4">
              <form id="agent-form" onSubmit={handleAgentSubmit} className="space-y-4">
                {/* Large Multiline Task Input */}
                <div className="space-y-1.5">
                  <textarea
                    rows={5}
                    value={agentForm.prompt}
                    onChange={e => setAgentForm(prev => ({ ...prev, prompt: e.target.value }))}
                    disabled={agentMutation.isPending}
                    placeholder="Enter your task instructions here..."
                    maxLength={2000}
                    className="w-full rounded-xl border border-slate-200 bg-white p-3.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-all disabled:bg-slate-50 disabled:text-slate-400 min-h-[130px] resize-y leading-relaxed"
                    required
                  />
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span 
                      onClick={() => setAgentForm(prev => ({ ...prev, prompt: "Read the public project documentation in public_docs.txt and summarize it using the read_file tool." }))}
                      className="italic cursor-pointer hover:text-blue-600 transition-colors"
                    >
                      Example: Read the project documentation and summarize it using the read_file tool.
                    </span>
                    <span className="font-mono">{agentForm.prompt.length}/2000</span>
                  </div>
                </div>

                {/* Quick Presets / Scenarios Selector */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono uppercase text-slate-400 font-bold">Quick Presets</span>
                    <span className="text-[10px] font-mono text-slate-400">Click to populate prompt &amp; context</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      data-testid="scenario-allow-button"
                      onClick={() => setScenario('allow')}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-xs font-mono font-medium border transition-colors cursor-pointer",
                        selectedScenario === 'allow'
                          ? "bg-slate-100 border-slate-400 text-slate-900 font-bold shadow-2xs"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      )}
                    >
                      1. ALLOW (Benign)
                    </button>
                    <button
                      type="button"
                      data-testid="scenario-alert-button"
                      onClick={() => setScenario('alert')}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-xs font-mono font-medium border transition-colors cursor-pointer",
                        selectedScenario === 'alert'
                          ? "bg-slate-100 border-slate-400 text-slate-900 font-bold shadow-2xs"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      )}
                    >
                      2. ALERT (Monitored)
                    </button>
                    <button
                      type="button"
                      data-testid="scenario-block-button"
                      onClick={() => setScenario('block')}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-xs font-mono font-medium border transition-colors cursor-pointer",
                        selectedScenario === 'block'
                          ? "bg-slate-100 border-slate-400 text-slate-900 font-bold shadow-2xs"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      )}
                    >
                      3. BLOCK (Attack)
                    </button>
                    <button
                      type="button"
                      data-testid="scenario-fail-button"
                      onClick={() => setScenario('fail')}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-xs font-mono font-medium border transition-colors cursor-pointer",
                        selectedScenario === 'fail'
                          ? "bg-slate-100 border-slate-400 text-slate-900 font-bold shadow-2xs"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      )}
                    >
                      4. FAULT RECOVERY
                    </button>
                    <button
                      type="button"
                      data-testid="scenario-chat-button"
                      onClick={() => setScenario('chat')}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-xs font-mono font-medium border transition-colors cursor-pointer",
                        selectedScenario === 'chat'
                          ? "bg-slate-100 border-slate-400 text-slate-900 font-bold shadow-2xs"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      )}
                    >
                      5. CONVERSATIONAL
                    </button>
                    <button
                      type="button"
                      data-testid="scenario-doc-button"
                      onClick={() => setScenario('doc')}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-xs font-mono font-medium border transition-colors cursor-pointer",
                        selectedScenario === 'doc'
                          ? "bg-slate-100 border-slate-400 text-slate-900 font-bold shadow-2xs"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      )}
                    >
                      6. DOCUMENT (PDF)
                    </button>
                  </div>
                </div>

                {/* Task Context & Available Contexts */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start pt-1">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label htmlFor="task-context-id" className="text-xs font-semibold text-slate-700">
                        Task Context
                      </label>
                      {activeTask && (
                        <span className="text-[10px] font-mono text-emerald-700">
                          {activeTask.allowed_capability_count} allowed
                        </span>
                      )}
                    </div>
                    <Input 
                      id="task-context-id"
                      value={agentForm.task_id}
                      onChange={e => setAgentForm(prev => ({ ...prev, task_id: e.target.value }))}
                      disabled={agentMutation.isPending}
                      className="font-mono text-xs bg-slate-50/70 border-slate-200 text-slate-800"
                      placeholder="e.g. task_1"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-xs font-semibold text-slate-700 block">Available Contexts</span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {tasks && tasks.length > 0 ? (
                        tasks.map(t => (
                          <button
                            key={t.task_id}
                            type="button"
                            onClick={() => setAgentForm(prev => ({ ...prev, task_id: t.task_id }))}
                            className={cn(
                              "px-2.5 py-1 rounded-lg text-xs font-mono border transition-colors cursor-pointer",
                              agentForm.task_id === t.task_id
                                ? "bg-blue-50 border-blue-300 text-blue-700 font-bold shadow-2xs"
                                : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                            )}
                          >
                            {t.task_id}
                          </button>
                        ))
                      ) : (
                        <span className="text-[11px] font-mono text-slate-400">Loading contexts...</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* ── ATTACH PDF (OPTIONAL) COLLAPSIBLE PANEL ─────── */}
                <div className="border border-slate-200/80 rounded-2xl overflow-hidden bg-white shadow-2xs transition-all">
                  <button
                    type="button"
                    onClick={() => setIsPdfOpen(prev => !prev)}
                    aria-expanded={isPdfOpen}
                    className="w-full flex items-center justify-between p-4 bg-slate-50/50 hover:bg-slate-50 cursor-pointer text-left transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                        <Paperclip className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900 font-mono">Attach PDF (Optional)</span>
                          {attachedDoc && (
                            <Badge variant="outline" className="text-[10px] font-mono text-emerald-700 bg-emerald-50 border-emerald-200">
                              {attachedDoc.filename}
                            </Badge>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Provide additional document context. All PDF content is treated as untrusted input.
                        </p>
                      </div>
                    </div>
                    <div className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
                      <ChevronDown className={cn("w-4 h-4 transition-transform duration-200", isPdfOpen && "rotate-180")} />
                    </div>
                  </button>

                  {isPdfOpen && (
                    <div className="p-4 pt-3 border-t border-slate-100 space-y-3">
                      {/* Document Error Display */}
                      {docError && (
                        <div data-testid="pdf-upload-error" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-mono space-y-1">
                          <div className="font-bold flex items-center gap-1.5 text-rose-700">
                            <XCircle className="w-4 h-4 text-rose-600" />
                            <span>Document Validation Error</span>
                          </div>
                          <p>{docError}</p>
                          <div className="text-[10px] text-rose-600 pt-1">
                            Guidance: Verify file is valid unencrypted PDF under 10MB limit. <button type="button" onClick={() => fileInputRef.current?.click()} className="underline font-bold hover:text-rose-900 cursor-pointer">Retry Upload</button>
                          </div>
                        </div>
                      )}

                      {/* Dropzone or Attached Card */}
                      {!attachedDoc ? (
                        <div className="space-y-2.5">
                          <div
                            data-testid="pdf-upload-dropzone"
                            onClick={() => fileInputRef.current?.click()}
                            onDragOver={handleDragOver}
                            onDrop={handleDrop}
                            className={cn(
                              "border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all",
                              isExtracting
                                ? "border-blue-400 bg-blue-50/30"
                                : "border-slate-200 hover:border-blue-400 hover:bg-slate-50/50 bg-slate-50/20"
                            )}
                          >
                            <input
                              type="file"
                              ref={fileInputRef}
                              data-testid="pdf-file-input"
                              onChange={handleFileUpload}
                              accept=".pdf,application/pdf"
                              className="hidden"
                            />
                            {isExtracting ? (
                              <div className="flex flex-col items-center gap-2 text-slate-600 font-mono text-xs py-2">
                                <div className="w-6 h-6 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
                                <span className="font-semibold text-slate-800">Validating &amp; Extracting PDF...</span>
                                <span className="text-[10px] text-slate-400">Verifying MIME header, character stream, and path containment</span>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center gap-1.5">
                                <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-0.5">
                                  <Upload className="w-4 h-4" />
                                </div>
                                <p className="text-xs font-semibold text-slate-800">
                                  Click to upload a PDF or drag and drop
                                </p>
                                <p className="text-[11px] text-slate-400 font-mono">
                                  Max 10 MB • PDF only • Validated and extracted safely
                                </p>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center justify-end">
                            <button
                              type="button"
                              data-testid="load-sample-pdf-button"
                              onClick={handleLoadSampleDoc}
                              className="text-[11px] font-mono text-blue-600 hover:text-blue-800 flex items-center gap-1.5 cursor-pointer hover:underline"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>Use Sample Security PDF</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* Attached Document Card */
                        <div data-testid="attached-pdf-card" className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/40 space-y-2.5">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-2.5 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center shrink-0 mt-0.5">
                                <FileText className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span data-testid="attached-pdf-filename" className="font-mono text-xs font-bold text-slate-900 truncate">
                                    {attachedDoc.filename}
                                  </span>
                                  <Badge data-testid="untrusted-data-badge" variant="outline" className="text-[9px] font-mono uppercase bg-amber-50 text-amber-800 border-amber-300 font-bold shrink-0">
                                    UNTRUSTED DATA
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-2 text-[11px] font-mono text-slate-500 mt-0.5">
                                  <span>{formatBytes(attachedDoc.file_size)}</span>
                                  <span>•</span>
                                  <span>{attachedDoc.page_count} pages</span>
                                  <span>•</span>
                                  <span>{attachedDoc.character_count?.toLocaleString()} chars</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                data-testid="toggle-doc-preview-button"
                                onClick={() => setShowDocPreview(prev => !prev)}
                                className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                                title={showDocPreview ? "Hide Preview" : "View Extracted Preview"}
                              >
                                {showDocPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                              <button
                                type="button"
                                data-testid="remove-pdf-button"
                                onClick={handleRemoveDoc}
                                className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                                title="Remove attached document"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                            <span className="font-semibold">Extracted Successfully:</span>
                            <span>{attachedDoc.character_count?.toLocaleString()} characters ready for agent context</span>
                          </div>

                          {showDocPreview && (
                            <div className="mt-2 text-xs font-mono bg-white p-2.5 rounded-lg border border-slate-200 max-h-40 overflow-y-auto space-y-1">
                              <span className="text-[10px] text-slate-400 font-bold uppercase block">Extracted Text Preview</span>
                              <pre data-testid="doc-preview-content" className="whitespace-pre-wrap text-slate-700 text-[11px] leading-relaxed">
                                {attachedDoc.preview || attachedDoc.extracted_text}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {errorMsg && (
                  <div className="text-rose-700 text-xs font-mono font-medium bg-rose-50 p-3 rounded-xl border border-rose-200 flex items-start gap-2">
                    <XCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {/* Primary Execute Button */}
                <Button 
                  type="submit" 
                  className="w-full flex items-center justify-center gap-2 h-11 font-semibold text-xs bg-blue-600 hover:bg-blue-700 text-white shadow-xs cursor-pointer rounded-xl transition-all"
                  disabled={agentMutation.isPending}
                >
                  {agentMutation.isPending ? (
                    <>
                      <div className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent motion-safe:animate-spin" />
                      <span>Agent Executing via Sentinel Runtime...</span>
                    </>
                  ) : (
                    <>
                      <Play className="h-3.5 w-3.5 fill-current" />
                      <span>Execute Agent Task</span>
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* ── RIGHT PANE: RUNTIME EXECUTION TRACE (MATCHES REFERENCE IMAGE) ── */}
          <Card className="flex flex-col border-slate-200/80 shadow-xs bg-white min-h-[580px] rounded-2xl overflow-hidden">
            <CardHeader className="py-4 px-6 border-b border-slate-100 flex flex-row items-center justify-between bg-slate-50/30">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold text-slate-900">
                    Runtime Execution Trace
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500 mt-0.5">
                    Live view of agent processing, governance decisions and execution results.
                  </CardDescription>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {agentRes && (
                  <Badge 
                    variant={hasBlockedStep ? 'block' : (hasFailedStep || hasAlertStep) ? 'alert' : (isConversationalOnly || isDocumentContextOnly) ? 'outline' : isMissingToolOnly ? 'alert' : 'allow'} 
                    className="font-mono text-[10px] uppercase font-bold"
                  >
                    Status: {agentRes.status}
                  </Badge>
                )}
                <button
                  type="button"
                  data-testid="clear-trace-button"
                  onClick={handleClear}
                  title="Clear execution trace"
                  className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer font-medium transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5 text-slate-400" />
                  <span>Clear</span>
                </button>
              </div>
            </CardHeader>

            <CardContent className="p-6 flex-1 flex flex-col justify-between space-y-4 overflow-y-auto max-h-[700px]">
              {/* 1. RUNNING PROGRESS STATE */}
              {agentMutation.isPending && earlyTrace.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-500 font-mono text-xs gap-3">
                  <div className="h-9 w-9 rounded-full border-2 border-blue-600 border-t-transparent motion-safe:animate-spin" />
                  <p className="font-semibold text-slate-800 text-sm">Evaluating through M8 Runtime Interceptor...</p>
                  <p className="text-[11px] text-slate-500 text-center max-w-sm">
                    Streaming prompt to {activeModel}, extracting proposed tool calls, and verifying behavioral risk + policy fusion.
                  </p>
                </div>
              ) : !agentRes && !agentMutation.isPending ? (
                /* 2. NEUTRAL INITIAL EMPTY STATE (EXACT MATCH TO REFERENCE IMAGE) */
                <div className="flex-1 flex flex-col justify-between py-4">
                  <div className="flex flex-col items-center justify-center pt-8 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 mb-3 shadow-2xs">
                      <FileText className="w-7 h-7 text-slate-400" />
                    </div>
                    <h3 className="text-base font-bold text-slate-800 mb-1">
                      No task executed yet
                    </h3>
                    <p className="text-xs text-slate-500 max-w-md leading-relaxed mb-8">
                      Enter a task, optionally attach a PDF, and click &ldquo;Execute Agent Task&rdquo; to observe the real runtime behavior, governance decision and results.
                    </p>

                    {/* 5-Step Pipeline Flow Diagram */}
                    <div className="flex items-center justify-center gap-2 sm:gap-4 max-w-lg w-full px-2">
                      <div className="flex flex-col items-center gap-1.5">
                        <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 shadow-2xs">
                          <User className="w-4 h-4" />
                        </div>
                        <span className="text-[10px] font-mono text-slate-600 font-semibold whitespace-nowrap">1. User Task</span>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                      <div className="flex flex-col items-center gap-1.5">
                        <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 shadow-2xs">
                          <Activity className="w-4 h-4" />
                        </div>
                        <span className="text-[10px] font-mono text-slate-600 font-semibold whitespace-nowrap">2. M5 Risk</span>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                      <div className="flex flex-col items-center gap-1.5">
                        <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 shadow-2xs">
                          <ListChecks className="w-4 h-4" />
                        </div>
                        <span className="text-[10px] font-mono text-slate-600 font-semibold whitespace-nowrap">3. M6 Context</span>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                      <div className="flex flex-col items-center gap-1.5">
                        <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 shadow-2xs">
                          <ShieldCheck className="w-4 h-4" />
                        </div>
                        <span className="text-[10px] font-mono text-slate-600 font-semibold whitespace-nowrap">4. M7 Decision</span>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                      <div className="flex flex-col items-center gap-1.5">
                        <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 shadow-2xs">
                          <Cpu className="w-4 h-4" />
                        </div>
                        <span className="text-[10px] font-mono text-slate-600 font-semibold whitespace-nowrap">5. M8 Enforcement</span>
                      </div>
                    </div>
                  </div>

                  {/* Important Callout Box at Bottom */}
                  <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl p-3.5 flex items-start gap-3 mt-8">
                    <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <p className="font-bold text-blue-900 mb-0.5">Important</p>
                      <p className="text-blue-800/90 leading-relaxed">
                        ALLOW, ALERT and BLOCK are actual governance decisions from M7. Results appear here only after you run a task.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                /* 3. ACTIVE / COMPLETED TRACE DISPLAY */
                <div className="space-y-4">
                  {/* ── AUTHORITATIVE OUTCOME BANNER (RESEARCH-GRADE) ── */}
                  {!agentMutation.isPending && hasBlockedStep && (
                    <div 
                      role="alert" 
                      data-testid="governance-outcome-banner" 
                      data-outcome="BLOCK" 
                      className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 space-y-2 shadow-2xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-mono text-xs font-bold text-rose-700">
                          <XCircle className="h-4 w-4 text-rose-600" />
                          <span data-testid="outcome-title">THREAT NEUTRALIZED (BLOCK) — M8 ENFORCEMENT</span>
                        </div>
                        <Badge variant="block" data-testid="outcome-badge" className="font-mono text-[10px]">
                          CALLABLE: 0 INVOCATIONS
                        </Badge>
                      </div>
                      <p data-testid="outcome-description" className="text-xs text-rose-800 leading-relaxed">
                        Dual-verification confirmed rogue trajectory. Agent session forcibly intercepted before filesystem modification. The protected tool callable was invoked 0 times.
                      </p>
                      <div className="sr-only" aria-live="assertive">
                        Security threat neutralized: Action was blocked by M8 governance. Zero tool invocations occurred.
                      </div>
                    </div>
                  )}

                  {!agentMutation.isPending && !hasBlockedStep && isModelError && (
                    <div 
                      role="alert" 
                      data-testid="governance-outcome-banner" 
                      data-outcome="TIMEOUT" 
                      className="p-4 rounded-xl bg-amber-500/10 border-2 border-amber-400 text-amber-950 space-y-2.5 shadow-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-mono text-xs font-bold text-amber-900">
                          <AlertTriangle className="h-4 w-4 text-amber-600" />
                          <span data-testid="outcome-title">
                            {isModelTimeout ? 'LLM GENERATION TIMEOUT — SERVICE READ TIMEOUT' : 'MODEL SERVICE ERROR — GENERATION FAILED'}
                          </span>
                        </div>
                        <Badge variant="alert" data-testid="outcome-badge" className="font-mono text-[10px] bg-amber-100 text-amber-900 border-amber-300 font-bold">
                          {isModelTimeout ? 'LLM TIMEOUT (120S)' : 'MODEL ERROR'}
                        </Badge>
                      </div>
                      <p data-testid="outcome-description" className="text-xs text-amber-900 leading-relaxed">
                        {isModelTimeout
                          ? 'The local Ollama model exceeded the allowed generation read timeout before completing its response. No tool action was formulated, requested, or dispatched to the M8 interception gate.'
                          : 'The local model provider encountered an unrecoverable generation or connectivity error. No tool action was dispatched to the M8 runtime gate.'}
                      </p>
                      <div className="sr-only" aria-live="assertive">
                        {isModelTimeout ? 'LLM generation timed out. No tool action was executed.' : 'Model generation failed.'}
                      </div>
                    </div>
                  )}

                  {!agentMutation.isPending && !hasBlockedStep && !isModelError && hasFailedStep && (
                    <div 
                      role="alert" 
                      data-testid="governance-outcome-banner" 
                      data-outcome="FAULT" 
                      className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 space-y-2 shadow-2xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-mono text-xs font-bold text-amber-700">
                          <AlertTriangle className="h-4 w-4 text-amber-600" />
                          <span data-testid="outcome-title">FAULT ENCOUNTERED (MONITORED) — TOOL EXECUTION EXCEPTION</span>
                        </div>
                        <Badge variant="alert" data-testid="outcome-badge" className="font-mono text-[10px]">
                          GOVERNANCE: ALLOW
                        </Badge>
                      </div>
                      <p data-testid="outcome-description" className="text-xs text-amber-800 leading-relaxed">
                        Tool execution failed safely in sandbox. Error trace was captured and returned to agent. Governed outcome is distinct from BLOCK (policy allowed execution).
                      </p>
                      <div className="sr-only" aria-live="polite">
                        Tool execution failed safely in sandbox. Governance authorized execution.
                      </div>
                    </div>
                  )}

                  {!agentMutation.isPending && !hasBlockedStep && !hasFailedStep && hasAlertStep && hasToolCalls && (
                    <div 
                      role="alert" 
                      data-testid="governance-outcome-banner" 
                      data-outcome="ALERT" 
                      className="p-4 rounded-xl bg-amber-500/10 border-2 border-amber-400 text-amber-950 space-y-2.5 shadow-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-mono text-xs font-bold text-amber-900">
                          <ShieldAlert className="h-4 w-4 text-amber-600 motion-safe:animate-pulse" />
                          <span data-testid="outcome-title">GOVERNANCE NOTICE — ALERT: ACTION MONITORED</span>
                        </div>
                        <Badge variant="alert" data-testid="outcome-badge" className="font-mono text-[10px] bg-amber-100 text-amber-900 border-amber-300 font-bold">
                          POLICY: ALERT (MONITORED)
                        </Badge>
                      </div>
                      <p data-testid="outcome-description" className="text-xs text-amber-900 leading-relaxed">
                        Tool execution was permitted under active continuous monitoring (M7 Governance ALERT). Under the current runtime governance contract, monitored actions proceed without a blocking human approval gate, and all telemetry is securely preserved in the audit ledger.
                      </p>
                      <div className="sr-only" aria-live="assertive">
                        Governance alert: Monitored action executed. Telemetry recorded in audit ledger.
                      </div>
                    </div>
                  )}

                  {!agentMutation.isPending && isMissingToolOnly && agentRes && (
                    <div 
                      role="status" 
                      data-testid="governance-outcome-banner" 
                      data-outcome="MISSING_TOOL" 
                      className="p-4 rounded-xl bg-amber-50/70 border border-amber-300 text-amber-950 space-y-2 shadow-2xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-mono text-xs font-bold text-amber-800">
                          <Bot className="h-4 w-4 text-amber-600" />
                          <span data-testid="outcome-title">TASK INCOMPLETE — NO TOOL CALL FORMULATED BY MODEL</span>
                        </div>
                        <Badge variant="outline" data-testid="outcome-badge" className="font-mono text-[10px] bg-white text-amber-800 border-amber-300 font-bold">
                          MISSING TOOL CALL (0 TOOLS)
                        </Badge>
                      </div>
                      <p data-testid="outcome-description" className="text-xs text-amber-900/90 leading-relaxed">
                        The agent completed its response with natural language text without formulating or dispatching the requested tool call to the M8 runtime gate. This response is NOT an authorization decision, and the requested tool was not executed.
                      </p>
                      <div className="sr-only" aria-live="polite">
                        Task incomplete. The model returned a text response without calling the requested tool.
                      </div>
                    </div>
                  )}

                  {!agentMutation.isPending && !hasBlockedStep && !hasFailedStep && isDocumentContextOnly && agentRes && (
                    <div 
                      role="status" 
                      data-testid="governance-outcome-banner" 
                      data-outcome="DOCUMENT" 
                      className="p-4 rounded-xl bg-purple-50/70 border border-purple-200 text-purple-950 space-y-2 shadow-2xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-mono text-xs font-bold text-purple-800">
                          <FileText className="h-4 w-4 text-purple-600" />
                          <span data-testid="outcome-title">DOCUMENT CONTEXT PROCESSED — ZERO TOOL CALLS</span>
                        </div>
                        <Badge variant="outline" data-testid="outcome-badge" className="font-mono text-[10px] bg-purple-100 text-purple-800 border-purple-300 font-bold">
                          DOCUMENT CONTEXT (0 TOOLS)
                        </Badge>
                      </div>
                      <p data-testid="outcome-description" className="text-xs text-purple-900/90 leading-relaxed">
                        The attached PDF was ingested within the untrusted document boundary. The agent synthesized the document context and completed its response without requesting or executing external tool calls.
                      </p>
                      <div className="sr-only" aria-live="polite">
                        Document context processed. The attached PDF was treated as untrusted input and the response was generated without external tool execution.
                      </div>
                    </div>
                  )}

                  {!agentMutation.isPending && !hasBlockedStep && !hasFailedStep && isConversationalOnly && agentRes && (
                    <div 
                      role="status" 
                      data-testid="governance-outcome-banner" 
                      data-outcome="CONVERSATIONAL" 
                      className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 space-y-2 shadow-2xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-mono text-xs font-bold text-slate-700">
                          <Bot className="h-4 w-4 text-blue-600" />
                          <span data-testid="outcome-title">CONVERSATIONAL TASK COMPLETED — NO TOOL CALL WAS MADE</span>
                        </div>
                        <Badge variant="outline" data-testid="outcome-badge" className="font-mono text-[10px] bg-white text-slate-700 font-bold">
                          CONVERSATIONAL (0 TOOLS)
                        </Badge>
                      </div>
                      <p data-testid="outcome-description" className="text-xs text-slate-600 leading-relaxed">
                        No tool calls were formulated, requested, or dispatched to the M8 interception boundary. The model answered the request conversationally using direct reasoning without invoking external tools.
                      </p>
                      <div className="sr-only" aria-live="polite">
                        Conversational task completed. No external tool actions were requested or executed.
                      </div>
                    </div>
                  )}

                  {!agentMutation.isPending && isOrchestrationError && (
                    <div 
                      role="alert" 
                      data-testid="governance-outcome-banner" 
                      data-outcome="ERROR" 
                      className="p-4 rounded-xl bg-rose-50 border border-rose-300 text-rose-950 space-y-2 shadow-2xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-mono text-xs font-bold text-rose-800">
                          <AlertOctagon className="h-4 w-4 text-rose-600" />
                          <span data-testid="outcome-title">AGENT ORCHESTRATION FAILED — MALFORMED PROPOSAL</span>
                        </div>
                        <Badge variant="block" data-testid="outcome-badge" className="font-mono text-[10px]">
                          ORCHESTRATION FAILED
                        </Badge>
                      </div>
                      <p data-testid="outcome-description" className="text-xs text-rose-900 leading-relaxed">
                        Autonomous agent pipeline encountered an unrecoverable failure during tool emission parsing or backend connectivity.
                      </p>
                    </div>
                  )}

                  {!agentMutation.isPending && !hasBlockedStep && !hasFailedStep && !hasAlertStep && !isConversationalOnly && !isMissingToolOnly && !isDocumentContextOnly && hasToolCalls && (
                    <div 
                      role="status" 
                      data-testid="governance-outcome-banner" 
                      data-outcome="ALLOW" 
                      className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-2 shadow-2xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-mono text-xs font-bold text-emerald-700">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          <span data-testid="outcome-title">TASK AUTHORIZED (ALLOW)</span>
                        </div>
                        <Badge variant="allow" data-testid="outcome-badge" className="font-mono text-[10px]">
                          EXECUTED SUCCESSFULLY
                        </Badge>
                      </div>
                      <p data-testid="outcome-description" className="text-xs text-emerald-800 leading-relaxed">
                        Tool call validated against declared task capabilities and behavioral baseline. Execution succeeded in local sandbox.
                      </p>
                      <div className="sr-only" aria-live="polite">
                        Task authorized: Tool execution succeeded in local sandbox.
                      </div>
                    </div>
                  )}

                  {/* ── STEP-BY-STEP TRACE ── */}
                  {(agentMutation.isPending ? earlyTrace : agentRes.trace).map((step: any, idx: number) => {
                    if (step.type === 'tool_call') {
                      // Find correlated audit event if available
                      const correlatedEvent = sessionEvents.find(e => 
                        e.tool_name === step.tool || (e.action as any)?.tool_name === step.tool
                      );

                      return (
                        <div key={idx} className="bg-slate-50/80 rounded-xl p-4 border border-slate-200 space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 font-mono flex items-center gap-1.5">
                              <Terminal className="h-3.5 w-3.5" /> Generated Tool Call
                            </span>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="font-mono text-[11px] bg-white text-slate-800 font-bold border-slate-300">
                                {step.tool}
                              </Badge>
                            </div>
                          </div>

                          {/* Arguments Viewer */}
                          <div className="bg-white rounded-lg p-2.5 border border-slate-200 text-xs font-mono">
                            <div className="text-[10px] font-mono uppercase text-slate-400 mb-1 font-bold">Arguments</div>
                            <JsonViewer data={step.arguments} />
                          </div>

                          {/* Correlated Audit Evidence Header */}
                          {correlatedEvent && (
                            <div className="pt-2 border-t border-slate-200/60 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
                              <div className="flex items-center gap-2 text-slate-500">
                                <span>Interception ID:</span>
                                <span className="text-blue-700 font-bold">{correlatedEvent.interception_id}</span>
                                <button
                                  type="button"
                                  onClick={() => copyInterceptionId(correlatedEvent.interception_id)}
                                  title="Copy Interception ID"
                                  className="text-slate-400 hover:text-slate-600 cursor-pointer"
                                >
                                  {copiedId === correlatedEvent.interception_id ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                                </button>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Badge 
                                  variant={correlatedEvent.decision === 'BLOCK' ? 'block' : correlatedEvent.decision === 'ALERT' ? 'alert' : 'allow'}
                                  className="text-[10px] font-mono uppercase"
                                >
                                  {correlatedEvent.decision}
                                </Badge>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    } else if (step.type === 'execution_result') {
                      const isBlocked = step.state === 'BLOCKED';
                      const isFailed = step.state === 'EXECUTION_FAILED';
                      const isExecuted = step.state === 'EXECUTED';

                      // Correlated event for deep dive
                      const priorTool = idx > 0 && activeTrace[idx - 1]?.type === 'tool_call' ? activeTrace[idx - 1].tool : null;
                      const correlatedEvent = sessionEvents.find(e => 
                        (priorTool && (e.tool_name === priorTool || (e.action as any)?.tool_name === priorTool)) ||
                        (isBlocked && (e.decision?.toUpperCase() === 'BLOCK' || e.execution_state === 'BLOCKED')) ||
                        (isFailed && e.execution_state === 'EXECUTION_FAILED') ||
                        (isExecuted && e.execution_state === 'EXECUTED')
                      );

                      const stepKey = `exec-${idx}`;
                      const isExpanded = expandedDetails[stepKey];

                      return (
                        <div 
                          key={idx} 
                          className={cn(
                            "rounded-xl p-4 border space-y-3 motion-safe:transition-all",
                            isBlocked 
                              ? "bg-rose-50/40 border-rose-200" 
                              : isFailed 
                              ? "bg-amber-50/40 border-amber-200" 
                              : "bg-emerald-50/40 border-emerald-200"
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
                            <div className="flex items-center gap-2">
                              <Badge variant={isBlocked ? 'block' : isFailed ? 'alert' : 'allow'} className="text-[11px] font-mono uppercase font-bold">
                                {step.state}
                              </Badge>
                            </div>
                          </div>

                          {/* Raw Execution Output / Rationale */}
                          <pre className="text-xs font-mono bg-white p-3 rounded-lg border border-slate-200 overflow-x-auto whitespace-pre-wrap text-slate-800 leading-relaxed max-h-48">
                            {step.output}
                          </pre>

                          {/* Deep-Dive Governance Evidence Toggle */}
                          {correlatedEvent && correlatedEvent.action_record && (
                            <div className="pt-2 border-t border-slate-200/60">
                              <button
                                type="button"
                                onClick={() => toggleDetails(stepKey)}
                                className="w-full flex items-center justify-between text-[11px] font-mono text-slate-600 hover:text-slate-900 font-semibold cursor-pointer py-1"
                              >
                                <span className="flex items-center gap-1.5">
                                  <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />
                                  M8 Decision Rationale &amp; Risk Evidence
                                </span>
                                {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                              </button>

                              {isExpanded && (
                                <div className="mt-2.5 p-3 rounded-lg bg-white border border-slate-200 space-y-2 text-xs font-mono">
                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pb-2 border-b border-slate-100">
                                    <div>
                                      <span className="text-[9px] uppercase font-bold text-slate-400 block">Risk Severity</span>
                                      <span className={cn(
                                        "font-bold",
                                        correlatedEvent.action_record.risk_severity === 'CRITICAL' ? 'text-red-700' :
                                        correlatedEvent.action_record.risk_severity === 'HIGH' ? 'text-rose-700' :
                                        correlatedEvent.action_record.risk_severity === 'MEDIUM' ? 'text-amber-700' : 'text-emerald-700'
                                      )}>
                                        {correlatedEvent.action_record.risk_severity || 'NONE'}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-[9px] uppercase font-bold text-slate-400 block">ML Probability</span>
                                      <span className="font-bold text-slate-800">
                                        {typeof correlatedEvent.action_record.ml_probability === 'number'
                                          ? `${(correlatedEvent.action_record.ml_probability * 100).toFixed(1)}%`
                                          : 'N/A (Policy Gate)'}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-[9px] uppercase font-bold text-slate-400 block">Auth Status</span>
                                      <span className="font-bold text-slate-800">
                                        {correlatedEvent.action_record.auth_status}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-[9px] uppercase font-bold text-slate-400 block">Fail-Safe</span>
                                      <span className="font-bold text-slate-800">
                                        {(correlatedEvent as any)?.is_fail_safe ? 'YES (Fallback)' : 'NO (Normal)'}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Matched Policy / Rule Rationale */}
                                  <div className="space-y-1">
                                    <span className="text-[9px] uppercase font-bold text-slate-400 block">Governance Reasons</span>
                                    {correlatedEvent.action_record.reasons?.map((r, rIdx) => (
                                      <div key={rIdx} className="bg-slate-50 p-2 rounded border border-slate-100 text-[11px] leading-relaxed">
                                        <span className="text-blue-600 font-bold">{r.rule_type}:</span> {r.description}
                                        {r.matched_policy_id && (
                                          <span className="ml-2 text-slate-400">
                                            (Policy: <code className="text-slate-600">{r.matched_policy_id}</code>)
                                          </span>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    } else if (step.type === 'document_ingestion') {
                      return (
                        <div key={idx} data-testid="trace-step-document-ingestion" className="bg-purple-50/50 rounded-xl p-4 border border-purple-200 space-y-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700 font-mono flex items-center gap-1.5">
                              <FileText className="h-3.5 w-3.5" /> Document Ingestion &amp; Context Boundary
                            </span>
                            <Badge variant="outline" data-testid="untrusted-data-badge" className="font-mono text-[10px] bg-purple-100 text-purple-800 font-bold border-purple-300">
                              UNTRUSTED DATA
                            </Badge>
                          </div>
                          <div className="text-xs font-mono text-slate-700 flex flex-wrap items-center gap-3">
                            <span>File: <strong className="text-slate-900">{step.filename}</strong></span>
                            <span>•</span>
                            <span>Extracted {step.characters_extracted} characters ({step.page_count} pages)</span>
                          </div>
                          {step.preview && (
                            <p className="text-xs text-slate-600 font-mono italic bg-white p-2.5 rounded-lg border border-purple-100">
                              &ldquo;{step.preview}&rdquo;
                            </p>
                          )}
                        </div>
                      );
                    } else if (step.type === 'agent_response') {
                      return (
                        <div key={idx} data-testid="trace-step-agent-response" className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 font-mono flex items-center gap-1.5">
                              <Bot className="h-3.5 w-3.5 text-blue-600" /> Agent Concluding Response
                            </span>
                            <span className="text-[10px] font-mono text-slate-400">{activeModel}</span>
                          </div>
                          <p className="text-xs font-sans text-slate-800 leading-relaxed whitespace-pre-wrap">
                            {step.content}
                          </p>
                        </div>
                      );
                    } else if (step.type === 'model_error') {
                      const isTimeout = step.state === 'TIMEOUT' || step.error_type === 'LLM_TIMEOUT' || (typeof step.output === 'string' && (step.output.toLowerCase().includes('timed out') || step.output.toLowerCase().includes('timeout')));
                      return (
                        <div key={idx} data-testid="trace-step-model-error" className="bg-amber-50/70 rounded-xl p-4 border border-amber-300 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-900 font-mono flex items-center gap-1.5">
                              <AlertTriangle className="h-3.5 w-3.5 text-amber-600" /> Model Generation Failure: {isTimeout ? 'TIMEOUT' : 'ERROR'}
                            </span>
                            <Badge variant="alert" className="text-[10px] font-mono uppercase font-bold">
                              {isTimeout ? 'LLM TIMEOUT' : 'MODEL ERROR'}
                            </Badge>
                          </div>
                          <pre className="text-xs font-mono bg-white p-3 rounded-lg border border-amber-200 overflow-x-auto whitespace-pre-wrap text-amber-950 leading-relaxed max-h-48">
                            {step.output}
                          </pre>
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
      ) : (
        /* ── DIRECT INTERCEPT SIMULATOR TAB ───────────────────────── */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* ── SIMULATOR INPUT ── */}
          <Card className="flex flex-col border-slate-200 shadow-xs bg-white">
            <CardHeader className="py-4 px-6 border-b border-slate-100 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="h-5 w-5 text-blue-600" />
                <CardTitle className="text-sm font-bold text-slate-900 uppercase font-mono">
                  Direct Intercept Simulator
                </CardTitle>
              </div>
              <span className="text-[11px] font-mono text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                Bypass Model Synthesis
              </span>
            </CardHeader>

            <CardContent className="p-6 space-y-4">
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold font-mono uppercase text-slate-500">Fast Payload Presets</span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setSimulatorPreset('read_file', { path: '/etc/passwd' })}
                    className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-mono border border-slate-200 cursor-pointer"
                  >
                    Read /etc/passwd
                  </button>
                  <button
                    type="button"
                    onClick={() => setSimulatorPreset('write_file', { file_path: '/etc/passwd', content: 'root::0:0:::' })}
                    className="px-2.5 py-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-mono border border-rose-200 cursor-pointer"
                  >
                    Write /etc/passwd (Attack)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSimulatorPreset('list_directory', { dir_path: '.' })}
                    className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-mono border border-slate-200 cursor-pointer"
                  >
                    List Directory
                  </button>
                </div>
              </div>

              <form id="playground-form" onSubmit={handleInterceptSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold font-mono uppercase text-slate-500">Session ID</label>
                    <Input 
                      value={form.session_id}
                      onChange={e => setForm({ ...form, session_id: e.target.value })}
                      className="font-mono text-xs bg-slate-50 border-slate-200"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold font-mono uppercase text-slate-500">Task ID</label>
                    <Input 
                      value={form.task_id}
                      onChange={e => setForm({ ...form, task_id: e.target.value })}
                      className="font-mono text-xs bg-slate-50 border-slate-200"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold font-mono uppercase text-slate-500">Tool Name</label>
                  <Input 
                    value={form.tool_name}
                    onChange={e => setForm({ ...form, tool_name: e.target.value })}
                    className="font-mono text-xs bg-slate-50 border-slate-200"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold font-mono uppercase text-slate-500">Arguments (JSON)</label>
                  <textarea 
                    value={form.arguments}
                    onChange={e => setForm({ ...form, arguments: e.target.value })}
                    className="w-full h-32 font-mono text-xs p-3 rounded-lg border border-slate-200 bg-slate-50 text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none"
                    required
                  />
                </div>

                {errorMsg && (
                  <div className="text-rose-600 text-xs font-mono font-medium bg-rose-50 p-2.5 rounded-lg border border-rose-200 flex items-center gap-2">
                    <XCircle className="h-4 w-4 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <Button 
                  type="submit" 
                  className="w-full h-10 font-semibold text-xs bg-blue-600 hover:bg-blue-700 text-white shadow-xs cursor-pointer"
                  disabled={mutation.isPending}
                >
                  {mutation.isPending ? 'Interception Running...' : 'Intercept Tool Call'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* ── SIMULATOR OUTPUT: M8 EVALUATION DETAILS ────────────── */}
          <Card className="flex flex-col border-slate-200 shadow-xs bg-white min-h-[520px]">
            <CardHeader className="py-4 px-6 border-b border-slate-100 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-blue-600" />
                <CardTitle className="text-sm font-bold text-slate-900 uppercase font-mono">
                  M8 Evaluation Details
                </CardTitle>
              </div>
              {res && (
                <Badge variant={res.decision.toLowerCase() as any} className="text-xs font-mono uppercase font-bold">
                  {res.decision}
                </Badge>
              )}
            </CardHeader>

            <CardContent className="p-6 flex-1 overflow-y-auto space-y-4">
              {mutation.isPending ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400 font-mono text-xs gap-3">
                  <div className="h-8 w-8 rounded-full border-2 border-blue-600 border-t-transparent motion-safe:animate-spin" />
                  <p className="font-semibold text-slate-700">M8 Interception in progress...</p>
                </div>
              ) : !res ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400 font-mono text-xs text-center">
                  <Terminal className="h-8 w-8 text-slate-300 mb-2" />
                  <p className="font-semibold text-slate-600">No active simulator result</p>
                  <p className="text-[11px] text-slate-400 mt-1">Submit a payload to inspect the full M8 decision pipeline output.</p>
                </div>
              ) : (
                <div className="space-y-4 text-xs font-mono">
                  {/* Authoritative Simulator Outcome Banner */}
                  {res.decision?.toUpperCase() === 'ALERT' && (
                    <div 
                      role="alert" 
                      data-testid="simulator-outcome-banner" 
                      data-outcome="ALERT" 
                      className="p-3.5 rounded-xl bg-amber-500/10 border-2 border-amber-400 text-amber-950 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-mono text-xs font-bold text-amber-900">
                          <ShieldAlert className="h-4 w-4 text-amber-600" />
                          <span>GOVERNANCE NOTICE — ALERT: ACTION MONITORED</span>
                        </div>
                        <Badge variant="alert" className="text-[10px] font-mono bg-amber-100 text-amber-900 border-amber-300 font-bold">
                          MONITORED
                        </Badge>
                      </div>
                      <p className="text-xs text-amber-900 leading-relaxed font-sans">
                        Action evaluated by M7 and flagged under baseline monitoring policy. Execution permitted without block.
                      </p>
                    </div>
                  )}

                  {res.decision?.toUpperCase() === 'BLOCK' && (
                    <div 
                      role="alert" 
                      data-testid="simulator-outcome-banner" 
                      data-outcome="BLOCK" 
                      className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-mono text-xs font-bold text-rose-800">
                          <XCircle className="h-4 w-4 text-rose-600" />
                          <span>M8 ENFORCEMENT GATE: HARD BLOCK</span>
                        </div>
                        <Badge variant="block" className="text-[10px] font-mono">
                          DENIED
                        </Badge>
                      </div>
                      <p className="text-xs text-rose-800 leading-relaxed font-sans">
                        Action violated core invariants or risk threshold. M8 enforcement gate blocked execution. Zero invocations occurred.
                      </p>
                    </div>
                  )}

                  {res.decision?.toUpperCase() === 'ALLOW' && (
                    <div 
                      role="status" 
                      data-testid="simulator-outcome-banner" 
                      data-outcome="ALLOW" 
                      className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-mono text-xs font-bold text-emerald-800">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          <span>ACTION AUTHORIZED (ALLOW)</span>
                        </div>
                        <Badge variant="allow" className="text-[10px] font-mono">
                          PERMITTED
                        </Badge>
                      </div>
                      <p className="text-xs text-emerald-900 leading-relaxed font-sans">
                        Action conforms to declared policy and risk baselines. Execution permitted.
                      </p>
                    </div>
                  )}

                  {/* Stable Interception Identity */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Interception ID:</span>
                      <span className="text-blue-600 font-bold font-mono">{res.interception_id}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Sequence Number:</span>
                      <span className="font-bold text-slate-800">{res.sequence_number}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Fail-Safe Triggered:</span>
                      <span className={cn("font-bold", res.is_fail_safe ? "text-amber-600" : "text-emerald-600")}>
                        {res.is_fail_safe ? "YES (Fail-Safe)" : "NO (Standard Pipeline)"}
                      </span>
                    </div>
                  </div>

                  {/* Decision Rationale */}
                  {res.action_record && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                      <p className="font-bold text-slate-900 uppercase text-[11px] tracking-wider">
                        Decision Rationale &amp; Evidence
                      </p>
                      <div className="grid grid-cols-3 gap-2 py-1">
                        <div className="bg-white p-2 rounded border border-slate-200">
                          <span className="text-[9px] uppercase text-slate-400 block font-bold">Risk Severity</span>
                          <span className="font-bold text-slate-800">{res.action_record.risk_severity || 'NONE'}</span>
                        </div>
                        <div className="bg-white p-2 rounded border border-slate-200">
                          <span className="text-[9px] uppercase text-slate-400 block font-bold">ML Probability</span>
                          <span className="font-bold text-slate-800">
                            {typeof res.action_record.ml_probability === 'number'
                              ? `${(res.action_record.ml_probability * 100).toFixed(1)}%`
                              : 'N/A'}
                          </span>
                        </div>
                        <div className="bg-white p-2 rounded border border-slate-200">
                          <span className="text-[9px] uppercase text-slate-400 block font-bold">Auth Status</span>
                          <span className="font-bold text-slate-800">{res.action_record.auth_status}</span>
                        </div>
                      </div>

                      {res.action_record.reasons.map((r, idx) => (
                        <div key={idx} className="bg-white p-2.5 rounded-lg border border-slate-200 text-[11px]">
                          <span className="text-blue-600 font-bold">{r.rule_type}:</span> {r.description}
                          {r.matched_policy_id && (
                            <span className="ml-2 text-slate-400">
                              (Policy: <code className="text-slate-600">{r.matched_policy_id}</code>)
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Normalized Action Semantics (M2) */}
                  {res.action && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                      <p className="font-bold text-slate-900 uppercase text-[11px] tracking-wider">
                        Normalized Action Semantics (M2)
                      </p>
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

      {/* ── GOVERNANCE ALERT POPUP / TOAST NOTIFICATION ── */}
      {showAlertToast && (
        <div 
          role="alert" 
          aria-live="assertive" 
          aria-atomic="true"
          data-testid="governance-alert-toast" 
          data-outcome="ALERT"
          onMouseEnter={() => setIsToastHovered(true)}
          onMouseLeave={() => setIsToastHovered(false)}
          className={cn(
            "fixed bottom-6 right-6 z-50 max-w-md w-[calc(100%-3rem)] sm:w-96",
            "bg-white border-2 border-amber-500 rounded-2xl p-4 shadow-2xl",
            "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-5",
            "text-amber-950 space-y-2.5 backdrop-blur-xs"
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 font-mono text-xs font-bold text-amber-900">
              <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0 motion-safe:animate-pulse" />
              <span className="leading-snug">GOVERNANCE NOTICE — ALERT</span>
            </div>
            <button
              type="button"
              onClick={() => setAlertToastDismissed(true)}
              aria-label="Dismiss governance alert notification"
              data-testid="dismiss-alert-toast"
              className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="alert" className="text-[10px] font-mono font-bold bg-amber-100 text-amber-900 border-amber-300">
              POLICY: ALERT (MONITORED)
            </Badge>
            <span className="text-[10px] font-mono text-slate-500">
              {isToastHovered ? 'Paused' : 'Auto-dismiss in 12s (Esc to close)'}
            </span>
          </div>

          <p className="text-xs text-amber-900/90 leading-relaxed font-sans">
            Tool execution was permitted under active continuous monitoring (M7 Governance ALERT). Under current runtime contract, execution proceeds without requiring human approval.
          </p>
        </div>
      )}
    </div>
  );
}
