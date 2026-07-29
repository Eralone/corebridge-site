import { AdminShell } from '@/components/AdminShell';
import { IntegrationsBody } from './IntegrationsBody';

export default function Page() {
  return (
    <AdminShell active="admin-integrations" title="Интеграции n8n" crumbs={[{ label: 'Admin', href: '/' }, { label: 'Интеграции n8n' }]}>
      <IntegrationsBody />
    </AdminShell>
  );
}
