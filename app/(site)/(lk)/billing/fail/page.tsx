import type { Metadata } from 'next';
import Link from 'next/link';
import { LkShell } from '@/components/LkShell';

export const metadata: Metadata = { title: 'Оплата не завершена — CoreBridge', robots: { index: false } };

/**
 * FailURL Robokassa: человек закрыл форму или банк отказал.
 *
 * Ничего не опрашиваем — здесь опрашивать нечего: платёж остался неоплаченным,
 * деньги не списаны. Если банк всё-таки подтвердит операцию позже, тариф
 * активирует уведомление ResultURL, и это будет видно в истории.
 *
 * Доступна и по /lk/billing/fail — прежнему адресу из кабинета (см. success).
 */
export default function Page() {
  return (
    <LkShell active="billing" title="Оплата не завершена" subtitle="Платёж не прошёл">
      <div className="pay-result">
        <div className="card">
          <div className="pr-icon fail">×</div>
          <h2>Оплата не завершена</h2>
          <p className="text-muted">
            Платёж не прошёл: форма была закрыта или банк отклонил операцию. Деньги
            не списаны — можно попробовать ещё раз или оплатить по счёту.
          </p>
          <div className="row gap-8" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/billing/pay" className="btn btn-primary">
              Вернуться к тарифам
            </Link>
            <Link href="/billing" className="btn btn-outline">
              История платежей
            </Link>
          </div>
          <p className="text-muted" style={{ fontSize: 12.5, marginBottom: 0 }}>
            Если деньги всё-таки списались, напишите на{' '}
            <a href="mailto:info@corebridge.ru">info@corebridge.ru</a> — разберёмся.
          </p>
        </div>
      </div>
    </LkShell>
  );
}
