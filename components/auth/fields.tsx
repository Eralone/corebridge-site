'use client';

import { useId, useState, type InputHTMLAttributes } from 'react';
import { markOAuthStart } from '@/lib/auth/oauth-return';

/** Поле пароля с глазом-переключателем. Разметка из login.html */
export function PasswordField({
  label,
  ...props
}: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  const [shown, setShown] = useState(false);

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="input-group">
        <input
          id={id}
          className="input"
          type={shown ? 'text' : 'password'}
          autoComplete="current-password"
          {...props}
        />
        <button
          type="button"
          className="eye"
          aria-label={shown ? 'Скрыть пароль' : 'Показать пароль'}
          aria-pressed={shown}
          onClick={() => setShown((v) => !v)}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" />
            <circle cx="12" cy="12" r="3" />
            {shown && <path d="M3 3l18 18" />}
          </svg>
        </button>
      </div>
    </div>
  );
}

export function TextField({
  label,
  ...props
}: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} className="input" {...props} />
    </div>
  );
}

export type Strength = 'weak' | 'medium' | 'strong';

/**
 * Оценка пароля для полоски из макета. Сервер требует только длину от 8
 * (`WEAK_PASSWORD { min_length: 8 }`), поэтому это подсказка, а не запрет:
 * форма не мешает отправить пароль, который сервер примет.
 */
export function strengthOf(password: string): Strength | null {
  if (!password) return null;
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-zа-я]/.test(password) && /[A-ZА-Я]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^\p{L}\d]/u.test(password)) score++;

  if (password.length < 8 || score <= 2) return 'weak';
  return score <= 3 ? 'medium' : 'strong';
}

const STRENGTH_LABEL: Record<Strength, string> = {
  weak: 'Слабый пароль',
  medium: 'Средняя надёжность пароля',
  strong: 'Надёжный пароль',
};

export function PasswordStrength({ value }: { value: string }) {
  const s = strengthOf(value);
  return (
    <>
      <div className={`pwd-strength${s ? ` ${s}` : ''}`} aria-label={s ? STRENGTH_LABEL[s] : undefined}>
        <span />
        <span />
        <span />
      </div>
      <div className="pwd-hint">
        {value && value.length < 8
          ? 'Минимум 8 символов'
          : 'Используйте буквы, цифры и спецсимволы для надёжного пароля'}
      </div>
    </>
  );
}

export function Alert({
  kind = 'error',
  children,
}: {
  kind?: 'error' | 'info' | 'success';
  children: React.ReactNode;
}) {
  return (
    <div className={`auth-alert auth-alert--${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}

/**
 * Кнопка входа через Яндекс ID — вместо кнопки Google из макета.
 *
 * Осталась обычной ссылкой: без JS переход всё равно работает. Перед уходом
 * помечаем попытку — на возврате она нужна, чтобы починить потерянную сессию,
 * см. lib/auth/oauth-return.ts.
 */
export function YandexButton({ label }: { label: string }) {
  return (
    <a
      href="/lk/auth/yandex"
      className="btn btn-outline btn-block oauth-btn"
      onClick={() => markOAuthStart()}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="12" fill="#FC3F1D" />
        <path
          d="M13.2 19h2.2V5h-3.2c-3.2 0-5 1.6-5 4.1 0 2 .9 3.2 2.6 4.3L6.9 19h2.4l3.2-5.5-1.1-.7c-1.3-.9-1.9-1.6-1.9-3 0-1.3.9-2.2 2.5-2.2h1.2V19z"
          fill="#fff"
        />
      </svg>
      {label}
    </a>
  );
}
