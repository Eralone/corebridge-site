import type { Metadata } from 'next';
import { LkShell } from '@/components/LkShell';
import { DashboardBody } from './DashboardBody';

export const metadata: Metadata = { title: 'Дашборд — CoreBridge', robots: { index: false } };

export default function Page() {
  return (
    <LkShell active="dashboard" title="Дашборд">
      <DashboardBody />
    </LkShell>
  );
}
