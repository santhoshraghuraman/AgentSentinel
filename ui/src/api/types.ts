export interface InterceptRequest {
  session_id: string;
  task_id: string;
  tool_name: string;
  arguments?: Record<string, any>;
}

export interface AgentRunRequest {
  prompt: string;
  session_id: string;
  task_id: string;
  document_context?: string;
  document_filename?: string;
}

export interface CreateTaskRequest {
  task_id: string;
  task_description?: string;
  allowed_capabilities?: Record<string, any>[];
  denied_capabilities?: Record<string, any>[];
}

export interface CreatePolicyRequest {
  policy_id: string;
  decision: string;
  priority?: number;
  description?: string;
  condition?: Record<string, any>;
}

export interface SafeActionResponse {
  normalized_name: string;
  category: string;
  provider?: string;
  operation?: string;
  resource?: string;
  is_mutating?: boolean;
  is_destructive?: boolean;
  source_dataset: string;
}

export interface SafeGovernanceReasonResponse {
  rule_type: string;
  description: string;
  matched_policy_id?: string;
  policy_priority?: number;
}

export interface SafeActionDecisionRecordResponse {
  decision: string;
  risk_severity?: string;
  risk_score?: number;
  ml_probability?: number;
  features?: Record<string, any>;
  auth_status: string;
  matched_policy_id?: string;
  reasons: SafeGovernanceReasonResponse[];
}

export interface InterceptResponse {
  interception_id: string;
  sequence_number: number;
  decision: string;
  is_fail_safe: boolean;
  action?: SafeActionResponse;
  action_record?: SafeActionDecisionRecordResponse;
  error_message?: string;
}

export interface SafeAuditEventResponse {
  interception_id: string;
  session_id: string;
  sequence_number: number;
  timestamp: string;
  decision: string;
  execution_state: string;
  action?: SafeActionResponse;
  action_record?: SafeActionDecisionRecordResponse;
  error_message?: string;
  task_id: string;
  tool_name: string;
  arguments?: Record<string, any>;
  execution_result?: string;
}

export interface SafeTaskResponse {
  task_id: string;
  task_description?: string;
  allowed_capability_count: number;
  denied_capability_count: number;
}

export interface SafePolicyResponse {
  policy_id: string;
  decision: string;
  priority: number;
  description: string;
}

export interface SafeSessionResponse {
  session_id: string;
  task_id: string;
  agent_id: string;
  created_at: string;
  status: string;
  verdict_counts?: Record<string, number>;
  total_events?: number;
}

export interface HealthResponse {
  status: string;
  version: string;
  milestone: string;
}

export interface ErrorResponse {
  error: string;
  detail?: string;
}

export interface DiagnosticHealthInfo {
  status: string;
  version: string;
  milestone: string;
}

export interface DiagnosticDatabaseInfo {
  type: string;
  status: string;
}

export interface DiagnosticLLMInfo {
  provider: string;
  model: string;
  host: string;
  status: string;
}

export interface DiagnosticGovernanceInfo {
  active_policies: number;
  fail_safe_enabled: boolean;
}

export interface SystemDiagnosticsResponse {
  health: DiagnosticHealthInfo;
  database: DiagnosticDatabaseInfo;
  llm: DiagnosticLLMInfo;
  governance: DiagnosticGovernanceInfo;
}

export interface MetricsDecisions {
  allow: number;
  alert: number;
  block: number;
  unknown?: number;
}

export interface MetricsResponse {
  total_interceptions: number;
  decisions: MetricsDecisions;
  actions_by_category: Record<string, number>;
}

export interface MetricTimeseriesPoint {
  time: string;
  allow: number;
  alert: number;
  block: number;
}

export interface DocumentUploadResponse {
  filename: string;
  file_size: number;
  page_count: number;
  extracted_text: string;
  character_count: number;
  preview: string;
  warning?: string | null;
  sandbox_path?: string | null;
}
