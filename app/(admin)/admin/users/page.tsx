import { AdminShell } from '@/components/AdminShell';
import { StubBody } from '@/components/StubBody';

export default function Page() {
  return (
    <AdminShell active="admin-users" title="Пользователи платформы" crumbs={[{ label: 'Admin', href: '/' }, { label: 'Пользователи' }]}>
      <StubBody source="admin-users.html" stage="Э7" />
    </AdminShell>
  );
}
