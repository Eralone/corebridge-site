import { AdminShell } from '@/components/AdminShell';
import { QueuesBody } from './QueuesBody';

export default function Page() {
  return (
    <AdminShell active="admin-queues" title="Очереди" crumbs={[{ label: 'Admin', href: '/' }, { label: 'Очереди' }]}>
      <QueuesBody />
    </AdminShell>
  );
}
