import type { Metadata } from 'next';
import { LkShell } from '@/components/LkShell';
import { WorkflowsBody } from './WorkflowsBody';

export const metadata: Metadata = { title: 'n8n-воркфлоу — CoreBridge', robots: { index: false } };

export default function Page() {
  return (
    <LkShell active="n8n" title="n8n-воркфлоу" subtitle="Сценарии автоматизации поверх интеграций">
      <WorkflowsBody />
    </LkShell>
  );
}
