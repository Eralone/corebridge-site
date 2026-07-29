'use client';

import Link from 'next/link';
import { adminLogout } from '@/lib/api/admin';
import { useAdmin } from './admin/AdminGuard';

/**
 * Перенос window.renderAdminSidebar из shell.js.
 *
 * Пути: на admin.corebridge.ru интерфейс живёт в корне (middleware переписывает
 * / → /admin, /users → /admin/users), потому что /admin/* занят API.
 *
 * ⚠️ Пункт «Поддержка» из эталона НЕ переносим: тикет-системы на сервере нет,
 * поддержка вне MVP (решение продукта). Бейдж «12» там был заглушкой.
 */
export type AdminNavId =
  | 'admin'
  | 'admin-users'
  | 'admin-integrations'
  | 'admin-payments'
  | 'admin-privacy'
  | 'admin-queues'
  | 'admin-epf';

/**
 * Первые три пункта — из макета. Остальные четыре добавлены: соответствующие
 * экраны в дизайне не рисовали, а API под них на сервере есть целиком
 * (решение Дмитрия 2026-07-28 — недостающие админ-экраны собираем сами).
 */
const ITEMS: { id: AdminNavId; label: string; href: string }[] = [
  { id: 'admin', label: 'Обзор', href: '/' },
  { id: 'admin-users', label: 'Пользователи', href: '/users' },
  { id: 'admin-integrations', label: 'Интеграции n8n', href: '/integrations' },
  { id: 'admin-payments', label: 'Платежи', href: '/payments' },
  { id: 'admin-epf', label: 'Сборки .epf', href: '/epf' },
  { id: 'admin-queues', label: 'Очереди', href: '/queues' },
  { id: 'admin-privacy', label: 'Обращения по ПДн', href: '/privacy' },
];

const ICONS: Record<AdminNavId, string> = {
  admin: 'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z',
  'admin-users':
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  'admin-integrations':
    'M5 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM19 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM5 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM19 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 5l3 6M17 5l-3 6M7 19l3-6M17 19l-3-6',
  'admin-payments': 'M2 7h20v12H2zM2 11h20M6 15h4',
  'admin-epf': 'M12 3v12m0 0-4-4m4 4 4-4M4 19h16',
  'admin-queues': 'M4 6h16M4 12h16M4 18h10M18 16l3 3-3 3',
  'admin-privacy':
    'M12 3l8 4v5c0 5-3.4 8.4-8 9-4.6-.6-8-4-8-9V7l8-4zM9 12l2 2 4-4',
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
  const me = useAdmin();
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
        {/* в эталоне это была ссылка на /login — она не гасила сессию */}
        <button
          type="button"
          onClick={async () => {
            try {
              await adminLogout();
            } finally {
              window.location.reload();
            }
          }}
        >
          <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M16 17l5-5-5-5M21 12H9M12 3H5v18h7" />
          </svg>
          <span>Выйти</span>
        </button>
      </nav>
      <div className="sidebar-user">
        <div className="avatar" style={{ background: 'var(--admin)' }}>
          {initials ?? initialsFrom(me?.email)}
        </div>
        <div>
          <div className="name">{adminName ?? me?.email?.split('@')[0] ?? 'Администратор'}</div>
          <div className="sub">сотрудник CoreBridge</div>
        </div>
      </div>
    </aside>
  );
}

/** Инициалы из почты: `d.korolev@…` → `ДК` неоткуда взять, берём латиницу как есть */
function initialsFrom(email?: string): string {
  if (!email) return '—';
  const local = email.split('@')[0];
  const parts = local.split(/[._-]+/).filter(Boolean);
  const letters = parts.length >= 2 ? parts[0][0] + parts[1][0] : local.slice(0, 2);
  return letters.toUpperCase();
}
