'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ApiError } from '@/lib/api/client';
import {
  changePassword,
  changeUserRole,
  confirm2fa,
  createPrivacyRequest,
  disable2fa,
  enable2fa,
  get2faStatus,
  getNotificationSettings,
  getPrivacyRequests,
  getProfile,
  getSessions,
  getTeam,
  inviteUser,
  linkTelegram,
  logoutOtherSessions,
  removeUser,
  revokeSession,
  saveNotificationSettings,
  telegramStatus,
  unlinkTelegram,
  updateProfile,
} from '@/lib/api/lk';
import type {
  NotificationSettings,
  PrivacyRequest,
  PrivacyRequestType,
  Profile,
  Session,
  TeamMember,
  TwoFactorStatus,
} from '@/lib/contracts/lk';
import { timeAgo } from '@/components/lk/events';

/**
 * Настройки. Самый большой разрыв между макетом и сервером.
 *
 * **Убрано из design-source/settings.html:**
 * · блок **API-ключей `cb_*`** целиком — таких ключей на сервере нет,
 *   доступ к API даёт JWT со страницы `/epf`;
 * · **двухфакторка «через SMS»** — SMS на платформе не существует и не появится,
 *   второй фактор только через Telegram;
 * · **колонка SMS** в матрице уведомлений — по той же причине;
 * · аватар с загрузкой, Должность, Язык интерфейса, Часовой пояс — полей нет на сервере.
 *
 * **Добавлено, чего в макете не было:**
 * · раздел «Компания» — поля на сервере есть (`company_name`, `company_inn`, …);
 * · раздел «Команда» — API готов целиком, а секции в макете нет;
 * · раздел «Данные и приватность» — экспорт и удаление аккаунта (S8).
 */

type Tab = 'profile' | 'company' | 'team' | 'security' | 'notifications' | 'privacy';

const TABS: { id: Tab; label: string }[] = [
  { id: 'profile', label: 'Профиль' },
  { id: 'company', label: 'Компания' },
  { id: 'team', label: 'Команда' },
  { id: 'security', label: 'Безопасность' },
  { id: 'notifications', label: 'Уведомления' },
  { id: 'privacy', label: 'Данные и приватность' },
];

export function SettingsBody() {
  const [tab, setTab] = useState<Tab>('profile');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getProfile().then(setProfile).catch(() => setError('Не удалось загрузить профиль.'));
  }, []);

  const ok = (m: string) => {
    setError(null);
    setNote(m);
  };
  const fail = (e: unknown, fallback: string) => {
    setNote(null);
    setError(e instanceof ApiError ? messageFor(e, fallback) : fallback);
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Настройки</h1>
          <p className="text-muted">Профиль, компания, команда, безопасность и уведомления</p>
        </div>
      </div>

      {error && <div className="lk-error">{error}</div>}
      {note && (
        <div className="lk-error" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}>
          {note}
        </div>
      )}

      <div className="settings-grid">
        {/*
          ⚠️ В эталоне вкладки были `<a>` без href. Такой элемент не получает
          фокус, не нажимается с клавиатуры и не объявляется как интерактивный —
          до половины настроек нельзя было добраться, не взяв мышь.
          Заменено на кнопки с ролью вкладки; оформление совпадает с эталоном
          (правило `.set-side a, .set-side button` в styles/lk.css).
        */}
        <nav className="set-side" role="tablist" aria-label="Разделы настроек">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={tab === t.id ? 'active' : undefined}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <div>
          {tab === 'profile' && <ProfileCard profile={profile} setProfile={setProfile} ok={ok} fail={fail} />}
          {tab === 'company' && <CompanyCard profile={profile} setProfile={setProfile} ok={ok} fail={fail} />}
          {tab === 'team' && <TeamCard profile={profile} ok={ok} fail={fail} />}
          {tab === 'security' && <SecurityCard profile={profile} ok={ok} fail={fail} />}
          {tab === 'notifications' && <NotificationsCard ok={ok} fail={fail} />}
          {tab === 'privacy' && <PrivacyCard ok={ok} fail={fail} />}
        </div>
      </div>
    </>
  );
}

type OK = (m: string) => void;
type FAIL = (e: unknown, fallback: string) => void;

