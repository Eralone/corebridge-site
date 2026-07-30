import { LkShell } from '@/components/LkShell';
import { SupportBody } from './SupportBody';

export default function Page() {
  return (
    <LkShell active="support" title="Поддержка" subtitle="Обращения по почте">
      <SupportBody />
    </LkShell>
  );
}
