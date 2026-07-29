import { api } from './client';
import type {
  Activity, AuditEntry, Dashboard, EpfConfig, EpfVersion, Integration, NotificationSettings, Payment, Plan, TeamMember, WorkflowExecution, WorkflowTemplate,
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
  api<{
    token: string;
    version: string;
    sha256: string;
    expires_in: number;
    download_url: string;
  }>(`/lk/epf/download?config=${config}`);

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

/**
 * Каталог готовых воркфлоу n8n. Пустой массив = шаблоны ещё не публиковались.
 *
 * Нормализация ответа снята 2026-07-29: сервер (пакет S12) теперь отдаёт
 * человекочитаемый `name`, плоские строки в `tags` и отфильтровывает служебные
 * JSON без узлов. До этого приходили плейсхолдеры `{TENANT_ID}__…` и объекты.
 */
export const getWorkflowCatalog = () => api<WorkflowTemplate[]>('/lk/workflows/catalog');

/** `limit` учитывается сервером с пакета S12: умолчание 50, потолок 200 */
export const getWorkflowExecutions = (limit = 10) =>
  api<WorkflowExecution[]>(`/lk/workflows/executions?limit=${limit}`);

/**
 * ⚠️ `integration_id` обязателен: без него сервер отвечает `400 MISSING_FIELDS`.
 * Воркфлоу привязывается к конкретной интеграции — она попадает в теги n8n.
 */
export const activateWorkflow = (template_id: string, integration_id: string) =>
  api<{ workflow_id: string; name: string; active: boolean; webhook_url: string | null }>(
    '/lk/workflows/activate',
    { method: 'POST', body: { template_id, integration_id } },
  );

/** История платежей. Пустой массив — оплат ещё не было */
export const getPayments = () => api<Payment[]>('/lk/billing');

/**
 * Инициация оплаты.
 * ⚠️ До подключения Robokassa вернётся ошибка или `payment_url: null` —
 * заглушка на этот случай нужна и после подключения, на случай сбоя платёжки.
 */
export const startPayment = (plan: string, period: 'monthly' | 'yearly', promo_code?: string) =>
  api<{ payment_url: string | null; payment_id?: string }>('/lk/billing/pay', {
    method: 'POST',
    body: { plan, period, ...(promo_code ? { promo_code } : {}) },
  });

// ── Настройки ──────────────────────────────────────────────────────────────
export const updateProfile = (body: Partial<{ name: string; phone: string }> & Partial<Profile['company']>) =>
  api<Profile>('/lk/profile', { method: 'PATCH', body });

export const changePassword = (current_password: string, new_password: string) =>
  api<{ ok: true }>('/lk/profile/password', { method: 'POST', body: { current_password, new_password } });

/** Завершить все сеансы, кроме текущего */
export const logoutOtherSessions = () =>
  api<{ revoked: number }>('/lk/sessions/logout-others', { method: 'POST' });

export const revokeSession = (id: string) =>
  api<{ ok: true }>(`/lk/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' });

/** Шаг 1: код уходит в Telegram. Шаг 2 — confirm */
export const enable2fa = () => api<{ sent: true }>('/lk/2fa/enable', { method: 'POST' });

export const confirm2fa = (code: string) =>
  api<{ enabled: true; recovery_codes: string[] }>('/lk/2fa/confirm', { method: 'POST', body: { code } });

export const disable2fa = (password: string) =>
  api<{ enabled: false }>('/lk/2fa', { method: 'DELETE', body: { password } });

export const saveNotificationSettings = (body: NotificationSettings) =>
  api<NotificationSettings>('/lk/notifications/settings', { method: 'PUT', body });

/** Ссылка на бота: человек открывает её, бот присылает nonce обратно */
export const linkTelegram = () =>
  api<{ deep_link: string; expires_in: number }>('/lk/notifications/telegram/link', { method: 'POST' });

export const telegramStatus = () =>
  api<{ linked: boolean; chat_id_masked: string | null }>('/lk/notifications/telegram/status');

export const unlinkTelegram = () =>
  api<{ ok: true }>('/lk/notifications/telegram', { method: 'DELETE' });

export const getTeam = () =>
  api<{ users: TeamMember[] }>('/lk/users');

export const inviteUser = (email: string, role: 'manager' | 'user') =>
  api<{ invite_id: string; email: string; invite_url?: string }>('/lk/users/invite', {
    method: 'POST',
    body: { email, role },
  });

export const changeUserRole = (id: string, role: 'owner' | 'manager' | 'user') =>
  api<{ id: string; role: string }>(`/lk/users/${encodeURIComponent(id)}/role`, {
    method: 'PATCH',
    body: { role },
  });

export const removeUser = (id: string) =>
  api<{ ok: true }>(`/lk/users/${encodeURIComponent(id)}`, { method: 'DELETE' });