function messageFor(e: ApiError, fallback: string): string {
  switch (e.code) {
    case 'OAUTH_ACCOUNT':
      return 'У аккаунта Яндекс ID нет пароля — задайте его через «Забыли пароль?».';
    case 'INVALID_PASSWORD':
      return 'Текущий пароль указан неверно.';
    case 'WEAK_PASSWORD':
      return 'Новый пароль слишком простой. Минимум 8 символов.';
    case 'TELEGRAM_REQUIRED_FOR_2FA':
      return 'Сначала выключите двухфакторную защиту: без Telegram вход станет невозможен.';
    case 'TELEGRAM_NOT_LINKED':
      return 'Сначала привяжите Telegram — код второго фактора приходит туда.';
    case 'INVALID_CODE': {
      const left = e.details?.attempts_left;
      return typeof left === 'number' ? `Неверный код. Осталось попыток: ${left}.` : 'Неверный код.';
    }
    case 'USERS_LIMIT_REACHED': {
      const limit = e.details?.limit;
      return `Лимит тарифа исчерпан${typeof limit === 'number' ? `: ${limit} чел.` : ''}. Смените тариф, чтобы добавить ещё.`;
    }
    case 'USER_EXISTS':
      return 'Такой пользователь уже в команде.';
    case 'LAST_OWNER':
      return 'Нельзя убрать последнего владельца аккаунта.';
    case 'CANNOT_DELETE_SELF':
      return 'Себя удалить нельзя.';
    default:
      return fallback;
  }
}

/* ── Профиль ─────────────────────────────────────────────────────────────── */
function ProfileCard({
  profile,
  setProfile,
  ok,
  fail,
}: {
  profile: Profile | null;
  setProfile: (p: Profile) => void;
  ok: OK;
  fail: FAIL;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setName(profile.user.name ?? '');
    setPhone(profile.user.phone ?? '');
  }, [profile]);

  if (!profile) return <div className="card">Загружаем…</div>;

  return (
    <div className="card">
      <h3>Профиль</h3>
      <div className="sub">Как вас видят коллеги и на какой адрес приходят письма</div>

      <div className="form-row">
        <label htmlFor="p-name">Имя</label>
        <input id="p-name" className="input" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="form-row">
        <label htmlFor="p-email">Email</label>
        <div>
          <input id="p-email" className="input" value={profile.user.email} disabled />
          <div className="hint">
            {profile.user.email_verified ? 'Адрес подтверждён' : 'Адрес не подтверждён — проверьте почту'}
            {' · '}
            {profile.user.auth_provider === 'yandex' ? 'вход через Яндекс ID' : 'вход по паролю'}
          </div>
        </div>
      </div>
      <div className="form-row">
        <label htmlFor="p-phone">Телефон</label>
        <div>
          <input id="p-phone" className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <div className="hint">Нужен, только если попросите позвонить — уведомления сюда не шлём</div>
        </div>
      </div>
      {/* В макете здесь были аватар, должность, язык и часовой пояс —
          этих полей на сервере нет, поэтому и в форме их нет */}

      <div className="row gap-8" style={{ marginTop: 20 }}>
        <button
          className="btn btn-primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              setProfile(await updateProfile({ name, phone }));
              ok('Профиль сохранён.');
            } catch (e) {
              fail(e, 'Не удалось сохранить профиль.');
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? 'Сохраняем…' : 'Сохранить'}
        </button>
      </div>
    </div>
  );
}

/* ── Компания ────────────────────────────────────────────────────────────── */
function CompanyCard({
  profile,
  setProfile,
  ok,
  fail,
}: {
  profile: Profile | null;
  setProfile: (p: Profile) => void;
  ok: OK;
  fail: FAIL;
}) {
  const [f, setF] = useState({ company_name: '', company_inn: '', company_kpp: '', company_address: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setF({
      company_name: profile.company.company_name ?? '',
      company_inn: profile.company.company_inn ?? '',
      company_kpp: profile.company.company_kpp ?? '',
      company_address: profile.company.company_address ?? '',
    });
  }, [profile]);

  if (!profile) return <div className="card">Загружаем…</div>;

  const field = (key: keyof typeof f, label: string, hint?: string) => (
    <div className="form-row">
      <label htmlFor={`c-${key}`}>{label}</label>
      <div>
        <input
          id={`c-${key}`}
          className="input"
          value={f[key]}
          onChange={(e) => setF({ ...f, [key]: e.target.value })}
        />
        {hint && <div className="hint">{hint}</div>}
      </div>
    </div>
  );

  return (
    <div className="card">
      {/* Секции «Компания» в макете нет вовсе, а поля на сервере есть */}
      <h3>Компания</h3>
      <div className="sub">Реквизиты подставляются в счета для юрлиц</div>
      {field('company_name', 'Организация')}
      {field('company_inn', 'ИНН')}
      {field('company_kpp', 'КПП', 'Только для организаций, у ИП его нет')}
      {field('company_address', 'Адрес')}
      <div className="row gap-8" style={{ marginTop: 20 }}>
        <button
          className="btn btn-primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              setProfile(await updateProfile(f));
              ok('Реквизиты сохранены.');
            } catch (e) {
              fail(e, 'Не удалось сохранить реквизиты.');
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? 'Сохраняем…' : 'Сохранить'}
        </button>
      </div>
    </div>
  );
}

