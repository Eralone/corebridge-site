'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { isSignedIn } from '@/lib/auth/session-probe';

/**
 * Перенос window.renderPublicHeader из shell.js.
 *
 * ⚠️ В эталоне пункт «О нас» вёл на about.html, которого не существует —
 * ведём на /for-business (решение зафиксировано в design_findings.md).
 *
 * ⚠️ **Мобильной версии в эталоне не было вовсе.** Пять пунктов меню и две
 * кнопки стоят в одну строку без переноса, поэтому на 820px шапка вылезала
 * за экран на 234px, а на 390px — на 664px, и вся страница получала
 * горизонтальную прокрутку. Найдено проверкой на трёх ширинах 2026-07-29.
 * Добавлено: до 900px меню и кнопки уезжают в раскрывающуюся панель,
 * в строке остаются логотип и кнопка-гамбургер. Вид на десктопе не менялся.
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
  const [open, setOpen] = useState(false);

  /**
   * ⚠️ В эталоне шапка гостевая и другой не бывает — «Войти» показывалось
   * всем, включая вошедшего. Из-за этого с публичных страниц не было пути
   * обратно в кабинет, и вместе с потерей cookie (см. lib/auth/session-probe.ts)
   * это читалось как «вход не держится». Спрашиваем один раз на вкладку.
   *
   * `null` — ещё не знаем: до ответа показываем гостевой вид, он же и в макете,
   * так что подмены на глазах не происходит.
   */
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    isSignedIn().then((v) => !cancelled && setSignedIn(v));
    return () => {
      cancelled = true;
    };
  }, []);

  // на Esc закрываем — иначе панель не убрать с клавиатуры
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <header className="site-header">
      <div className="container row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <Link href="/" className="logo-mark" onClick={() => setOpen(false)}>
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

        <div className="row gap-12 header-auth">
          {signedIn ? (
            <Link href="/dashboard" className="btn btn-primary">
              Личный кабинет
            </Link>
          ) : (
            <>
              <Link href="/login" className="btn btn-ghost">
                Войти
              </Link>
              <Link href="/register" className="btn btn-primary">
                Попробовать бесплатно
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          className="nav-burger"
          aria-expanded={open}
          aria-controls="public-nav-panel"
          aria-label={open ? 'Закрыть меню' : 'Открыть меню'}
          onClick={() => setOpen((v) => !v)}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {open ? <path d="M18 6 6 18M6 6l12 12" /> : <path d="M3 6h18M3 12h18M3 18h18" />}
          </svg>
        </button>
      </div>

      {/* Панель для узких экранов. На десктопе скрыта правилом, а не условием —
          иначе при повороте планшета пришлось бы перерисовывать дерево. */}
      <div className={`nav-panel${open ? ' open' : ''}`} id="public-nav-panel">
        <div className="container">
          {ITEMS.map((it) => (
            <Link
              key={it.id}
              href={it.href}
              className={active === it.id ? 'active' : undefined}
              onClick={() => setOpen(false)}
            >
              {it.label}
            </Link>
          ))}
          <div className="nav-panel-auth">
            {signedIn ? (
              <Link href="/dashboard" className="btn btn-primary btn-block" onClick={() => setOpen(false)}>
                Личный кабинет
              </Link>
            ) : (
              <>
                <Link href="/login" className="btn btn-outline btn-block" onClick={() => setOpen(false)}>
                  Войти
                </Link>
                <Link href="/register" className="btn btn-primary btn-block" onClick={() => setOpen(false)}>
                  Попробовать бесплатно
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
