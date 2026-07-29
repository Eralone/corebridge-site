/**
 * TS-типы админского API (admin:3003, префикс `/admin/*`).
 *
 * ⚠️ Сверены не с документацией, а с кодом сервисов внутри контейнера
 * `corebridge-admin` (прогон 2026-07-29): `API_ENDPOINTS.md` перечисляет маршруты,
 * но форм ответов не содержит, а часть маршрутов там устарела.
 *
 * Четыре эндпоинта отвечали 500 из-за расхождения SQL со схемой БД — сервер починил
 * их пакетом S13, проверено на проде 2026-07-29. Обработку отказа на экранах
 * оставляю: она стоила дёшево, а без неё падение любого источника снова превратится
 * в пустую таблицу, которая соврёт «данных нет».
 */

import type { PlanCode, UserRole } from './lk';

/** `GET /admin/auth/login` → шаг 1 двухшагового входа */
export interface AdminLoginStep {
  requires_totp: boolean;
  step_token: string;
}

export interface AdminMe {
  admin_id: string;
  email: string;
}

/** `GET /admin/stats` */
export interface AdminStats {
  tenants: {
    total: number;
    by_status: { active: number; blocked: number };
    /** ключ — код тарифа; тарифы без клиентов в объект не попадают */
    by_plan: Partial<Record<PlanCode | string, number>>;
    /** истекают в ближайшие 3 дня; бессрочные не считаются */
    expiring_soon: number;
  };
  revenue: { month_confirmed: number; year_confirmed: number };
  integrations: { active_total: number; by_adapter: Record<string, number> };
}

export type HealthStatus = 'ok' | 'degraded' | 'down';

/** `GET /admin/health` — живой опрос, а не история. Процентов uptime здесь нет и не будет */
export interface AdminHealth {
  checked_at: string;
  cached: boolean;
  services: {
    key: string;
    title: string;
    status: HealthStatus;
    /** человекочитаемая деталь от сервера: «174 мс», «5 тенантов, 194 мс», «таймаут» */
    detail: string;
    latency_ms: number;
  }[];
}

/** `GET /admin/audit` — кросс-тенантный журнал */
export interface AdminAuditEntry {
  id: string;
  created_at: string;
  action: string;
  /** `admin:<email>` у сотрудников, `lk_user:<id>` у клиентов, `deleted_user:<id>` после чистки */
  actor: string;
  tenant_id: string | null;
  company_name: string | null;
  entity_type: string | null;
  entity_id: string | null;
  new_value: Record<string, unknown> | null;
}

export interface AdminAuditPage {
  entries: AdminAuditEntry[];
  count: number;
  page: number;
  limit: number;
}

/** `GET /admin/audit/actions` — фактические значения action, чтобы не выдумывать бейджи */
export interface AdminAuditActions {
  actions: { action: string; count: number; last_seen_at: string }[];
}

/**
 * Строка `GET /admin/users`. Это пользователь **вместе с его тенантом** — экран
 * «Пользователи платформы» в макете на самом деле про тенантов (design_findings.md).
 */
export interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  role: UserRole;
  auth_provider: string;
  status: 'active' | 'invited';
  email_verified: boolean;
  twofa_enabled: boolean;
  created_at: string;
  last_login_at: string | null;
  tenant_id: string;
  company_name: string | null;
  company_inn: string | null;
  tenant_plan: PlanCode | string;
  /** ⚠️ Четыре значения, а не два: интерфейс не должен падать на незнакомом */
  tenant_status: 'active' | 'blocked' | 'pending_deletion' | 'purged' | string;
  /** null = бессрочная лицензия (пробный тариф) */
  valid_until: string | null;
  n8n_initialized: boolean;
}

export interface AdminUsersPage {
  users: AdminUser[];
  count: number;
  page: number;
  limit: number;
}

