import { LkShell } from '@/components/LkShell';
import { StubBody } from '@/components/StubBody';

export default function Page() {
  return (
    <LkShell active="support" title="Поддержка" subtitle="">
      <StubBody source="support.html" stage="Э6" />
    </LkShell>
  );
}
