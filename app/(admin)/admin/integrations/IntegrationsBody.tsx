'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '@/lib/api/client';
import {
  activateWorkflowAdmin,
  deactivateWorkflowAdmin,
  getAdminIntegrations,
  getAdminN8nStats,
  getAdminUsers,
  getTenantWorkflows,
  resetN8nLimit,
} from '@/lib/api/admin';
import type {
  AdminIntegration,
  AdminN8nStats,
  AdminUser,
  AdminWorkflow,
} from '@/lib/contracts/admin';
import { Blocked, planTitle, ts } from '@/components/admin/bits';

/**
 * Интеграции и воркфлоу n8n. Отличия от design-source/admin-integrations.html:
 *
 * · **«Открыть n8n UI» убрана** — n8n слушает только внутреннюю сеть (`n8n:5678`),
 *   наружу не выставлен, ссылке некуда вести;
 * · **«Перезапустить worker» убрана** — такого эндпоинта нет;
 * · **«+12.4% MoM» убрано** — истории по месяцам сервер не хранит;
 * · «из 2 712 всего · 528 на паузе» заменено фактическими числами: сервер отдаёт
 *   только активные воркфлоу, общего количества у него нет;
 * · добавлена таблица интеграций всех тенантов — `GET /admin/integrations`
 *   в макете не использовался, хотя он есть и на этом экране ему место.
 *
 * Информационная врезка про `tenant_id` из URL перенесена дословно: она верна.
 */
