import { AdminShell } from '@/components/AdminShell';
import { StubBody } from '@/components/StubBody';

export default function Page() {
  return (
    <AdminShell active="admin" title="Обзор платформы" crumbs={[{ label: 'Admin', href: '/' }, { label: 'Обзор' }]}>
      <StubBody source="admin.html" stage="Э7" />
    </AdminShell>
  );
}
