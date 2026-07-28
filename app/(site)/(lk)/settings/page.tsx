import { LkShell } from '@/components/LkShell';
import { StubBody } from '@/components/StubBody';

export default function Page() {
  return (
    <LkShell active="settings" title="Настройки" subtitle="Профиль, компания, безопасность, уведомления">
      <StubBody source="settings.html" stage="Э5" />
    </LkShell>
  );
}
