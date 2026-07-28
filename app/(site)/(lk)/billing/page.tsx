import { LkShell } from '@/components/LkShell';
import { StubBody } from '@/components/StubBody';

export default function Page() {
  return (
    <LkShell active="billing" title="Биллинг и тариф" subtitle="Тарифный план, лимиты и история платежей">
      <StubBody source="billing.html" stage="Э4" />
    </LkShell>
  );
}
