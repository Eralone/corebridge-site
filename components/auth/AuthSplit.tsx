import type { ReactNode } from 'react';
import Link from 'next/link';

/**
 * Экран на две колонки: тёмная панель слева, форма справа.
 * Разметка и классы — из design-source/login.html и register.html.
 * На ширине до 900px панель скрывается (медиазапрос в auth.css) — как в макете.
 */
export function AuthSplit({
  title,
  lead,
  features,
  footnote,
  warm,
  children,
}: {
  title: string;
  lead: string;
  features: string[];
  /** Подпись внизу панели. В макете здесь был выдуманный отзыв — не переносим */
  footnote?: string;
  /** Тёплая подсветка панели, как на регистрации */
  warm?: boolean;
  children: ReactNode;
}) {
  return (
    <main className="auth-wrap">
      <section className={`auth-panel${warm ? ' auth-panel--warm' : ''}`} aria-hidden="true">
        <div className="auth-brand">
          <span className="logo" />
          <span>CoreBridge</span>
        </div>
        <div>
          <h2>{title}</h2>
          <p>{lead}</p>
          <ul className="auth-feature-list">
            {features.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
        <div className="auth-footer-note">{footnote ?? ''}</div>
      </section>

      <section className="auth-form-wrap">
        <div className="auth-card">{children}</div>
      </section>
    </main>
  );
}

/** Переключатель «Вход / Регистрация» из макета */
export function AuthTabs({ active }: { active: 'login' | 'register' }) {
  return (
    <div className="tabs-nav">
      <Link href="/login" className={active === 'login' ? 'active' : undefined}>
        Вход
      </Link>
      <Link href="/register" className={active === 'register' ? 'active' : undefined}>
        Регистрация
      </Link>
    </div>
  );
}

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="back-link">
      {children}
    </Link>
  );
}

/**
 * Одна карточка по центру — восстановление пароля, подтверждение почты.
 * `icon` в макете рисовался крупнее на verify-email, поэтому вариант отдельный.
 */
export function AuthCenter({
  children,
  bigIcon,
}: {
  children: ReactNode;
  bigIcon?: boolean;
}) {
  return (
    <main className={`auth-center${bigIcon ? ' auth-center--icon' : ''}`}>
      <section className="auth-card">{children}</section>
    </main>
  );
}
