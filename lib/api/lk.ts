import { api } from './client';
import type {
  Activity, AuditEntry, Dashboard, EpfConfig, EpfVersion, Integration, NotificationSettings, Plan, WorkflowExecution, WorkflowTemplate,
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

/**
 * Запрос на скачивание .epf. Файл отдаёт не этот эндпоинт: он выдаёт одноразовый
 * токен и адрес `/cdn/epf/download?token=…`, по которому файл раздаёт bridge.
 * Токен живёт 10 минут и гасится после первого использования.
 */
export const requestEpfDownload = (config: EpfConfig) =>
  api<{ token: string; version: string; sha256: string; expiresIn: number; downloadUrl: string }>(
    `/lk/epf/download?config=${config}`,
  );

/** Приостановить обмен по интеграции. owner/manager */
export const pauseIntegration = (id: string) =>
  api<{ ok: true }>(`/lk/integrations/${encodeURIComponent(id)}/pause`, { method: 'POST' });

export const resumeIntegration = (id: string) =>
  api<{ ok: true }>(`/lk/integrations/${encodeURIComponent(id)}/resume`, { method: 'POST' });

/** Сохранить доступы к сервису. Ключи шифруются на сервере (AES-256-GCM) */
export const saveCredentials = (
  id: string,
  body: { adapter_type: string; api_key: string; api_secret?: string; extra?: Record<string, string> },
) =>
  api<{ ok: true }>(`/lk/integrations/${encodeURIComponent(id)}/credentials`, {
    method: 'POST',
    body,
  });

/** Удалить интеграцию. Только владелец */
export const deleteIntegration = (id: string) =>
  api<{ ok: true }>(`/lk/integrations/${encodeURIComponent(id)}`, { method: 'DELETE' });

/** Каталог готовых воркфлоу n8n. Пустой массив = шаблоны ещё не публиковались */
export const getWorkflowCatalog = () => api<WorkflowTemplate[]>('/lk/workflows/catalog');

export const getWorkflowExecutions = (limit = 20) =>
  api<WorkflowExecution[]>(`/lk/workflows/executions?limit=${limit}`);

export const activateWorkflow = (template_id: string) =>
  api<{ workflow_id: string; status: string }>('/lk/workflows/activate', {
    method: 'POST',
    body: { template_id },
  });
