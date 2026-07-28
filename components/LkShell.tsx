import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

/** Структура .app из design-source: сайдбар слева, топбар сверху, .page внутри. */
export function LkShell({
  active,
  title,
  subtitle,
  children,
}: {
  active?: Parameters<typeof Sidebar>[0]['active'];
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="app">
      <Sidebar active={active} />
      <div className="app-main">
        <Topbar title={title} subtitle={subtitle} />
        <main className="page">{children}</main>
      </div>
    </div>
  );
}
