import type { Metadata } from 'next';
import { LkShell } from '@/components/LkShell';
import { IntegrationsBody } from './IntegrationsBody';

export const metadata: Metadata = { title: 'Мои интеграции — CoreBridge', robots: { index: false } };

export default function Page() {
  return (
    <LkShell active="integrations-app" title="Мои интеграции">
      <IntegrationsBody />
    </LkShell>
  );
}
