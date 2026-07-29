import { AdminShell } from '@/components/AdminShell';
import { UsersBody } from './UsersBody';

export default function Page() {
  return (
    <AdminShell active="admin-users" title="Пользователи" crumbs={[{ label: 'Admin', href: '/' }, { label: 'Пользователи' }]}>
      <UsersBody />
    </AdminShell>
  );
}
