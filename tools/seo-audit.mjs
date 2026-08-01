/**
 * Сплошная проверка выдачи: заголовок, описание, canonical, og:image, <h1>
 * и разбираемость JSON-LD — по всем публичным страницам сайта.
 *
 *   node tools/seo-audit.mjs
 *
 * Тесты (`tests/e2e/seo.spec.ts`) проверяют то же самое, но на выборке: набор
 * идёт по живому проду за лимитером nginx, и сплошной обход оттуда ронял 429
 * в чужие тесты. Здесь обход неспешный и запускается руками — после правок
 * метаданных или добавления страниц.
 *
 * Падает с ненулевым кодом, если нашлось хоть одно замечание.
 */
import { readFileSync } from 'node:fs';

const m = JSON.parse(readFileSync(new URL('../content/docs/epf/manifest.json', import.meta.url), 'utf8'));
const BASE = process.env.BASE_URL ?? 'https://corebridge.ru';
const pages = ['/', '/pricing', '/integrations', '/n8n', '/for-business', '/contacts', '/docs', '/docs/epf',
  ...m.sections.flatMap((s) => s.docs).map((s) => `/docs/epf/${s}`)];

let problems = 0;
const seen = new Map();

for (const path of pages) {
  const html = await (await fetch(BASE + path)).text();
  await new Promise((r) => setTimeout(r, 60)); // не упираемся в per_ip 30 r/s
  const pick = (re) => (html.match(re) ?? [])[1];
  const title = pick(/<title>([^<]*)<\/title>/);
  const desc = pick(/<meta name="description" content="([^"]*)"/);
  const canon = pick(/<link rel="canonical" href="([^"]*)"/);
  const og = pick(/property="og:image" content="([^"]*)"/);
  const say = (msg) => { console.log(`✗ ${path}: ${msg}`); problems++; };

  if (!title) say('нет title');
  else if (title.length > 65) say(`title ${title.length} знаков — обрежется`);
  if (!desc) say('нет description');
  else if (desc.length > 175) say(`description ${desc.length} знаков — обрежется`);
  else if (desc.length < 70) say(`description ${desc.length} знаков — слишком коротко`);
  if (!canon) say('нет canonical');
  if (!og) say('нет og:image');
  if (!/<h1[ >]/.test(html)) say('нет h1');

  for (const [what, val] of [['title', title], ['description', desc]]) {
    const key = what + '|' + val;
    if (seen.has(key)) say(`${what} дублирует ${seen.get(key)}`);
    else seen.set(key, path);
  }
  // разметка должна разбираться как JSON
  for (const [, json] of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try { JSON.parse(json); } catch (e) { say('битый JSON-LD: ' + e.message); }
  }
}
console.log(`\nПроверено страниц: ${pages.length}, замечаний: ${problems}`);
process.exit(problems ? 1 : 0);
