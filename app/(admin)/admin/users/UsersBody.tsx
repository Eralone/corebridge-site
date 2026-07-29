'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError } from '@/lib/api/client';
import {
  blockTenant,
  getAdminN8nStats,
  getAdminPayments,
  getAdminStats,
  getAdminUsers,
  issueTenantToken,
  setTenantPlan,
  unblockTenant,
} from '@/lib/api/admin';
import type {
  AdminN8nStats,
  AdminPayment,
  AdminStats,
  AdminUser,
} from '@/lib/contracts/admin';
import { Blocked, PLAN_CODES, TenantStatus, dt, planTitle, ts } from '@/components/admin/bits';

const PER_PAGE = 20;

/**
 * Пользователи платформы. Строки — пользователь **вместе с его тенантом**:
 * `GET /admin/users` отдаёт их одной записью, и экран в макете тоже про тенантов
 * (колонки `valid_until`, `n8n`, действия «Выдать JWT», «Сменить тариф»).
 *
 * Отличия от design-source/admin-users.html:
 *
 * · **«+ Создать тенант» убрана** — эндпоинта нет, тенанты появляются регистрацией;
 * · **«Экспорт CSV» убрана** — выгрузки списка на сервере нет (есть только
 *   выгрузка одного тенанта по обращению ПДн, это другой экран);
 * · **в модалку смены тарифа добавлено поле «Причина»** — сервер требует `reason`
 *   и пишет его в аудит, в макете поля не было;
 * · **из модалки выдачи JWT убран выбор срока** — `issue-token` срока не принимает,
 *   токен выпускается на условиях текущего тарифа;
 * · подписи тарифов и суммы — канон сервера, а не «Корпоративный / 14 990 ₽» из макета;
 * · статус тенанта четырёхзначный (`active|blocked|pending_deletion|purged`).
 */
