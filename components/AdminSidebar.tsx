'use client';

import Link from 'next/link';

/**
 * Перенос window.renderAdminSidebar из shell.js.
 *
 * Пути: на admin.corebridge.ru интерфейс живёт в корне (middleware переписывает
 * / → /admin, /users → /admin/users), потому что /admin/* занят API.
 *
 * ⚠️ Пункт «Поддержка» из эталона НЕ переносим: тикет-системы на сервере нет,
 * поддержка вне MVP (решение продукта). Бейдж «12» там был заглушкой.
 */
export type AdminNavId = 'admin' | 'admin-users' | 'admin-integrations';

const ITEMS: { id: AdminNavId; label: string; href: string }[] = [
  { id: 'admin', label: 'Обзор', href: '/' },
  { id: 'admin-users', label: 'Пользователи', href: '/users' },
  { id: 'admin-integrations', label: 'Интеграции n8n', href: '/integrations' },
];

const ICONS: Record<AdminNavId, string> = {
  admin: 'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z',
  'admin-users':
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  'admin-integrations':
    'M5 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM19 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM5 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM19 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 5l3 6M17 5l-3 6M7 19l3-6M17 19l-3-6',
};

export function AdminSidebar({
  active,
  adminName,
  initials,
}: {
  active?: AdminNavId;
  adminName?: string;
  initials?: string;
}) {
  return (
    <aside className="sidebar" aria-label="Админ-навигация">
      <Link className="brand" href="/">
        <span className="logo" aria-hidden="true" />
        <span>CoreBridge</span>
      </Link>
      <span className="admin-badge">● ADMIN PANEL</span>
      <nav className="sidebar-nav">
        <div className="sidebar-section">Управление</div>
        {ITEMS.map((it) => (
          <Link key={it.id} href={it.href} className={active === it.id ? 'active' : ''}>
            <svg
              className="icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d={ICONS[it.id]} />
            </svg>
            <span style={{ flex: 1 }}>{it.label}</span>
          </Link>
        ))}
        <div className="sidebar-section" style={{ marginTop: 18 }}>
          Выход из admin
        </div>
        <a href="https://corebridge.ru/dashboard">
          <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
          </svg>
          <span>В личный кабинет</span>
        </a>
        <a href="/login">
          <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M16 17l5-5-5-5M21 12H9M12 3H5v18h7" />
          </svg>
          <span>Выйти</span>
        </a>
      </nav>
      <div className="sidebar-user">
        <div className="avatar" style={{ background: 'var(--admin)' }}>
          {initials ?? '—'}
        </div>
        <div>
          <div className="name">{adminName ?? 'Администратор'}</div>
          <div className="sub">role: admin</div>
        </div>
      </div>
    </aside>
  );
}
