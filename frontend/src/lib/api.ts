import axios from 'axios';
import type {
  Receipt, ReceiptListItem, DashboardStats, AnalyticsPoint, User
} from '@/types';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL + '/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT from localStorage
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('access_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('access_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  register: (data: { email: string; password: string; full_name: string; organization_name: string }) =>
    api.post('/auth/register', data),
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  me: () => api.get<User>('/auth/me'),
};

export const receiptsApi = {
  upload: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post<Receipt>('/receipts/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  list: (params?: { status?: string; risk_level?: string; limit?: number; offset?: number }) =>
    api.get<ReceiptListItem[]>('/receipts', { params }),
  get: (id: string) => api.get<Receipt>(`/receipts/${id}`),
  review: (id: string, action: 'approve' | 'reject' | 'escalate', notes?: string) =>
    api.post<Receipt>(`/receipts/${id}/review`, { action, notes }),
};

export const dashboardApi = {
  stats: () => api.get<DashboardStats>('/dashboard/stats'),
  analytics: (days = 30) => api.get<AnalyticsPoint[]>('/dashboard/analytics', { params: { days } }),
};

export default api;
