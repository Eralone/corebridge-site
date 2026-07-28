import { api } from './client';
import type {
  LoginResult,
  RegisterResult,
  ResetPasswordResult,
  VerifyEmailResult,
} from '@/lib/contracts/auth';

/**
 * Вход паролем. При включённом втором факторе вернётся не сессия, а challenge —
 * разбирать через needsTwoFactor() из contracts/auth.
 */
export const login = (email: string, password: string) =>
  api<LoginResult>('/lk/auth/login', { method: 'POST', body: { email, password } });

/** Второй шаг входа. Вместо кода из Telegram принимается код восстановления. */
export const loginTwoFactor = (challenge_id: string, code: string) =>
  api<LoginResult>('/lk/auth/login/2fa', { method: 'POST', body: { challenge_id, code } });

/** Переотправка кода. Сервер не чаще раза в 60 с, иначе 429. */
export const resendTwoFactor = (challenge_id: string) =>
  api<{ sent: true }>('/lk/auth/login/2fa/resend', { method: 'POST', body: { challenge_id } });

export const register = (input: {
  email: string;
  password: string;
  name?: string;
  company_name?: string;
}) => api<RegisterResult>('/lk/auth/register', { method: 'POST', body: input });

/**
 * Ссылка для входа без пароля. Всегда 202, даже если такого email нет —
 * иначе форма превращается в способ проверять чужие адреса.
 * ⚠️ Пользователь должен уже существовать: magic-link не создаёт аккаунт.
 */
export const sendMagicLink = (email: string) =>
  api<{ sent: true }>('/lk/auth/magic-link', { method: 'POST', body: { email } });

/** Письмо со ссылкой на сброс. Тоже всегда 202 — по той же причине. */
export const requestPasswordReset = (email: string) =>
  api<{ sent: true }>('/lk/auth/password/reset-request', { method: 'POST', body: { email } });

export const resetPassword = (token: string, new_password: string) =>
  api<ResetPasswordResult>('/lk/auth/password/reset', {
    method: 'POST',
    body: { token, new_password },
  });

export const verifyEmail = (token: string) =>
  api<VerifyEmailResult>(`/lk/auth/verify-email?token=${encodeURIComponent(token)}`);

/** Повторное письмо о подтверждении. Требует сессии, не чаще 3 раз в час. */
export const resendVerification = () =>
  api<{ sent: true }>('/lk/auth/verify-email/resend', { method: 'POST' });

/** Приглашение в команду: человек задаёт себе имя и пароль */
export const acceptInvite = (input: { token: string; name: string; password: string }) =>
  api<{ ok: true }>('/lk/users/accept', { method: 'POST', body: input });

/** Вход через Яндекс ID — переход по адресу, а не fetch: дальше редирект на oauth.yandex.ru */
export const YANDEX_LOGIN_URL = '/lk/auth/yandex';
