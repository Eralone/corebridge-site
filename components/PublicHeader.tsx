import Link from 'next/link';

/**
 * Перенос window.renderPublicHeader из shell.js.
 * ⚠️ В эталоне пункт «О нас» вёл на about.html, которого не существует —
 * ведём на /for-business (решение зафиксировано в design_findings.md).
 */
export type PublicNavId = 'features' | 'integrations' | 'pricing' | 'docs' | 'about';

const ITEMS: { id: PublicNavId; label: string; href: string }[] = [
  { id: 'features', label: 'Возможности', href: '/#features' },
  { id: 'integrations', label: 'Интеграции', href: '/integrations' },
  { id: 'pricing', label: 'Тарифы', href: '/pricing' },
  { id: 'docs', label: 'Документация', href: '/docs' },
  { id: 'about', label: 'О нас', href: '/for-business' },
];

export function PublicHeader({ active }: { active?: PublicNavId }) {
  return (
    <header className="site-header">
      <div className="container row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <Link href="/" className="logo-mark">
          <span className="logo-glyph" />
          CoreBridge
        </Link>
        <nav className="nav-links">
          {ITEMS.map((it) => (
            <Link key={it.id} href={it.href} className={active === it.id ? 'active' : undefined}>
              {it.label}
            </Link>
          ))}
        </nav>
        <div className="row gap-12">
          <Link href="/login" className="btn btn-ghost">
            Войти
          </Link>
          <Link href="/register" className="btn btn-primary">
            Попробовать бесплатно
          </Link>
        </div>
      </div>
    </header>
  );
}
