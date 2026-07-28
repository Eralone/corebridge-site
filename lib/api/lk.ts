import { api } from './client';
import type {
  Activity, AuditEntry, Dashboard, EpfConfig, EpfVersion, Integration, NotificationSettings, Plan,
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

/** Гасит сессию на сервере. Без этого «выход» оставлял бы cookie живой. */
export const logout = () => api<{ ok: true }>('/lk/auth/logout', { method: 'POST' });

/** Лента событий тенанта. Глубина хранения зависит от тарифа (log_retention_days) */
export const getLogs = (limit = 20) => api<AuditEntry[]>(`/lk/logs?limit=${limit}`);

/** Полный JWT для .epf. Только владельцу: остальным сервер отдаёт маскированный */
export const getFullToken = () =>
  api<{ token: string; valid_until: number | null }>('/lk/token/full');

/**
 * Перевыпуск токена.
 * ⚠️ На сервере доступен только при подтверждённой оплате: на пробном тарифе
 * всегда 402 NO_ACTIVE_SUBSCRIPTION, даже если лицензия активна и бессрочна.
 */
export const refreshToken = () => api<{ token: string }>('/lk/token/refresh', { method: 'POST' });

/** Список сборок .epf для конфигурации. Пустой массив = сборка ещё не публиковалась */
export const getEpfVersions = (config: EpfConfig) =>
  api<{ config: EpfConfig; versions: EpfVersion[] }>(`/lk/epf/versions?config=${config}`);
