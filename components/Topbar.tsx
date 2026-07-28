'use client';

import Link from 'next/link';
import { useUser } from '@/lib/user-context';

/** Перенос window.renderTopbar из shell.js. Разметка дословно из эталона. */
export function Topbar({ title, subtitle }: { title: string; subtitle?: string }) {
  const user = useUser();
  return (
    <header className="topbar">
      <div>
        <h1>{title}</h1>
        {subtitle && (
          <div className="text-muted" style={{ fontSize: 13 }}>
            {subtitle}
          </div>
        )}
      </div>
      <div className="topbar-right">
        <Link className="icon-btn" aria-label="Поддержка" href="/support">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </Link>
        <a href="mailto:info@corebridge.ru" className="icon-btn" aria-label="Написать нам">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="3" y="6" width="18" height="12" rx="2" />
            <path d="m3 8 9 6 9-6" />
          </svg>
        </a>
        <div className="avatar">{user?.initials ?? '—'}</div>
      </div>
    </header>
  );
}
