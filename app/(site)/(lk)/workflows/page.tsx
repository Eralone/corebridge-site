import { LkShell } from '@/components/LkShell';
import { StubBody } from '@/components/StubBody';

export default function Page() {
  return (
    <LkShell active="n8n" title="n8n-воркфлоу" subtitle="Свои сценарии автоматизации">
      <StubBody source="n8n.html" stage="Э3" />
    </LkShell>
  );
}
