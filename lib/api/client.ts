/**
 * Тонкая обёртка над fetch для API CoreBridge.
 *
 * Топология single-origin: nginx на corebridge.ru проксирует /lk/* в lk-api,
 * /api/v1/* в bridge, остальное в Next.js. Поэтому base пустой — пути
 * совпадают с контрактом сервера, CORS не нужен.
 */
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? '';

/** Ошибка API в формате сервера: { error: CODE, ...детали } */
export class ApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    readonly details?: Record<string, unknown>,
  ) {
    super(`${code} (HTTP ${status})`);
    this.name = 'ApiError';
  }
}

type Options = Omit<RequestInit, 'body'> & { body?: unknown };

export async function api<T>(path: string, opts: Options = {}): Promise<T> {
  const { body, headers, ...rest } = opts;

  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    // cookie lk_session ставит и читает сервер
    credentials: 'include',
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      // не JSON — оставляем null, код ошибки выведем из статуса
    }
  }

  if (!res.ok) {
    const obj = (data ?? {}) as Record<string, unknown>;
    const code = typeof obj.error === 'string' ? obj.error : `HTTP_${res.status}`;
    throw new ApiError(code, res.status, obj);
  }

  return data as T;
}

/**
 * Коды ошибок, которые UI обрабатывает отдельно. Список из контракта, а не
 * догадки: см. Documents/server_ask/site_S*_RESPONSE.md.
 */
export const ERR = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  /** Вход: одинаково для неверной почты и неверного пароля — чтобы нельзя было
   *  перебором выяснить, кто у нас зарегистрирован. Проверено на живом сервере:
   *  это НЕ UNAUTHORIZED, как можно подумать по сводке пакета S1. */
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  MISSING_FIELDS: 'MISSING_FIELDS',
  INVALID_EMAIL: 'INVALID_EMAIL',
  WEAK_PASSWORD: 'WEAK_PASSWORD',
  EMAIL_EXISTS: 'EMAIL_EXISTS',
  MISSING_TOKEN: 'MISSING_TOKEN',
  TOKEN_INVALID: 'TOKEN_INVALID',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  ALREADY_VERIFIED: 'ALREADY_VERIFIED',
  TENANT_BLOCKED: 'TENANT_BLOCKED',
  TENANT_PENDING_DELETION: 'TENANT_PENDING_DELETION',
  NO_ACTIVE_SUBSCRIPTION: 'NO_ACTIVE_SUBSCRIPTION',
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',
  CUSTOM_PRICE_PLAN: 'CUSTOM_PRICE_PLAN',
  PROMO_ALREADY_USED: 'PROMO_ALREADY_USED',
  PROMO_NOT_APPLICABLE: 'PROMO_NOT_APPLICABLE',
  OAUTH_ACCOUNT: 'OAUTH_ACCOUNT',
  TELEGRAM_REQUIRED_FOR_2FA: 'TELEGRAM_REQUIRED_FOR_2FA',
  TELEGRAM_NOT_LINKED: 'TELEGRAM_NOT_LINKED',
  INVALID_CODE: 'INVALID_CODE',
  CHALLENGE_EXPIRED: 'CHALLENGE_EXPIRED',
} as const;
