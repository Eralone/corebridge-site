/**
 * Собирает иконки сайта из `app/icon.svg`.
 *
 *   node tools/make-icons.mjs
 *
 * Пишет:
 *   app/favicon.ico    — 16 + 32 + 48 px в одном файле
 *   app/apple-icon.png — 180×180, экран «на рабочий стол» в iOS
 *
 * ── Зачем, если SVG-иконка уже есть ────────────────────────────────────────
 * В выдаче иконки не было, и причина простая: `/favicon.ico` отдавал 404.
 * Яндекс и Google идут за иконкой сначала по корневому `/favicon.ico`
 * и только потом смотрят `<link rel="icon">` — а там у нас лежал SVG,
 * да ещё с хешем в адресе, который Next добавляет для сброса кеша.
 *
 * Размер тоже важен: Google требует не меньше 48×48 и кратность 48, иначе
 * иконку молча не показывают. Отсюда 48 в наборе, а не только 16 и 32.
 *
 * ICO — контейнер: заголовок, таблица записей и сами картинки. Кладём в него
 * PNG (так делают все современные наборы, распознаётся и поисковиками,
 * и браузерами), поэтому сборка помещается в десяток строк без библиотек.
 */
import { firefox } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './lib/pages.mjs';

/**
 * Берём тот же знак, но «в край»: убираем скругление и прозрачные углы.
 * Так принято для иконок — рамку рисует сам браузер во вкладке и iOS
 * на рабочем столе, каждый по-своему. Плюс Firefox в Playwright не умеет
 * снимать с прозрачным фоном, а на белых углах знак выглядел бы наклейкой.
 */
const svg = readFileSync(join(ROOT, 'app', 'icon.svg'), 'utf8').replace('rx="17"', 'rx="0"');

const browser = await firefox.launch();

/** Рисует SVG в PNG нужного размера. */
async function render(size) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(
    `<style>html,body{margin:0;padding:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
    { waitUntil: 'load' },
  );
  const png = await page.screenshot();
  await page.close();
  return png;
}

/**
 * ⚠️ Порядок важен: 48 первым. Next читает первую запись в ICO и объявляет
 * её в `sizes` у <link>. С порядком 16, 32, 48 в разметку уходило
 * `sizes="16x16"`, а Google не показывает иконку меньше 48×48 — файл-то
 * содержал нужный размер, но снаружи выглядел мелким.
 */
const sizes = [48, 32, 16];
const images = await Promise.all(sizes.map(render));

/** Пакует PNG-картинки в ICO. */
function ico(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // зарезервировано
  header.writeUInt16LE(1, 2); // тип: 1 — иконка
  header.writeUInt16LE(entries.length, 4);

  let offset = 6 + entries.length * 16;
  const table = [];
  for (const { size, png } of entries) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size === 256 ? 0 : size, 0); // ширина, 0 означает 256
    e.writeUInt8(size === 256 ? 0 : size, 1); // высота
    e.writeUInt8(0, 2); // палитра не используется
    e.writeUInt8(0, 3); // зарезервировано
    e.writeUInt16LE(1, 4); // цветовых плоскостей
    e.writeUInt16LE(32, 6); // бит на пиксель
    e.writeUInt32LE(png.length, 8);
    e.writeUInt32LE(offset, 12);
    table.push(e);
    offset += png.length;
  }
  return Buffer.concat([header, ...table, ...entries.map((x) => x.png)]);
}

writeFileSync(join(ROOT, 'app', 'favicon.ico'), ico(sizes.map((size, i) => ({ size, png: images[i] }))));
writeFileSync(join(ROOT, 'app', 'apple-icon.png'), await render(180));

await browser.close();
console.log(`app/favicon.ico — ${sizes.join(', ')} px · app/apple-icon.png — 180×180`);
