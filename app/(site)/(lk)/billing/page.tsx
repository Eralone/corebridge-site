import type { Metadata } from 'next';
import { LkShell } from '@/components/LkShell';
import { BillingBody } from './BillingBody';

export const metadata: Metadata = { title: 'Биллинг и тариф — CoreBridge', robots: { index: false } };

export default function Page() {
  return (
    <LkShell active="billing" title="Биллинг и тариф" subtitle="Тариф, лимиты и платежи">
      <BillingBody />
    </LkShell>
  );
}
