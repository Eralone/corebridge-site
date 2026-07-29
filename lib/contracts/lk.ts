/**
 * TS-типы контракта lk-api. Источник истины — Documents/server_ask/API_ENDPOINTS.md
 * и site_server_integration_reference.md §9b/§9c + site_S1_S7_RESPONSE.md +
 * site_S8_S9_RESPONSE.md.
 *
 * Git-submodule contracts/ сознательно не заводим (решение Дмитрия 2026-07-26):
 * он дублировал бы уже существующие механики сервера.
 */

export type PlanCode = 'trial' | 'starter' | 'business' | 'professional' | 'enterprise';
export type UserRole = 'owner' | 'manager' | 'user';
export type AuthProvider = 'password' | 'yandex';

export interface Plan {
  code: PlanCode;
  title: string;
  price: {
    monthly: number | null;
    yearly: number | null;
    yearly_monthly: number | null;
    /** null у тарифов без годовой цены — «Пробный» и «Энтерпрайз» */
    discount_percent: number | null;
  };
  is_trial: boolean;
  /** true только у trial — бессрочная лицензия, valid_until = null */
  is_perpetual: boolean;
  /** true только у enterprise — цена по запросу, оплата запрещена */
  is_custom_price: boolean;
  contact_email?: string;
  promo: {
    code: string;
    label: string;
    price: number;
    period_days: number;
    cta_label: string;
    once_per_tenant: boolean;
  } | null;
  limits: {
    projects: number;
    users_per_company: number;
    monthly_operations: number;
    n8n_executions_month: number;
    n8n_concurrent: number;
    log_retention_days: number;
  };
  features: { n8n_ui: boolean; git_sync: boolean; sso: boolean; api_access: boolean };
  /** Только для таблицы сравнения, в JWT не попадает */
  marketing_features: { telegram_support: boolean; on_premise: boolean; sla: boolean };
}

export interface Dashboard {
  plan: PlanCode;
  company_name: string | null;
  /** null = бессрочно (пробный тариф). НЕ «0 дней» и не ошибка */
  days_left: number | null;
  valid_until: number | null;
  integrations_count: number;
  executions_this_month: number;
  /**
   * Запуски сценариев за месяц. `limit` берётся из снимка тарифа в лицензии
   * и верен с первого дня (исправлено сервером в S10) — до этого он был нулевым,
   * пока не случилось ни одного запуска, и сайт из-за этого писал оплатившему
   * человеку «на пробном тарифе n8n недоступен».
   */
  n8n_usage: { used: number; limit: number; is_limit_hit: boolean; period: string | null };
  /**
   * Операции за месяц — событие, доставленное в сценарии. Ретраи и недоехавшее
   * не считаются (решение сервера, S10 §0). Лимит **мягкий**: на 80 % и 100 %
   * приходит уведомление, но обмен не останавливается — обещать блокировку нельзя.
   */
  operations_usage: { used: number; limit: number; is_limit_hit: boolean; period: string | null };
}

export interface ActivityPoint {
  date: string;
  ok: number;
  error: number;
  total: number;
}
export interface Activity {
  range: '7d' | '30d';
  points: ActivityPoint[];
}

export interface Profile {
  user: {
    id: string;
    email: string;
    name: string | null;
    phone: string | null;
    role: UserRole;
    auth_provider: AuthProvider;
    email_verified: boolean;
  };
  company: {
    company_name: string | null;
    company_inn: string | null;
    company_kpp: string | null;
    company_address: string | null;
  };
}

export type IntegrationStatus = 'active' | 'paused' | 'error';

export interface Integration {
  integration_id: string;
  adapter_type: string;
  display_name: string | null;
  status: IntegrationStatus;
  paused: boolean;
  error_count: number;
  last_sync_at: string | null;
  created_at: string;
  /** Справочно, для подписи. Действие выбирать по reauth_action */
  auth_kind: 'api_key' | 'oauth2';
  needs_reauth: boolean;
  /** Сейчас всегда 'credentials_form' — открывать форму ввода доступов */
  reauth_action: 'credentials_form' | null;
}

export interface Session {
  id: string;
  ip: string;
  user_agent: string;
  created_at: string;
  last_seen_at: string;
  current: boolean;
}