/* ── Команда ─────────────────────────────────────────────────────────────── */
function TeamCard({ profile, ok, fail }: { profile: Profile | null; ok: OK; fail: FAIL }) {
  const [team, setTeam] = useState<TeamMember[] | null>(null);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'manager' | 'user'>('user');
  const [busy, setBusy] = useState(false);

  const reload = () => getTeam().then((r) => setTeam(r.users)).catch(() => setTeam([]));
  useEffect(() => {
    void reload();
  }, []);

  const isOwner = profile?.user.role === 'owner';

  return (
    <div className="card">
      {/* Секции «Команда» в макете нет, а API готов целиком */}
      <h3>Команда</h3>
      <div className="sub">Коллеги работают в общем кабинете компании. Количество ограничено тарифом</div>

      {team === null ? (
        'Загружаем…'
      ) : (
        team.map((m) => (
          <div className="sess-row" key={m.id}>
            <div className="sess-icon">{(m.name || m.email).slice(0, 1).toUpperCase()}</div>
            <div className="info">
              <div>{m.name || m.email}</div>
              <div className="meta">
                {m.email} · {m.status === 'invited' ? 'приглашение отправлено' : roleLabel(m.role)}
              </div>
            </div>
            {isOwner && m.role !== 'owner' && (
              <div className="row gap-8">
                <select
                  className="select"
                  style={{ width: 'auto' }}
                  value={m.role}
                  onChange={async (e) => {
                    try {
                      await changeUserRole(m.id, e.target.value as 'manager' | 'user');
                      await reload();
                      ok('Роль изменена.');
                    } catch (err) {
                      fail(err, 'Не удалось изменить роль.');
                    }
                  }}
                >
                  <option value="user">Только чтение</option>
                  <option value="manager">Менеджер</option>
                </select>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={async () => {
                    if (!confirm(`Убрать ${m.email} из команды?`)) return;
                    try {
                      await removeUser(m.id);
                      await reload();
                      ok('Участник удалён.');
                    } catch (err) {
                      fail(err, 'Не удалось удалить участника.');
                    }
                  }}
                >
                  Убрать
                </button>
              </div>
            )}
          </div>
        ))
      )}

      {isOwner && (
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          <b style={{ fontSize: 14 }}>Пригласить коллегу</b>
          <div className="row gap-8" style={{ marginTop: 10, flexWrap: 'wrap' }}>
            <input
              className="input"
              style={{ flex: 1, minWidth: 220 }}
              placeholder="почта коллеги"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <select
              className="select"
              style={{ width: 'auto' }}
              value={role}
              onChange={(e) => setRole(e.target.value as 'manager' | 'user')}
            >
              <option value="user">Только чтение</option>
              <option value="manager">Менеджер</option>
            </select>
            <button
              className="btn btn-primary"
              disabled={busy || !email}
              onClick={async () => {
                setBusy(true);
                try {
                  await inviteUser(email.trim(), role);
                  setEmail('');
                  await reload();
                  ok('Приглашение отправлено — коллеге придёт письмо со ссылкой.');
                } catch (e) {
                  fail(e, 'Не удалось отправить приглашение.');
                } finally {
                  setBusy(false);
                }
              }}
            >
              Пригласить
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function roleLabel(r: string) {
  return r === 'owner' ? 'владелец' : r === 'manager' ? 'менеджер' : 'только чтение';
}

/* ── Безопасность ────────────────────────────────────────────────────────── */
function SecurityCard({ profile, ok, fail }: { profile: Profile | null; ok: OK; fail: FAIL }) {
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [tfa, setTfa] = useState<TwoFactorStatus | null>(null);
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [code, setCode] = useState('');
  const [codes, setCodes] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = () => {
    void getSessions().then((r) => setSessions(r.sessions)).catch(() => setSessions([]));
    void get2faStatus().then(setTfa).catch(() => setTfa(null));
  };
  useEffect(reload, []);

  const isYandex = profile?.user.auth_provider === 'yandex';

  return (
    <>
      <div className="card">
        <h3>Пароль</h3>
        <div className="sub">После смены пароля сеансы на других устройствах завершатся</div>
        {isYandex ? (
          <p className="text-muted" style={{ fontSize: 13.5, margin: 0 }}>
            Вход выполняется через Яндекс ID — пароля у аккаунта нет. Задать его можно по ссылке
            «Забыли пароль?» на странице входа.
          </p>
        ) : (
          <>
            <div className="form-row">
              <label htmlFor="s-cur">Текущий пароль</label>
              <input
                id="s-cur"
                className="input"
                type="password"
                value={cur}
                onChange={(e) => setCur(e.target.value)}
              />
            </div>
            <div className="form-row">
              <label htmlFor="s-new">Новый пароль</label>
              <div>
                <input
                  id="s-new"
                  className="input"
                  type="password"
                  value={next}
                  onChange={(e) => setNext(e.target.value)}
                />
                <div className="hint">Минимум 8 символов</div>
              </div>
            </div>
            <button
              className="btn btn-primary"
              style={{ marginTop: 20 }}
              disabled={busy || !cur || !next}
              onClick={async () => {
                setBusy(true);
                try {
                  await changePassword(cur, next);
                  setCur('');
                  setNext('');
                  ok('Пароль изменён.');
                } catch (e) {
                  fail(e, 'Не удалось изменить пароль.');
                } finally {
                  setBusy(false);
                }
              }}
            >
              Сменить пароль
            </button>
          </>
        )}
      </div>

      {/* ⚠️ В макете второй фактор шёл «через SMS». SMS не существует —
          код приходит в Telegram */}
      <div className="card">
        <h3>Двухфакторная защита</h3>
        <div className="sub">Код подтверждения приходит в Telegram при каждом входе</div>

        {isYandex && (
          <p className="text-muted" style={{ fontSize: 13, marginTop: 0 }}>
            Вход через Яндекс ID не требует кода — Яндекс подтверждает личность сам.
          </p>
        )}

        {tfa === null ? (
          'Загружаем…'
        ) : tfa.enabled ? (
          <>
            <p style={{ fontSize: 14 }}>
              Включена. Кодов восстановления осталось: <b>{tfa.recovery_codes_left}</b>.
            </p>
            <div className="row gap-8">
              <input
                className="input"
                type="password"
                placeholder="пароль для отключения"
                value={cur}
                onChange={(e) => setCur(e.target.value)}
                style={{ maxWidth: 260 }}
              />
              <button
                className="btn btn-outline"
                disabled={busy || !cur}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await disable2fa(cur);
                    setCur('');
                    reload();
                    ok('Двухфакторная защита отключена.');
                  } catch (e) {
                    fail(e, 'Не удалось отключить.');
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Отключить
              </button>
            </div>
          </>
        ) : !tfa.can_enable ? (
          <p className="text-muted" style={{ fontSize: 13.5, margin: 0 }}>
            Сначала привяжите Telegram в разделе «Уведомления» — код второго фактора приходит туда.
          </p>
        ) : codes ? (
          <>
            <p style={{ fontSize: 14 }}>
              Готово. Сохраните коды восстановления — они показываются <b>один раз</b> и заменяют код
              из Telegram, если он недоступен.
            </p>
            <div className="token-box" style={{ background: 'var(--bg-alt)', color: 'var(--text)' }}>
              <code style={{ fontFamily: 'var(--mono)', fontSize: 13, lineHeight: 1.9 }}>
                {codes.join('   ')}
              </code>
            </div>
            <button className="btn btn-outline btn-sm" style={{ marginTop: 12 }} onClick={() => setCodes(null)}>
              Я сохранил коды
            </button>
          </>
        ) : (
          <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
            <button
              className="btn btn-outline"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await enable2fa();
                  ok('Код отправлен в Telegram — введите его ниже.');
                } catch (e) {
                  fail(e, 'Не удалось начать подключение.');
                } finally {
                  setBusy(false);
                }
              }}
            >
              Прислать код
            </button>
            <input
              className="input"
              placeholder="код из Telegram"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              style={{ maxWidth: 200 }}
            />
            <button
              className="btn btn-primary"
              disabled={busy || !code}
              onClick={async () => {
                setBusy(true);
                try {
                  const r = await confirm2fa(code.trim());
                  setCodes(r.recovery_codes);
                  setCode('');
                  reload();
                } catch (e) {
                  fail(e, 'Не удалось включить.');
                } finally {
                  setBusy(false);
                }
              }}
            >
              Включить
            </button>
          </div>
        )}
      </div>

      <div className="card">
        <h3>Активные сеансы</h3>
        <div className="sub">Где выполнен вход в этот аккаунт</div>
        {sessions === null ? (
          'Загружаем…'
        ) : (
          sessions.map((s) => (
            <div className="sess-row" key={s.id}>
              <div className="sess-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="3" y="4" width="18" height="12" rx="2" />
                  <path d="M8 20h8" />
                </svg>
              </div>
              <div className="info">
                <div>
                  {s.current ? 'Текущий сеанс' : 'Другое устройство'} · {s.ip}
                </div>
                <div className="meta">
                  {s.user_agent} · активность {timeAgo(s.last_seen_at)}
                </div>
              </div>
              {!s.current && (
                <button
                  className="btn btn-outline btn-sm"
                  onClick={async () => {
                    try {
                      await revokeSession(s.id);
                      reload();
                      ok('Сеанс завершён.');
                    } catch (e) {
                      fail(e, 'Не удалось завершить сеанс.');
                    }
                  }}
                >
                  Завершить
                </button>
              )}
            </div>
          ))
        )}
        {sessions && sessions.length > 1 && (
          <button
            className="btn btn-outline"
            style={{ marginTop: 16 }}
            onClick={async () => {
              try {
                const r = await logoutOtherSessions();
                reload();
                ok(`Завершено сеансов: ${r.revoked}.`);
              } catch (e) {
                fail(e, 'Не удалось завершить сеансы.');
              }
            }}
          >
            Выйти на всех других устройствах
          </button>
        )}
      </div>
    </>
  );
}

/* ── Уведомления ─────────────────────────────────────────────────────────── */
type NotifEvent = keyof NotificationSettings['matrix'];

const EVENTS: { key: NotifEvent; label: string; hint: string }[] = [
  { key: 'integration_errors', label: 'Ошибки интеграций', hint: 'Обмен не прошёл, сервис недоступен' },
  { key: 'limit_exceeded', label: 'Лимиты тарифа', hint: 'Приближение к лимиту и его исчерпание' },
  { key: 'reports', label: 'Отчёты', hint: 'Сводка за период' },
  { key: 'news', label: 'Новости продукта', hint: 'Новые механики и сервисы' },
];

function NotificationsCard({ ok, fail }: { ok: OK; fail: FAIL }) {
  const [s, setS] = useState<NotificationSettings | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getNotificationSettings().then(setS).catch(() => setS(null));
  }, []);

  // после открытия ссылки бот отвечает не сразу — опрашиваем статус
  useEffect(() => {
    if (!link) return;
    const t = setInterval(async () => {
      const r = await telegramStatus().catch(() => null);
      if (r?.linked) {
        setLink(null);
        setS(await getNotificationSettings().catch(() => s));
        ok('Telegram привязан.');
      }
    }, 2000);
    const stop = setTimeout(() => clearInterval(t), 120_000);
    return () => {
      clearInterval(t);
      clearTimeout(stop);
    };
  }, [link, ok, s]);

  if (!s) return <div className="card">Загружаем…</div>;

  const setMatrix = (event: NotifEvent, channel: 'email' | 'telegram', value: boolean) => {
    const next = {
      ...s,
      matrix: { ...s.matrix, [event]: { ...s.matrix[event], [channel]: value } },
    } as NotificationSettings;
    setS(next);
    void saveNotificationSettings(next).catch((e) => fail(e, 'Не удалось сохранить настройки.'));
  };

  return (
    <>
      <div className="card">
        <h3>Каналы</h3>
        <div className="sub">Куда доставлять уведомления</div>

        <div className="sess-row">
          <div className="sess-icon">@</div>
          <div className="info">
            <div>Почта</div>
            <div className="meta">{s.channels.email.address}</div>
          </div>
        </div>

        <div className="sess-row">
          <div className="sess-icon">TG</div>
          <div className="info">
            <div>Telegram</div>
            <div className="meta">
              {s.channels.telegram.linked
                ? `привязан ${s.channels.telegram.chat_id_masked ?? ''}`
                : 'не привязан'}
            </div>
          </div>
          {s.channels.telegram.linked ? (
            <button
              className="btn btn-outline btn-sm"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await unlinkTelegram();
                  setS(await getNotificationSettings());
                  ok('Telegram отвязан.');
                } catch (e) {
                  // сервер запрещает отвязку при включённой 2FA
                  fail(e, 'Не удалось отвязать Telegram.');
                } finally {
                  setBusy(false);
                }
              }}
            >
              Отвязать
            </button>
          ) : (
            <button
              className="btn btn-primary btn-sm"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const r = await linkTelegram();
                  setLink(r.deep_link);
                  window.open(r.deep_link, '_blank', 'noopener');
                } catch (e) {
                  fail(e, 'Не удалось создать ссылку на бота.');
                } finally {
                  setBusy(false);
                }
              }}
            >
              Подключить
            </button>
          )}
        </div>
        {link && (
          <p className="text-muted" style={{ fontSize: 13, marginBottom: 0 }}>
            Откройте бота и нажмите «Старт». Как только это произойдёт, блок обновится сам.
          </p>
        )}
      </div>

      <div className="card">
        <h3>О чём сообщать</h3>
        {/* ⚠️ Колонки SMS нет вовсе: SMS на платформе не существует */}
        <div className="sub">Почта и Telegram — других каналов у платформы нет</div>
        <table className="notif-matrix">
          <thead>
            <tr>
              <th>Событие</th>
              <th>Почта</th>
              <th>Telegram</th>
            </tr>
          </thead>
          <tbody>
            {EVENTS.map((ev) => (
              <tr key={ev.key}>
                <td>
                  {ev.label}
                  <div className="hint">{ev.hint}</div>
                </td>
                {(['email', 'telegram'] as const).map((ch) => (
                  <td key={ch}>
                    <button
                      type="button"
                      aria-label={`${ev.label}: ${ch}`}
                      aria-pressed={Boolean(s.matrix[ev.key]?.[ch])}
                      className={`toggle${s.matrix[ev.key]?.[ch] ? ' on' : ''}`}
                      disabled={ch === 'telegram' && !s.channels.telegram.linked}
                      onClick={() => setMatrix(ev.key, ch, !s.matrix[ev.key]?.[ch])}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ── Данные и приватность ────────────────────────────────────────────────── */
function PrivacyCard({ ok, fail }: { ok: OK; fail: FAIL }) {
  const [reqs, setReqs] = useState<PrivacyRequest[] | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = () => getPrivacyRequests().then((r) => setReqs(r.requests)).catch(() => setReqs([]));
  useEffect(() => {
    void reload();
  }, []);

  // тип обращения из контракта: 'deletion', а не 'delete'
  const send = async (type: PrivacyRequestType, confirmText?: string) => {
    if (confirmText && !confirm(confirmText)) return;
    setBusy(true);
    try {
      const r = await createPrivacyRequest(type);
      await reload();
      ok(`Обращение принято, номер ${r.ref}. Ответим в течение ${r.response_due_days} дней.`);
    } catch (e) {
      fail(e, 'Не удалось отправить обращение.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="card">
        {/* Раздела в макете не было; механика появилась пакетом S8 */}
        <h3>Ваши данные</h3>
        <div className="sub">Обращения исполняет администратор, срок ответа — 30 дней</div>
        <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
          <button className="btn btn-outline" disabled={busy} onClick={() => send('export')}>
            Выгрузить мои данные
          </button>
          <button
            className="btn btn-danger-outline"
            disabled={busy}
            onClick={() =>
              send(
                'deletion',
                'Запросить удаление аккаунта? Доступ прекратится, данные будут стёрты через 30 дней.',
              )
            }
          >
            Удалить аккаунт
          </button>
        </div>
        <p className="text-muted" style={{ fontSize: 12, marginTop: 14, marginBottom: 0 }}>
          Платежи и записи журнала по закону хранятся дольше: их удалить нельзя, но они обезличиваются.
        </p>
      </div>

      <div className="card">
        <h3>История обращений</h3>
        {reqs === null ? (
          'Загружаем…'
        ) : reqs.length === 0 ? (
          <div className="lk-empty" style={{ padding: '12px 0', textAlign: 'left' }}>
            Обращений пока не было.
          </div>
        ) : (
          reqs.map((r) => (
            <div className="sess-row" key={r.id}>
              <div className="info">
                <div>{r.type === 'export' ? 'Выгрузка данных' : 'Удаление аккаунта'}</div>
                <div className="meta">
                  {r.ref} · {timeAgo(r.created_at)} · {r.status}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <p className="text-muted" style={{ fontSize: 12, marginTop: 16 }}>
        Как мы обращаемся с данными — в <Link href="/privacy">политике конфиденциальности</Link>.
      </p>
    </>
  );
}
