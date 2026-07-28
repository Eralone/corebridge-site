import type { ReactNode } from 'react';
import { AdminSidebar } from './AdminSidebar';
import { AdminTopbar } from './AdminTopbar';

/** Структура .app.app--admin из design-source/admin.html */
export function AdminShell({
  active,
  title,
  crumbs,
  children,
}: {
  active?: Parameters<typeof AdminSidebar>[0]['active'];
  title: string;
  crumbs?: { label: string; href?: string }[];
  children: ReactNode;
}) {
  return (
    <div className="app app--admin">
      <AdminSidebar active={active} />
      <div className="app-main">
        <AdminTopbar title={title} crumbs={crumbs} />
        <main className="page">{children}</main>
      </div>
    </div>
  );
}
