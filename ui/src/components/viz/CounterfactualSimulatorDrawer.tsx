/**
 * CounterfactualSimulatorDrawer.tsx — Phase 4D.3
 *
 * Small, accessible, client-side What-If / Counterfactual Preview drawer
 * for exploring how selected risk-severity and authorization-status inputs
 * map to the deterministic baseline decision matrix.
 *
 * Strict Isolation & Security Invariants:
 *  - Operates 100% in client memory.
 *  - Zero API calls (never calls /agent/run or /runtime/intercept).
 *  - Zero mutations (no POST, PUT, PATCH, DELETE).
 *  - Preserves recorded historical event and decision.
 *  - Simulated results marked with HYPOTHETICAL provenance.
 *  - Grounded directly in src/agentsentinel/governance/engine.py.
 */

import { useState, useEffect, useCallback, useId } from 'react';
import { 
  X, 
  FlaskConical, 
  RotateCcw, 
  AlertTriangle, 
  ShieldCheck, 
  XCircle, 
  CheckCircle2, 
  HelpCircle,
  Sparkles,
  Info
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { cn } from '../../utils/cn';

export type SimulatedSeverity = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'UNEVALUABLE';
export type SimulatedAuthStatus = 'AUTHORIZED' | 'UNAUTHORIZED' | 'UNEVALUABLE';

export interface BaselineMatrixResult {
  verdict: 'ALLOW' | 'ALERT' | 'BLOCK' | 'UNSUPPORTED';
  ruleType: 'baseline_matrix' | 'mandatory_invariant' | 'unsupported';
  rationale: string;
}

/**
 * Exact replica of the 18-case deterministic baseline decision matrix
 * defined in src/agentsentinel/governance/engine.py (_BASELINE_MATRIX & _check_invariants).
 */
export function evaluateBaselineMatrix(
  severity: SimulatedSeverity | string,
  authStatus: SimulatedAuthStatus | string
): BaselineMatrixResult {
  const sev = (severity || '').toUpperCase();
  const auth = (authStatus || '').toUpperCase();

  if (!sev || !auth) {
    return {
      verdict: 'UNSUPPORTED',
      ruleType: 'unsupported',
      rationale: 'Unsupported / unavailable for this preview.'
    };
  }

  // Validate supported inputs
  const validSeverities: SimulatedSeverity[] = ['NONE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'UNEVALUABLE'];
  const validAuth: SimulatedAuthStatus[] = ['AUTHORIZED', 'UNAUTHORIZED', 'UNEVALUABLE'];

  if (!validSeverities.includes(sev as SimulatedSeverity) || !validAuth.includes(auth as SimulatedAuthStatus)) {
    return {
      verdict: 'UNSUPPORTED',
      ruleType: 'unsupported',
      rationale: 'Unsupported / unavailable for this preview.'
    };
  }

  // Mandatory Invariant 1: CRITICAL risk -> BLOCK
  if (sev === 'CRITICAL') {
    return {
      verdict: 'BLOCK',
      ruleType: 'mandatory_invariant',
      rationale: 'Risk severity CRITICAL triggered mandatory BLOCK invariant (Invariant #1).'
    };
  }

  // Mandatory Invariant 2: UNEVALUABLE authorization -> BLOCK
  if (auth === 'UNEVALUABLE') {
    return {
      verdict: 'BLOCK',
      ruleType: 'mandatory_invariant',
      rationale: 'Authorization status UNEVALUABLE triggered mandatory BLOCK invariant (Invariant #2).'
    };
  }

  // Mandatory Invariant 3: Unevaluable risk severity -> BLOCK
  if (sev === 'UNEVALUABLE') {
    return {
      verdict: 'BLOCK',
      ruleType: 'mandatory_invariant',
      rationale: 'Unevaluable risk severity triggered mandatory BLOCK invariant (Invariant #3).'
    };
  }

  // NONE
  if (sev === 'NONE') {
    if (auth === 'AUTHORIZED') {
      return {
        verdict: 'ALLOW',
        ruleType: 'baseline_matrix',
        rationale: 'Baseline matrix: NONE risk + AUTHORIZED status produces ALLOW.'
      };
    }
    if (auth === 'UNAUTHORIZED') {
      return {
        verdict: 'ALERT',
        ruleType: 'baseline_matrix',
        rationale: 'Baseline matrix: NONE risk + UNAUTHORIZED status produces ALERT (Invariant #4 prevents ALLOW).'
      };
    }
  }

  // LOW
  if (sev === 'LOW') {
    if (auth === 'AUTHORIZED') {
      return {
        verdict: 'ALLOW',
        ruleType: 'baseline_matrix',
        rationale: 'Baseline matrix: LOW risk + AUTHORIZED status produces ALLOW.'
      };
    }
    if (auth === 'UNAUTHORIZED') {
      return {
        verdict: 'ALERT',
        ruleType: 'baseline_matrix',
        rationale: 'Baseline matrix: LOW risk + UNAUTHORIZED status produces ALERT (Invariant #4 prevents ALLOW).'
      };
    }
  }

  // MEDIUM
  if (sev === 'MEDIUM') {
    if (auth === 'AUTHORIZED') {
      return {
        verdict: 'ALLOW',
        ruleType: 'baseline_matrix',
        rationale: 'Baseline matrix: MEDIUM risk + AUTHORIZED status produces ALLOW.'
      };
    }
    if (auth === 'UNAUTHORIZED') {
      return {
        verdict: 'BLOCK',
        ruleType: 'baseline_matrix',
        rationale: 'Baseline matrix: MEDIUM risk + UNAUTHORIZED status produces BLOCK.'
      };
    }
  }

  // HIGH
  if (sev === 'HIGH') {
    if (auth === 'AUTHORIZED') {
      return {
        verdict: 'ALERT',
        ruleType: 'baseline_matrix',
        rationale: 'Baseline matrix: HIGH risk + AUTHORIZED status produces ALERT (heightened risk monitoring).'
      };
    }
    if (auth === 'UNAUTHORIZED') {
      return {
        verdict: 'BLOCK',
        ruleType: 'baseline_matrix',
        rationale: 'Baseline matrix: HIGH risk + UNAUTHORIZED status produces BLOCK.'
      };
    }
  }

  return {
    verdict: 'UNSUPPORTED',
    ruleType: 'unsupported',
    rationale: 'Unsupported / unavailable for this preview.'
  };
}

interface CounterfactualSimulatorDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  event: any | null;
}

export function CounterfactualSimulatorDrawer({
  isOpen,
  onClose,
  event,
}: CounterfactualSimulatorDrawerProps) {
  const announcerId = useId();

  // Recorded facts from historical event
  const recordedSeverity: string = (event?.action_record?.risk_severity || 'NONE').toUpperCase();
  const recordedAuth: string = (event?.action_record?.auth_status || 'AUTHORIZED').toUpperCase();
  const recordedDecision: string = (event?.decision || 'UNKNOWN').toUpperCase();
  const recordedExecution: string = (event?.execution_state || 'UNKNOWN').toUpperCase();

  // Hypothetical state
  const [hypotheticalSeverity, setHypotheticalSeverity] = useState<string>(recordedSeverity);
  const [hypotheticalAuth, setHypotheticalAuth] = useState<string>(recordedAuth);

  // Sync with selected event on initial open or event change
  useEffect(() => {
    if (event) {
      const recSev = (event.action_record?.risk_severity || 'NONE').toUpperCase();
      const recAuth = (event.action_record?.auth_status || 'AUTHORIZED').toUpperCase();
      setHypotheticalSeverity(recSev);
      setHypotheticalAuth(recAuth);
    }
  }, [event]);

  // Compute hypothetical result
  const simulationResult = evaluateBaselineMatrix(hypotheticalSeverity, hypotheticalAuth);

  // Handle Escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Reset hypothetical state to recorded baseline
  const handleReset = useCallback(() => {
    setHypotheticalSeverity(recordedSeverity);
    setHypotheticalAuth(recordedAuth);
  }, [recordedSeverity, recordedAuth]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 overflow-hidden bg-slate-900/30 backdrop-blur-xs flex justify-end animate-backdrop-fade"
      data-testid="counterfactual-drawer-backdrop"
      onClick={onClose}
    >
      <div 
        role="dialog"
        aria-modal="true"
        aria-labelledby="counterfactual-drawer-title"
        data-testid="counterfactual-drawer"
        className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col border-l border-slate-200 overflow-y-auto animate-drawer-slide"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80 sticky top-0 z-10">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-violet-100 border border-violet-200 flex items-center justify-center text-violet-700">
              <FlaskConical className="h-4 w-4" />
            </div>
            <div>
              <h2 id="counterfactual-drawer-title" className="text-sm font-bold text-slate-900">
                Counterfactual Policy Preview
              </h2>
              <p className="text-[11px] text-slate-500 font-mono">
                Baseline Decision Matrix &middot; In-Memory Simulator
              </p>
            </div>
          </div>

          <button
            type="button"
            aria-label="Close Counterfactual Drawer"
            data-testid="close-counterfactual-drawer-btn"
            onClick={onClose}
            className="h-8 w-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Live Screen Reader Announcer */}
        <div id={announcerId} role="status" aria-live="polite" className="sr-only" data-testid="counterfactual-live-announcer">
          {`Counterfactual preview: Risk Severity ${hypotheticalSeverity}, Authorization ${hypotheticalAuth}. Hypothetical verdict: ${simulationResult.verdict}`}
        </div>

        <div className="p-5 space-y-5 flex-1">
          {/* Strict Mandatory Warning Banner */}
          <div 
            data-testid="counterfactual-warning-banner"
            className="p-3.5 rounded-xl bg-amber-50/90 border border-amber-200/90 text-amber-900 text-xs flex items-start gap-2.5"
          >
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-[11px] uppercase tracking-wider text-amber-800 font-mono">
                SIMULATED — LIMITED BASELINE MATRIX PREVIEW
              </p>
              <p className="text-[11px] leading-relaxed text-amber-900">
                This is not a re-evaluation of the complete policy engine. Policy condition expressions and raw task capability rules are not available through the current API and therefore are not simulated.
              </p>
            </div>
          </div>

          {/* Historical Baseline Section (Immutable Facts) */}
          <Card className="border-slate-200 shadow-xs bg-slate-50/50">
            <CardHeader className="py-3 px-4 border-b border-slate-200/80 bg-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />
                  <CardTitle className="text-xs font-bold font-mono uppercase text-slate-700 tracking-wider">
                    Recorded Historical Baseline
                  </CardTitle>
                </div>
                <Badge variant="outline" className="text-[10px] font-mono font-bold bg-blue-50 text-blue-700 border-blue-200">
                  RECORDED FACT
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-2.5 text-xs font-mono">
              <div className="flex justify-between items-center py-1 border-b border-slate-200/40">
                <span className="text-slate-500">Event Interception ID:</span>
                <span className="font-bold text-slate-800" title={event?.interception_id}>
                  {event ? event.interception_id.slice(0, 12) + '...' : 'None'}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-200/40">
                <span className="text-slate-500">M5 Risk Severity:</span>
                <span className="font-bold text-slate-900" data-testid="recorded-severity-display">
                  {recordedSeverity}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-200/40">
                <span className="text-slate-500">M6 Task Authorization:</span>
                <span className="font-bold text-slate-900" data-testid="recorded-auth-display">
                  {recordedAuth}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-200/40">
                <span className="text-slate-500">M7 Authoritative Verdict:</span>
                <Badge 
                  variant={recordedDecision.toLowerCase() as any}
                  className="font-bold text-[11px] px-2 py-0.5"
                  data-testid="recorded-decision-display"
                >
                  {recordedDecision}
                </Badge>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500">M8 Execution Outcome:</span>
                <span className="font-bold text-slate-700" data-testid="recorded-execution-display">
                  {recordedExecution}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Interactive Hypothetical Configuration */}
          <div className="space-y-4 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold font-mono uppercase text-slate-600 tracking-wider flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-violet-600" />
                Hypothetical Inputs
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                className="h-7 px-2 text-[11px] font-mono text-slate-600 bg-white border-slate-200 hover:bg-slate-50 cursor-pointer"
                aria-label="Reset hypothetical inputs to recorded values"
                data-testid="reset-hypothetical-inputs-btn"
              >
                <RotateCcw className="h-3 w-3 mr-1 text-slate-400" />
                Reset Inputs
              </Button>
            </div>

            {/* Input 1: Risk Severity */}
            <div className="space-y-1.5">
              <label 
                htmlFor="hypothetical-severity-select"
                className="block text-xs font-semibold text-slate-700 font-mono"
              >
                Simulated M5 Risk Severity:
              </label>
              <select
                id="hypothetical-severity-select"
                data-testid="hypothetical-severity-select"
                value={hypotheticalSeverity}
                onChange={(e) => setHypotheticalSeverity(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500 cursor-pointer"
              >
                <option value="">-- Select Severity --</option>
                <option value="NONE">NONE (No risk evidence observed)</option>
                <option value="LOW">LOW (Nominal intensity)</option>
                <option value="MEDIUM">MEDIUM (Moderate intensity)</option>
                <option value="HIGH">HIGH (Elevated intensity)</option>
                <option value="CRITICAL">CRITICAL (Invariant #1 Trigger)</option>
                <option value="UNEVALUABLE">UNEVALUABLE / None (Invariant #3 Trigger)</option>
              </select>
            </div>

            {/* Input 2: Task Authorization */}
            <div className="space-y-1.5">
              <label 
                htmlFor="hypothetical-auth-select"
                className="block text-xs font-semibold text-slate-700 font-mono"
              >
                Simulated M6 Authorization Status:
              </label>
              <select
                id="hypothetical-auth-select"
                data-testid="hypothetical-auth-select"
                value={hypotheticalAuth}
                onChange={(e) => setHypotheticalAuth(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500 cursor-pointer"
              >
                <option value="">-- Select Authorization Status --</option>
                <option value="AUTHORIZED">AUTHORIZED (Permitted by declared capability)</option>
                <option value="UNAUTHORIZED">UNAUTHORIZED (No capability grant)</option>
                <option value="UNEVALUABLE">UNEVALUABLE (Invariant #2 Trigger)</option>
              </select>
            </div>
          </div>

          {/* Hypothetical Decision Matrix Output Card */}
          <Card 
            data-testid="hypothetical-result-card"
            className={cn(
              "border shadow-xs overflow-hidden transition-all",
              simulationResult.verdict === 'ALLOW' ? "border-emerald-300 bg-emerald-50/40" :
              simulationResult.verdict === 'ALERT' ? "border-amber-300 bg-amber-50/40" :
              simulationResult.verdict === 'BLOCK' ? "border-rose-300 bg-rose-50/40" :
              "border-slate-300 bg-slate-50/80"
            )}
          >
            <CardHeader className="py-3 px-4 border-b border-slate-200/60 bg-white/70">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold font-mono uppercase text-slate-700 tracking-wider">
                  Hypothetical Matrix Result
                </span>
                <Badge 
                  data-testid="hypothetical-provenance-badge"
                  className="text-[10px] font-mono font-bold bg-violet-100 text-violet-800 border-violet-200"
                >
                  HYPOTHETICAL
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-slate-500">Preview Verdict:</span>
                <div className="flex items-center gap-1.5">
                  {simulationResult.verdict === 'ALLOW' && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                  {simulationResult.verdict === 'ALERT' && <AlertTriangle className="h-4 w-4 text-amber-600" />}
                  {simulationResult.verdict === 'BLOCK' && <XCircle className="h-4 w-4 text-rose-600" />}
                  {simulationResult.verdict === 'UNSUPPORTED' && <HelpCircle className="h-4 w-4 text-slate-400" />}
                  <span 
                    data-testid="hypothetical-verdict-display"
                    className={cn(
                      "text-sm font-bold font-mono px-2 py-0.5 rounded border",
                      simulationResult.verdict === 'ALLOW' ? "bg-emerald-100 text-emerald-800 border-emerald-300" :
                      simulationResult.verdict === 'ALERT' ? "bg-amber-100 text-amber-800 border-amber-300" :
                      simulationResult.verdict === 'BLOCK' ? "bg-rose-100 text-rose-800 border-rose-300" :
                      "bg-slate-100 text-slate-600 border-slate-300"
                    )}
                  >
                    {simulationResult.verdict}
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200/60">
                <span className="text-[10px] font-bold font-mono text-slate-400 uppercase tracking-wider block mb-1">
                  Baseline Evaluation Rationale:
                </span>
                <p 
                  data-testid="hypothetical-rationale-display"
                  className="text-xs text-slate-700 font-mono leading-relaxed bg-white/60 p-2 rounded border border-slate-200/60"
                >
                  {simulationResult.rationale}
                </p>
              </div>

              {/* Distinguish from recorded M8 outcome */}
              <div className="text-[11px] font-mono text-slate-500 flex items-center gap-1 pt-1">
                <Info className="h-3 w-3 text-slate-400 shrink-0" />
                <span>Original M8 execution state remains: <strong className="text-slate-700">{recordedExecution}</strong></span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bottom Drawer Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50/80 flex items-center justify-between">
          <span className="text-[11px] font-mono text-slate-400">
            Phase 4D.3 &middot; Zero Mutation Guarantee
          </span>
          <Button
            size="sm"
            onClick={onClose}
            className="text-xs font-semibold bg-slate-800 hover:bg-slate-900 text-white cursor-pointer"
          >
            Close Preview
          </Button>
        </div>
      </div>
    </div>
  );
}
