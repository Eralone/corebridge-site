import Link from 'next/link';
import { docSections, docsBySlug } from '@/lib/docs';

/**
 * Левая панель документации: все инструкции, разбитые на группы.
 *
 * Группа — это `<details>`: её можно свернуть и развернуть, без единой строки
 * JavaScript. Раскрыта та, в которой лежит открытая страница, — так панель
 * остаётся короткой, но человек всегда видит, где находится. Текущая страница
 * помечена: подсветкой, полосой слева и `aria-current="page"`.
 *
 * Один и тот же список рисуется дважды и разводится стилями:
 * · `aside.docs-side` — колонка слева, видна от 820px;
 * · `details.docs-nav-mobile` — раскрывающийся список над текстом, до 820px.
 *
 * Так сделано потому, что `.docs-side` на телефоне скрыт (public.css §docs),
 * и без второго списка на узком экране из статьи некуда уйти, кроме «назад».
 *
 * ⚠️ `prefetch={false}` на всех ссылках. Next.js по умолчанию подгружает
 * содержимое каждой ссылки в поле зрения, а список рисуется дважды — это
 * 66 запросов `?_rsc=` одним всплеском на каждое открытие страницы раздела.
 * nginx на сайте держит `per_ip` 30 r/s, и всплеск честно получал 429:
 * сначала предзагрузка, следом — настоящие запросы страницы. Найдено разбором
 * 429 в access.log 2026-08-01. Переход по ссылке от этого не медленнее
 * заметным образом: страницы статические и отдаются из кэша.
 */

/**
 * `/docs` — первый пункт группы «Установка», а не отдельная ссылка внизу.
 * Там описан путь до JWT-токена и файла .epf, то есть то, с чего установка
 * начинается: без токена ни одна инструкция дальше первого шага не идёт.
 * Прежнее имя «Токен и API платформы» ставило справочник API вперёд задачи.
 */
const PRIMARY = { href: '/docs', label: 'Первичная настройка', id: 'platform' };

/**
 * `active` — слаг открытой инструкции, либо `index` (оглавление раздела),
 * либо `platform` (первичная настройка).
 */
export function DocsNav({ active }: { active?: string }) {
  const items = (section: (typeof docSections)[number]) => [
    ...(section.id === 'install' ? [PRIMARY] : []),
    ...section.docs.map((slug) => ({ href: `/docs/epf/${slug}`, label: docsBySlug[slug].nav, id: slug })),
  ];

  const list = (
    <nav className="docs-nav">
      <Link
        href="/docs/epf"
        prefetch={false}
        aria-current={active === 'index' ? 'page' : undefined}
        className={`docs-nav-top${active === 'index' ? ' active' : ''}`}
      >
        Все инструкции
      </Link>

      {docSections.map((s) => {
        const entries = items(s);
        return (
          <details key={s.id} className="docs-nav-group" open={entries.some((i) => i.id === active)}>
            <summary>
              <span>{s.title}</span>
              <span className="n">{entries.length}</span>
            </summary>
            {entries.map((i) => (
              <Link
                key={i.href}
                href={i.href}
                prefetch={false}
                aria-current={active === i.id ? 'page' : undefined}
                className={active === i.id ? 'active' : undefined}
              >
                {i.label}
              </Link>
            ))}
          </details>
        );
      })}
    </nav>
  );

  return (
    <>
      <aside className="docs-side">{list}</aside>
      <details className="docs-nav-mobile">
        <summary>Все инструкции по .epf</summary>
        <div>{list}</div>
      </details>
    </>
  );
}
