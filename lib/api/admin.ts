import { api } from './client';
import type {
  AdminAuditActions,
  AdminAuditPage,
  AdminDlqEntry,
  AdminEpfVersion,
  AdminHealth,
  AdminIntegration,
  AdminLoginStep,
  AdminMe,
  AdminN8nStats,
  AdminPayment,
  AdminPrivacyPage,
  AdminStats,
  AdminTokenRecord,
  AdminUsersPage,
  AdminWorkflow,
} from '@/lib/contracts/admin';

/**
 * Обёртки админского API.
 *
 * Топология: интерфейс живёт в корне `admin.corebridge.ru`, API — под `/admin/*`
 * на том же домене (nginx отправляет его в admin:3003). Поэтому пути абсолютные
 * и без base, как в ЛК.
 *
 * ⚠️ Cookie `admin_session_id` сервер ставит с `path=/admin`. Значит браузер шлёт
 * её только на запросы к API — а на запрос самой страницы (`/`, `/users`) не шлёт.
 * Из-за этого guard админки **невозможен в middleware**: там cookie попросту нет.
 * Проверка входа делается в браузере через `getAdminMe()`, см. `AdminGuard`.
 */

function qs(params: Record<string, string | number | boolean | undefined | null>) {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') s.set(k, String(v));
  }
  const out = s.toString();
  return out ? `?${out}` : '';
}

// ── Вход ────────────────────────────────────────────────────────────────────
export const adminLogin = (email: string, password: string) =>
  api<AdminLoginStep>('/admin/auth/login', { method: 'POST', body: { email, password } });

/**
 * Шаг 2 — только когда `requires_totp: true`. При выключенном TOTP сервер
 * (с пакета S13) ставит cookie сразу на шаге 1, а `totp_code` больше не требует
 * непустым. Заглушку `'000000'` из клиента убрал.
 */
export const adminVerifyTotp = (step_token: string, totp_code: string) =>
  api<{ ok: true }>('/admin/auth/totp/verify', { method: 'POST', body: { step_token, totp_code } });

export const adminLogout = () => api<{ ok: true }>('/admin/auth/logout', { method: 'POST' });

export const getAdminMe = () => api<AdminMe>('/admin/auth/me');

// ── Обзор ───────────────────────────────────────────────────────────────────
export const getAdminStats = () => api<AdminStats>('/admin/stats');

/** `force=1` обходит кеш (~12 с) — для кнопки «Обновить» */
export const getAdminHealth = (force = false) =>
  api<AdminHealth>(`/admin/health${force ? '?force=1' : ''}`);

export const getAdminAudit = (params: {
  actor?: string;
  action?: string;
  tenant_id?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
} = {}) => api<AdminAuditPage>(`/admin/audit${qs(params)}`);

export const getAdminAuditActions = () => api<AdminAuditActions>('/admin/audit/actions');

// ── Пользователи и тенанты ──────────────────────────────────────────────────
export const getAdminUsers = (params: {
  q?: string;
  plan?: string;
  status?: string;
  role?: string;
  tenant_id?: string;
  expiring_within_days?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
} = {}) => api<AdminUsersPage>(`/admin/users${qs(params)}`);

export const blockTenant = (id: string) =>
  api<unknown>(`/admin/tenants/${encodeURIComponent(id)}/block`, { method: 'POST' });

export const unblockTenant = (id: string) =>
  api<unknown>(`/admin/tenants/${encodeURIComponent(id)}/unblock`, { method: 'POST' });

/**
 * ⚠️ `reason` обязателен — сервер отвечает `400 REASON_REQUIRED` без него,
 * причина уходит в `audit_log`. В макете этого поля нет, добавлено намеренно.
 * `valid_until: null` — бессрочная лицензия (как у пробного тарифа).
 */
export const setTenantPlan = (
  id: string,
  body: { plan: string; reason: string; valid_until: string | null },
) => api<{ tenant_id: string; plan: string; valid_until: string | null; is_perpetual: boolean; jwt_reissued: boolean }>(
  `/admin/tenants/${encodeURIComponent(id)}/set-plan`,
  { method: 'POST', body },
);

/**
 * ⚠️ Срока действия не принимает: токен выпускается на условиях текущего тарифа.
 * Селектор «7 / 30 / 90 / 365 дней» из макета не переносим — выбирать нечего.
 */
/** История лицензий тенанта. Полный JWT сервер не отдаёт даже админу — только префикс */
export const getTenantTokens = (id: string) =>
  api<{ tokens: AdminTokenRecord[] }>(`/admin/tenants/${encodeURIComponent(id)}/tokens`);

export const issueTenantToken = (id: string) =>
  api<{ token: string; plan: string; valid_until: string | null }>(
    `/admin/tenants/${encodeURIComponent(id)}/issue-token`,
    { method: 'POST' },
  );