export function IntegrationsBody() {
  const [n8n, setN8n] = useState<AdminN8nStats | null>(null);
  const [integrations, setIntegrations] = useState<AdminIntegration[] | null>(null);
  const [failed, setFailed] = useState<string[]>([]);
  const note = (w: string) => setFailed((f) => (f.includes(w) ? f : [...f, w]));

  useEffect(() => {
    getAdminN8nStats().then(setN8n).catch(() => note('статистика n8n'));
    getAdminIntegrations({ limit: 100 })
      .then((r) => setIntegrations(r.integrations))
      .catch(() => note('список интеграций'));
  }, []);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Интеграции n8n</h1>
          <p className="text-muted">Воркфлоу тенантов и подключённые адаптеры</p>
        </div>
      </div>

      {failed.length > 0 && <Blocked what={failed.join(', ')} />}

      <div className="info-banner">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
        <div>
          <b>Чем это отличается от конструктора в личном кабинете.</b>
          <p>
            В кабинете тенант виден только свой — идентификатор берётся из его токена.
            Здесь идентификатор берётся из адреса, поэтому сотрудник может открыть любого
            клиента. Логика при этом одна и та же.
          </p>
        </div>
      </div>

      <SectionTitle>Статистика платформы</SectionTitle>

      <div className="stats-row">
        <Kpi
          title="Тенантов с запусками"
          value={n8n ? String(n8n.stats.total_tenants) : '—'}
          note="считаются те, у кого есть счётчик за месяц"
        />
        <Kpi
          title="Тенантов у лимита"
          value={n8n ? String(n8n.stats.tenants_at_limit) : '—'}
          danger={(n8n?.stats.tenants_at_limit ?? 0) > 0}
          note="нужно сбросить лимит или повысить тариф"
        />
        <Kpi
          title="Запусков в этом месяце"
          value={n8n ? n8n.stats.total_executions_this_month.toLocaleString('ru-RU') : '—'}
          note="сумма по всем тенантам"
        />
        <Kpi
          title="Активных воркфлоу"
          value={n8n ? String(n8n.stats.active_workflows) : '—'}
          ok
          note="привязаны к интеграциям"
        />
      </div>

      <SectionTitle>Воркфлоу тенанта</SectionTitle>
      <TenantWorkflows n8n={n8n} />

      <SectionTitle>Интеграции всех тенантов</SectionTitle>
      <div className="adm-table-card">
        {integrations === null ? (
          <div className="adm-empty">Загружаем…</div>
        ) : integrations.length === 0 ? (
          <div className="adm-empty">
            <div className="ttl">Интеграций нет</div>
            Ни один тенант ещё не подключил адаптер.
          </div>
        ) : (
          <div className="adm-scroll">
            <table className="table compact">
              <thead>
                <tr>
                  <th>Компания</th>
                  <th>Интеграция</th>
                  <th>Адаптер</th>
                  <th>Состояние</th>
                  <th>Ошибок</th>
                  <th>Последний обмен</th>
                </tr>
              </thead>
              <tbody>
                {integrations.map((i) => (
                  <tr key={`${i.tenant_id}:${i.integration_id}`}>
                    <td className="email-cell">
                      <span className="ml">{i.company_name ?? '—'}</span>
                      <span className="id">{i.tenant_id}</span>
                    </td>
                    <td>{i.display_name || i.integration_id}</td>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{i.adapter_type}</td>
                    <td>
                      <span className={`badge ${intClass(i.status)}`}>{intLabel(i.status)}</span>
                    </td>
                    <td>{i.error_count > 0 ? <b style={{ color: 'var(--danger)' }}>{i.error_count}</b> : '0'}</td>
                    <td>{i.last_used_at ? ts(i.last_used_at) : 'не было'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

/** Поиск тенанта и его воркфлоу — центральный блок макета */
function TenantWorkflows({ n8n }: { n8n: AdminN8nStats | null }) {
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<AdminUser[] | null>(null);
  const [picked, setPicked] = useState<AdminUser | null>(null);
  const [workflows, setWorkflows] = useState<AdminWorkflow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const usage = picked ? n8n?.tenants.find((t) => t.tenant_id === picked.tenant_id) : undefined;

  const load = useCallback((tenantId: string) => {
    setWorkflows(null);
    setError(null);
    getTenantWorkflows(tenantId)
      .then((r) => setWorkflows(r.workflows))
      .catch((e) =>
        setError(
          e instanceof ApiError && e.status === 503
            ? 'n8n сейчас недоступен — список воркфлоу не получить.'
            : 'Не удалось загрузить воркфлоу тенанта.',
        ),
      );
  }, []);

  async function search() {
    setFound(null);
    try {
      const r = await getAdminUsers({ q: query, limit: 8 });
      setFound(r.users);
    } catch {
      setError('Поиск не сработал.');
    }
  }

  async function toggle(w: AdminWorkflow) {
    if (!picked) return;
    setBusy(w.id);
    setMsg(null);
    try {
      await (w.active ? deactivateWorkflowAdmin(w.id) : activateWorkflowAdmin(w.id));
      setMsg(`Воркфлоу «${w.name}» ${w.active ? 'выключен' : 'включён'}.`);
      load(picked.tenant_id);
    } catch (e) {
      setMsg(
        e instanceof ApiError && e.status === 503
          ? 'n8n не ответил — состояние не изменилось.'
          : 'Действие не выполнено.',
      );
    } finally {
      setBusy(null);
    }
  }

  async function reset() {
    if (!picked) return;
    setBusy('limit');
    setMsg(null);
    try {
      const r = await resetN8nLimit(picked.tenant_id);
      setMsg(
        `Лимит снят${r.reactivated_workflows ? `, включено воркфлоу: ${r.reactivated_workflows}` : ''}.` +
          ' Счётчик запусков не обнуляется — он сбрасывается первого числа.',
      );
      load(picked.tenant_id);
    } catch {
      setMsg('Не удалось сбросить лимит.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div className="tenant-search">
        <div className="si">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            placeholder="Найти тенанта по email или названию компании…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && search()}
            aria-label="Поиск тенанта"
          />
        </div>
        {picked && (
          <span className="tenant-chip">
            <span className="em">{picked.company_name || picked.email}</span>
            <span className="tid">{picked.tenant_id}</span>
            <button
              className="btn btn-ghost btn-sm"
              style={{ padding: 0, minWidth: 0 }}
              onClick={() => {
                setPicked(null);
                setWorkflows(null);
              }}
              aria-label="Сбросить выбор"
            >
              ✕
            </button>
          </span>
        )}
        <button className="btn btn-outline btn-sm" onClick={search} disabled={query.trim().length === 0}>
          Найти
        </button>
      </div>

      {found && found.length > 0 && !picked && (
        <div className="adm-table-card mb-24">
          <div className="adm-scroll">
            <table className="table compact">
              <tbody>
                {found.map((u) => (
                  <tr key={u.id}>
                    <td className="email-cell">
                      <span className="ml">{u.email}</span>
                      <span className="id">{u.tenant_id}</span>
                    </td>
                    <td>{u.company_name ?? '—'}</td>
                    <td>
                      <span className="badge badge-neutral">{planTitle(u.tenant_plan)}</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => {
                          setPicked(u);
                          setFound(null);
                          load(u.tenant_id);
                        }}
                      >
                        Открыть
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {found && found.length === 0 && <div className="adm-empty mb-24">Никого не нашли</div>}

      {picked && (
        <>
          <div className="stat-block">
            <div>
              <h2>
                {picked.company_name || picked.email}{' '}
                <span className="badge badge-neutral" style={{ verticalAlign: 'middle' }}>
                  {planTitle(picked.tenant_plan)}
                </span>
              </h2>
              <p>
                {workflows === null
                  ? 'Загружаем воркфлоу…'
                  : `${workflows.length} воркфлоу · ${workflows.filter((w) => w.active).length} включено`}
                {picked.n8n_initialized ? '' : ' · рабочее пространство n8n ещё не создано'}
              </p>
            </div>
            <div className="sb-right">
              {usage ? (
                <>
                  <div>
                    Лимит: <b style={{ color: '#fff' }}>{usage.limit_value.toLocaleString('ru-RU')} / мес</b>
                  </div>
                  <div>
                    Использовано:{' '}
                    <b style={{ color: usage.is_limit_hit ? 'var(--orange-500)' : '#fff' }}>
                      {usage.count.toLocaleString('ru-RU')}
                      {usage.limit_value > 0 && ` (${Math.round((usage.count / usage.limit_value) * 100)}%)`}
                    </b>
                  </div>
                  <div>Период: <b style={{ color: '#fff' }}>{usage.period}</b></div>
                </>
              ) : (
                /* строки в usage_counters нет, пока не было ни одного запуска — это не ошибка */
                <div>Запусков в этом месяце не было</div>
              )}
              <div style={{ marginTop: 10 }}>
                <button
                  className="btn btn-primary btn-sm"
                  style={{ background: 'var(--orange-500)' }}
                  disabled={busy === 'limit' || !usage?.is_limit_hit}
                  title={usage?.is_limit_hit ? undefined : 'Лимит не исчерпан — сбрасывать нечего'}
                  onClick={reset}
                >
                  {busy === 'limit' ? 'Сбрасываем…' : 'Сбросить лимит'}
                </button>
              </div>
            </div>
          </div>

          {msg && (
            <div className="lk-error" style={{ background: 'var(--blue-100)', color: 'var(--navy-700)' }}>
              {msg}
            </div>
          )}
          {error && <div className="lk-error">{error}</div>}

          {workflows !== null && workflows.length === 0 && (
            <div className="adm-empty">
              <div className="ttl">Воркфлоу нет</div>
              У этого тенанта в n8n не создано ни одного сценария.
            </div>
          )}

          {workflows !== null && workflows.length > 0 && (
            <div className="wf-grid">
              {workflows.map((w) => (
                <div className="wf-card" key={w.id}>
                  <div className="wh">
                    <div>
                      <div className="wn">{w.name}</div>
                      <div className="wd">n8n id: {w.id}</div>
                    </div>
                    <span className={`wf-status ${w.active ? 'active' : 'inactive'}`}>
                      {w.active ? '● ВКЛЮЧЁН' : '○ ВЫКЛЮЧЕН'}
                    </span>
                  </div>
                  <div className="meta-row">
                    <div>
                      <div className="lab">Создан</div>
                      <div className="vv">{w.createdAt ? ts(w.createdAt) : '—'}</div>
                    </div>
                    <div>
                      <div className="lab">Изменён</div>
                      <div className="vv">{w.updatedAt ? ts(w.updatedAt) : '—'}</div>
                    </div>
                  </div>
                  <div className="wf-actions">
                    <button
                      className="btn btn-outline btn-sm"
                      disabled={w.active || busy === w.id}
                      onClick={() => toggle(w)}
                    >
                      Включить
                    </button>
                    <button
                      className="btn btn-outline btn-sm"
                      disabled={!w.active || busy === w.id}
                      onClick={() => toggle(w)}
                    >
                      Выключить
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3
      style={{
        margin: '24px 0 14px',
        fontSize: 16,
        color: 'var(--text-faint)',
        textTransform: 'uppercase',
        letterSpacing: '.08em',
        fontWeight: 700,
      }}
    >
      {children}
    </h3>
  );
}

function Kpi({
  title,
  value,
  note,
  ok,
  danger,
}: {
  title: string;
  value: string;
  note?: string;
  ok?: boolean;
  danger?: boolean;
}) {
  return (
    <div className={`admin-kpi${danger ? ' alert' : ''}`}>
      <div className="kh">
        <span>{title}</span>
      </div>
      <div className="kv" style={danger ? { color: 'var(--danger)' } : ok ? { color: 'var(--success)' } : undefined}>
        {value}
      </div>
      {note && <div className="kd">{note}</div>}
    </div>
  );
}

function intClass(s: string) {
  if (s === 'active') return 'badge-success';
  if (s === 'paused') return 'badge-warning';
  if (s === 'error') return 'badge-danger';
  return 'badge-neutral';
}
function intLabel(s: string) {
  if (s === 'active') return 'работает';
  if (s === 'paused') return 'на паузе';
  if (s === 'error') return 'ошибки';
  if (s === 'deleted') return 'удалена';
  return s;
}
