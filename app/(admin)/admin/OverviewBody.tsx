'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  getAdminAudit,
  getAdminHealth,
  getAdminN8nStats,
  getAdminPayments,
  getAdminStats,
  getAdminUsers,
} from '@/lib/api/admin';
import type {
  AdminAuditEntry,
  AdminHealth,
  AdminN8nStats,
  AdminPayment,
  AdminStats,
  AdminUser,
} from '@/lib/contracts/admin';
import { useAdmin } from '@/components/admin/AdminGuard';
import { Blocked, planTitle, shortId, ts } from '@/components/admin/bits';

/**
 * Обзор платформы. Отличия от design-source/admin.html — все из-за того,
 * что источника данных нет, а выдумывать цифры в админке опаснее всего:
 *
 * · **селектор периода и «Экспорт CSV» убраны** — `GET /admin/stats` периода
 *   не принимает, выгрузки списка на сервере нет;
 * · **дельты убраны** («+42 за 7 дней», «конверсия 33.5%», «+8.2% MoM») —
 *   истории по тенантам и платежам сервер не хранит, сравнивать не с чем;
 * · **проценты uptime убраны** — `GET /admin/health` делает живой опрос
 *   «сейчас», а не считает доступность за период (так и задумано, S9 §1);
 * · «p95 124ms» из KPI n8n убран: такого измерения нет.
 *
 * Всё остальное — 1:1 с макетом.
 */
