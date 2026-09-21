import axios from 'axios';
import type { ErrorResponse } from './types';

export const apiClient = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // We handle the error gracefully so the UI doesn't crash.
    // React Query will catch this and expose it to the components.
    if (error.response) {
      const data = error.response.data as ErrorResponse;
      console.error('API Error:', data.error, data.detail);
    } else {
      console.error('Network Error:', error.message);
    }
    return Promise.reject(error);
  }
);
