/**
 * Контракты авторизации. Формы ответов — из site_S1_S7_RESPONSE.md §1
 * и site_S8_S9_RESPONSE.md §1, а не из макета: в макете кнопки ни к чему
 * не подключены.
 */

export type Role = 'owner' | 'manager' | 'user' | 'admin';

/** Обычный вход: cookie lk_session уже поставлена сервером */
export interface LoginOk {
  user_id: string;
  tenant_id: string;
  role: Role;
  /** Приходит после второго шага: вошли по коду восстановления, а не по коду из Telegram */
  used_recovery_code?: boolean;
}

/**
 * Включён второй фактор. Cookie НЕ ставится, код уже ушёл в Telegram —
 * нужен второй шаг POST /lk/auth/login/2fa.
 */
export interface TwoFactorChallenge {
  twofactor_required: true;
  method: 'telegram';
  challenge_id: string;
}

export type LoginResult = LoginOk | TwoFactorChallenge;

export function needsTwoFactor(r: LoginResult): r is TwoFactorChallenge {
  return (r as TwoFactorChallenge).twofactor_required === true;
}

export interface RegisterResult {
  user_id: string;
  tenant_id: string;
  email: string;
  email_verified: false;
  verification_sent: boolean;
}

/**
 * Сброс пароля. Пароль к этому моменту уже изменён и все сессии погашены,
 * но при включённой 2FA cookie не ставится: доступа к почте не должно
 * хватать, чтобы обойти второй фактор.
 */
export interface ResetPasswordResult {
  ok: true;
  email: string;
  twofactor_required?: true;
  method?: 'telegram';
  challenge_id?: string;
}

export interface VerifyEmailResult {
  email: string;
  verified: true;
}
