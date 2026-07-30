/**
 * Проверка иконок на всех страницах.
 *
 *   node tools/icons.mjs               все страницы
 *   node tools/icons.mjs lk admin      по области
 *
 * Что ищет — каждое из этого выглядит как «иконка отвалилась»:
 *
 *  · <svg> без содержимого или нулевого размера;
 *  · <svg> с `viewBox`, но без `width`/`height` и без размера из CSS —
 *    такой растягивается на всю ширину родителя;
 *  · путь, выходящий за viewBox: рисунок обрезается;
 *  · `stroke-width` при `fill` без `stroke` и наоборот — контур не виден;
 *  · символы-заглушки в тексте («□», «?»), которых нет в шрифте;
 *  · буквенные плашки адаптеров (.cb-ic) с пустым или слишком длинным текстом.
 *
 * Отчёт — в консоль. Скриншоты не снимает: это делает inspect.mjs.
 */
import { selectPages, liveUrl } from './lib/pages.mjs';
import { launch, newContext, sessionCookies } from './lib/shot.mjs';

const pages = selectPages(process.argv.slice(2));
const browser = await launch();
let problems = 0;

for (const p of pages) {
  const ctx = await newContext(browser, {
    viewport: { width: 1440, height: 900 },
    cookies: sessionCookies(),
  });
  const page = await ctx.newPage();
  try {
    await page.goto(liveUrl(p), { waitUntil: 'networkidle', timeout: 25_000 });
  } catch {
    console.log(`· ${p.id} … не открылась`);
    await ctx.close();
    continue;
  }

  const found = await page.evaluate(() => {
    const out = [];
    const where = (el) => {
      const path = [];
      for (let e = el; e && e !== document.body && path.length < 3; e = e.parentElement) {
        path.unshift(e.tagName.toLowerCase() + (e.className ? '.' + String(e.className).split(' ')[0] : ''));
      }
      return path.join(' > ');
    };

    /** Скрыт ли элемент сам или любым родителем: у таких размер 0 законно */
    const hidden = (el) => {
      if (el.getClientRects().length === 0) return true;
      for (let e = el; e; e = e.parentElement) {
        const cs = getComputedStyle(e);
        if (cs.display === 'none' || cs.visibility === 'hidden') return true;
      }
      return false;
    };

    for (const svg of document.querySelectorAll('svg')) {
      // мобильная шапка на десктопе скрыта — её иконка нулевая законно
      if (hidden(svg)) continue;
      const r = svg.getBoundingClientRect();
      const cs = getComputedStyle(svg);

      if (!svg.innerHTML.trim()) {
        out.push({ kind: 'пустой svg', at: where(svg) });
        continue;
      }
      if (r.width === 0 || r.height === 0) {
        out.push({ kind: 'нулевой размер', at: where(svg), w: Math.round(r.width), h: Math.round(r.height) });
        continue;
      }
      // без явного размера и без размера из CSS svg растянется на всю ширину
      const hasAttrSize = svg.hasAttribute('width') || svg.hasAttribute('height');
      const hasCssSize = cs.width !== 'auto' && cs.width !== '0px';
      const isChartSvg = svg.closest('.chart-card, .activity-card') && !svg.closest('.chart-head');
      if (!hasAttrSize && !hasCssSize && !isChartSvg) {
        out.push({ kind: 'нет размера', at: where(svg) });
      }
      // график — не иконка: он и должен быть большим и без фиксированного размера
      const isChart = svg.closest('.chart-card, .activity-card') && !svg.closest('.chart-head');
      if (!isChart && (r.width > 120 || r.height > 120)) {
        out.push({ kind: 'подозрительно крупная', at: where(svg), w: Math.round(r.width), h: Math.round(r.height) });
      }

      const vb = svg.getAttribute('viewBox');
      const fill = svg.getAttribute('fill');
      const stroke = svg.getAttribute('stroke');
      const sw = svg.getAttribute('stroke-width');
      // контур задан толщиной, но цвета обводки нет — линий не будет видно
      if (sw && !stroke && fill !== 'currentColor') {
        out.push({ kind: 'stroke-width без stroke', at: where(svg) });
      }
      // геометрия за пределами viewBox — рисунок обрежется
      if (vb) {
        const [, , vw, vh] = vb.split(/[\s,]+/).map(Number);
        try {
          for (const shape of svg.querySelectorAll('path,circle,rect,line,polyline,polygon')) {
            const b = shape.getBBox();
            if (b.x < -1 || b.y < -1 || b.x + b.width > vw + 1 || b.y + b.height > vh + 1) {
              out.push({
                kind: 'фигура за пределами viewBox',
                at: where(svg),
                vb,
                box: `${Math.round(b.x)},${Math.round(b.y)} ${Math.round(b.width)}×${Math.round(b.height)}`,
              });
              break;
            }
          }
        } catch {
          /* getBBox бросает на скрытых узлах — пропускаем */
        }
      }
    }

    // буквенные плашки адаптеров
    for (const ic of document.querySelectorAll('.cb-ic, .avatar, .icard-logo')) {
      const t = (ic.textContent || '').trim();
      if (!t) out.push({ kind: 'плашка без букв', at: where(ic) });
      else if (t.length > 3) out.push({ kind: 'слишком длинная подпись плашки', at: where(ic), text: t });
    }

    // символы, которых нет в шрифте
    const bad = /[�□]/;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (bad.test(n.nodeValue)) {
        out.push({ kind: 'символ отсутствует в шрифте', at: where(n.parentElement), text: n.nodeValue.trim().slice(0, 40) });
      }
    }
    return out;
  });

  if (found.length === 0) {
    console.log(`· ${p.id} … иконки в порядке`);
  } else {
    problems += found.length;
    console.log(`· ${p.id} … замечаний: ${found.length}`);
    // одинаковые проблемы схлопываем: 30 одинаковых карточек — это одна причина
    const seen = new Map();
    for (const f of found) {
      const key = `${f.kind}|${f.at}`;
      seen.set(key, (seen.get(key) ?? 0) + 1);
      if (seen.get(key) === 1) {
        console.log(`    ${f.kind} — ${f.at}${f.vb ? ` (viewBox ${f.vb}, фигура ${f.box})` : ''}${f.text ? ` «${f.text}»` : ''}${f.w !== undefined ? ` ${f.w}×${f.h}` : ''}`);
      }
    }
    for (const [key, n] of seen) if (n > 1) console.log(`    ↑ повторяется ${n}×: ${key.split('|')[0]}`);
  }

  await ctx.close();
}

console.log(problems === 0 ? '\nВсе иконки в порядке.' : `\nВсего замечаний: ${problems}`);
await browser.close();
