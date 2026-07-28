import { LkShell } from '@/components/LkShell';
import { StubBody } from '@/components/StubBody';

export default function Page() {
  return (
    <LkShell active="dashboard" title="Дашборд" subtitle="">
      <StubBody source="dashboard.html" stage="Э2" />
    </LkShell>
  );
}
