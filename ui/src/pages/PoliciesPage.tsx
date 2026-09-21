import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { policyService } from '../api/services';
import type { CreatePolicyRequest } from '../api/types';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Textarea } from '../components/ui/Textarea';
import { Badge } from '../components/ui/Badge';
import { 
  Shield, 
  Plus, 
  Search, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  FileKey, 
  ShieldAlert, 
  Check
} from 'lucide-react';
import { cn } from '../utils/cn';

export function PoliciesPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [decisionFilter, setDecisionFilter] = useState<'ALL' | 'BLOCK' | 'ALERT' | 'ALLOW'>('ALL');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const { data: policies, isError, isLoading } = useQuery({
    queryKey: ['policies'],
    queryFn: policyService.listPolicies
  });

  const [form, setForm] = useState({
    policy_id: '',
    decision: 'block',
    priority: '100',
    description: '',
    condition: '{\n  \n}'
  });

  const mutation = useMutation({
    mutationFn: policyService.createPolicy,
    onSuccess: (newPolicy) => {
      queryClient.invalidateQueries({ queryKey: ['policies'] });
      setStatusMessage({ type: 'success', text: `Policy "${newPolicy.policy_id}" registered successfully.` });
      setForm({
        policy_id: '',
        decision: 'block',
        priority: '100',
        description: '',
        condition: '{\n  \n}'
      });
      setTimeout(() => setStatusMessage(null), 4000);
    },
    onError: (err: any) => {
      setStatusMessage({ type: 'error', text: err?.response?.data?.detail || "Failed to register policy." });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const cond = JSON.parse(form.condition);
      const req: CreatePolicyRequest = {
        policy_id: form.policy_id.trim(),
        decision: form.decision.toLowerCase(),
        priority: parseInt(form.priority, 10) || 0,
        description: form.description.trim(),
        condition: cond
      };
      mutation.mutate(req);
    } catch (err) {
      setStatusMessage({ type: 'error', text: "Invalid JSON format in condition field." });
    }
  };

  // Filtered policies list
  const filteredPolicies = useMemo(() => {
    if (!policies) return [];
    return policies.filter(p => {
      const matchQuery = 
        p.policy_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchDecision = 
        decisionFilter === 'ALL' || 
        p.decision.toUpperCase() === decisionFilter;

      return matchQuery && matchDecision;
    });
  }, [policies, searchQuery, decisionFilter]);

  // Real Counts
  const totalCount = policies?.length || 0;
  const blockCount = useMemo(() => policies?.filter(p => p.decision.toLowerCase() === 'block').length || 0, [policies]);
  const alertCount = useMemo(() => policies?.filter(p => p.decision.toLowerCase() === 'alert').length || 0, [policies]);
  const allowCount = useMemo(() => policies?.filter(p => p.decision.toLowerCase() === 'allow').length || 0, [policies]);

  return (
    <div className="flex flex-col gap-5 h-full pb-10">
      {/* Top Breadcrumbs & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono mb-1">
            <span className="text-slate-400 uppercase tracking-wider font-semibold">RESEARCH & GOVERNANCE</span>
            <span className="text-slate-300">//</span>
            <span className="text-blue-700 font-bold uppercase tracking-tight">M7 POLICY ENGINE</span>
            <span className="text-slate-300">//</span>
            <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[11px]">
              ACTIVE RULES: {totalCount}
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <span>Governance Policies</span>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              M7 Active
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Define deterministic task scope boundaries, behavioral thresholds, and runtime security tripwires.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => {
              const el = document.getElementById('policy-authoring-box');
              el?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="h-8 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Create New Policy</span>
          </Button>
        </div>
      </div>

      {/* Top 4 KPI Metrics (Strictly Real Backend Data) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 border-slate-200 shadow-xs bg-white flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold font-mono text-slate-500 uppercase tracking-wider">
              TOTAL ACTIVE RULES
            </span>
            <Shield className="h-4 w-4 text-slate-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold font-mono text-slate-900">
              {totalCount}
            </span>
            <span className="text-xs font-mono text-emerald-600 font-semibold">Loaded</span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] font-mono text-slate-500">
            Rules loaded in M9 policy repository
          </div>
        </Card>

        <Card className="p-4 border-slate-200 shadow-xs bg-white flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold font-mono text-slate-500 uppercase tracking-wider">
              BLOCK POLICIES
            </span>
            <XCircle className="h-4 w-4 text-rose-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold font-mono text-rose-600">
              {blockCount}
            </span>
            <span className="text-xs font-mono text-slate-500">Enforced</span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] font-mono text-slate-500">
            Tripwires denying tool execution
          </div>
        </Card>

        <Card className="p-4 border-slate-200 shadow-xs bg-white flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold font-mono text-slate-500 uppercase tracking-wider">
              ALERT POLICIES
            </span>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold font-mono text-amber-600">
              {alertCount}
            </span>
            <span className="text-xs font-mono text-slate-500">Monitored</span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] font-mono text-slate-500">
            Warning triggers logged to audit
          </div>
        </Card>

        <Card className="p-4 border-slate-200 shadow-xs bg-white flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold font-mono text-slate-500 uppercase tracking-wider">
              ALLOW POLICIES
            </span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold font-mono text-emerald-600">
              {allowCount}
            </span>
            <span className="text-xs font-mono text-slate-500">Permitted</span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] font-mono text-slate-500">
            Explicit authorized governance rules
          </div>
        </Card>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <Input 
            placeholder="Filter by policy ID or description..." 
            className="pl-8 h-8 text-xs font-mono bg-slate-50/50 border-slate-200"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Filter Buttons */}
        <div className="flex items-center gap-1.5">
          <Button
            variant={decisionFilter === 'ALL' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setDecisionFilter('ALL')}
            className={cn("h-7 text-[11px] font-mono px-2.5", decisionFilter === 'ALL' ? "bg-slate-900 text-white" : "text-slate-600")}
          >
            All ({totalCount})
          </Button>
          <Button
            variant={decisionFilter === 'BLOCK' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setDecisionFilter('BLOCK')}
            className={cn("h-7 text-[11px] font-mono px-2.5", decisionFilter === 'BLOCK' ? "bg-rose-600 text-white" : "text-rose-700")}
          >
            Block ({blockCount})
          </Button>
          <Button
            variant={decisionFilter === 'ALERT' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setDecisionFilter('ALERT')}
            className={cn("h-7 text-[11px] font-mono px-2.5", decisionFilter === 'ALERT' ? "bg-amber-500 text-white" : "text-amber-700")}
          >
            Alert ({alertCount})
          </Button>
          <Button
            variant={decisionFilter === 'ALLOW' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setDecisionFilter('ALLOW')}
            className={cn("h-7 text-[11px] font-mono px-2.5", decisionFilter === 'ALLOW' ? "bg-emerald-600 text-white" : "text-emerald-700")}
          >
            Allow ({allowCount})
          </Button>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left 7 Cols: Active Policy Cards */}
        <div className="lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between pb-1">
            <h2 className="text-xs font-bold font-mono uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
              <Shield className="h-4 w-4 text-blue-600" />
              Active Policies ({filteredPolicies.length})
            </h2>
            <span className="text-[11px] font-mono text-slate-400">
              M7 Policy Fusion Engine
            </span>
          </div>

          {isLoading ? (
            <div className="p-12 text-center text-xs font-mono text-slate-400 bg-white rounded-xl border border-slate-200">
              Loading policies...
            </div>
          ) : isError ? (
            <div className="p-4 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 text-xs font-mono flex items-center gap-2">
              <ShieldAlert className="h-4 w-4" />
              <span>Failed to load governance policies. Backend API may be unreachable.</span>
            </div>
          ) : filteredPolicies.length === 0 ? (
            <div className="p-12 text-center text-xs font-mono text-slate-400 bg-white rounded-xl border border-slate-200">
              <FileKey className="h-8 w-8 mx-auto text-slate-300 mb-2" />
              <span>No policies registered matching current criteria.</span>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredPolicies.map((p) => {
                const isBlock = p.decision.toLowerCase() === 'block';
                const isAlert = p.decision.toLowerCase() === 'alert';

                return (
                  <Card 
                    key={p.policy_id}
                    className={cn(
                      "p-4 border rounded-xl bg-white motion-safe:transition-all hover:shadow-xs",
                      isBlock ? "border-rose-200/90 hover:border-rose-300" :
                      isAlert ? "border-amber-200/90 hover:border-amber-300" :
                      "border-emerald-200/90 hover:border-emerald-300"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant={p.decision.toLowerCase() as any}
                          className={cn(
                            "text-[11px] font-mono uppercase px-2 py-0.5 font-bold",
                            isBlock ? "bg-rose-100 text-rose-800 border-rose-200" :
                            isAlert ? "bg-amber-100 text-amber-800 border-amber-200" :
                            "bg-emerald-100 text-emerald-800 border-emerald-200"
                          )}
                        >
                          {p.decision}
                        </Badge>
                        <span className="font-mono text-xs font-bold text-slate-900">
                          {p.policy_id}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 font-mono text-[11px]">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
                          Priority: {p.priority}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-700 font-medium mb-3">
                      {p.description || 'No description provided.'}
                    </p>

                    <div className="grid grid-cols-2 gap-3 pt-2.5 border-t border-slate-100 font-mono text-[11px]">
                      <div>
                        <span className="text-slate-400 block">ENFORCED ACTION:</span>
                        <span className={cn(
                          "font-bold",
                          isBlock ? "text-rose-700" : isAlert ? "text-amber-700" : "text-emerald-700"
                        )}>
                          {isBlock ? "BLOCK (Execution Denied)" : isAlert ? "ALERT (Flagged & Logged)" : "ALLOW (Permitted)"}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">EVALUATOR:</span>
                        <span className="font-bold text-slate-800">
                          M7 Policy Fusion Layer
                        </span>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Right 5 Cols: Policy Authoring Sandbox */}
        <div id="policy-authoring-box" className="lg:col-span-5 space-y-3 sticky top-6">
          <Card className="border-slate-200 shadow-sm bg-white rounded-xl overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50/70">
              <span className="text-[11px] font-bold font-mono text-slate-400 uppercase tracking-wider block">
                POLICY AUTHORING SANDBOX
              </span>
              <h3 className="text-xs font-bold font-mono text-slate-900 mt-0.5">
                Register New Governance Rule
              </h3>
            </div>

            <CardContent className="p-4">
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

              <form onSubmit={handleSubmit} className="space-y-3.5">
                <div className="space-y-1">
                  <label className="text-[11px] font-mono font-bold text-slate-600 uppercase">
                    Policy Rule ID
                  </label>
                  <Input 
                    required 
                    value={form.policy_id} 
                    onChange={e => setForm({...form, policy_id: e.target.value})} 
                    placeholder="e.g. block-destructive-file-write"
                    className="h-8 text-xs font-mono bg-slate-50/50"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-mono font-bold text-slate-600 uppercase">
                      Decision
                    </label>
                    <select 
                      className="h-8 w-full rounded-md border border-slate-200 bg-slate-50/50 px-2.5 py-1 text-xs font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      value={form.decision}
                      onChange={e => setForm({...form, decision: e.target.value})}
                    >
                      <option value="block">BLOCK</option>
                      <option value="alert">ALERT</option>
                      <option value="allow">ALLOW</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-mono font-bold text-slate-600 uppercase">
                      Priority (Number)
                    </label>
                    <Input 
                      type="number" 
                      required 
                      value={form.priority} 
                      onChange={e => setForm({...form, priority: e.target.value})} 
                      className="h-8 text-xs font-mono bg-slate-50/50"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-mono font-bold text-slate-600 uppercase">
                    Description
                  </label>
                  <Input 
                    required 
                    value={form.description} 
                    onChange={e => setForm({...form, description: e.target.value})} 
                    placeholder="e.g. Block unapproved destructive writes to workspace"
                    className="h-8 text-xs bg-slate-50/50"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-[11px] font-mono font-bold text-slate-600 uppercase">
                      Condition (JSON)
                    </label>
                    <span className="text-[11px] font-mono text-slate-400">Valid JSON Object</span>
                  </div>
                  <Textarea 
                    required 
                    value={form.condition} 
                    onChange={e => setForm({...form, condition: e.target.value})} 
                    className="font-mono text-xs h-28 bg-slate-50/50 border-slate-200 resize-none"
                    placeholder="{\n  \n}"
                  />
                </div>

                <Button 
                  type="submit" 
                  className="w-full h-8 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
                  disabled={mutation.isPending}
                >
                  {mutation.isPending ? 'Registering...' : 'Register Policy Rule'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
