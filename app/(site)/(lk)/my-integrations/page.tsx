import { LkShell } from '@/components/LkShell';
import { StubBody } from '@/components/StubBody';

export default function Page() {
  return (
    <LkShell active="integrations-app" title="Мои интеграции" subtitle="Подключённые сервисы и автоматизации">
      <StubBody source="integrations-app.html" stage="Э3" />
    </LkShell>
  );
}
