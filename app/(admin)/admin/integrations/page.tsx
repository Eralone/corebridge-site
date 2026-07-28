import { AdminShell } from '@/components/AdminShell';
import { StubBody } from '@/components/StubBody';

export default function Page() {
  return (
    <AdminShell active="admin-integrations" title="Интеграции n8n" crumbs={[{ label: 'Admin', href: '/' }, { label: 'Интеграции n8n' }]}>
      <StubBody source="admin-integrations.html" stage="Э7" />
    </AdminShell>
  );
}
