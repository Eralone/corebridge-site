'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ApiError } from '@/lib/api/client';
import { requestPasswordReset } from '@/lib/api/auth';
import { Alert, TextField } from '@/components/auth/fields';

/**
 * Восстановление пароля. Оба состояния из макета — ввод адреса и «проверьте
 * почту» — здесь реальные шаги одной формы. В design-source/forgot-password.html
 * второе состояние показано ниже первого внутри блока .variants: это макет
 * состояния, а не секция экрана, поэтому вместе они не выводятся.
 *
 * Сервер отвечает 202 всегда, даже если такой почты нет, — иначе форма
 * превращается в способ проверять чужие адреса. Текст это учитывает.
 */
export function ForgotForm() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await requestPasswordReset(email.trim());
      setSent(true);
    } catch (err) {
      setError(
        err instanceof ApiError && err.code === 'TOO_MANY_REQUESTS'
          ? 'Слишком много запросов. Подождите немного и попробуйте снова.'
          : err instanceof ApiError && err.code === 'INVALID_EMAIL'
            ? 'Проверьте адрес почты.'
            : 'Не удалось отправить письмо. Попробуйте ещё раз.',
      );
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <>
        <div className="big-icon success">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>
        <h1>Проверьте почту</h1>
        <p className="sub">
          Если такой аккаунт у нас есть, мы отправили инструкции на{' '}
          <strong style={{ color: 'var(--text)' }}>{email.trim()}</strong>. Ссылка действительна 60 минут.
        </p>

        {error && <Alert>{error}</Alert>}

        <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-muted)', marginTop: 16 }}>
          Не пришло письмо?{' '}
          <button type="button" className="link-btn" disabled={busy} onClick={() => submit()}>
            Отправить повторно
          </button>
        </p>
        <p style={{ textAlign: 'center', marginTop: 16 }}>
          <Link href="/login" style={{ fontSize: 14 }}>
            ← Вернуться к входу
          </Link>
        </p>
      </>
    );
  }

  return (
    <>
      <Link href="/login" className="back-link">
        ← Вернуться к входу
      </Link>
      <div className="big-icon">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="3" y="6" width="18" height="12" rx="2" />
          <path d="m3 8 9 6 9-6" />
        </svg>
      </div>
      <h1>Восстановление пароля</h1>
      <p className="sub">Введите email, и мы пришлём ссылку для сброса пароля</p>

      {error && <Alert>{error}</Alert>}

      <form onSubmit={submit} noValidate>
        <TextField
          label="Email"
          type="email"
          placeholder="your@email.com"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={busy || !email}>
          {busy ? 'Отправляем…' : 'Отправить инструкции'}
        </button>
      </form>
    </>
  );
}
