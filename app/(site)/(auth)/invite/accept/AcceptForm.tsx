'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ApiError } from '@/lib/api/client';
import { acceptInvite } from '@/lib/api/auth';
import { Alert, PasswordField, PasswordStrength, TextField } from '@/components/auth/fields';

/**
 * Приглашение в команду. Макета нет — верстаем по образцу остальных экранов
 * авторизации.
 *
 * ⚠️ Сервер шлёт в письме ссылку `${LK_BASE_URL}/lk/invite/accept?token=…`,
 * а весь префикс `/lk/*` nginx отдаёт API — ссылка приводила в 404 (проверено).
 * Чинится на нашей стороне: в vhost заведено точное совпадение
 * `location = /lk/invite/accept` на Next.js, а middleware.ts переписывает
 * этот путь на /invite/accept. Бэкенд менять не нужно.
 */
export function AcceptForm({ token }: { token: string | null }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!token) {
    return (
      <>
        <h1>Ссылка неполная</h1>
        <p className="sub">
          В адресе нет кода приглашения. Откройте ссылку из письма целиком или попросите коллегу
          выслать приглашение заново.
        </p>
        <Link href="/login" className="btn btn-outline btn-block">
          К входу
        </Link>
      </>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== repeat) {
      setError('Пароли не совпадают.');
      return;
    }
    setBusy(true);
    try {
      await acceptInvite({ token: token!, name: name.trim(), password });
      // сервер ставит cookie сразу — человек попадает в кабинет уже участником
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1>Присоединиться к команде</h1>
      <p className="sub">Задайте имя и пароль — и попадёте в общий кабинет компании</p>

      {error && <Alert>{error}</Alert>}

      <form onSubmit={onSubmit} noValidate>
        <TextField
          label="Имя"
          type="text"
          placeholder="Как к вам обращаться"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <div className="field">
          <PasswordField
            label="Пароль"
            placeholder="Минимум 8 символов"
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
          {busy ? 'Присоединяемся…' : 'Присоединиться'}
        </button>
      </form>
    </>
  );
}

function messageFor(e: unknown): string {
  if (!(e instanceof ApiError)) return 'Не удалось связаться с сервером. Попробуйте ещё раз.';
  switch (e.code) {
    case 'INVITE_INVALID':
      return 'Приглашение недействительно — возможно, им уже воспользовались. Попросите выслать новое.';
    case 'INVITE_EXPIRED':
      return 'Срок действия приглашения истёк. Попросите коллегу выслать новое.';
    case 'WEAK_PASSWORD': {
      const min = e.details?.min_length;
      return `Пароль слишком простой. Минимум ${typeof min === 'number' ? min : 8} символов.`;
    }
    case 'MISSING_FIELDS':
      return 'Заполните имя и пароль.';
    default:
      return 'Не удалось принять приглашение. Попробуйте ещё раз.';
  }
}
