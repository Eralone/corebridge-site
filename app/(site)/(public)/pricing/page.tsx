import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { PublicHeader } from '@/components/PublicHeader';
import { PublicFooter } from '@/components/PublicFooter';
import { PricingBody } from './PricingBody';

export const metadata: Metadata = {
  title: 'Тарифы на интеграцию 1С с маркетплейсами и CRM — CoreBridge',
  description:
    'Сколько стоит интеграция 1С: пробный тариф без карты, платные — от 990 ₽ в месяц. ' +
    'Лимиты по интеграциям и операциям, годовая оплата со скидкой, ответы на частые вопросы.',
  alternates: { canonical: 'https://corebridge.ru/pricing' },
};

/**
 * Наличие сессии определяем здесь, а не запросом из браузера. Иначе гость
 * на публичной странице получал бы `401 /lk/dashboard` в консоли: ошибки нет,
 * но выглядит как поломка, и в отчёте обходчика она шумит наравне с настоящими.
 * Cookie httpOnly, из JS её не прочитать, — а на сервере можно.
 */
export default async function Page() {
  const hasSession = (await cookies()).has('lk_session');

  return (
    <>
      <PublicHeader active="pricing" />
      <PricingBody hasSession={hasSession} />
      <PublicFooter />
    </>
  );
}
