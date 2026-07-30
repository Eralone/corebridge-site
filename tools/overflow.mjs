/**
 * Ищет, что именно вылезает за экран. Печатает элементы, чья правая граница
 * выходит за ширину окна, — с селектором, шириной и текстом для узнавания.
 *
 *   node tools/overflow.mjs https://corebridge.ru/ mobile
 *   node tools/overflow.mjs https://corebridge.ru/ tablet
 *
 * Нужен потому, что «горизонтальная прокрутка есть» из отчёта не говорит, где.
 * Элементы внутри блоков со своей прокруткой (широкие таблицы) не считаются:
 * они прокручиваются внутри себя, а не тянут за собой страницу.
 */
import { VIEWPORTS } from './lib/pages.mjs';
import { launch, newContext, sessionCookies } from './lib/shot.mjs';

const url = process.argv[2] ?? 'https://corebridge.ru/';
const vp = VIEWPORTS[process.argv[3] ?? 'mobile'] ?? VIEWPORTS.mobile;

const browser = await launch();
const ctx = await newContext(browser, { viewport: vp, cookies: sessionCookies() });
const page = await ctx.newPage();
await page.goto(url, { waitUntil: 'networkidle' });

const found = await page.evaluate((width) => {
  /**
   * Элемент внутри блока со своей горизонтальной прокруткой — не проблема:
   * так сделаны широкие таблицы сравнения и журналов. Проблема — только то,
   * из-за чего прокручивается вся страница.
   */
  const inScroller = (el) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const ox = getComputedStyle(p).overflowX;
      if (ox === 'auto' || ox === 'scroll') return true;
    }
    return false;
  };

  const out = [];
  for (const el of document.querySelectorAll('*')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.right <= width + 1 && r.left >= -1) continue;
    if (inScroller(el)) continue;
    // берём только сам виновник, без родителей, которые растянулись из-за него
    const inner = Array.from(el.children).some((c) => {
      const cr = c.getBoundingClientRect();
      return cr.right > width + 1 || cr.left < -1;
    });
    if (inner) continue;
    out.push({
      tag: el.tagName.toLowerCase(),
      cls: el.className?.toString?.().slice(0, 60) ?? '',
      left: Math.round(r.left),
      right: Math.round(r.right),
      w: Math.round(r.width),
      text: (el.textContent ?? '').trim().slice(0, 50),
    });
  }
  return out;
}, vp.width);

console.log(`${url} @ ${vp.width}px — вылезает элементов: ${found.length}`);
for (const f of found) {
  console.log(
    `  ${f.tag}.${f.cls} · left ${f.left} right ${f.right} (ширина окна ${vp.width}) · «${f.text}»`,
  );
}

await browser.close();
