/**
 * Попиксельная сверка живой страницы с эталоном из design-source.
 *
 *   node tools/design-server.mjs &          сначала поднять эталон на 3006
 *   node tools/compare.mjs                  все страницы, у которых есть макет
 *   node tools/compare.mjs pricing login    только эти
 *   node tools/compare.mjs --ported         только перенесённые (то же, что в гейте)
 *
 * Пишет artifacts/<id>/{design,live,diff}.png и artifacts/compare.md.
 *
 * Как читать цифру расхождения: пока экран не перенесён, она будет близка к
 * единице — это нормально и означает «страница ещё заглушка». Смысл появляется
 * после переноса: тогда доля должна уложиться в maxDiff из tests/visual/pages.json.
 * Расхождения по данным (цены, имена, счётчики) — не баг: макет их только
 * иллюстрирует, значения приходят из API. Смотреть надо на раскладку.
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { selectPages, liveUrl, designUrl, VIEWPORTS } from './lib/pages.mjs';
import { launch, newContext, sessionCookies, openWithDiagnostics, shoot, ARTIFACTS } from './lib/shot.mjs';
import { ensureDesignServer, stopDesignServer } from './design-server.mjs';

const args = process.argv.slice(2);
const onlyPorted = args.includes('--ported');

/** Дополняет картинку снизу белым до нужной высоты — страницы редко совпадают по длине */
function pad(png, height) {
  if (png.height === height) return png;
  const out = new PNG({ width: png.width, height });
  out.data.fill(0xff);
  PNG.bitblt(png, out, 0, 0, png.width, Math.min(png.height, height), 0, 0);
  return out;
}

export async function comparePage(browser, p, { dir } = {}) {
  const outDir = dir ?? join(ARTIFACTS, p.id);
  await mkdir(outDir, { recursive: true });
  await ensureDesignServer();

  const shots = {};
  for (const [name, url] of [
    ['design', designUrl(p)],
    ['live', liveUrl(p)],
  ]) {
    const ctx = await newContext(browser, {
      viewport: VIEWPORTS.desktop,
      cookies: name === 'live' ? sessionCookies() : [],
    });
    const { page } = await openWithDiagnostics(ctx, url);
    shots[name] = join(outDir, `${name}.png`);
    await shoot(page, shots[name]);
    await ctx.close();
  }

  const design = PNG.sync.read(readFileSync(shots.design));
  const live = PNG.sync.read(readFileSync(shots.live));
  const width = Math.min(design.width, live.width);
  const height = Math.max(design.height, live.height);
  const a = pad(design, height);
  const b = pad(live, height);

  const diff = new PNG({ width, height });
  const mismatched = pixelmatch(a.data, b.data, diff.data, width, height, {
    threshold: 0.12, // сглаживание шрифтов даёт разброс, ловим только настоящие сдвиги
    includeAA: false,
  });
  const diffPath = join(outDir, 'diff.png');
  await writeFile(diffPath, PNG.sync.write(diff));

  return {
    id: p.id,
    ported: p.ported,
    maxDiff: p.maxDiff,
    note: p.note,
    designHeight: design.height,
    liveHeight: live.height,
    ratio: mismatched / (width * height),
    files: { ...shots, diff: diffPath },
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const pages = selectPages(args).filter((p) => p.design && (!onlyPorted || p.ported));
  if (!pages.length) {
    console.log('Нечего сверять: у выбранных страниц нет макета.');
    process.exit(0);
  }

  const browser = await launch();
  const rows = [];
  try {
    for (const p of pages) {
      process.stdout.write(`· ${p.id} … `);
      try {
        const r = await comparePage(browser, p);
        rows.push(r);
        const pct = (r.ratio * 100).toFixed(1);
        const verdict = !r.ported
          ? 'заглушка'
          : r.ratio <= r.maxDiff
            ? 'в допуске'
            : `ВЫШЕ ДОПУСКА (${(r.maxDiff * 100).toFixed(0)}%)`;
        console.log(`${pct}% — ${verdict}`);
      } catch (e) {
        console.log(`сорвалось: ${e.message.split('\n')[0]}`);
        rows.push({ id: p.id, error: e.message, ported: p.ported });
      }
    }
  } finally {
    await browser.close();
    stopDesignServer();
  }

  const md = [
    '# Сверка с макетом',
    '',
    `Снято: ${new Date().toISOString()}`,
    '',
    '| Страница | Расхождение | Допуск | Высота макет / сайт | Итог |',
    '|---|---:|---:|---|---|',
    ...rows.map((r) => {
      if (r.error) return `| ${r.id} | — | — | — | сорвалось: ${r.error.split('\n')[0]} |`;
      const verdict = !r.ported ? 'ещё заглушка' : r.ratio <= r.maxDiff ? 'в допуске' : 'выше допуска';
      const budget = r.maxDiff != null ? `${(r.maxDiff * 100).toFixed(0)}%` : '—';
      return `| ${r.id} | ${(r.ratio * 100).toFixed(1)}% | ${budget} | ${r.designHeight} / ${r.liveHeight} | ${verdict} |`;
    }),
    '',
    'Картинки: `artifacts/<страница>/design.png`, `live.png`, `diff.png`.',
  ].join('\n');
  await writeFile(join(ARTIFACTS, 'compare.md'), md + '\n');
  console.log('\nОтчёт: artifacts/compare.md');
}
