'use client';

import Link from 'next/link';
import { useUser } from '@/lib/user-context';
import { logout } from '@/lib/api/lk';
import { forgetSessionState } from '@/lib/auth/session-probe';

/**
 * Перенос window.renderSidebar из design-source/assets/shell.js.
 * Разметка и классы — дословно из эталона, изменены только пути:
 * в дизайне это .html-файлы, здесь маршруты Next.js.
 *
 * ⚠️ id пункта интеграций — 'integrations-app' (как в shell.js). В эталоне
 * страница вызывала renderSidebar('integrations') и пункт не подсвечивался —
 * это баг дизайна, здесь исправлен.
 */

type ItemId =
  | 'dashboard'
  | 'integrations-app'
  | 'epf'
  | 'n8n'
  | 'billing'
  | 'support'
  | 'settings';

const ITEMS: { id: ItemId; label: string; href: string }[] = [
  { id: 'dashboard', label: 'Дашборд', href: '/dashboard' },
  { id: 'integrations-app', label: 'Мои интеграции', href: '/my-integrations' },
  { id: 'epf', label: 'Файл .epf', href: '/epf' },
  { id: 'n8n', label: 'n8n-воркфлоу', href: '/workflows' },
  { id: 'billing', label: 'Биллинг и тариф', href: '/billing' },
  { id: 'support', label: 'Поддержка', href: '/support' },
  { id: 'settings', label: 'Настройки', href: '/settings' },
];

const ICONS: Record<ItemId, string> = {
  dashboard: 'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z',
  'integrations-app':
    'M10 13a5 5 0 0 0 7 0l4-4a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-4 4a5 5 0 0 0 7 7l1-1',
  epf: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  n8n: 'M5 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM19 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM5 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM19 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 5l3 6M17 5l-3 6M7 19l3-6M17 19l-3-6',
  billing: 'M2 5h20v14H2z M2 10h20',
  support: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  settings:
    'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M19 12a7 7 0 0 0-.1-1l2-1.6-2-3.4-2.4.9A7 7 0 0 0 15 5l-.4-2.5h-4L10 5a7 7 0 0 0-2.4 1.4l-2.4-.9-2 3.4 2 1.6A7 7 0 0 0 5 12a7 7 0 0 0 .1 1l-2 1.6 2 3.4 2.4-.9A7 7 0 0 0 10 19l.4 2.5h4L15 19a7 7 0 0 0 2.4-1.4l2.4.9 2-3.4-2-1.6',
};

function Icon({ d }: { d: string }) {
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  );
}

export function Sidebar({ active }: { active?: ItemId }) {
  const user = useUser();

  return (
    <aside className="sidebar" aria-label="Главная навигация">
      <Link className="brand" href="/dashboard">
        <span className="logo" aria-hidden="true" />
        <span>CoreBridge</span>
      </Link>
      <nav className="sidebar-nav">
        <div className="sidebar-section">Рабочее пространство</div>
        {ITEMS.map((it) => (
          <Link key={it.id} href={it.href} className={active === it.id ? 'active' : ''}>
            <Icon d={ICONS[it.id]} />
            <span>{it.label}</span>
          </Link>
        ))}

        {user?.role === 'admin' && (
          <>
            <div className="sidebar-section" style={{ marginTop: 18 }}>
              Администратор
            </div>
            {/* Админка — отдельный субдомен, не путь: /admin/* занят API */}
            <a href="https://admin.corebridge.ru/">
              <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M12 2 2 7l10 5 10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
              <span>Админ-панель</span>
            </a>
          </>
        )}

        <div className="sidebar-section" style={{ marginTop: 18 }}>
          Прочее
        </div>
        <Link href="/">
          <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M3 12l9-9 9 9M5 10v10h14V10" />
          </svg>
          <span>Главная сайта</span>
        </Link>
        {/* В эталоне это ссылка на login.html. Выход должен гасить сессию на
            сервере, иначе человек «вышел», а cookie осталась. */}
        <a
          href="/login"
          onClick={(e) => {
            e.preventDefault();
            void logout().finally(() => {
              // шапка публичных страниц помнит ответ на вкладку — иначе после
              // выхода она бы ещё показывала «Личный кабинет»
              forgetSessionState();
              window.location.href = '/login';
            });
          }}
        >
          <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M16 17l5-5-5-5M21 12H9M12 3H5v18h7" />
          </svg>
          <span>Выйти</span>
        </a>
      </nav>
      <div className="sidebar-user">
        <div className="avatar">{user?.initials ?? '—'}</div>
        <div>
          <div className="name">{user?.name ?? 'Загрузка…'}</div>
          <div className="sub">{user?.org ?? ''}</div>
        </div>
      </div>
    </aside>
  );
}
