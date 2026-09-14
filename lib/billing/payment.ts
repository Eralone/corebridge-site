/**
 * Платежи: словарь статусов, подписи и формат сумм.
 *
 * ── Слой совместимости снят (2026-08-06) ────────────────────────────────────
 * До выкладки F20 P0 здесь жила нормализация двух форм ответа: прежний сервис
 * отдавал `{ id, amount: number, status: 'confirmed' }`. Сейчас P0 на проде —
 * проверено в работающем контейнере (`getPaymentHistory` выбирает `public_id`,
 * `payment_method`, `refunded_at`…) и в базе: миграция 029 применена, старые
 * строки переведены в новый вид, а `CHECK (status IN (…))` физически не даёт
 * записать `confirmed`. Разбирать вторую форму больше нечего — код снят,
 * чтобы он не выглядел работающим запасным путём.
 *
 * Что осталось: запасной вариант для **незнакомого** статуса. Словарь задаёт
 * сервер, и седьмое значение когда-нибудь может появиться раньше, чем правка
 * здесь; падать из-за этого страница не должна.
 */

import type { PaymentStatus } from '@/lib/contracts/lk';

const KNOWN_STATUSES: PaymentStatus[] = [
  'pending',
  'paid',
  'failed',
  'expired',
  'refunded',
  'mismatch',
];

/**
 * Статус, который экран умеет отрисовать. Незнакомое значение показываем как
 * «обрабатывается»: это единственное состояние, которое ничего не обещает
 * человеку — ни успеха, ни отказа.
 */
export function knownStatus(raw: string | undefined | null): PaymentStatus {
  return KNOWN_STATUSES.includes(raw as PaymentStatus) ? (raw as PaymentStatus) : 'pending';
}

/** Подпись статуса для клиента. Формулировки согласованы с F20 §3 */
export function statusLabel(s: PaymentStatus): string {
  switch (s) {
    case 'paid':
      return 'Оплачено';
    case 'pending':
      return 'Обрабатывается';
    case 'failed':
      return 'Не прошёл';
    case 'expired':
      return 'Просрочен';
    case 'refunded':
      return 'Возврат';
    case 'mismatch':
      return 'Нужна проверка';
  }
}

/** Классы плашки из design-source/billing.html: ok · pending · fail */
export function statusClass(s: PaymentStatus): 'ok' | 'pending' | 'fail' {
  if (s === 'paid') return 'ok';
  if (s === 'pending') return 'pending';
  return 'fail';
}

/**
 * Пояснение к статусу — то, что человеку делать дальше.
 * ⚠️ `mismatch` намеренно **не** предлагает заплатить ещё раз: сумма не сошлась
 * с выставленной, лицензия не выдана, случай разбирается руками (F20 §3).
 */
export function statusHint(s: PaymentStatus): string {
  switch (s) {
    case 'paid':
      return 'Тариф активен. Чек по 54-ФЗ придёт от платёжного оператора на вашу почту.';
    case 'pending':
      return 'Платёж обрабатывается. Обычно это занимает несколько секунд.';
    case 'failed':
      return 'Оплата не прошла. Деньги не списаны — можно попробовать ещё раз.';
    case 'expired':
      return 'Ссылка на оплату устарела. Создайте платёж заново.';
    case 'refunded':
      return 'Возврат оформлен. Деньги вернутся на тот же способ оплаты.';
    case 'mismatch':
      return 'Платёж требует проверки: сумма не совпала с выставленной. Мы свяжемся с вами — платить повторно не нужно.';
  }
}

/**
 * Сумма приходит из Postgres NUMERIC строкой («5990.00»), а из старого
 * сервера — числом. Копейки показываем, только если они есть: «5 990 ₽»
 * читается лучше, чем «5 990,00 ₽», а «1 490,50 ₽» терять нельзя.
 */
export function formatAmount(v: string | number | null | undefined): string {
  const n = typeof v === 'number' ? v : Number.parseFloat(v ?? '');
  if (!Number.isFinite(n)) return '—';
  const kopecks = Math.round(n * 100) % 100 !== 0;
  return `${n.toLocaleString('ru-RU', {
    minimumFractionDigits: kopecks ? 2 : 0,
    maximumFractionDigits: 2,
  })} ₽`;
}

/** Способ оплаты Robokassa (IncCurrLabel). ⚠️ Это НЕ реквизиты карты */
export function methodLabel(m: string | null): string | null {
  if (!m) return null;
  const known: Record<string, string> = {
    BankCard: 'Банковская карта',
    SBP: 'СБП',
    SberPay: 'SberPay',
    Qiwi: 'QIWI',
    YandexMerchant: 'ЮMoney',
  };
  return known[m] ?? m;
}

/**
 * Сколько дней подписки ещё оплачено.
 *
 * ⚠️ Считаем по `valid_until`, а не по `days_left`: на пробном тарифе сервер
 * отдаёт `days_left: 0` при бессрочной лицензии (`valid_until: null`), и «0 дней»
 * выглядело бы как истёкший доступ. Бессрочная лицензия — это ноль **теряемых**
 * дней: терять там нечего, срок не ограничен.
 */
export function paidDaysLeft(validUntil: number | null | undefined, now = Date.now()): number {
  if (validUntil == null) return 0;
  return Math.max(0, Math.ceil((validUntil * 1000 - now) / 86_400_000));
}

/**
 * Нужен ли для этой покупки пересчёт смены тарифа.
 *
 * Три случая ведут себя по-разному, и путать их нельзя:
 *   · **тот же тариф** — продление, `POST /lk/billing/pay`; срок считается
 *     от конца оплаченного периода (P1-4);
 *   · **другой тариф при живой оплаченной подписке** — `change-plan`:
 *     оплаченная стоимость сохраняется, апгрейд оплачивается доплатой,
 *     даунгрейд бесплатен и отодвигает дату окончания (P3-2);
 *   · **пробный или истёкший** — остатка нет (`valid_until === null` либо срок
 *     прошёл), это обычная первая покупка.
 *
 * Окончательное слово всё равно за сервером: он отвечает `SAME_PLAN` или
 * `NO_PAID_REMAINDER`, если считать нечего. Здесь мы лишь не дёргаем расчёт
 * там, где он заведомо не нужен.
 */
export function isPlanChange(
  currentPlan: string | null | undefined,
  nextPlan: string | null | undefined,
  validUntil: number | null | undefined,
  now = Date.now(),
): boolean {
  if (!currentPlan || !nextPlan || currentPlan === nextPlan) return false;
  return paidDaysLeft(validUntil, now) > 0;
}

export const PERIOD_LABEL: Record<string, string> = {
  monthly: '1 мес.',
  yearly: '1 год',
};
