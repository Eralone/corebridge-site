import { AdminShell } from '@/components/AdminShell';
import { EpfBody } from './EpfBody';

export default function Page() {
  return (
    <AdminShell active="admin-epf" title="Сборки .epf" crumbs={[{ label: 'Admin', href: '/' }, { label: 'Сборки .epf' }]}>
      <EpfBody />
    </AdminShell>
  );
}
