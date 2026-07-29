'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getActivity, getDashboard, getIntegrations, getLogs, getPlans } from '@/lib/api/lk';
import type { Activity, AuditEntry, Dashboard, Integration, Plan } from '@/lib/contracts/lk';
import { ActivityChart, ActivityLegend } from '@/components/lk/ActivityChart';
import { EventRow, timeAgo } from '@/components/lk/events';

/**
 * Дашборд. Отличия от design-source/dashboard.html — там, где макет показывал
 * то, чего у сервера нет:
 *
 * · дельты («+2 за неделю», «+12 % к апрелю», «+0.3 п.п.») **убраны** — истории
 *   для них не ведётся, любое число здесь было бы выдумкой;
 * · период **90д убран**: `GET /lk/dashboard/activity` принимает только 7d и 30d;
 * · «Успешность синхронизации» отдельного источника не имеет — считаем на
 *   клиенте как ok/(ok+error) по тем же точкам, что и график;
 * · счётчик операций сервер завёл 2026-07-29 (промт S10) — он в `operations_usage`
 *   и показан в биллинге. Здесь KPI остаётся про запуски n8n, чтобы плитки
 *   не дублировали друг друга;
 * · строки интеграций: `requests_this_month` сервер не отдаёт → «—».
 */

const DAY = 86_400_000;

