import type { Metadata } from 'next';
import { LkShell } from '@/components/LkShell';
import { billingFlags } from '@/lib/billing/flags';
import { BillingBody } from './BillingBody';

export const metadata: Metadata = { title: 'Биллинг и тариф — CoreBridge', robots: { index: false } };

/** Флаги читаются на сервере при запросе — см. lib/billing/flags.ts */
export const dynamic = 'force-dynamic';

export default function Page() {
  return (
    <LkShell active="billing" title="Биллинг и тариф" subtitle="Тариф, лимиты и платежи">
      <BillingBody flags={billingFlags()} />
    </LkShell>
  );
}
