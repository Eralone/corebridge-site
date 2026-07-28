'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ApiError } from '@/lib/api/client';
import { resetPassword } from '@/lib/api/auth';
import { Alert, PasswordField, PasswordStrength } from '@/components/auth/fields';
import { TwoFactorStep, twoFactorMessage } from '@/components/auth/TwoFactorStep';

/**
 * Новый пароль по ссылке из письма.
 *
 * ⚠️ Главное отличие от макета: при включённой двухфакторке сервер меняет
 * пароль, но **сессию не выдаёт** — возвращает challenge. Иначе доступа к
 * почте хватало бы, чтобы обойти второй фактор. Поэтому после успешного
 * сброса проверяем twofactor_required и ведём на тот же экран ввода кода,
 * что и при обычном входе.
 */
export function ResetForm() {
  const router = useRouter();
  const token = useSearchParams().get('token') ?? '';

  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [challenge, setChallenge] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== repeat) {
      setError('Пароли не совпадают.');
      return;
    }
    setBusy(true);
    try {
      const res = await resetPassword(token, password);
      if (res.twofactor_required && res.challenge_id) {
        setChallenge(res.challenge_id);
      } else {
        router.push('/dashboard');
        router.refresh();
      }
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setBusy(false);
    }
  }

  if (challenge) {
    return (
      <TwoFactorStep
        challengeId={challenge}
        messageFor={twoFactorMessage}
        onDone={() => {
          router.push('/dashboard');
          router.refresh();
        }}
      />
    );
  }

  if (!token) {
    return (
      <>
        <h1>Ссылка неполная</h1>
        <p className="sub">
          В адресе нет кода восстановления. Откройте ссылку из письма целиком или запросите новую.
        </p>
        <Link href="/forgot-password" className="btn btn-primary btn-block btn-lg">
          Запросить новую ссылку
        </Link>
      </>
    );
  }

  return (
    <>
      <Link href="/login" className="back-link">
        ← Вернуться к входу
      </Link>
      <h1>Новый пароль</h1>
      <p className="sub">Придумайте новый пароль — минимум 8 символов</p>

      {error && <Alert>{error}</Alert>}

      <form onSubmit={onSubmit} noValidate>
        <div className="field">
          <PasswordField
            label="Новый пароль"
            placeholder="Новый пароль"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <PasswordStrength value={password} />
        </div>
        <PasswordField
          label="Подтвердить пароль"
          placeholder="Повторите пароль"
          autoComplete="new-password"
          value={repeat}
          onChange={(e) => setRepeat(e.target.value)}
          required
        />
        <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={busy}>
          {busy ? 'Сохраняем…' : 'Сохранить пароль'}
        </button>
      </form>
      <p className="pwd-hint" style={{ marginTop: 14 }}>
        После смены пароля вход на других устройствах будет прекращён.
      </p>
    </>
  );
}

function messageFor(e: unknown): string {
  if (!(e instanceof ApiError)) return 'Не удалось связаться с сервером. Попробуйте ещё раз.';
  switch (e.code) {
    case 'TOKEN_INVALID':
      return 'Ссылка недействительна. Запросите восстановление пароля заново.';
    case 'TOKEN_EXPIRED':
      return 'Срок действия ссылки истёк — она живёт 60 минут. Запросите новую.';
    case 'WEAK_PASSWORD': {
      const min = e.details?.min_length;
      return `Пароль слишком простой. Минимум ${typeof min === 'number' ? min : 8} символов.`;
    }
    case 'MISSING_FIELDS':
      return 'Введите новый пароль.';
    default:
      return 'Не удалось сохранить пароль. Попробуйте ещё раз.';
  }
}