export function UsersBody() {
  const [rows, setRows] = useState<AdminUser[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [plan, setPlan] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [failed, setFailed] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const [sheet, setSheet] = useState<AdminUser | null>(null);
  const [planFor, setPlanFor] = useState<AdminUser | null>(null);
  const [tokenFor, setTokenFor] = useState<AdminUser | null>(null);

  const load = useCallback(() => {
    setFailed(false);
    getAdminUsers({
      q: q || undefined,
      plan: plan || undefined,
      // сервер знает status = active | invited (это про пользователя),
      // блокировка живёт в tenant_status и фильтруется на нашей стороне
      page,
      limit: PER_PAGE,
      sort: 'created_at',
      order: 'desc',
    })
      .then((r) => {
        setRows(r.users);
        setTotal(r.count);
      })
      .catch(() => setFailed(true));
  }, [q, plan, page]);

  useEffect(load, [load]);

  useEffect(() => {
    getAdminStats().then(setStats).catch(() => undefined);
  }, []);

  /** Поиск с задержкой: в макете стояло «debounce 300ms», оставляем как есть */
  const debounced = useRef<ReturnType<typeof setTimeout> | null>(null);
  function onSearch(value: string) {
    if (debounced.current) clearTimeout(debounced.current);
    debounced.current = setTimeout(() => {
      setPage(1);
      setQ(value);
    }, 300);
  }

  /** Блокировка — свойство тенанта, сервер её в фильтры списка не принимает */
  const visible = useMemo(() => {
    if (!rows) return null;
    if (status === 'active') return rows.filter((r) => r.tenant_status === 'active');
    if (status === 'blocked') return rows.filter((r) => r.tenant_status !== 'active');
    return rows;
  }, [rows, status]);

  const pages = Math.max(1, Math.ceil(total / PER_PAGE));

  async function toggleBlock(u: AdminUser) {
    const blocked = u.tenant_status === 'blocked';
    setNote(null);
    try {
      await (blocked ? unblockTenant(u.tenant_id) : blockTenant(u.tenant_id));
      setNote(
        blocked
          ? `Компания ${u.company_name || u.email} разблокирована.`
          : `Компания ${u.company_name || u.email} заблокирована — доступ закрыт, токены отозваны.`,
      );
      load();
    } catch (e) {
      setNote(e instanceof ApiError && e.status === 404 ? 'Тенант не найден.' : 'Действие не выполнено.');
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Пользователи платформы</h1>
          <p className="text-muted">
            {stats
              ? `${stats.tenants.total} тенантов · ${stats.tenants.by_status.active} активных · ${stats.tenants.by_status.blocked} заблокировано`
              : 'Тенанты, их тарифы и лицензии'}
          </p>
        </div>
      </div>

      {note && (
        <div className="lk-error" style={{ background: 'var(--blue-100)', color: 'var(--navy-700)' }}>
          {note}
        </div>
      )}
      {failed && <Blocked what="список пользователей" endpoint="GET /admin/users" />}

      <div className="user-stats">
        <div className="ustat">
          <div className="lb">Тенантов всего</div>
          <div className="vl">{stats ? stats.tenants.total : '—'}</div>
        </div>
        <div className="ustat">
          <div className="lb">Тенантов активных</div>
          <div className="vl" style={{ color: 'var(--success)' }}>
            {stats ? stats.tenants.by_status.active : '—'}
          </div>
        </div>
        <div className="ustat">
          <div className="lb">Истекает &lt;3 дн.</div>
          <div className="vl" style={{ color: 'var(--warning)' }}>
            {stats ? stats.tenants.expiring_soon : '—'}
          </div>
        </div>
        <div className="ustat danger">
          <div className="lb">Заблокированы</div>
          <div className="vl">{stats ? stats.tenants.by_status.blocked : '—'}</div>
        </div>
      </div>

      <div className="filter-bar">
        <div className="search-input">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            placeholder="Поиск по email, имени или названию компании…"
            onChange={(e) => onSearch(e.target.value)}
            aria-label="Поиск"
          />
        </div>
        <div className="chip-set">
          <Chip active={plan === ''} onClick={() => { setPage(1); setPlan(''); }}>Все тарифы</Chip>
          {PLAN_CODES.map((c) => (
            <Chip key={c} active={plan === c} onClick={() => { setPage(1); setPlan(c); }}>
              {planTitle(c)}
            </Chip>
          ))}
        </div>
        <div className="chip-set">
          <Chip active={status === ''} onClick={() => setStatus('')}>Все</Chip>
          <Chip active={status === 'active'} onClick={() => setStatus('active')}>Активные</Chip>
          <Chip active={status === 'blocked'} onClick={() => setStatus('blocked')}>Заблокированные</Chip>
        </div>
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Email / ID тенанта</th>
              <th>Тариф</th>
              <th>Действует до</th>
              <th>n8n</th>
              <th>Создан</th>
              <th style={{ textAlign: 'right' }}>Действия</th>
            </tr>
          </thead>
          <tbody>
            {visible === null ? (
              <tr>
                <td colSpan={6}>Загружаем…</td>
              </tr>
            ) : visible.length === 0 ? (
              <tr>
                <td colSpan={6}>Ничего не найдено</td>
              </tr>
            ) : (
              visible.map((u) => (
                <tr key={u.id} style={u.tenant_status !== 'active' ? { background: 'rgba(216,58,58,.04)' } : undefined}>
                  <td>
                    <div style={{ fontWeight: 600 }}>
                      {u.email}
                      {u.tenant_status !== 'active' && (
                        <span style={{ marginLeft: 6 }}>
                          <TenantStatus status={u.tenant_status} />
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-faint)', fontFamily: 'var(--mono)' }}>
                      {u.tenant_id}
                    </div>
                  </td>
                  <td>
                    <span className="badge badge-neutral">{planTitle(u.tenant_plan)}</span>
                  </td>
                  <td>
                    <ValidUntil value={u.valid_until} plan={String(u.tenant_plan)} />
                  </td>
                  <td>
                    {u.n8n_initialized ? (
                      <span className="ck">✓ готов</span>
                    ) : (
                      <span className="xx">✗ не создан</span>
                    )}
                  </td>
                  <td>
                    {dt(u.created_at)}
                    <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                      {u.last_login_at ? `вход ${ts(u.last_login_at)}` : 'не входил'}
                    </div>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <RowMenu
                      onProfile={() => setSheet(u)}
                      onToken={() => setTokenFor(u)}
                      onPlan={() => setPlanFor(u)}
                      onBlock={() => toggleBlock(u)}
                      blocked={u.tenant_status === 'blocked'}
                      /* удалённый тенант трогать нечем — данные уже вычищены */
                      frozen={u.tenant_status === 'purged'}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="pager">
        <div className="text-muted" style={{ fontSize: 13 }}>
          {total > 0
            ? `Показано ${(page - 1) * PER_PAGE + 1}–${Math.min(page * PER_PAGE, total)} из ${total} · ${PER_PAGE} на страницу`
            : 'Пусто'}
        </div>
        <div className="pg">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>‹</button>
          {pageNumbers(page, pages).map((n, i) =>
            n === null ? (
              <button key={`gap${i}`} disabled>…</button>
            ) : (
              <button key={n} className={n === page ? 'cur' : ''} onClick={() => setPage(n)}>
                {n}
              </button>
            ),
          )}
          <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>›</button>
        </div>
      </div>

      {sheet && <ProfileSheet user={sheet} onClose={() => setSheet(null)} />}
      {planFor && (
        <ChangePlan
          user={planFor}
          onClose={() => setPlanFor(null)}
          onDone={(msg) => {
            setNote(msg);
            setPlanFor(null);
            load();
          }}
        />
      )}
      {tokenFor && <IssueToken user={tokenFor} onClose={() => setTokenFor(null)} />}
    </>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" className={`chip${active ? ' active' : ''}`} onClick={onClick}>
      {children}
    </button>
  );
}

/**
 * `valid_until: null` — бессрочная лицензия, а не «нет данных». Обычно это пробный
 * тариф, но не всегда: админ может выдать бессрочную лицензию на любом тарифе
 * через `set-plan` с `valid_until: null`. Поэтому подпись зависит от тарифа.
 */
function ValidUntil({ value, plan }: { value: string | null; plan: string }) {
  if (value === null) {
    return (
      <>
        бессрочно
        <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>
          {plan === 'trial' ? 'пробный тариф' : 'срок не ограничен'}
        </div>
      </>
    );
  }
  const d = new Date(value);
  const days = Math.ceil((d.getTime() - Date.now()) / 86_400_000);
  if (days < 0) {
    return (
      <>
        <span className="vu-soon">истёк {d.toLocaleDateString('ru-RU')}</span>
        <div style={{ fontSize: 11, color: 'var(--danger)' }}>{Math.abs(days)} дн. назад</div>
      </>
    );
  }
  return (
    <>
      <span className={days <= 3 ? 'vu-soon' : undefined}>{d.toLocaleDateString('ru-RU')}</span>
      <div style={{ fontSize: 11, color: days <= 3 ? 'var(--danger)' : 'var(--text-faint)' }}>{days} дн.</div>
    </>
  );
}

function RowMenu({
  onProfile,
  onToken,
  onPlan,
  onBlock,
  blocked,
  frozen,
}: {
  onProfile: () => void;
  onToken: () => void;
  onPlan: () => void;
  onBlock: () => void;
  blocked: boolean;
  frozen: boolean;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [open]);

  const pick = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };

  return (
    <div className="row-actions" ref={box}>
      <button className="menu-btn" onClick={() => setOpen((v) => !v)} aria-label="Действия">
        ⋮
      </button>
      <div className={`dropdown${open ? ' open' : ''}`}>
        <button onClick={pick(onProfile)}>Просмотр профиля</button>
        <button onClick={pick(onToken)} disabled={frozen}>
          Выдать JWT вручную
        </button>
        <button onClick={pick(onPlan)} disabled={frozen}>
          Сменить тариф
        </button>
        <hr />
        <button className="danger" onClick={pick(onBlock)} disabled={frozen}>
          {blocked ? 'Разблокировать' : 'Заблокировать'}
        </button>
      </div>
    </div>
  );
}

/** Боковая панель профиля. Часть блоков зависит от эндпоинтов, которые сейчас 500 */
function ProfileSheet({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const [payments, setPayments] = useState<AdminPayment[] | null>(null);
  const [n8n, setN8n] = useState<AdminN8nStats['tenants'][number] | null>(null);

  useEffect(() => {
    getAdminPayments({ tenant_id: user.tenant_id, limit: 5 })
      .then((r) => setPayments(r.payments))
      .catch(() => setPayments([]));
    getAdminN8nStats()
      .then((r) => setN8n(r.tenants.find((t) => t.tenant_id === user.tenant_id) ?? null))
      .catch(() => undefined);
  }, [user.tenant_id]);

  return (
    <>
      <div className="sheet-overlay open" onClick={onClose} />
      <aside className="sheet open" aria-label="Профиль тенанта">
        <div className="sheet-head">
          <div>
            <h3>Профиль тенанта</h3>
            <div style={{ fontSize: 11, color: 'var(--text-faint)', fontFamily: 'var(--mono)' }}>
              {user.tenant_id}
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Закрыть">
            ✕
          </button>
        </div>
        <div className="sheet-body">
          <div className="sheet-section">
            <h5>Личные данные</h5>
            <Kv k="Email" v={user.email} />
            <Kv k="Контактное лицо" v={user.name ?? '—'} />
            <Kv k="Компания" v={user.company_name ?? '—'} />
            <Kv k="ИНН" v={user.company_inn ?? '—'} />
            <Kv k="Телефон" v={user.phone ?? '—'} />
            <Kv k="Роль" v={user.role} />
            <Kv
              k="Почта подтверждена"
              v={user.email_verified ? 'да' : 'нет'}
              color={user.email_verified ? 'var(--success)' : 'var(--warning)'}
            />
          </div>

          <div className="sheet-section">
            <h5>Тариф и лицензия</h5>
            <Kv k="План" v={<span className="badge badge-neutral">{planTitle(user.tenant_plan)}</span>} />
            <Kv k="Действует до" v={user.valid_until ? dt(user.valid_until) : 'бессрочно'} />
            <Kv k="Статус" v={<TenantStatus status={user.tenant_status} />} />
            <Kv
              k="Рабочее пространство n8n"
              v={user.n8n_initialized ? 'создано' : 'не создано'}
              color={user.n8n_initialized ? 'var(--success)' : 'var(--text-muted)'}
            />
            <Kv
              k="Запусков за месяц"
              v={n8n ? `${n8n.count} из ${n8n.limit_value}` : 'запусков не было'}
            />
          </div>

          <div className="sheet-section">
            <h5>История JWT-токенов</h5>
            {/* ⚠️ GET /admin/tenants/:id/tokens отвечает 500: SQL обращается к колонкам
                issued_at и details, которых в platform.licenses нет. Промт S13 §2.
                Показываем причину, а не пустой блок — иначе выглядело бы как «токенов не было». */}
            <p className="text-muted" style={{ fontSize: 12.5, margin: 0 }}>
              Источник недоступен: сервер отвечает ошибкой на <code>GET /admin/tenants/:id/tokens</code>.
              Починка описана в промте S13 для бэкенда. Факт ручной выдачи виден в журнале
              на обзоре — действие <code>admin_token_issued</code>.
            </p>
          </div>

          <div className="sheet-section">
            <h5>История платежей</h5>
            {payments === null ? (
              <p className="text-muted" style={{ fontSize: 13, margin: 0 }}>Загружаем…</p>
            ) : payments.length === 0 ? (
              <p className="text-muted" style={{ fontSize: 13, margin: 0 }}>Платежей не было</p>
            ) : (
              payments.map((p) => (
                <Kv
                  key={p.id}
                  k={dt(p.created_at)}
                  v={`${Number(p.amount).toLocaleString('ru-RU')} ₽ · ${p.status}`}
                />
              ))
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

function Kv({ k, v, color }: { k: string; v: React.ReactNode; color?: string }) {
  return (
    <div className="kv-row">
      <span className="k">{k}</span>
      <span className="v" style={color ? { color } : undefined}>
        {v}
      </span>
    </div>
  );
}

/**
 * Смена тарифа. Главное отличие от макета — обязательное поле «Причина»:
 * сервер отвечает `400 REASON_REQUIRED` без неё и пишет текст в `audit_log`.
 */
function ChangePlan({
  user,
  onClose,
  onDone,
}: {
  user: AdminUser;
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const [plan, setPlan] = useState<string>(String(user.tenant_plan));
  const [reason, setReason] = useState('');
  const [perpetual, setPerpetual] = useState(user.valid_until === null);
  const [until, setUntil] = useState(defaultUntil());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function apply() {
    setBusy(true);
    setError(null);
    try {
      const r = await setTenantPlan(user.tenant_id, {
        plan,
        reason: reason.trim(),
        valid_until: perpetual ? null : new Date(until).toISOString(),
      });
      onDone(
        `Тариф ${user.company_name || user.email} изменён на «${planTitle(r.plan)}»` +
          `${r.is_perpetual ? ' бессрочно' : ` до ${dt(r.valid_until)}`}. Токен перевыпущен.`,
      );
    } catch (e) {
      setError(
        e instanceof ApiError && e.code === 'REASON_REQUIRED'
          ? 'Причина обязательна — она уходит в журнал.'
          : e instanceof ApiError && e.code === 'INVALID_PLAN'
            ? 'Такого тарифа нет.'
            : e instanceof ApiError && e.status === 502
              ? 'Сервис лицензий не ответил. Тариф не изменён.'
              : 'Не удалось сменить тариф.',
      );
      setBusy(false);
    }
  }

  return (
    <div className="cb-modal-bd open" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="cb-modal">
        <button className="x" onClick={onClose} aria-label="Закрыть">
          ×
        </button>
        <h3>Сменить тариф</h3>
        <p>
          Перевыпустит лицензию для <b>{user.company_name || user.email}</b>: лимиты и срок
          заменятся на новые, старый токен перестанет действовать сразу.
        </p>

        {error && <div className="lk-error">{error}</div>}

        <div className="col" style={{ gap: 8 }}>
          {PLAN_CODES.map((code) => (
            <label
              className="cb"
              key={code}
              style={{
                padding: 12,
                border: `1px solid ${plan === code ? 'var(--admin)' : 'var(--border)'}`,
                borderRadius: 10,
                background: plan === code ? 'rgba(107,70,193,.04)' : undefined,
              }}
            >
              <input type="radio" name="plan" checked={plan === code} onChange={() => setPlan(code)} />
              <div>
                <b>{planTitle(code)}</b>
                {code === user.tenant_plan && (
                  <span className="badge badge-neutral" style={{ marginLeft: 6 }}>
                    текущий
                  </span>
                )}
              </div>
            </label>
          ))}
        </div>

        <div className="field mt-16">
          <label className="cb">
            <input type="checkbox" checked={perpetual} onChange={(e) => setPerpetual(e.target.checked)} />
            <span>Бессрочно (как на пробном тарифе)</span>
          </label>
        </div>

        {!perpetual && (
          <div className="field">
            <label htmlFor="plan-until">Действует до</label>
            <input
              id="plan-until"
              className="input"
              type="date"
              value={until}
              onChange={(e) => setUntil(e.target.value)}
            />
          </div>
        )}

        {/* поля нет в макете: сервер требует reason и пишет его в audit_log */}
        <div className="field">
          <label htmlFor="plan-reason">Причина</label>
          <input
            id="plan-reason"
            className="input"
            placeholder="Например: оплата по счёту №142 от 29.07"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <span className="hint">Останется в журнале рядом с действием. Обязательна.</span>
        </div>

        <div className="row gap-12" style={{ marginTop: 18 }}>
          <button className="btn btn-outline btn-sm" onClick={onClose} disabled={busy}>
            Отмена
          </button>
          <button
            className="btn btn-primary btn-sm"
            style={{ marginLeft: 'auto' }}
            disabled={busy || !reason.trim()}
            onClick={apply}
          >
            {busy ? 'Применяем…' : 'Применить'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Выдача JWT вручную. Срок не выбирается — сервер его не принимает */
function IssueToken({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function issue() {
    setBusy(true);
    setError(null);
    try {
      const r = await issueTenantToken(user.tenant_id);
      setToken(r.token);
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 502
          ? 'Сервис лицензий не ответил. Токен не выдан.'
          : 'Не удалось выдать токен.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="cb-modal-bd open" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="cb-modal">
        <button className="x" onClick={onClose} aria-label="Закрыть">
          ×
        </button>
        <h3>Выдать JWT вручную</h3>
        <p>
          Перевыпустит лицензию для <b>{user.company_name || user.email}</b> на условиях текущего
          тарифа «{planTitle(user.tenant_plan)}». Прежний токен перестанет действовать.
          Действие попадёт в журнал.
        </p>

        {error && <div className="lk-error">{error}</div>}

        {token ? (
          <div className="field">
            <label htmlFor="issued-token">Выданный токен</label>
            <textarea
              id="issued-token"
              className="textarea"
              style={{ fontFamily: 'var(--mono)', fontSize: 11, background: 'var(--bg-tinted)' }}
              readOnly
              rows={5}
              value={token}
            />
            <span className="hint">Показывается один раз — на сервере в открытом виде не хранится.</span>
          </div>
        ) : (
          <p className="text-muted" style={{ fontSize: 13 }}>
            Срок действия задаётся тарифом: отдельного выбора сервер не принимает.
          </p>
        )}

        <div className="row gap-12" style={{ marginTop: 16 }}>
          {token && (
            <button
              className="btn btn-outline btn-sm"
              onClick={() => {
                navigator.clipboard?.writeText(token);
                setCopied(true);
              }}
            >
              {copied ? 'Скопировано' : 'Копировать'}
            </button>
          )}
          <button
            className="btn btn-primary btn-sm"
            style={{ marginLeft: 'auto' }}
            disabled={busy}
            onClick={token ? onClose : issue}
          >
            {busy ? 'Выпускаем…' : token ? 'Готово' : 'Выдать токен'}
          </button>
        </div>
      </div>
    </div>
  );
}

function defaultUntil(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

/** 1 … текущая ± 1 … последняя, как в макете: ‹ 1 2 3 … 156 › */
function pageNumbers(current: number, total: number): (number | null)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: (number | null)[] = [1];
  const from = Math.max(2, current - 1);
  const to = Math.min(total - 1, current + 1);
  if (from > 2) out.push(null);
  for (let i = from; i <= to; i++) out.push(i);
  if (to < total - 1) out.push(null);
  out.push(total);
  return out;
}