export function DashboardBody() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [logs, setLogs] = useState<AuditEntry[] | null>(null);
  const [integrations, setIntegrations] = useState<Integration[] | null>(null);
  const [range, setRange] = useState<'7d' | '30d'>('30d');
  const [failed, setFailed] = useState(false);
  const [recoveryUsed, setRecoveryUsed] = useState(false);

  useEffect(() => {
    // флаг ставит экран входа, если человек вошёл кодом восстановления
    if (sessionStorage.getItem('cb_recovery_code_used')) {
      setRecoveryUsed(true);
      sessionStorage.removeItem('cb_recovery_code_used');
    }
    Promise.all([getDashboard(), getPlans(), getLogs(6), getIntegrations()])
      .then(([d, p, l, i]) => {
        setData(d);
        setPlans(p.plans);
        setLogs(l);
        setIntegrations(i);
      })
      .catch(() => setFailed(true));
  }, []);

  useEffect(() => {
    getActivity(range)
      .then(setActivity)
      .catch(() => setActivity(null));
  }, [range]);

  const plan = plans?.find((p) => p.code === data?.plan);
  const points = activity?.points ?? [];
  const ok = points.reduce((s, p) => s + p.ok, 0);
  const err = points.reduce((s, p) => s + p.error, 0);
  const successRate = ok + err > 0 ? (ok / (ok + err)) * 100 : null;

  return (
    <>
      {failed && (
        <div className="lk-error">
          Не удалось загрузить данные кабинета. Обновите страницу — если не поможет, напишите на
          info@corebridge.ru.
        </div>
      )}
      {recoveryUsed && (
        <div className="lk-error" style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }}>
          Вход выполнен кодом восстановления — один из десяти израсходован. Перевыпустить комплект
          можно в <Link href="/settings">настройках безопасности</Link>.
        </div>
      )}

      <div className="page-head">
        <div>
          <h1>Дашборд</h1>
          <p className="text-muted">{greeting(data, integrations)}</p>
        </div>
        <div className="row">
          <Link href="/my-integrations" className="btn btn-outline">
            + Новая интеграция
          </Link>
          <Link href="/epf" className="btn btn-primary">
            Скачать .epf
          </Link>
        </div>
      </div>

      {/* ── KPI ─────────────────────────────────────────────────────────── */}
      <div className="kpi-grid">
        <Kpi
          title="Активные интеграции"
          value={data ? String(data.integrations_count) : null}
          icon={<path d="M13 2 3 14h7l-1 8 11-13h-8l1-7z" />}
          note={plan ? `Лимит тарифа: ${plan.limits.projects}` : undefined}
        />
        <Kpi
          title="Запусков n8n за месяц"
          value={data ? data.executions_this_month.toLocaleString('ru-RU') : null}
          icon={<path d="M3 12h4l3-8 4 16 3-8h4" />}
          /* Лимит снова из `n8n_usage`: сервер (S10) починил его так, что он
             отражает тариф с первого дня. Каталог оставлен запасным вариантом. */
          note={
            data?.n8n_usage.limit
              ? `из ${data.n8n_usage.limit.toLocaleString('ru-RU')} по тарифу`
              : plan
                ? `из ${plan.limits.n8n_executions_month.toLocaleString('ru-RU')} по тарифу`
                : undefined
          }
        />
        <Kpi
          title="Успешность синхронизации"
          value={successRate === null ? '—' : `${successRate.toFixed(1)}`}
          suffix={successRate === null ? undefined : '%'}
          iconStyle={{ background: 'var(--success-bg)', color: 'var(--success)' }}
          icon={<path d="M20 6 9 17l-5-5" />}
          note={successRate === null ? 'событий пока не было' : `за ${range === '7d' ? '7' : '30'} дней`}
        />
        <Kpi
          title="Текущий тариф"
          value={plan?.title ?? (data ? data.plan : null)}
          small
          iconStyle={{ background: 'rgba(255,107,53,.12)', color: 'var(--orange-500)' }}
          icon={<path d="M5 16L3 8l5.5 4L12 5l3.5 7L21 8l-2 8H5z" fill="currentColor" stroke="none" />}
          note={planNote(data, plan)}
        />
      </div>

      {/* ── График и лента ──────────────────────────────────────────────── */}
      <div className="grid-dash">
        <div className="chart-card">
          <div className="chart-head">
            <div>
              <h3>Активность интеграций</h3>
              <div className="text-faint" style={{ fontSize: 13 }}>
                Событий в сутки
              </div>
            </div>
            {/* 90д из макета нет: сервер принимает только 7d и 30d */}
            <div className="seg">
              {(['7d', '30d'] as const).map((r) => (
                <span key={r}>
                  <input
                    type="radio"
                    name="range"
                    id={`r-${r}`}
                    checked={range === r}
                    onChange={() => setRange(r)}
                  />
                  <label htmlFor={`r-${r}`}>{r === '7d' ? '7д' : '30д'}</label>
                </span>
              ))}
            </div>
          </div>
          <ActivityChart points={points} />
          <ActivityLegend points={points} />
        </div>

        <div className="chart-card">
          <div className="chart-head">
            <h3>Последние события</h3>
          </div>
          {logs === null ? (
            <div className="lk-empty">Загружаем…</div>
          ) : logs.length === 0 ? (
            <div className="lk-empty">
              <div className="ttl">Событий пока нет</div>
              Здесь появятся синхронизации, заказы и ошибки интеграций.
            </div>
          ) : (
            <div className="events-list">
              {logs.map((e) => (
                <EventRow key={e.id} entry={e} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Интеграции ──────────────────────────────────────────────────── */}
      <div className="chart-card mt-24">
        <div className="chart-head">
          <h3>Мои интеграции</h3>
          <Link href="/my-integrations" style={{ fontSize: 13 }}>
            Все интеграции →
          </Link>
        </div>
        {integrations === null ? (
          <div className="lk-empty">Загружаем…</div>
        ) : integrations.length === 0 ? (
          <div className="lk-empty">
            <div className="ttl">Интеграций пока нет</div>
            Начните с файла .epf — он свяжет вашу 1С с сервисами.{' '}
            <Link href="/epf">Перейти к настройке</Link>
          </div>
        ) : (
          <div>
            {integrations.slice(0, 5).map((i) => (
              <IntegrationRow key={i.integration_id} it={i} />
            ))}
          </div>
        )}
      </div>

      {/* ── Быстрые действия ────────────────────────────────────────────── */}
      <div className="quick-actions">
        <Quick
          href="/my-integrations"
          title="Добавить интеграцию"
          sub="Маркетплейс, CRM, сервис"
          icon={<path d="M12 5v14M5 12h14" />}
        />
        <Quick
          href="/docs"
          title="Документация"
          sub="Гайды и API Reference"
          icon={
            <>
              <path d="M6 2h9l5 5v15H6z" />
              <path d="M14 2v6h6" />
            </>
          }
        />
        <Quick
          href="/support"
          title="Поддержка"
          // в макете «Ответ в среднем - 2 часа» — обещание, которое нечем обеспечить
          sub="Написать нам на почту"
          icon={<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />}
        />
        <Quick
          href="/billing"
          title="Сменить тариф"
          sub={promoLabel(plans, data?.plan) ?? 'Тарифы и оплата'}
          icon={<path d="M5 16 3 8l5.5 4L12 5l3.5 7L21 8l-2 8H5z" />}
        />
      </div>
    </>
  );
}

/** «Добрый день» из макета звало человека по имени — имя берём из контекста топбара */
function greeting(data: Dashboard | null, integrations: Integration[] | null): string {
  if (!data) return 'Загружаем данные кабинета…';
  if (!integrations || integrations.length === 0)
    return 'Интеграции ещё не подключены — начните с файла .epf.';
  const broken = integrations.filter((i) => i.status === 'error').length;
  return broken > 0
    ? `Требуют внимания: ${broken} ${plural(broken, 'интеграция', 'интеграции', 'интеграций')}.`
    : 'Все ключевые интеграции в норме.';
}

function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

/**
 * Подпись под тарифом.
 * ⚠️ `valid_until === null` — это бессрочная лицензия. Сам `days_left` полагаться
 * нельзя: на пробном тарифе сервер отдаёт `0`, хотя лицензия бессрочная, и
 * «0 дней» выглядело бы как истёкший доступ.
 */
function planNote(data: Dashboard | null, plan: Plan | undefined): string | undefined {
  if (!data) return undefined;
  const limits = plan
    ? `${plan.limits.projects} ${plural(plan.limits.projects, 'интеграция', 'интеграции', 'интеграций')} · ${plan.limits.monthly_operations.toLocaleString('ru-RU')} операций/мес`
    : '';
  if (data.valid_until === null) return limits ? `Бессрочно · ${limits}` : 'Бессрочно';
  const left = Math.max(0, Math.ceil((data.valid_until * 1000 - Date.now()) / DAY));
  return `Осталось ${left} ${plural(left, 'день', 'дня', 'дней')}${limits ? ` · ${limits}` : ''}`;
}

/**
 * Подпись плитки «Сменить тариф». Промо не рекламируем тому, кто уже на этом тарифе:
 * акция `once_per_tenant`, повторная оплата упрётся в `PROMO_ALREADY_USED`.
 */
function promoLabel(plans: Plan[] | null, current: string | undefined): string | undefined {
  const withPromo = plans?.find((p) => p.promo);
  if (!withPromo || withPromo.code === current) return undefined;
  return withPromo.promo?.label;
}

function Kpi({
  title,
  value,
  suffix,
  note,
  icon,
  iconStyle,
  small,
}: {
  title: string;
  value: string | null;
  suffix?: string;
  note?: string;
  icon: React.ReactNode;
  iconStyle?: React.CSSProperties;
  small?: boolean;
}) {
  return (
    <div className="kpi">
      <div className="kpi-head">
        <span>{title}</span>
        <span className="kpi-icon" style={iconStyle}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {icon}
          </svg>
        </span>
      </div>
      <div className="kpi-value" style={small ? { fontSize: 26 } : undefined}>
        {value === null ? <span className="lk-skeleton">000</span> : value}
        {suffix && <span style={{ fontSize: 18 }}>{suffix}</span>}
      </div>
      {/* Дельт из макета здесь нет: истории для них сервер не ведёт */}
      {note && (
        <div className="kpi-delta" style={{ color: 'var(--text-muted)' }}>
          {note}
        </div>
      )}
    </div>
  );
}

const STATUS: Record<string, { cls: string; label: string }> = {
  active: { cls: 'badge-success', label: 'Active' },
  paused: { cls: 'badge-warning', label: 'Paused' },
  error: { cls: 'badge-danger', label: 'Error' },
  pending: { cls: 'badge-neutral', label: 'Pending' },
};

function IntegrationRow({ it }: { it: Integration }) {
  const s = STATUS[it.status] ?? { cls: 'badge-neutral', label: it.status };
  const name = it.display_name || it.adapter_type;
  return (
    <div className="int-row">
      <div className="int-name">
        <div className="ic" style={{ background: colorFor(it.adapter_type) }}>
          {name.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <div className="nm">{name}</div>
          <div className="id">
            {it.integration_id} · {it.adapter_type}
          </div>
        </div>
      </div>
      <span className={`badge ${s.cls} badge-dot`}>{s.label}</span>
      {/* requests_this_month сервер не отдаёт — прочерк честнее выдуманного числа */}
      <span className="text-muted" style={{ fontSize: 13 }}>
        —
      </span>
      <span className="text-muted" style={{ fontSize: 13 }}>
        {it.last_sync_at ? timeAgo(it.last_sync_at) : 'не запускалась'}
      </span>
      <div className="text-right">
        <Link href="/my-integrations" className="btn btn-outline btn-sm">
          Настроить
        </Link>
      </div>
    </div>
  );
}

/** Цвет плашки по типу адаптера — в макете они были заданы вручную под каждый сервис */
function colorFor(adapter: string): string {
  const known: Record<string, string> = {
    ozon: '#005bff',
    wildberries: '#CB11AB',
    yandex_market: '#FFCC00',
    bitrix24: '#2D8CFF',
    cdek: '#00B956',
  };
  return known[adapter] ?? 'var(--navy-700)';
}

function Quick({
  href,
  title,
  sub,
  icon,
}: {
  href: string;
  title: string;
  sub: string;
  icon: React.ReactNode;
}) {
  return (
    <Link href={href} className="qa">
      <div className="qa-ic">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          {icon}
        </svg>
      </div>
      <div>
        <div className="ttl">{title}</div>
        <div className="sb">{sub}</div>
      </div>
    </Link>
  );
}
