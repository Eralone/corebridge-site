import { Suspense } from 'react';
import type { Metadata } from 'next';
import { LkShell } from '@/components/LkShell';
import { SuccessBody } from './SuccessBody';

export const metadata: Metadata = { title: 'Платёж — CoreBridge', robots: { index: false } };

/**
 * SuccessURL Robokassa. Доступен по двум адресам:
 *   · /billing/success     — канонический, он и стоит в кабинете Robokassa;
 *   · /lk/billing/success  — запасной, прежний адрес из кабинета.
 * Второй забирал бы lk-api (весь /lk/* принадлежит API), поэтому в vhost заведено
 * точное совпадение location, а middleware.ts приводит путь сюда. Так же в своё
 * время починена ссылка из письма-приглашения.
 */
export default function Page() {
  return (
    <LkShell active="billing" title="Платёж" subtitle="Подтверждение оплаты">
      <Suspense fallback={<div className="lk-empty">Загружаем…</div>}>
        <SuccessBody />
      </Suspense>
    </LkShell>
  );
}
