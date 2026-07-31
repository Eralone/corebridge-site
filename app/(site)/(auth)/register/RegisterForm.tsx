'use client';

import { useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ApiError } from '@/lib/api/client';
import { register } from '@/lib/api/auth';
import { forgetSessionState } from '@/lib/auth/session-probe';
import { AuthTabs, BackLink } from '@/components/auth/AuthSplit';
import {
  Alert,
  PasswordField,
  PasswordStrength,
  TextField,
  YandexButton,
} from '@/components/auth/fields';

/**
 * Регистрация. Отличия от design-source/register.html:
 *
 * · «Зарегистрироваться через Google» → **Яндекс ID**;
 * · тексты панели приведены к реальному тарифу: пробный **бессрочный**,
 *   лимит **500 операций в месяц**, а не «30 дней» и «5 операций в сутки»;
 * · убрано «Уже с нами: 1 247 компаний» — цифра выдуманная.
 *
 * Сервер ставит cookie сразу на 201 — человек попадает в кабинет, не
 * подтверждая почту. Подтверждение отдельным письмом, экран /verify-email.
 */

function messageFor(e: unknown): string {
  if (!(e instanceof ApiError)) return 'Не удалось связаться с сервером. Попробуйте ещё раз.';
  switch (e.code) {
    case 'EMAIL_EXISTS':
      return 'Такая почта уже зарегистрирована. Войдите или восстановите пароль.';
    case 'INVALID_EMAIL':
      return 'Проверьте адрес почты.';
    case 'WEAK_PASSWORD': {
      const min = e.details?.min_length;
      return `Пароль слишком простой. Минимум ${typeof min === 'number' ? min : 8} символов.`;
    }
    case 'MISSING_FIELDS':
      return 'Заполните почту и пароль.';
    case 'TOO_MANY_REQUESTS':
      return 'Слишком много попыток регистрации. Подождите немного и попробуйте снова.';
    default:
      return 'Не удалось зарегистрироваться. Попробуйте ещё раз.';
  }
}

export function RegisterForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const alertRef = useRef<HTMLDivElement>(null);
  const agreeRef = useRef<HTMLInputElement>(null);

  /**
   * Кнопка внизу длинной формы, сообщение об ошибке — вверху. Если человек
   * его не заметил, нажатие выглядит как «ничего не произошло». Поэтому
   * подводим к сообщению и ставим курсор на то поле, из-за которого не пустили.
   */
  function reject(message: string, focus?: HTMLElement | null) {
    setError(message);
    requestAnimationFrame(() => {
      alertRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      focus?.focus({ preventScroll: true });
    });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== repeat) {
      reject('Пароли не совпадают.');
      return;
    }
    if (password.length < 8) {
      reject('Пароль должен быть не короче 8 символов.');
      return;
    }
    if (!agreed) {
      reject(
        'Чтобы продолжить, примите оферту и политику конфиденциальности.',
        agreeRef.current,
      );
      return;
    }

    setBusy(true);
    try {
      await register({ email: email.trim(), password, name: name.trim() || undefined });
      // cookie сервер поставил сам — идём в кабинет
      forgetSessionState(); // шапка публичных страниц помнит ответ на вкладку
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      reject(messageFor(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <BackLink href="/">← На главную</BackLink>
      <AuthTabs active="register" />
      <h1>Создать аккаунт</h1>
      <p className="sub">Начните использовать интеграции 1С за 2 минуты</p>

      {error && (
        <div ref={alertRef}>
          <Alert>{error}</Alert>
        </div>
      )}

      <form onSubmit={onSubmit} autoComplete="on" noValidate>
        <TextField
          label="Имя"
          type="text"
          placeholder="Как к вам обращаться"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <TextField
          label="Рабочий email"
          type="email"
          placeholder="you@company.ru"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
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

        <label className="cb" style={{ margin: '14px 0 20px' }}>
          <input
            ref={agreeRef}
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
          />
          <span>
            Я соглашаюсь с <Link href="/oferta" target="_blank">офертой</Link>,{' '}
            <Link href="/terms" target="_blank">условиями использования</Link> и{' '}
            <Link href="/privacy" target="_blank">политикой конфиденциальности</Link>
          </span>
        </label>

        <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={busy}>
          {busy ? 'Создаём аккаунт…' : 'Зарегистрироваться'}
        </button>

        <div className="divider">или</div>

        <YandexButton label="Зарегистрироваться через Яндекс ID" />

        <p className="switch-link">
          Уже есть аккаунт?{' '}
          <Link href="/login" style={{ fontWeight: 600 }}>
            Войти
          </Link>
        </p>
      </form>
    </>
  );
}
