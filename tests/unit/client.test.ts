import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api, ApiError, ERR } from '@/lib/api/client';

/**
 * Контракт ответа сервера: успех — JSON или пустое тело, ошибка — { error: CODE }
 * плюс произвольные детали рядом. Ошибка должна доезжать до экрана кодом, а не
 * текстом: экраны различают TENANT_BLOCKED и TENANT_PENDING_DELETION, показывают
 * attempts_left при вводе кода 2FA и так далее.
 */

function respond(body: string | null, init: ResponseInit = {}) {
  return vi.fn().mockResolvedValue(new Response(body, init));
}

describe('api()', () => {
  beforeEach(() => vi.stubGlobal('fetch', respond('{}')));
  afterEach(() => vi.unstubAllGlobals());

  it('разбирает JSON успешного ответа', async () => {
    vi.stubGlobal('fetch', respond(JSON.stringify({ ok: true, items: [1, 2] })));
    await expect(api<{ ok: boolean }>('/lk/plans')).resolves.toEqual({ ok: true, items: [1, 2] });
  });

  it('на 204 возвращает undefined и не пытается читать тело', async () => {
    vi.stubGlobal('fetch', respond(null, { status: 204 }));
    await expect(api('/lk/auth/logout', { method: 'POST' })).resolves.toBeUndefined();
  });

  it('пустое тело при 200 не роняет разбор', async () => {
    vi.stubGlobal('fetch', respond('', { status: 200 }));
    await expect(api('/lk/ping')).resolves.toBeNull();
  });

  it('шлёт cookie сессии — без credentials ЛК не работает', async () => {
    const f = respond('{}');
    vi.stubGlobal('fetch', f);
    await api('/lk/profile');
    expect(f.mock.calls[0][1]).toMatchObject({ credentials: 'include' });
  });

  it('тело сериализует в JSON и выставляет Content-Type', async () => {
    const f = respond('{}');
    vi.stubGlobal('fetch', f);
    await api('/lk/contact', { method: 'POST', body: { source: 'pricing' } });
    const init = f.mock.calls[0][1] as RequestInit;
    expect(init.body).toBe('{"source":"pricing"}');
    expect(init.headers).toMatchObject({ 'Content-Type': 'application/json' });
  });

  it('на GET без тела Content-Type не ставит', async () => {
    const f = respond('{}');
    vi.stubGlobal('fetch', f);
    await api('/lk/plans');
    expect((f.mock.calls[0][1] as RequestInit).headers).not.toHaveProperty('Content-Type');
  });
});

describe('ApiError', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('достаёт код из тела ошибки', async () => {
    vi.stubGlobal('fetch', respond(JSON.stringify({ error: ERR.TENANT_BLOCKED }), { status: 403 }));
    await expect(api('/lk/auth/session')).rejects.toMatchObject({
      name: 'ApiError',
      code: 'TENANT_BLOCKED',
      status: 403,
    });
  });

  it('сохраняет детали рядом с кодом — экрану нужен attempts_left', async () => {
    vi.stubGlobal(
      'fetch',
      respond(JSON.stringify({ error: ERR.INVALID_CODE, attempts_left: 2 }), { status: 400 }),
    );
    const err = await api('/lk/auth/login/2fa', { method: 'POST' }).catch((e) => e as ApiError);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).details).toMatchObject({ attempts_left: 2 });
  });

  it('не-JSON тело (например HTML от nginx) не глотает ошибку', async () => {
    vi.stubGlobal('fetch', respond('<html>502 Bad Gateway</html>', { status: 502 }));
    await expect(api('/lk/profile')).rejects.toMatchObject({ code: 'HTTP_502', status: 502 });
  });

  it('ошибка без поля error получает код из статуса', async () => {
    vi.stubGlobal('fetch', respond(JSON.stringify({ message: 'oops' }), { status: 500 }));
    await expect(api('/lk/profile')).rejects.toMatchObject({ code: 'HTTP_500' });
  });

  it('сообщение читаемо в логах', async () => {
    vi.stubGlobal('fetch', respond(JSON.stringify({ error: 'UNAUTHORIZED' }), { status: 401 }));
    const err = (await api('/lk/profile').catch((e) => e)) as ApiError;
    expect(err.message).toBe('UNAUTHORIZED (HTTP 401)');
  });
});

describe('ERR', () => {
  it('коды совпадают со своими именами — их сравнивают со строкой из тела ответа', () => {
    for (const [name, value] of Object.entries(ERR)) expect(value).toBe(name);
  });

  it('содержит коды, которые обрабатывают экраны входа и оплаты', () => {
    // список из site_S*_RESPONSE.md, а не из головы
    expect(Object.keys(ERR)).toEqual(
      expect.arrayContaining([
        'UNAUTHORIZED',
        'TENANT_BLOCKED',
        'TENANT_PENDING_DELETION',
        'NO_ACTIVE_SUBSCRIPTION',
        'OAUTH_ACCOUNT',
        'TELEGRAM_REQUIRED_FOR_2FA',
        'INVALID_CODE',
        'CHALLENGE_EXPIRED',
      ]),
    );
  });

  it('кода GOOGLE_ACCOUNT нет — вход через Google удалён, у Яндекс ID код OAUTH_ACCOUNT', () => {
    expect(Object.keys(ERR)).not.toContain('GOOGLE_ACCOUNT');
  });
});
