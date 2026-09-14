/**
 * Собирает раздел «Разборы» из markdown в готовый HTML.
 *
 *   node tools/build-articles.mjs          собрать
 *   node tools/build-articles.mjs --check  проверить, не собирая
 *
 * Вход:  content/articles/<slug>.md      — исходники, шапка в YAML
 *        marketing/content/drafts/*.png  — обложки, как их прислал человек
 * Выход: content/articles-built/<slug>.html   — тело статьи
 *        content/articles-built/manifest.json — оглавление и метаданные
 *        public/razbory/<slug>.jpg            — обложка, ужатая до 1200px
 *
 * ── Почему отдельный раздел, а не дописывание в /docs/epf ───────────────────
 * Страницы документации собираются из `content/epf-docs/`, а те исходники
 * отдаёт команда модуля: наша правка там либо потеряется на следующей сборке,
 * либо будет конфликтовать при каждой поставке. Плюс жанр другой: документация
 * отвечает «как настроить», разбор — «почему не сходится и что делать».
 * Смешивать их плохо и для читателя, и для выдачи.
 *
 * ── Почему обложки пережимаются здесь ───────────────────────────────────────
 * Присланные PNG весят до 1,8 МБ. Отдавать их как есть нельзя: скорость
 * первого экрана — фактор ранжирования, а раздел затевается ровно ради поиска.
 * `sharp` стоит в devDependencies и в рантайм сайта не попадает.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { Marked } from 'marked';
import sharp from 'sharp';
import { ROOT } from './lib/pages.mjs';

const check = process.argv.includes('--check');
const SRC = join(ROOT, 'content', 'articles');
const OUT = join(ROOT, 'content', 'articles-built');
const COVERS_IN = join(ROOT, 'marketing', 'content', 'drafts');
const COVERS_OUT = join(ROOT, 'public', 'razbory');

/** Ширина обложки на странице статьи. Больше не нужно: контейнер уже. */
const COVER_WIDTH = 1200;

const marked = new Marked({ gfm: true, breaks: false });

/** Разбор YAML-шапки. Полный парсер здесь лишний: полей пять и они плоские. */
function parseFront(text) {
  if (!text.startsWith('---\n')) throw new Error('нет шапки');
  const end = text.indexOf('\n---\n', 4);
  if (end < 0) throw new Error('шапка не закрыта');
  const front = {};
  for (const line of text.slice(4, end).split('\n')) {
    const i = line.indexOf(':');
    if (i < 0) continue;
    front[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
  return { front, body: text.slice(end + 5) };
}

/** id для якоря: латиница и кириллица, остальное в дефис. */
function slugify(text) {
  return text.toLowerCase().replace(/[^a-zа-яё0-9]+/gi, '-').replace(/^-|-$/g, '');
}

async function cover(slug, file) {
  const from = join(COVERS_IN, file);
  if (!existsSync(from)) throw new Error(`нет обложки ${file}`);
  const to = join(COVERS_OUT, `${slug}.jpg`);
  if (check) return `/razbory/${slug}.jpg`;
  mkdirSync(COVERS_OUT, { recursive: true });
  const meta = await sharp(from).resize({ width: COVER_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: 82, progressive: true }).toFile(to);
  console.log(`  обложка ${slug}.jpg ${meta.width}x${meta.height} ${Math.round(meta.size / 1024)} КБ`);
  return `/razbory/${slug}.jpg`;
}

const files = readdirSync(SRC).filter((f) => f.endsWith('.md')).sort();
if (!files.length) throw new Error('в content/articles нет исходников');

const articles = {};
const order = [];

for (const file of files) {
  const slug = file.replace(/\.md$/, '');
  const { front, body } = parseFront(readFileSync(join(SRC, file), 'utf8'));

  // Обложка необязательна: страница под поисковый запрос полезна и без неё,
  // а дублировать одну картинку на двух статьях хуже, чем обойтись без.
  for (const need of ['title', 'lead', 'date']) {
    if (!front[need]) throw new Error(`${file}: в шапке нет ${need}`);
  }

  // Оглавление статьи — по заголовкам второго уровня.
  const toc = [];
  const tokens = marked.lexer(body);
  for (const t of tokens) {
    if (t.type === 'heading' && t.depth === 2) toc.push({ id: slugify(t.text), text: t.text });
  }

  let html = marked.parse(body);
  // Якоря для боковой навигации — те же id, что в toc.
  html = html.replace(/<h2>(.*?)<\/h2>/g, (_, inner) =>
    `<h2 id="${slugify(inner.replace(/<[^>]+>/g, ''))}">${inner}</h2>`);

  // ⚠️ Ссылки внутри статьи ведут на наш же сайт, метки площадок тут вредны:
  // они бы приписали внутренний переход внешнему источнику.
  html = html.replace(/(https:\/\/corebridge\.ru)?(\/[^"']*?)\?utm_[^"']*/g, '$2');
  html = html.replace(/https:\/\/corebridge\.ru\//g, '/');

  if (!check) {
    mkdirSync(OUT, { recursive: true });
    writeFileSync(join(OUT, `${slug}.html`), html, 'utf8');
  }

  articles[slug] = {
    slug,
    title: front.title,
    lead: front.lead,
    date: front.date,
    format: front.format ?? '',
    cover: front.cover ? await cover(slug, front.cover) : null,
    seoTitle: front.seoTitle || front.title,
    seoDescription: front.seoDescription || front.lead,
    toc,
  };
  order.push(slug);
  console.log(`  ${slug}: ${toc.length} разделов, ${html.length} знаков`);
}

// Свежие сверху: раздел читают с последнего.
order.sort((a, b) => articles[b].date.localeCompare(articles[a].date));

if (!check) {
  writeFileSync(join(OUT, 'manifest.json'),
    JSON.stringify({ order, articles }, null, 2), 'utf8');
}
console.log(`${check ? 'проверено' : 'собрано'}: ${order.length} разборов`);
