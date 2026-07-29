import { AdminShell } from '@/components/AdminShell';
import { PrivacyBody } from './PrivacyBody';

export default function Page() {
  return (
    <AdminShell
      active="admin-privacy"
      title="Обращения по ПДн"
      crumbs={[{ label: 'Admin', href: '/' }, { label: 'Обращения по ПДн' }]}
    >
      <PrivacyBody />
    </AdminShell>
  );
}