export function OverviewBody() {
  const me = useAdmin();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [health, setHealth] = useState<AdminHealth | null>(null);
  const [n8n, setN8n] = useState<AdminN8nStats | null>(null);
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [payments, setPayments] = useState<AdminPayment[] | null>(null);
  const [audit, setAudit] = useState<AdminAuditEntry[] | null>(null);
  const [failed, setFailed] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const note = (what: string) => setFailed((f) => (f.includes(what) ? f : [...f, what]));

  const loadHealth = useCallback((force: boolean) => {
    setRefreshing(true);
    getAdminHealth(force)
      .then(setHealth)
      .catch(() => note('health'))
      .finally(() => setRefreshing(false));
  }, []);

  useEffect(() => {
    getAdminStats().then(setStats).catch(() => note('stats'));
    getAdminN8nStats().then(setN8n).catch(() => note('n8n'));
    getAdminUsers({ sort: 'created_at', order: 'desc', limit: 5 })
      .then((r) => setUsers(r.users))
      .catch(() => note('users'));
    getAdminPayments({ limit: 5 }).then((r) => setPayments(r.payments)).catch(() => note('payments'));
    getAdminAudit({ limit: 8 }).then((r) => setAudit(r.entries)).catch(() => note('audit'));
    loadHealth(false);
  }, [loadHealth]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Обзор платформы</h1>
          <p className="text-muted">
            Ключевые метрики
            {health && ` · обновлено ${ts(health.checked_at)}`} ·{' '}
            <span style={{ fontFamily: 'var(--mono)', color: 'var(--admin)' }}>
              {me?.email ?? 'role=admin'}
            </span>
          </p>
        </div>
        <div className="row">
          <button className="btn btn-outline btn-sm" disabled={refreshing} onClick={() => loadHealth(true)}>
            {refreshing ? 'Опрашиваем…' : 'Обновить статус'}
          </button>
        </div>
      </div>

      {failed.length > 0 && (
        <Blocked what={failed.map(sourceTitle).join(', ')} />
      )}

      <div className="kpi-row">
        <AdminKpi
          title="Клиентов (всего)"
          value={stats ? stats.tenants.total.toLocaleString('ru-RU') : '—'}
          note={stats ? `активных ${stats.tenants.by_status.active} · заблокировано ${stats.tenants.by_status.blocked}` : ''}
          icon={
            <>
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
            </>
          }
        />
        <AdminKpi
          title="Истекают в 3 дня"
          value={stats ? String(stats.tenants.expiring_soon) : '—'}
          /* бессрочные лицензии (пробный тариф) сюда не попадают — у них нет срока */
          note="без бессрочных лицензий"
          icon={
            <>
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </>
          }
        />
        <AdminKpi
          title="Выручка · месяц"
          value={stats ? rub(stats.revenue.month_confirmed) : '—'}
          note={stats ? `${rub(stats.revenue.year_confirmed)} за год · только подтверждённые` : ''}
          icon={
            <>
              <line x1="12" y1="1" x2="12" y2="23" />
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </>
          }
        />
        <AdminKpi
          title="Статус n8n"
          value={n8nLabel(health, n8n)}
          note={
            n8n
              ? `${n8n.stats.active_workflows} воркфлоу · на лимите ${n8n.stats.tenants_at_limit}`
              : ''
          }
          ok={health?.services.find((s) => s.key === 'n8n')?.status === 'ok'}
          icon={
            <>
              <circle cx="12" cy="12" r="10" />
              <path d="M9 12l2 2 4-4" />
            </>
          }
        />
      </div>

      <div className="health-card mb-24">
        <h3>Статус сервисов платформы</h3>
        {health === null ? (
          <p className="text-muted" style={{ fontSize: 13, margin: 0 }}>Опрашиваем сервисы…</p>
        ) : (
          <>
            <div className="health-grid">
              {health.services.map((s) => (
                <div className={`health-item ${s.status === 'ok' ? 'ok' : s.status === 'degraded' ? 'warn' : 'down'}`} key={s.key}>
                  <div>
                    <div className="label">● {s.title}</div>
                    <div className="sub">{s.detail}</div>
                  </div>
                  <span className={`badge ${s.status === 'ok' ? 'badge-success' : s.status === 'degraded' ? 'badge-warning' : 'badge-danger'}`}>
                    {s.status === 'ok' ? 'норма' : s.status === 'degraded' ? 'медленно' : 'недоступен'}
                  </span>
                </div>
              ))}
            </div>
            {/* в макете здесь были проценты доступности — их не существует, см. шапку файла */}
            <p className="text-muted" style={{ fontSize: 12, margin: '12px 0 0' }}>
              Живой опрос на момент {ts(health.checked_at)}
              {health.cached && ' · из кеша, обновляется раз в 12 секунд'}. Доступность за период
              не считается — истории проверок нет.
            </p>
          </>
        )}
      </div>

      <div className="tables-grid">
        <div className="activity-card">
          <div className="h">
            <h3>Недавние регистрации</h3>
            <Link href="/users">Все пользователи →</Link>
          </div>
          {users === null ? (
            <div className="adm-empty">Загружаем…</div>
          ) : users.length === 0 ? (
            <div className="adm-empty">Регистраций пока не было</div>
          ) : (
            <div className="adm-scroll">
              <table className="table compact">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Тариф</th>
                    <th>Дата</th>
                    <th>Верификация</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td className="email-cell">
                        <span className="ml">{u.email}</span>
                        <span className="id">{shortId(u.tenant_id)}</span>
                      </td>
                      <td>
                        <span className="badge badge-neutral">{planTitle(u.tenant_plan)}</span>
                      </td>
                      <td>{ts(u.created_at)}</td>
                      <td>
                        <span className={`badge badge-dot ${u.email_verified ? 'badge-success' : 'badge-warning'}`}>
                          {u.email_verified ? 'verified' : 'pending'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="activity-card">
          <div className="h">
            <h3>Недавние платежи</h3>
            <Link href="/payments">Все платежи →</Link>
          </div>
          {payments === null ? (
            <div className="adm-empty">Загружаем…</div>
          ) : payments.length === 0 ? (
            <div className="adm-empty">Платежей ещё не было</div>
          ) : (
            <div className="adm-scroll">
              <table className="table compact">
                <thead>
                  <tr>
                    <th>Клиент</th>
                    <th>Тариф / сумма</th>
                    <th>Дата</th>
                    <th>Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <td className="email-cell">
                        <span className="ml">{p.tenant_email ?? p.company_name ?? shortId(p.tenant_id)}</span>
                        <span className="id">{p.robokassa_inv_id ?? shortId(p.id)}</span>
                      </td>
                      <td>
                        {rub(p.amount)} · {planTitle(p.plan)}
                      </td>
                      <td>{ts(p.created_at)}</td>
                      <td>
                        <span className={`badge ${payClass(p.status)}`}>{payLabel(p.status)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="audit-card">
        <div className="h">
          <h3>Журнал · последние действия</h3>
          <span className="badge badge-neutral">только запись · изменению не подлежит</span>
        </div>
        {audit === null ? (
          <div className="adm-empty">Загружаем…</div>
        ) : audit.length === 0 ? (
          <div className="adm-empty">Записей пока нет</div>
        ) : (
          <ul className="audit-list">
            {audit.map((a) => (
              <li key={a.id}>
                <span className="ts">{ts(a.created_at)}</span>
                <span className="audit-pill">{a.action}</span>
                <span>{auditText(a)}</span>
                <span className="who">{actorLabel(a.actor)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function AdminKpi({
  title,
  value,
  note,
  icon,
  ok,
}: {
  title: string;
  value: string;
  note?: string;
  icon: React.ReactNode;
  ok?: boolean;
}) {
  return (
    <div className="admin-kpi">
      <div className="kh">
        <span>{title}</span>
        <span
          className="ki"
          style={ok ? { background: 'rgba(31,157,85,.12)', color: 'var(--success)' } : undefined}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {icon}
          </svg>
        </span>
      </div>
      <div className="kv">{value}</div>
      {note && <div className="kd">{note}</div>}
    </div>
  );
}

/** Суммы в копейках сервер не отдаёт — `platform.payments.amount` уже в рублях */
function rub(v: number): string {
  return `${Number(v).toLocaleString('ru-RU')} ₽`;
}

function n8nLabel(health: AdminHealth | null, n8n: AdminN8nStats | null): string {
  const s = health?.services.find((x) => x.key === 'n8n');
  if (!s) return n8n ? 'нет данных' : '—';
  return s.status === 'ok' ? 'Работает' : s.status === 'degraded' ? 'Медленно' : 'Недоступен';
}

/** Статусы у сервера: pending | confirmed | refunded | failed. В макете были paid/failed/refunded */
function payClass(s: string) {
  if (s === 'confirmed') return 'badge-success';
  if (s === 'pending') return 'badge-warning';
  if (s === 'refunded') return 'badge-neutral';
  return 'badge-danger';
}
function payLabel(s: string) {
  if (s === 'confirmed') return 'оплачен';
  if (s === 'pending') return 'в обработке';
  if (s === 'refunded') return 'возврат';
  if (s === 'failed') return 'не прошёл';
  return s;
}

/** `admin:d@corebridge.ru` → `d@corebridge.ru`; клиентские действия помечаем явно */
function actorLabel(actor: string): string {
  if (actor.startsWith('admin:')) return actor.slice(6);
  if (actor.startsWith('lk_user:')) return 'клиент';
  if (actor.startsWith('deleted_user:')) return 'удалённый клиент';
  return actor;
}

/**
 * Текст записи журнала. Набор `action` открытый — сервер добавляет новые по мере
 * роста механик, поэтому запасной вариант обязателен, иначе журнал будет врать.
 */
function auditText(a: AdminAuditEntry): React.ReactNode {
  /**
   * ⚠️ У действий сотрудников `tenant_id` пустой: тенант лежит в `entity_id`
   * (проверено на живой записи `admin_set_plan`). Без этого запаса запись
   * о смене тарифа не показывала бы, кому именно тариф сменили.
   */
  const tenant = a.tenant_id ?? (a.entity_type === 'tenant' ? a.entity_id : null);
  const who = a.company_name || (tenant ? shortId(tenant) : null);
  const v = a.new_value ?? {};
  const plan = typeof v.plan === 'string' ? planTitle(v.plan) : null;
  const reason = typeof v.reason === 'string' ? v.reason : null;

  if (a.action === 'admin_set_plan' && plan) {
    return (
      <>
        Тариф <b>{who}</b> изменён на «{plan}»{reason ? ` — ${reason}` : ''}
      </>
    );
  }
  return (
    <>
      {a.entity_type ? `${a.entity_type} · ` : ''}
      {who ? <b>{who}</b> : 'платформа'}
    </>
  );
}

function sourceTitle(key: string): string {
  const map: Record<string, string> = {
    stats: 'сводная статистика',
    health: 'статус сервисов',
    n8n: 'статистика n8n',
    users: 'недавние регистрации',
    payments: 'недавние платежи',
    audit: 'журнал',
  };
  return map[key] ?? key;
}
