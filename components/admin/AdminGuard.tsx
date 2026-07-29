'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { ApiError } from '@/lib/api/client';
import { adminLogin, adminVerifyTotp, getAdminMe } from '@/lib/api/admin';
import type { AdminMe } from '@/lib/contracts/admin';

/**
 * Вход в админку и защита её экранов.
 *
 * ⚠️ Почему проверка здесь, а не в `middleware.ts`, как у ЛК. Сервер ставит
 * cookie `admin_session_id` с `path=/admin`. Интерфейс живёт в корне
 * (`/`, `/users`, …), поэтому на запрос **страницы** браузер эту cookie
 * не отправляет — в middleware её просто нет, проверять там нечего.
 * На запросы к API (`/admin/*`) cookie уходит, поэтому вход проверяем
 * из браузера через `GET /admin/auth/me`.
 *
 * Практическое следствие: экраны админки — клиентские. Данных они не содержат
 * до ответа `/admin/auth/me`, так что «подсмотреть» через исходник страницы нечего.
 */

const AdminContext = createContext<AdminMe | null>(null);
export const useAdmin = () => useContext(AdminContext);

export function AdminGuard({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<AdminMe | null>(null);
  const [checked, setChecked] = useState(false);

  const check = useCallback(() => {
    getAdminMe()
      .then(setMe)
      .catch(() => setMe(null))
      .finally(() => setChecked(true));
  }, []);

  useEffect(check, [check]);

  if (!checked) {
    return (
      <div className="adm-login">
        <div className="adm-login-card">
          <p className="text-muted" style={{ margin: 0 }}>Проверяем доступ…</p>
        </div>
      </div>
    );
  }

  if (!me) return <AdminLogin onDone={check} />;

  return <AdminContext.Provider value={me}>{children}</AdminContext.Provider>;
}

function AdminLogin({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<{ token: string; requiresTotp: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (!step) {
        const r = await adminLogin(email, password);
        if (r.requires_totp) {
          setStep({ token: r.step_token, requiresTotp: true });
          return;
        }
        // ⚠️ Сессия выдаётся только на шаге 2, а маршрут отвергает пустой код
        // ещё до проверки. При выключенном TOTP сервер код игнорирует, но поле
        // требует непустым — отсюда заглушка. Чинится на сервере, промт S13 §5.
        await adminVerifyTotp(r.step_token, '000000');
      } else {
        await adminVerifyTotp(step.token, code.trim());
      }
      onDone();
    } catch (err) {
      setError(loginError(err, step !== null));
      setBusy(false);
    }
  }

  return (
    <div className="adm-login">
      <form className="adm-login-card" onSubmit={submit}>
        <span className="brand">
          <span className="logo" aria-hidden="true" />
          <span>CoreBridge</span>
        </span>
        <span className="admin-badge">● ADMIN PANEL</span>
        <h1>{step ? 'Код из приложения' : 'Вход для сотрудников'}</h1>
        <p className="text-muted" style={{ fontSize: 13, marginTop: 0 }}>
          {step
            ? 'Введите шестизначный код из приложения-аутентификатора.'
            : 'Панель управления платформой. Доступ только по списку IP.'}
        </p>

        {error && <div className="lk-error">{error}</div>}

        {step ? (
          <div className="field">
            <label htmlFor="adm-code">Код подтверждения</label>
            <input
              id="adm-code"
              className="input"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoFocus
            />
          </div>
        ) : (
          <>
            <div className="field">
              <label htmlFor="adm-email">Рабочая почта</label>
              <input
                id="adm-email"
                className="input"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="adm-pass">Пароль</label>
              <input
                id="adm-pass"
                className="input"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </>
        )}

        <button className="btn btn-primary btn-block" disabled={busy || (step ? code.trim().length === 0 : false)}>
          {busy ? 'Проверяем…' : step ? 'Подтвердить' : 'Войти'}
        </button>
      </form>
    </div>
  );
}

/** Сервер отвечает одинаковым `Unauthorized` на все случаи — намеренно, чтобы
 *  перебором нельзя было выяснить, кто заведён. Формулировку подбираем по шагу. */
function loginError(e: unknown, onTotpStep: boolean): string {
  if (e instanceof ApiError && e.status === 401) {
    return onTotpStep
      ? 'Код не подошёл. Проверьте время на устройстве и попробуйте ещё раз.'
      : 'Почта или пароль не подошли.';
  }
  if (e instanceof ApiError && e.status === 403) {
    return 'Доступ с этого IP закрыт. Панель открыта только с разрешённых адресов.';
  }
  return 'Не удалось войти. Попробуйте позже.';
}
