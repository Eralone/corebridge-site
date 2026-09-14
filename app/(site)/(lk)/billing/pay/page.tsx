import { Suspense } from 'react';
import type { Metadata } from 'next';
import { LkShell } from '@/components/LkShell';
import { billingFlags } from '@/lib/billing/flags';
import { CheckoutBody } from './CheckoutBody';

export const metadata: Metadata = { title: 'Оплата тарифа — CoreBridge', robots: { index: false } };

/**
 * Флаги читаются на сервере при запросе, поэтому страница динамическая:
 * иначе Next вшил бы значение переменной окружения в статический пререндер
 * на сборке, и включение оплаты потребовало бы пересборки сайта.
 */
export const dynamic = 'force-dynamic';

export default function Page() {
  return (
    <LkShell active="billing" title="Оплата тарифа" subtitle="Тариф, период и способ оплаты">
      <Suspense fallback={<div className="lk-empty">Загружаем…</div>}>
        <CheckoutBody flags={billingFlags()} />
      </Suspense>
    </LkShell>
  );
}
