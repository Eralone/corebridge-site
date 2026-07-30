import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { PublicHeader } from '@/components/PublicHeader';
import { PublicFooter } from '@/components/PublicFooter';
import { PricingBody } from './PricingBody';

export const metadata: Metadata = {
  title: 'Тарифы — CoreBridge',
  description:
    'Пробный тариф без карты, платные — от 990 ₽ в месяц. Сравнение лимитов, годовая оплата со скидкой и ответы на частые вопросы.',
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
