import { api } from './client';
import type {
  Activity, Dashboard, Integration, NotificationSettings, Plan,
  PrivacyRequest, PrivacyRequestType, Profile, Session, TwoFactorStatus, ContactSource,
} from '@/lib/contracts/lk';

/** Публичный прайс — без сессии, Cache-Control: public, max-age=300 */
export const getPlans = () => api<{ plans: Plan[] }>('/lk/plans');

export const getSession = () =>
  api<{ user_id: string; tenant_id: string; role: string; expires_at: number }>('/lk/auth/session');

export const getDashboard = () => api<Dashboard>('/lk/dashboard');

export const getActivity = (range: '7d' | '30d' = '7d') =>
  api<Activity>(`/lk/dashboard/activity?range=${range}`);

export const getProfile = () => api<Profile>('/lk/profile');

export const getIntegrations = () => api<Integration[]>('/lk/integrations');

export const getSessions = () => api<{ sessions: Session[] }>('/lk/sessions');

export const get2faStatus = () => api<TwoFactorStatus>('/lk/2fa/status');

export const getNotificationSettings = () =>
  api<NotificationSettings>('/lk/notifications/settings');

export const getPrivacyRequests = () =>
  api<{ requests: PrivacyRequest[] }>('/lk/privacy/requests');

export const createPrivacyRequest = (type: PrivacyRequestType, comment?: string) =>
  api<{ request_id: string; ref: string; response_due_days: number }>('/lk/privacy/request', {
    method: 'POST',
    body: { type, comment },
  });

/** Публичная форма обращений. honeypot обязателен и должен быть пустым */
export const sendContact = (input: {
  name: string;
  email: string;
  phone?: string;
  message: string;
  source: ContactSource;
  honeypot?: string;
}) =>
  api<{ received: boolean; ref: string }>('/lk/contact', {
    method: 'POST',
    body: { honeypot: '', ...input },
  });
