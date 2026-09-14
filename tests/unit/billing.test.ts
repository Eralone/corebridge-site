import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  formatAmount,
  isPlanChange,
  knownStatus,
  methodLabel,
  paidDaysLeft,
  statusClass,
  statusHint,
  statusLabel,
} from '@/lib/billing/payment';
import { billingFlags } from '@/lib/billing/flags';
import { changePlan, getPayments, previewPlanChange, startPayment } from '@/lib/api/lk';
import { matrixRows } from '@/lib/notifications/events';

/**
 * Платежи — единственное место сайта, где ошибка стоит денег. Поэтому тестами
 * закрыты ровно те вещи, которые тихо ломаются: словарь статусов (три сервиса
 * расходились в нём до миграции 029) и имя поля промо (сайт слал `promo_code`,
 * сервер читает `promo`).
 *
 * Разбора старой формы ответа здесь больше нет: F20 P0 на проде, миграция 029
 * применена, `CHECK` в базе не даёт записать `confirmed`. Слой совместимости снят.
 */

describe('словарь статусов', () => {
  it('шесть статусов контракта проходят как есть', () => {
    for (const s of ['pending', 'paid', 'failed', 'expired', 'refunded', 'mismatch'] as const) {
      expect(knownStatus(s)).toBe(s);
    }
  });

  it('неизвестное значение не выдаётся за оплату и не роняет экран', () => {
    // седьмой статус может приехать раньше правки на сайте
    expect(knownStatus('chargeback')).toBe('pending');
    expect(knownStatus(undefined)).toBe('pending');
  });

  it('mismatch не предлагает заплатить ещё раз — сумма не сошлась, разбирается руками', () => {
    expect(statusHint('mismatch')).toMatch(/свяжемся/);
    expect(statusHint('mismatch')).not.toMatch(/попроб/i);
    expect(statusLabel('mismatch')).toBe('Нужна проверка');
    expect(statusClass('mismatch')).toBe('fail');
  });

  it('плашка «оплачено» зелёная только у paid', () => {
    expect(statusClass('paid')).toBe('ok');
    expect(statusClass('pending')).toBe('pending');
    expect(statusClass('refunded')).toBe('fail');
  });
});

describe('формат сумм', () => {
  it('NUMERIC приходит строкой — «5990.00» это 5 990 ₽, а не NaN', () => {
    // ⚠️ разделитель разрядов у ru-RU — неразрывный пробел, а не обычный
    expect(formatAmount('5990.00')).toBe('5\u00a0990 ₽');
  });

  it('копейки не теряются', () => {
    expect(formatAmount('1490.50')).toBe('1\u00a0490,50 ₽');
  });

  it('пусто — прочерк, а не «0 ₽»: ноль означал бы бесплатно', () => {
    expect(formatAmount(null)).toBe('—');
    expect(formatAmount('')).toBe('—');
  });
});

describe('способ оплаты', () => {
  it('IncCurrLabel переводится, неизвестное показывается как есть', () => {
    expect(methodLabel('BankCard')).toBe('Банковская карта');
    expect(methodLabel('SomethingNew')).toBe('SomethingNew');
    expect(methodLabel(null)).toBeNull();
  });
});

describe('флаги биллинга', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env.BILLING_PAY_ENABLED = saved.BILLING_PAY_ENABLED;
    process.env.BILLING_AUTOPAY_ENABLED = saved.BILLING_AUTOPAY_ENABLED;
  });

  it('по умолчанию оплата и автоплатёж закрыты — до этапа P1 показывать их нельзя', () => {
    delete process.env.BILLING_PAY_ENABLED;
    delete process.env.BILLING_AUTOPAY_ENABLED;
    expect(billingFlags()).toEqual({ pay: false, autopay: false });
  });

  it('включается явным значением, а не любой непустой строкой', () => {
    process.env.BILLING_PAY_ENABLED = 'yes';
    expect(billingFlags().pay).toBe(false);
    process.env.BILLING_PAY_ENABLED = 'true';
    expect(billingFlags().pay).toBe(true);
  });
});