export interface TwoFactorStatus {
  enabled: boolean;
  method: 'telegram' | null;
  telegram_linked: boolean;
  can_enable: boolean;
  recovery_codes_left: number;
}

/** Каналы: sms убран целиком (S8 §5) */
export interface NotificationSettings {
  channels: {
    email: { enabled: boolean; address: string | null; available: boolean };
    telegram: {
      enabled: boolean;
      linked: boolean;
      chat_id_masked: string | null;
      available: boolean;
    };
  };
  matrix: Record<
    'integration_errors' | 'limit_exceeded' | 'reports' | 'news',
    { email: boolean; telegram: boolean }
  >;
}

export type PrivacyRequestType = 'export' | 'deletion';
export interface PrivacyRequest {
  id: string;
  ref: string;
  type: PrivacyRequestType;
  status: 'received' | 'in_progress' | 'done' | 'rejected';
  comment: string | null;
  admin_comment: string | null;
  created_at: string;
  resolved_at: string | null;
}

export type ContactSource =
  | 'landing'
  | 'pricing'
  | 'contacts'
  | 'for_business'
  | 'billing'
  | 'epf';

/**
 * Строка журнала из `GET /lk/logs` — это `platform.audit_log` тенанта.
 * Набор `action` открытый: сервер добавляет новые по мере роста механик,
 * поэтому в интерфейсе нужен разумный запасной вариант, а не падение.
 */
export interface AuditEntry {
  id: string;
  action: string;
  actor: string;
  entity_type: string | null;
  entity_id: string | null;
  new_value: Record<string, unknown> | null;
  created_at: string;
}

/**
 * Конфигурации 1С, для которых собирается .epf.
 * ⚠️ Список проверен на живом сервере: `/lk/epf/versions?config=erp` отвечает
 * `INVALID_CONFIG` со списком `["ut11","unf","ka","bp"]`. Карточки «1С:ERP»
 * из макета такой сборки нет, зато есть «БП 3.0», которой в макете нет.
 */
export type EpfConfig = 'ut11' | 'unf' | 'ka' | 'bp';

export interface EpfVersion {
  version: string;
  release_notes: string | null;
  sha256: string;
  file_size: number;
  force_update: boolean;
  released_at: string;
  is_active: boolean;
}

/**
 * Готовый сценарий n8n. Экран ЛК для воркфлоу в макете отсутствует — в дизайне
 * пункт меню «n8n-воркфлоу» вёл на публичную страницу n8n.html.
 *
 * ⚠️ Поля сверены с кодом сервера (`workflow_catalog.service.js`, прогон 2026-07-29),
 * а не с документацией: сервер отдаёт `required_integrations` и `tags`, никаких
 * `category`/`is_active` в ответе нет.
 */
export interface WorkflowTemplate {
  template_id: string;
  name: string;
  description?: string | null;
  /**
   * ⚠️ Это **поддерживаемые типы адаптеров**, а не обязательный набор.
   * Семантику уточнил сервер (S12 §3.3): требовать все три маркетплейса сразу
   * бессмысленно — сценарий включается на одной подходящей интеграции.
   * Пустой список = подойдёт любая. Сверять с `Integration.adapter_type`.
   */
  required_integrations?: string[] | null;
  tags?: string[] | null;
}

/**
 * Запуск сценария. Набор `status` открытый: сервер передаёт значения n8n как есть
 * (`success`, `error`, `crashed`, `canceled`, `running`), поэтому запасной вариант
 * обязателен. С пакета S12 поле называется `started_at` — camelCase исправлен.
 */
export interface WorkflowExecution {
  execution_id: string;
  workflow_name?: string | null;
  status: 'success' | 'error' | 'running' | string;
  started_at: string;
  duration_ms?: number | null;
}

/** Строка истории платежей из `GET /lk/billing` */
export interface Payment {
  id: string;
  plan: PlanCode | string;
  period?: string | null;
  amount: number;
  currency?: string | null;
  status: 'confirmed' | 'pending' | 'failed' | string;
  promo_code?: string | null;
  created_at: string;
}

/** Участник команды из `GET /lk/users` */
export interface TeamMember {
  id: string;
  email: string;
  name: string | null;
  role: 'owner' | 'manager' | 'user';
  auth_provider: string;
  status: 'active' | 'invited' | string;
  invitation_expires_at: string | null;
  created_at: string;
}
