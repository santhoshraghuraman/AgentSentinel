import axios from 'axios';
import { apiClient } from './client';
import type {
  InterceptRequest,
  InterceptResponse,
  SafeAuditEventResponse,
  CreateTaskRequest,
  SafeTaskResponse,
  CreatePolicyRequest,
  SafePolicyResponse,
  HealthResponse,
  SafeSessionResponse,
  SystemDiagnosticsResponse,
} from './types';

export const systemService = {
  getDiagnostics: async (): Promise<SystemDiagnosticsResponse> => {
    const { data } = await apiClient.get<SystemDiagnosticsResponse>('/system/diagnostics');
    return data;
  }
};

export const runtimeService = {
  getHealth: async (): Promise<HealthResponse> => {
    // Call the root /health endpoint directly, bypassing the /api/v1 baseURL
    const { data } = await axios.get<HealthResponse>('/health');
    return data;
  },
  intercept: async (request: InterceptRequest): Promise<InterceptResponse> => {
    const { data } = await apiClient.post<InterceptResponse>('/runtime/intercept', request);
    return data;
  },
};

export const auditService = {
  getBySession: async (sessionId: string): Promise<SafeAuditEventResponse[]> => {
    const { data } = await apiClient.get<SafeAuditEventResponse[]>(`/audit/${sessionId}`);
    return data;
  },
  getLiveEvents: async (limit: number = 20): Promise<SafeAuditEventResponse[]> => {
    const { data } = await apiClient.get<SafeAuditEventResponse[]>(`/events/live?limit=${limit}`);
    return data;
  },
  getAll: async (since?: number): Promise<SafeAuditEventResponse[]> => {
    const url = since ? `/audit?since=${since}` : '/audit';
    const { data } = await apiClient.get<SafeAuditEventResponse[]>(url);
    return data;
  }
};

export const taskService = {
  listTasks: async (): Promise<SafeTaskResponse[]> => {
    const { data } = await apiClient.get<SafeTaskResponse[]>('/tasks');
    return data;
  },
  createTask: async (request: CreateTaskRequest): Promise<SafeTaskResponse> => {
    const { data } = await apiClient.post<SafeTaskResponse>('/tasks', request);
    return data;
  },
};

export const policyService = {
  listPolicies: async (): Promise<SafePolicyResponse[]> => {
    const { data } = await apiClient.get<SafePolicyResponse[]>('/policies');
    return data;
  },
  createPolicy: async (request: CreatePolicyRequest): Promise<SafePolicyResponse> => {
    const { data } = await apiClient.post<SafePolicyResponse>('/policies', request);
    return data;
  },
};

export const agentService = {
  runAgent: async (request: any): Promise<any> => {
    const { data } = await apiClient.post<any>('/agent/run', request);
    return data;
  },
};

export const sessionService = {
  listSessions: async (): Promise<SafeSessionResponse[]> => {
    const { data } = await apiClient.get<SafeSessionResponse[]>('/sessions');
    return data;
  }
};

export const telemetryService = {
  getMetrics: async (since?: number): Promise<any> => {
    const url = since ? `/metrics?since=${since}` : '/metrics';
    const { data } = await apiClient.get<any>(url);
    return data;
  },
  getTimeseries: async (since?: number, bucketSize: number = 60): Promise<any[]> => {
    const url = since 
      ? `/metrics/timeseries?since=${since}&bucket_size=${bucketSize}` 
      : `/metrics/timeseries?bucket_size=${bucketSize}`;
    const { data } = await apiClient.get<any[]>(url);
    return data;
  }
};

export const researchService = {
  getEvaluation: async (): Promise<any> => {
    const { data } = await apiClient.get<any>('/research/evaluation');
    return data;
  },
  trainModel: async (modelType: string = 'random_forest'): Promise<any> => {
    const { data } = await apiClient.post<any>(`/research/train?model_type=${modelType}`);
    return data;
  },
  getDatasets: async (): Promise<any[]> => {
    const { data } = await apiClient.get<any[]>('/research/datasets');
    return data;
  }
};

export const reportService = {
  getCompliance: async (): Promise<any> => {
    const { data } = await apiClient.get<any>('/reports/compliance');
    return data;
  },
  getExportUrl: (format: 'json' | 'csv' = 'json'): string => {
    return `/api/v1/reports/export?format=${format}`;
  }
};