/** `GET /admin/integrations` — кросс-тенантный список */
export interface AdminIntegration {
  tenant_id: string;
  company_name: string | null;
  integration_id: string;
  adapter_type: string;
  display_name: string | null;
  status: 'active' | 'paused' | 'error' | 'deleted';
  last_used_at: string | null;
  error_count: number;
}

/** `GET /admin/payments` — это `platform.payments.*` плюс два поля тенанта */
export interface AdminPayment {
  id: string;
  tenant_id: string;
  amount: number;
  status: 'pending' | 'confirmed' | 'refunded' | 'failed' | string;
  plan: string | null;
  period: string | null;
  robokassa_inv_id: string | null;
  external_payment_id: string | null;
  plan_activated: boolean | null;
  created_at: string;
  confirmed_at: string | null;
  tenant_email: string | null;
  company_name: string | null;
}

/** `GET /admin/dlq` — «мёртвые» события */
export interface AdminDlqEntry {
  id: string;
  original_event_id: string | null;
  tenant_id: string | null;
  adapter: string | null;
  event_type: string | null;
  payload: Record<string, unknown> | null;
  error: string | null;
  retry_count: number | null;
  created_at: string;
}

/**
 * `GET /admin/epf/versions`.
 * ⚠️ В таблице две колонки хэша — `sha256_hash` (её читает админка) и `sha256`
 * (её отдаёт `GET /lk/epf/versions`). Сервер оставил это как есть: сведение
 * требует решить, какая каноничная. Пока обе заполняются, расхождения нет.
 */
export interface AdminEpfVersion {
  id: string;
  config: 'ut11' | 'unf' | 'ka' | 'bp' | string;
  version: string;
  file_path: string;
  sha256_hash: string;
  changelog: string | null;
  release_notes?: string | null;
  released_at: string;
  is_active: boolean;
  is_deprecated: boolean;
  file_size?: number | null;
  force_update?: boolean;
}

/** `GET /admin/privacy/requests` — обращения по персональным данным */
export interface AdminPrivacyRequest {
  id: string;
  ref: string;
  tenant_id: string;
  type: 'export' | 'deletion';
  status: 'received' | 'in_progress' | 'done' | 'rejected';
  comment: string | null;
  admin_comment: string | null;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  user_id: string | null;
  user_email: string | null;
  company_name: string | null;
  tenant_status: string | null;
}

export interface AdminPrivacyPage {
  requests: AdminPrivacyRequest[];
  count: number;
  page: number;
  limit: number;
}

/**
 * Воркфлоу из `GET /admin/n8n/tenants/:id/workflows`. Ответ проксируется прямо
 * от n8n, поэтому поля здесь в camelCase — это чужой контракт, не наш.
 */
export interface AdminWorkflow {
  id: string;
  name: string;
  active: boolean;
  tags?: ({ name?: string } | string)[];
  createdAt?: string;
  updatedAt?: string;
}

/** `GET /admin/n8n/stats` — строки из `platform.usage_counters`, а не из каталога тарифов */
export interface AdminN8nStats {
  stats: {
    total_tenants: number;
    tenants_at_limit: number;
    total_executions_this_month: number;
    active_workflows: number;
  };
  tenants: {
    tenant_id: string;
    period: string;
    count: number;
    limit_value: number;
    is_limit_hit: boolean;
    active_workflows_count: number;
  }[];
}

/**
 * `GET /admin/tenants/:id/tokens` — история выданных лицензий.
 * `issued_by_admin` сервер вычисляет по журналу: ищет действие `admin_*` в окне
 * ±1 минута от выдачи. Полного JWT в ответе нет даже у администратора — только
 * префикс: это действующий доступ, а не справочная строка.
 */
export interface AdminTokenRecord {
  id: string;
  plan: string;
  valid_until: string | null;
  jwt_expires_at: string | null;
  is_active: boolean;
  is_trial: boolean;
  created_at: string;
  invalidated_at: string | null;
  jti: string | null;
  jwt_token_masked?: string | null;
  issued_by_admin?: boolean;
}
