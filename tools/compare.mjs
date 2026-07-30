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
 * Считается ДВЕ цифры, и вторая важнее:
 *
 *  · `full` — вся страница целиком. Годится, только пока тексты совпадают с
 *    макетом. Стоит одному абзацу стать на строку длиннее, как всё ниже
 *    съезжает по вертикали, и дальше сравниваются разные секции. На лендинге
 *    это дало 15,5 % при полностью совпадающей раскладке: описание пробного
 *    тарифа мы переписали (он бессрочный), страница стала на 328px выше.
 *
 *  · `fold` — только первый экран, 1440×900. От длины текста ниже не зависит,
 *    поэтому ловит именно то, ради чего сверка и нужна: съехавшую сетку,
 *    неверный шрифт, другие отступы, потерянную шапку. Это и есть гейт.
 *
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

  const opts = {
    threshold: 0.12, // сглаживание шрифтов даёт разброс, ловим только настоящие сдвиги
    includeAA: false,
  };

  const diff = new PNG({ width, height });
  const mismatched = pixelmatch(a.data, b.data, diff.data, width, height, opts);
  const diffPath = join(outDir, 'diff.png');
  await writeFile(diffPath, PNG.sync.write(diff));

  // Первый экран: сравниваем без сдвига, поэтому цифра означает раскладку,
  // а не разницу в длине текстов где-то ниже по странице.
  const foldH = Math.min(VIEWPORTS.desktop.height, design.height, live.height);
  const foldDiff = new PNG({ width, height: foldH });
  const crop = (png) => {
    const out = new PNG({ width, height: foldH });
    PNG.bitblt(png, out, 0, 0, width, foldH, 0, 0);
    return out;
  };
  const foldMismatched = pixelmatch(
    crop(design).data, crop(live).data, foldDiff.data, width, foldH, opts,
  );
  const foldPath = join(outDir, 'diff-fold.png');
  await writeFile(foldPath, PNG.sync.write(foldDiff));

  return {
    id: p.id,
    ported: p.ported,
    maxDiff: p.maxDiff,
    note: p.note,
    designHeight: design.height,
    liveHeight: live.height,
    ratio: mismatched / (width * height),
    foldRatio: foldMismatched / (width * foldH),
    files: { ...shots, diff: diffPath, fold: foldPath },
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
        const foldPct = (r.foldRatio * 100).toFixed(1);
        const verdict = !r.ported
          ? 'заглушка'
          : r.foldRatio <= r.maxDiff
            ? 'в допуске'
            : `ВЫШЕ ДОПУСКА (${(r.maxDiff * 100).toFixed(0)}%)`;
        console.log(`первый экран ${foldPct}% · вся страница ${pct}% — ${verdict}`);
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
    'Гейт считается по первому экрану: он не зависит от того, что тексты ниже',
    'стали длиннее или короче макета, поэтому показывает именно раскладку.',
    'Колонка «вся страница» — справочная: сдвиг по вертикали от переписанного',
    'абзаца делает её большой при полностью совпадающей вёрстке.',
    '',
    '| Страница | Первый экран | Вся страница | Допуск | Высота макет / сайт | Итог |',
    '|---|---:|---:|---:|---|---|',
    ...rows.map((r) => {
      if (r.error) return `| ${r.id} | — | — | — | — | сорвалось: ${r.error.split('\n')[0]} |`;
      const verdict = !r.ported ? 'ещё заглушка' : r.foldRatio <= r.maxDiff ? 'в допуске' : 'выше допуска';
      const budget = r.maxDiff != null ? `${(r.maxDiff * 100).toFixed(0)}%` : '—';
      return `| ${r.id} | ${(r.foldRatio * 100).toFixed(1)}% | ${(r.ratio * 100).toFixed(1)}% | ${budget} | ${r.designHeight} / ${r.liveHeight} | ${verdict} |`;
    }),
    '',
    'Картинки: `artifacts/<страница>/design.png`, `live.png`, `diff.png`,',
    '`diff-fold.png` (первый экран).',
  ].join('\n');
  await writeFile(join(ARTIFACTS, 'compare.md'), md + '\n');
  console.log('\nОтчёт: artifacts/compare.md');
}
