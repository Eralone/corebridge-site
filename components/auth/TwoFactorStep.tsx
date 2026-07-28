'use client';

import { useState, type FormEvent } from 'react';
import { ApiError } from '@/lib/api/client';
import { loginTwoFactor, resendTwoFactor } from '@/lib/api/auth';
import { needsTwoFactor } from '@/lib/contracts/auth';
import { Alert } from './fields';

/**
 * Ввод кода второго фактора. Экрана в макете нет — 2FA появилась пакетом S8.
 *
 * Используется в двух местах: при обычном входе и после сброса пароля.
 * Сброс пароля не должен обходить второй фактор, иначе доступа к почте
 * хватало бы, чтобы войти в чужой кабинет, — поэтому шаг общий.
 */
export function TwoFactorStep({
  challengeId,
  onDone,
  onBack,
  messageFor,
}: {
  challengeId: string;
  /** Вызывается, когда сессия получена. used_recovery_code — вошли резервным кодом */
  onDone: (usedRecoveryCode: boolean) => void;
  /** Назад к вводу почты. Если null — возврата нет (например, после сброса пароля) */
  onBack?: () => void;
  messageFor: (e: unknown) => string;
}) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dead, setDead] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setResent(false);
    setBusy(true);
    try {
      const res = await loginTwoFactor(challengeId, code.trim());
      onDone(!needsTwoFactor(res) && res.used_recovery_code === true);
    } catch (err) {
      setError(messageFor(err));
      // истёкший challenge второй раз не оживить — код нужно запрашивать заново
      if (err instanceof ApiError && err.code === 'CHALLENGE_EXPIRED') setDead(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {onBack && (
        <button type="button" className="back-link" onClick={onBack}>
          ← Ввести другую почту
        </button>
      )}
      <h1>Код подтверждения</h1>
      <p className="sub">Мы отправили шестизначный код в Telegram на привязанный аккаунт.</p>

      {error && <Alert>{error}</Alert>}
      {resent && !error && <Alert kind="success">Новый код отправлен.</Alert>}

      <form onSubmit={onSubmit} noValidate>
        <div className="field">
          <label htmlFor="code2fa">Код из Telegram</label>
          <input
            id="code2fa"
            className="input code-input"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={9}
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            disabled={dead}
            autoFocus
          />
          <div className="pwd-hint">
            Код действует 5 минут. Вместо него подойдёт код восстановления вида a1b2-c3d4.
          </div>
        </div>

        <button
          type="submit"
          className="btn btn-primary btn-block btn-lg"
          disabled={busy || !code || dead}
        >
          {busy ? 'Проверяем…' : 'Подтвердить'}
        </button>
      </form>

      <p className="switch-link">
        Не пришёл код?{' '}
        <button
          type="button"
          className="link-btn"
          disabled={busy || dead}
          onClick={async () => {
            setError(null);
            try {
              await resendTwoFactor(challengeId);
              setResent(true);
            } catch (err) {
              setError(messageFor(err));
            }
          }}
        >
          Отправить повторно
        </button>
      </p>
    </>
  );
}

/** Разбор кодов ошибок второго фактора — одинаковый на входе и после сброса пароля */
export function twoFactorMessage(e: unknown): string {
  if (!(e instanceof ApiError)) return 'Не удалось связаться с сервером. Попробуйте ещё раз.';
  switch (e.code) {
    case 'INVALID_CODE': {
      const left = e.details?.attempts_left;
      // без этого числа блокировка после пятой попытки выглядит внезапной
      return typeof left === 'number'
        ? `Неверный код. Осталось попыток: ${left}.`
        : 'Неверный код.';
    }
    case 'CHALLENGE_EXPIRED':
      return 'Срок действия кода истёк. Начните вход заново, чтобы получить новый.';
    case 'TOO_MANY_ATTEMPTS':
    case 'TOO_MANY_REQUESTS':
      return 'Слишком много попыток. Подождите немного и попробуйте снова.';
    default:
      return 'Не удалось подтвердить код. Попробуйте ещё раз.';
  }
}
