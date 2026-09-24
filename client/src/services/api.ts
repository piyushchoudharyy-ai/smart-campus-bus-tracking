/**
 * Frontend HTTP API Service with Dynamic Production URL Support
 */

const envApiUrl = import.meta.env.VITE_API_URL;

// Normalize API base path
const API_BASE = envApiUrl
  ? envApiUrl.endsWith('/api')
    ? envApiUrl
    : envApiUrl.endsWith('/')
    ? `${envApiUrl}api`
    : `${envApiUrl}/api`
  : '/api';

export class ApiError extends Error {
  constructor(public message: string, public status: number, public data?: any) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('campus_bus_token');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>)
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  const url = API_BASE.endsWith('/')
    ? `${API_BASE}${cleanEndpoint}`
    : `${API_BASE}/${cleanEndpoint}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('campus_bus_token');
        localStorage.removeItem('campus_bus_user');
      }
      throw new ApiError(data.message || `Request failed with status ${response.status}`, response.status, data);
    }

    return data;
  } catch (err: any) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(err.message || 'Network connection failed', 0);
  }
}

export const api = {
  get: <T = any>(endpoint: string) => request<T>(endpoint, { method: 'GET' }),
  post: <T = any>(endpoint: string, body?: any) =>
    request<T>(endpoint, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: <T = any>(endpoint: string, body?: any) =>
    request<T>(endpoint, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  delete: <T = any>(endpoint: string) => request<T>(endpoint, { method: 'DELETE' })
};
