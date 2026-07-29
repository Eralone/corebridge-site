'use client';

import Link from 'next/link';
import { adminLogout } from '@/lib/api/admin';
import { useAdmin } from './admin/AdminGuard';

/**
 * Перенос window.renderAdminTopbar из shell.js.
 * ⚠️ В эталоне email был зашит как d.korolev@corebridge.ru — здесь берётся
 * из `GET /admin/auth/me` через контекст входа.
 * ⚠️ Бейдж «Системы в норме» в эталоне статичный — источник GET /admin/health.
 */
export function AdminTopbar({
  title,
  crumbs,
  adminName,
  email,
  health,
}: {
  title: string;
  crumbs?: { label: string; href?: string }[];
  adminName?: string;
  email?: string;
  health?: { label: string; kind: 'success' | 'warning' | 'danger' };
}) {
  const me = useAdmin();
  const shownEmail = email ?? me?.email;
  const items = crumbs ?? [{ label: 'Admin', href: '/' }, { label: title }];
  return (
    <header className="topbar">
      <div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>
          {items.map((c, i) =>
            i === items.length - 1 ? (
              <span key={i} style={{ color: 'var(--text)' }}>
                {c.label}
              </span>
            ) : (
              <span key={i}>
                <Link href={c.href ?? '/'} style={{ color: 'var(--text-muted)' }}>
                  {c.label}
                </Link>{' '}
                <span style={{ color: 'var(--text-faint)' }}>/</span>{' '}
              </span>
            ),
          )}
        </div>
        <h1>{title}</h1>
      </div>
      <div className="topbar-right">
        {health && (
          <span className={`badge badge-${health.kind} badge-dot`} style={{ marginRight: 8 }}>
            {health.label}
          </span>
        )}
        <div style={{ textAlign: 'right', lineHeight: 1.25 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{adminName ?? 'Администратор'}</div>
          <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>{shownEmail ?? ''}</div>
        </div>
        {/* в эталоне это была ссылка на /login: сессию она бы не погасила */}
        <button
          className="btn btn-outline btn-sm"
          onClick={async () => {
            try {
              await adminLogout();
            } finally {
              window.location.reload();
            }
          }}
        >
          Выйти
        </button>
      </div>
    </header>
  );
}