// ── Интеграции и n8n ────────────────────────────────────────────────────────
export const getAdminIntegrations = (params: {
  tenant_id?: string;
  adapter_type?: string;
  status?: string;
  page?: number;
  limit?: number;
} = {}) => api<{ integrations: AdminIntegration[]; count: number }>(`/admin/integrations${qs(params)}`);

export const getAdminN8nStats = () => api<AdminN8nStats>('/admin/n8n/stats');

/** Воркфлоу конкретного тенанта. Данные идут прямо из n8n, поэтому поля его — camelCase */
export const getTenantWorkflows = (tenantId: string) =>
  api<{ tenant_id: string; workflows: AdminWorkflow[]; total: number }>(
    `/admin/n8n/tenants/${encodeURIComponent(tenantId)}/workflows`,
  );

/** Снимает флаг «лимит исчерпан» и включает обратно отключённые воркфлоу */
export const resetN8nLimit = (tenantId: string) =>
  api<{ reactivated_workflows?: number }>(
    `/admin/n8n/tenants/${encodeURIComponent(tenantId)}/reset-limit`,
    { method: 'POST' },
  );

/** ⚠️ Тело не принимают: воркфлоу адресуется только своим n8n-идентификатором */
export const activateWorkflowAdmin = (workflowId: string) =>
  api<{ success: true }>(`/admin/n8n/workflows/${encodeURIComponent(workflowId)}/activate`, {
    method: 'PATCH',
  });

export const deactivateWorkflowAdmin = (workflowId: string) =>
  api<{ success: true }>(`/admin/n8n/workflows/${encodeURIComponent(workflowId)}/deactivate`, {
    method: 'PATCH',
  });

// ── Платежи ─────────────────────────────────────────────────────────────────
export const getAdminPayments = (params: {
  tenant_id?: string;
  status?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
} = {}) => api<{ payments: AdminPayment[]; count: number }>(`/admin/payments${qs(params)}`);

// ── Очереди ─────────────────────────────────────────────────────────────────
/** ⚠️ Параметра `status` больше нет: колонки, по которой фильтровали, не существовало */
export const getAdminDlq = (params: { tenant_id?: string; limit?: number; offset?: number } = {}) =>
  api<{ events: AdminDlqEntry[]; count: number }>(`/admin/dlq${qs(params)}`);

/**
 * Переиграть событие. `replay` говорит, каким способом сервер это сделал:
 * `webhook` — доставил заново, `tenant_init` — переинициализировал рабочее
 * пространство. Если переигрывать нечем — `409` с кодом `NOT_REPLAYABLE`,
 * и это не сбой сервиса, а свойство события.
 */
export const reprocessDlq = (id: string) =>
  api<{ success: true; replay: 'webhook' | 'tenant_init' }>(
    `/admin/dlq/${encodeURIComponent(id)}/reprocess`,
    { method: 'POST' },
  );

export const deleteDlq = (id: string) =>
  api<unknown>(`/admin/dlq/${encodeURIComponent(id)}/delete`, { method: 'POST' });

/**
 * ⚠️ Требует `tenant_id`: без него сервер отвечает 400. Разом по всем — нельзя.
 * `skipped_ids` — события, которые переиграть нечем; они отделены от `failed_ids`,
 * иначе выглядели бы как повторяющийся сбой при каждом запуске.
 */
export const reprocessAllDlq = (tenant_id: string) =>
  api<{ reprocessed_count: number; failed_ids: string[]; skipped_ids: string[] }>(
    `/admin/dlq/reprocess-all${qs({ tenant_id })}`,
    { method: 'POST' },
  );

export const getQueueStats = () =>
  api<{
    tenants: {
      tenant_id: string;
      pending_count: number;
      dlq_count: number;
      oldest_event_at: string | null;
      is_stuck: boolean;
      stuck_since_minutes: number;
    }[];
    total_pending: number;
    total_dlq: number;
    stuck_tenants_count: number;
  }>('/admin/queues/stats');

// ── Сборки .epf ─────────────────────────────────────────────────────────────
export const getEpfVersions = () =>
  api<{ versions: AdminEpfVersion[] }>('/admin/epf/versions');

/** Делает версию активной для конфигурации; прежняя активная гаснет в той же транзакции */
export const releaseEpf = (config: string, version: string) =>
  api<{ success: true }>('/admin/epf/release', { method: 'POST', body: { config, version } });

export const rollbackEpf = (config: string, version: string) =>
  api<{ success: true }>('/admin/epf/rollback', { method: 'POST', body: { config, version } });

// ── Обращения по персональным данным ────────────────────────────────────────
export const getPrivacyRequests = (params: { status?: string; type?: string; page?: number; limit?: number } = {}) =>
  api<AdminPrivacyPage>(`/admin/privacy/requests${qs(params)}`);

export const updatePrivacyRequest = (
  id: string,
  body: { status: string; admin_comment?: string },
) => api<unknown>(`/admin/privacy/requests/${encodeURIComponent(id)}`, { method: 'PATCH', body });
