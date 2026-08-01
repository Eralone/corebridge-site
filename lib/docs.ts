import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Доступ к разделу инструкций по .epf, собранному `tools/build-docs.mjs`.
 *
 * Читаем с диска на сервере при сборке страниц: раздел статический, всё,
 * что здесь есть, попадает в HTML на этапе `next build`. В клиентский бандл
 * ничего из этого модуля не уходит.
 */

export type DocToc = { id: string; text: string };

export type Doc = {
  slug: string;
  /** H1 исходника — заголовок страницы */
  title: string;
  /** короткое имя для боковой навигации и карточек */
  nav: string;
  /** первый абзац — для описания в поиске и подписи в карточке */
  lead: string;
  /** короткая пометка для оглавления раздела: «Только Ozon», «8 механик» */
  hint: string;
  toc: DocToc[];
  /** свои заголовок и описание для выдачи; null — берём title и lead */
  seo: { title: string; description: string } | null;
  section: string;
  source: string;
};

export type DocSection = { id: string; title: string; hint: string; docs: string[] };

type Manifest = { sections: DocSection[]; docs: Record<string, Doc>; extras: DocToc[] };

const DIR = join(process.cwd(), 'content', 'docs', 'epf');

const manifest: Manifest = JSON.parse(readFileSync(join(DIR, 'manifest.json'), 'utf8'));

export const docSections = manifest.sections;
export const docsBySlug = manifest.docs;
export const docExtrasToc = manifest.extras;

/** Плоский порядок обхода — им же ходят кнопки «предыдущая/следующая». */
export const docOrder: string[] = manifest.sections.flatMap((s) => s.docs);

export function getDoc(slug: string): Doc | null {
  return docsBySlug[slug] ?? null;
}

export function getDocHtml(slug: string): string {
  return readFileSync(join(DIR, `${slug}.html`), 'utf8');
}

/** Сводные таблицы из README: что где доступно, частые проблемы, о скриншотах. */
export function getIndexExtrasHtml(): string {
  return readFileSync(join(DIR, 'index-extras.html'), 'utf8');
}

export function getNeighbours(slug: string): { prev: Doc | null; next: Doc | null } {
  const i = docOrder.indexOf(slug);
  return {
    prev: i > 0 ? docsBySlug[docOrder[i - 1]] : null,
    next: i >= 0 && i < docOrder.length - 1 ? docsBySlug[docOrder[i + 1]] : null,
  };
}

/** Раздел, в котором лежит инструкция — для хлебных крошек. */
export function getSection(id: string): DocSection | null {
  return manifest.sections.find((s) => s.id === id) ?? null;
}
