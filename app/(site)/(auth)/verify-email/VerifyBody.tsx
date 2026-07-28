'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ApiError } from '@/lib/api/client';
import { resendVerification, verifyEmail } from '@/lib/api/auth';
import { Alert } from '@/components/auth/fields';

/**
 * Подтверждение почты. У экрана два входа:
 *
 * · со ссылкой из письма (`?token=`) — сразу подтверждаем и показываем итог;
 * · без токена — состояние из макета «письмо отправлено, ждём перехода».
 *
 * Таймер повторной отправки в макете статичный («Повторная отправка через
 * 59 сек»), здесь честно отсчитывает: сервер разрешает 3 письма в час.
 */

type State =
  | { kind: 'waiting' }
  | { kind: 'checking' }
  | { kind: 'done'; email: string }
  | { kind: 'failed'; message: string };

const RESEND_DELAY = 60;

export function VerifyBody({ token }: { token: string | null }) {
  const [state, setState] = useState<State>(token ? { kind: 'checking' } : { kind: 'waiting' });
  const [left, setLeft] = useState(RESEND_DELAY);
  const [note, setNote] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true; // в dev эффект вызывается дважды, а токен одноразовый
    verifyEmail(token)
      .then((r) => setState({ kind: 'done', email: r.email }))
      .catch((e) => setState({ kind: 'failed', message: messageFor(e) }));
  }, [token]);

  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  if (state.kind === 'checking') {
    return (
      <>
        <div className="big-icon pulse">
          <MailIcon />
        </div>
        <h1>Проверяем ссылку…</h1>
        <p className="sub">Секунду.</p>
      </>
    );
  }

  if (state.kind === 'done') {
    return (
      <>
        <div className="big-icon success">
          <svg
            width="44"
            height="44"
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
        <h1>Почта подтверждена</h1>
        <p className="sub">
          Адрес <strong style={{ color: 'var(--text)' }}>{state.email}</strong> подтверждён. Можно
          работать.
        </p>
        <Link href="/dashboard" className="btn btn-primary btn-block btn-lg">
          В личный кабинет
        </Link>
      </>
    );
  }

  if (state.kind === 'failed') {
    return (
      <>
        <div className="big-icon">
          <MailIcon />
        </div>
        <h1>Не получилось подтвердить</h1>
        <p className="sub">{state.message}</p>
        <ResendButton left={left} setLeft={setLeft} setNote={setNote} />
        {note && <Alert kind="info">{note}</Alert>}
        <p style={{ fontSize: 13, marginTop: 20, textAlign: 'center' }}>
          <Link href="/login">← Вернуться к входу</Link>
        </p>
      </>
    );
  }

  return (
    <>
      <div className="big-icon pulse">
        <MailIcon />
      </div>
      <h1>Подтвердите email</h1>
      <p className="sub">
        Мы отправили письмо со ссылкой. Перейдите по ней, чтобы подтвердить адрес.
      </p>
      <ResendButton left={left} setLeft={setLeft} setNote={setNote} />
      {note && <Alert kind="info">{note}</Alert>}
      <p style={{ fontSize: 13, marginTop: 20, textAlign: 'center' }}>
        <Link href="/login">← Вернуться к входу</Link>
      </p>
    </>
  );
}

function ResendButton({
  left,
  setLeft,
  setNote,
}: {
  left: number;
  setLeft: (n: number) => void;
  setNote: (s: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);

  return (
    <>
      <button
        type="button"
        className="btn btn-outline btn-block"
        disabled={left > 0 || busy}
        onClick={async () => {
          setBusy(true);
          setNote(null);
          try {
            await resendVerification();
            setNote('Письмо отправлено ещё раз.');
            setLeft(RESEND_DELAY);
          } catch (e) {
            setNote(
              e instanceof ApiError && e.code === 'UNAUTHORIZED'
                ? 'Чтобы отправить письмо повторно, войдите в кабинет.'
                : e instanceof ApiError && e.code === 'ALREADY_VERIFIED'
                  ? 'Адрес уже подтверждён.'
                  : e instanceof ApiError && e.code === 'TOO_MANY_REQUESTS'
                    ? 'Больше трёх писем в час не отправляем. Попробуйте позже.'
                    : 'Не удалось отправить письмо. Попробуйте позже.',
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        Отправить повторно
      </button>
      {left > 0 && <p className="timer">Повторная отправка через {left} сек</p>}
    </>
  );
}

function MailIcon() {
  return (
    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="m3 8 9 6 9-6" />
    </svg>
  );
}

function messageFor(e: unknown): string {
  if (!(e instanceof ApiError)) return 'Сервер не ответил. Попробуйте открыть ссылку ещё раз.';
  switch (e.code) {
    case 'TOKEN_INVALID':
      return 'Ссылка недействительна — возможно, ею уже воспользовались.';
    case 'TOKEN_EXPIRED':
      return 'Срок действия ссылки истёк: она живёт сутки. Запросите новое письмо.';
    case 'ALREADY_VERIFIED':
      return 'Этот адрес уже подтверждён — можно входить.';
    case 'MISSING_TOKEN':
      return 'В ссылке нет кода подтверждения. Откройте её из письма целиком.';
    default:
      return 'Не удалось подтвердить адрес. Попробуйте ещё раз.';
  }
}
