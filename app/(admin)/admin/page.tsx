import { AdminShell } from '@/components/AdminShell';
import { OverviewBody } from './OverviewBody';

export default function Page() {
  return (
    <AdminShell active="admin" title="Обзор платформы" crumbs={[{ label: 'Admin', href: '/' }, { label: 'Обзор' }]}>
      <OverviewBody />
    </AdminShell>
  );
}