describe('POST /lk/billing/pay', () => {
  const ok = (body: unknown) => vi.fn().mockResolvedValue(new Response(JSON.stringify(body)));
  beforeEach(() => vi.stubGlobal('fetch', ok({ payment_url: 'https://auth.robokassa.ru/…' })));
  afterEach(() => vi.unstubAllGlobals());

  it('промо уходит полем `promo` — `promo_code` сервер молча игнорировал', async () => {
    const f = ok({ payment_url: null });
    vi.stubGlobal('fetch', f);
    await startPayment('professional', 'monthly', { promo: 'first30' });
    expect(JSON.parse(f.mock.calls[0][1].body)).toEqual({
      plan: 'professional',
      period: 'monthly',
      promo: 'first30',
    });
  });

  it('без промо и автоплатежа лишних полей не шлём', async () => {
    const f = ok({ payment_url: null });
    vi.stubGlobal('fetch', f);
    await startPayment('starter', 'yearly');
    expect(JSON.parse(f.mock.calls[0][1].body)).toEqual({ plan: 'starter', period: 'yearly' });
  });

  it('autopay уходит, только когда его явно попросили', async () => {
    const f = ok({ payment_url: null });
    vi.stubGlobal('fetch', f);
    await startPayment('starter', 'monthly', { autopay: true });
    expect(JSON.parse(f.mock.calls[0][1].body).autopay).toBe(true);
  });

  it('подпись платежа на фронте не считается: тело запроса — только план, период, промо', async () => {
    const f = ok({ payment_url: null });
    vi.stubGlobal('fetch', f);
    await startPayment('professional', 'monthly', { promo: 'first30', autopay: true });
    const sent = JSON.parse(f.mock.calls[0][1].body);
    expect(Object.keys(sent).sort()).toEqual(['autopay', 'period', 'plan', 'promo']);
  });
});

describe('GET /lk/billing', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('история отдаётся как есть — без нормализации, но с cookie сессии', async () => {
    const f = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            public_id: 'pay_b',
            amount: '5990.00',
            currency: 'RUB',
            status: 'mismatch',
            plan: 'professional',
            period: 'monthly',
            description: 'CoreBridge — подписка «Профессионал», 1 мес.',
            payment_method: 'BankCard',
            is_recurring: false,
            paid_at: null,
            refunded_at: null,
            refund_amount: null,
            failure_reason: null,
            created_at: '2026-08-05',
          },
        ]),
      ),
    );
    vi.stubGlobal('fetch', f);
    const rows = await getPayments();
    expect(rows[0].public_id).toBe('pay_b');
    expect(rows[0].status).toBe('mismatch');
    expect(f.mock.calls[0][1]).toMatchObject({ credentials: 'include' });
  });
});

/**
 * Матрица уведомлений: строки задаёт сервер, а не сайт.
 * Категория `billing` («Оплата и подписка») приехала с этапом P1 — экран
 * обязан показать её сам, ничего не зашивая, и не показать раньше времени.
 */
describe('матрица уведомлений', () => {
  it('строит строки по ответу сервера, а не по своему списку', () => {
    const rows = matrixRows({
      news: { email: true, telegram: false },
      integration_errors: { email: true, telegram: false },
    });
    expect(rows.map((r) => r.key)).toEqual(['integration_errors', 'news']);
  });

  it('категория billing получает название и предупреждение об окончании подписки', () => {
    const rows = matrixRows({ billing: { email: true, telegram: false } });
    expect(rows[0].label).toBe('Оплата и подписка');
    // блокировка наступает без grace-периода — молчать об этом нельзя
    expect(rows[0].warn).toMatch(/приостанов/);
  });

  it('billing идёт выше прочих: с ним связаны деньги и остановка обмена', () => {
    const rows = matrixRows({
      news: { email: true, telegram: false },
      billing: { email: true, telegram: false },
      reports: { email: false, telegram: false },
    });
    expect(rows[0].key).toBe('billing');
  });

  it('незнакомый ключ не теряется, а показывается как есть', () => {
    const rows = matrixRows({ some_new_event: { email: true, telegram: false } });
    expect(rows[0]).toMatchObject({ key: 'some_new_event', label: 'some_new_event' });
  });
});

