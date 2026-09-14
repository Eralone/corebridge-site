import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Доступ к разделу «Разборы», собранному `tools/build-articles.mjs`.
 *
 * Устроено так же, как `lib/docs.ts`: манифест читается с диска на сервере
 * при сборке страниц, в клиентский бандл ничего отсюда не уходит.
 *
 * Раздел отдельный от документации намеренно. Документация отвечает
 * «как настроить» и собирается из исходников команды модуля; разбор отвечает
 * «почему не сходится» и пишется нами. Смешивать их — портить обе стороны:
 * страница инструкции, разбавленная рассуждениями, хуже отвечает на запрос.
 */

export type ArticleToc = { id: string; text: string };

export type Article = {
  slug: string;
  /** H1 страницы */
  title: string;
  /** первый абзац — описание в выдаче и подпись в карточке */
  lead: string;
  /** YYYY-MM-DD, по ней сортируется раздел */
  date: string;
  /** история | инструкция | разбор — помета в карточке */
  format: string;
  /** путь к обложке в public; null — статья без картинки */
  cover: string | null;
  /** заголовок под поисковый запрос; отличается от title намеренно */
  seoTitle: string;
  seoDescription: string;
  toc: ArticleToc[];
};

type Manifest = { order: string[]; articles: Record<string, Article> };

const DIR = join(process.cwd(), 'content', 'articles-built');

const manifest: Manifest = JSON.parse(readFileSync(join(DIR, 'manifest.json'), 'utf8'));

export const articleOrder = manifest.order;
export const articlesBySlug = manifest.articles;

export function getArticle(slug: string): Article | undefined {
  return manifest.articles[slug];
}

export function getArticleHtml(slug: string): string {
  return readFileSync(join(DIR, `${slug}.html`), 'utf8');
}

/** Соседи по разделу — для ссылок «предыдущая/следующая» внизу статьи. */
export function getNeighbours(slug: string) {
  const i = manifest.order.indexOf(slug);
  return {
    prev: i > 0 ? manifest.articles[manifest.order[i - 1]] : null,
    next: i >= 0 && i < manifest.order.length - 1 ? manifest.articles[manifest.order[i + 1]] : null,
  };
}

/** Дата по-русски: «10 сентября 2026». */
export function formatDate(iso: string): string {
  const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${months[m - 1]} ${y}`;
}
