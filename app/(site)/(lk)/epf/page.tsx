import { LkShell } from '@/components/LkShell';
import { StubBody } from '@/components/StubBody';

export default function Page() {
  return (
    <LkShell active="epf" title="Файл .epf и JWT-токен" subtitle="Всё, чтобы запустить интеграцию">
      <StubBody source="epf.html" stage="Э2" />
    </LkShell>
  );
}
