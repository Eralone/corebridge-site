import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const map = JSON.parse(readFileSync(join(ROOT, 'tests', 'visual', 'pages.json'), 'utf8'));

export const PAGES = map.pages;
export const VIEWPORTS = map.viewports;
export const DESIGN_ONLY = map.designOnly;

/** Живой сайт. По умолчанию — прод: он и есть текущая сборка. */
export const MAIN_BASE = process.env.BASE_URL ?? 'https://corebridge.ru';
export const ADMIN_BASE = process.env.ADMIN_BASE_URL ?? 'https://admin.corebridge.ru';
/** Эталон дизайна раздаёт tools/design-server.mjs */
export const DESIGN_BASE = process.env.DESIGN_BASE_URL ?? 'http://127.0.0.1:3006';

export function liveUrl(page) {
  return (page.host === 'admin' ? ADMIN_BASE : MAIN_BASE) + page.path;
}

export function designUrl(page) {
  return page.design ? `${DESIGN_BASE}/${encodeURIComponent(page.design)}` : null;
}

/** Отбор страниц по id/области из аргументов командной строки */
export function selectPages(args) {
  const names = args.filter((a) => !a.startsWith('-'));
  if (names.length === 0) return PAGES;
  return PAGES.filter(
    (p) =>
      names.includes(p.id) ||
      names.includes(p.auth) ||
      names.includes(p.host) ||
      (names.includes('ported') && p.ported),
  );
}
