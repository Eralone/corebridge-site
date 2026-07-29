import { AdminShell } from '@/components/AdminShell';
import { PaymentsBody } from './PaymentsBody';

export default function Page() {
  return (
    <AdminShell active="admin-payments" title="Платежи" crumbs={[{ label: 'Admin', href: '/' }, { label: 'Платежи' }]}>
      <PaymentsBody />
    </AdminShell>
  );
}