/**
 * Какой веткой оформлять покупку. Ошибка здесь стоит денег дважды: пойти
 * в `pay` вместо `change-plan` — потерять клиенту оплаченный остаток;
 * пойти в `change-plan` там, где остатка нет, — получить отказ вместо оплаты.
 */
describe('покупка, продление или смена тарифа', () => {
  const NOW = Date.parse('2026-08-06T12:00:00Z');
  const inDays = (d: number) => Math.floor((NOW + d * 86_400_000) / 1000);

  it('пробный бессрочный — обычная первая покупка, пересчитывать нечего', () => {
    // ⚠️ на пробном тарифе сервер отдаёт days_left: 0 при valid_until: null
    expect(paidDaysLeft(null, NOW)).toBe(0);
    expect(isPlanChange('trial', 'professional', null, NOW)).toBe(false);
  });

  it('истёкшая подписка — тоже обычная покупка', () => {
    expect(paidDaysLeft(inDays(-3), NOW)).toBe(0);
    expect(isPlanChange('starter', 'professional', inDays(-3), NOW)).toBe(false);
  });

  it('другой тариф при живой подписке — считает сервер (change-plan)', () => {
    expect(paidDaysLeft(inDays(12), NOW)).toBe(12);
    expect(isPlanChange('starter', 'professional', inDays(12), NOW)).toBe(true);
  });

  it('тот же тариф — это продление, а не смена: change-plan ответил бы SAME_PLAN', () => {
    expect(isPlanChange('professional', 'professional', inDays(12), NOW)).toBe(false);
  });
});

/**
 * Смена тарифа (P3-2). Сумму и новую дату считает сервер — сайт их только
 * показывает. Здесь проверяем, что запрос уходит правильный и что ответ
 * «применено сразу» не путается с «нужна доплата».
 */
describe('POST /lk/billing/change-plan', () => {
  const respond = (body: unknown) => vi.fn().mockResolvedValue(new Response(JSON.stringify(body)));
  afterEach(() => vi.unstubAllGlobals());

  it('тело запроса — только тариф и период: промо и автоплатёж сюда не идут', async () => {
    const f = respond({ applied: true, payment_url: null });
    vi.stubGlobal('fetch', f);
    await changePlan('starter', 'monthly');
    expect(JSON.parse(f.mock.calls[0][1].body)).toEqual({ plan: 'starter', period: 'monthly' });
  });

  it('расчёт запрашивается GET-ом и ничего не меняет', async () => {
    const f = respond({ kind: 'upgrade', amount_due: 1240 });
    vi.stubGlobal('fetch', f);
    await previewPlanChange('professional', 'yearly');
    const [url, init] = f.mock.calls[0];
    expect(url).toContain('/lk/billing/change-plan/preview?plan=professional&period=yearly');
    expect(init.method).toBeUndefined();
  });

  it('даунгрейд применяется сразу и не требует оплаты', async () => {
    vi.stubGlobal(
      'fetch',
      respond({ kind: 'downgrade', amount_due: 0, applied: true, payment_url: null, valid_until: 1790000000 }),
    );
    const r = await changePlan('starter', 'monthly');
    expect(r.applied).toBe(true);
    expect(r.payment_url).toBeNull();
    expect(r.amount_due).toBe(0);
  });

  it('платный апгрейд не считается применённым до оплаты', async () => {
    vi.stubGlobal(
      'fetch',
      respond({
        kind: 'upgrade',
        amount_due: 1240,
        applied: false,
        payment_url: 'https://auth.robokassa.ru/…',
        payment_id: 'pay_abc',
      }),
    );
    const r = await changePlan('professional', 'monthly');
    expect(r.applied).toBe(false);
    expect(r.payment_id).toBe('pay_abc');
  });
});
