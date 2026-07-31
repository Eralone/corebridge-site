'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ApiError } from '@/lib/api/client';
import { login, sendMagicLink } from '@/lib/api/auth';
import { needsTwoFactor } from '@/lib/contracts/auth';
import { AuthTabs, BackLink } from '@/components/auth/AuthSplit';
import { Alert, PasswordField, TextField, YandexButton } from '@/components/auth/fields';
import { TwoFactorStep, twoFactorMessage } from '@/components/auth/TwoFactorStep';
import { forgetSessionState } from '@/lib/auth/session-probe';

/**
 * Вход. Отличия от design-source/login.html — по сути механики, не вёрстки:
 *
 * · «Войти через Google» → **Яндекс ID**: Google удалён с сервера (404),
 *   регистрация через иностранные сервисы в РФ недоступна;
 * · добавлен **вход по ссылке из письма** — механика на сервере есть
 *   (`POST /lk/auth/magic-link`), в макете кнопки не было;
 * · добавлен второй шаг с кодом из Telegram — в макете экрана 2FA нет;
 * · убран чекбокс «Запомнить меня»: у `POST /lk/auth/login` такого параметра
 *   нет, срок сессии задаёт сервер. Показывать переключатель, который ничего
 *   не делает, хуже, чем не показывать;
 * · убран отзыв «Игорь П., Ритейл-М» из панели — выдуманный.
 */

/** Коды ошибок сервера человеческим языком */
function messageFor(e: unknown): string {
  if (!(e instanceof ApiError)) return 'Не удалось связаться с сервером. Попробуйте ещё раз.';
  switch (e.code) {
    // сервер отвечает одинаково на неверную почту и неверный пароль —
    // проверено вживую: код INVALID_CREDENTIALS, а не UNAUTHORIZED
    case 'INVALID_CREDENTIALS':
    case 'UNAUTHORIZED':
      return 'Неверная почта или пароль.';
    case 'MISSING_FIELDS':
      return 'Заполните почту и пароль.';
    case 'OAUTH_ACCOUNT':
      return 'Этот аккаунт заведён через Яндекс ID — войдите через него или задайте пароль по ссылке «Забыли пароль?».';
    case 'TENANT_BLOCKED':
      return 'Доступ компании приостановлен. Напишите на info@corebridge.ru — разберёмся.';
    case 'TENANT_PENDING_DELETION':
      return 'Аккаунт помечен на удаление. Если это ошибка, напишите на info@corebridge.ru до конца срока хранения.';
    case 'TOO_MANY_REQUESTS':
    case 'TOO_MANY_ATTEMPTS':
      return 'Слишком много попыток. Подождите немного и попробуйте снова.';
    default:
      return 'Не удалось войти. Попробуйте ещё раз.';
  }
}

/** Ошибка, с которой middleware.ts увёл на вход */
function messageForGuard(code: string): string | null {
  switch (code) {
    case 'TENANT_BLOCKED':
      return 'Доступ компании приостановлен. Напишите на info@corebridge.ru — разберёмся.';
    case 'TENANT_PENDING_DELETION':
      return 'Аккаунт помечен на удаление, вход в кабинет закрыт.';
    default:
      return null;
  }
}

/**
 * Куда безопасно вернуть человека после входа. Только путь внутри сайта:
 * `//чужой.сайт` браузер считает абсолютным адресом, поэтому одной проверки
 * на ведущий «/» мало.
 */
function safeNext(next: string | null): string | null {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return null;
  return next;
}

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next');
  const guardError = params.get('error');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(guardError ? messageForGuard(guardError) : null);
  const [busy, setBusy] = useState(false);

  // второй фактор: сам экран ввода кода — в TwoFactorStep
  const [challenge, setChallenge] = useState<string | null>(null);

  // вход по ссылке из письма
  const [magicSent, setMagicSent] = useState(false);

  /** Сервер после входа ведёт на /dashboard; ?next= возвращает туда, куда шли */
  function goIn() {
    forgetSessionState(); // шапка публичных страниц помнит ответ на вкладку
    router.push(safeNext(next) ?? '/dashboard');
    router.refresh();
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await login(email.trim(), password);
      if (needsTwoFactor(res)) {
        setChallenge(res.challenge_id);
      } else {
        goIn();
      }
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setBusy(false);
    }
  }

  async function onMagicLink() {
    setError(null);
    if (!email.trim()) {
      setError('Укажите почту — на неё придёт ссылка для входа.');
      return;
    }
    setBusy(true);
    try {
      await sendMagicLink(email.trim());
      setMagicSent(true);
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setBusy(false);
    }
  }

  // ── Шаг 2: код из Telegram ───────────────────────────────────────────────
  if (challenge) {
    return (
      <TwoFactorStep
        challengeId={challenge}
        messageFor={twoFactorMessage}
        onBack={() => setChallenge(null)}
        onDone={(usedRecovery) => {
          // сколько кодов восстановления осталось, покажем уже в кабинете:
          // иначе человек молча израсходует все десять
          if (usedRecovery) sessionStorage.setItem('cb_recovery_code_used', '1');
          goIn();
        }}
      />
    );
  }

  // ── Шаг 1: почта и пароль ────────────────────────────────────────────────
  return (
    <>
      <BackLink href="/">← На главную</BackLink>
      <AuthTabs active="login" />
      <h1>Войти в аккаунт</h1>
      <p className="sub">Рады снова вас видеть в CoreBridge</p>

      {error && <Alert>{error}</Alert>}
      {magicSent && (
        <Alert kind="success">
          Если такая почта у нас есть, ссылка для входа уже отправлена. Она действует ограниченное время.
        </Alert>
      )}

      <form onSubmit={onSubmit} autoComplete="on" noValidate>
        <TextField
          label="Email"
          type="email"
          placeholder="your@email.com"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <PasswordField
          label="Пароль"
          placeholder="Введите пароль"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <div className="row-between">
          <span />
          <Link href="/forgot-password" style={{ fontSize: 14 }}>
            Забыли пароль?
          </Link>
        </div>

        <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={busy}>
          {busy ? 'Входим…' : 'Войти'}
        </button>

        <div className="divider">или</div>

        <YandexButton label="Войти через Яндекс ID" />

        <button
          type="button"
          className="btn btn-ghost btn-block"
          style={{ marginTop: 10 }}
          onClick={onMagicLink}
          disabled={busy}
        >
          Прислать ссылку для входа
        </button>

        <p className="switch-link">
          Нет аккаунта?{' '}
          <Link href="/register" style={{ fontWeight: 600 }}>
            Зарегистрироваться
          </Link>
        </p>
      </form>
    </>
  );
}
