/**
 * Рисует картинку для соцсетей и мессенджеров — public/og.png, 1200×630.
 *
 *   node tools/make-og.mjs
 *
 * Её показывают Telegram, ВКонтакте и поисковики, когда кто-то делится ссылкой
 * на сайт. Без неё ссылка выглядит голой строкой, а место под картинку каждый
 * клиент заполняет по-своему — обычно первым попавшимся изображением страницы.
 *
 * Рисуем теми же шрифтом и цветами, что и сайт: файл берёт `public/assets`
 * напрямую с диска, поэтому картинка не разъедется с темой при её правке.
 */
import { firefox } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './lib/pages.mjs';

const fonts = readFileSync(join(ROOT, 'public', 'assets', 'fonts.css'), 'utf8').replace(
  /url\((['"]?)\.?\/?fonts\//g,
  (_, q) => `url(${q}file://${join(ROOT, 'public', 'assets', 'fonts')}/`,
);

const html = `<!doctype html><meta charset="utf-8"><style>
${fonts}
* { margin: 0; box-sizing: border-box; }
body {
  width: 1200px; height: 630px; display: flex; flex-direction: column; justify-content: space-between;
  padding: 72px 80px; font-family: Inter, sans-serif; color: #fff;
  background: linear-gradient(135deg, #0A2463 0%, #123a8f 55%, #3E92CC 100%);
}
.top { display: flex; align-items: center; gap: 20px; }
.glyph { width: 64px; height: 64px; border-radius: 17px; background: rgba(255,255,255,.14); position: relative; }
.glyph i { position: absolute; background: #fff; border-radius: 2px; }
.arch { left: 15px; top: 17px; width: 34px; height: 4px; }
.p1 { left: 15px; top: 27px; width: 4px; height: 20px; }
.p2 { left: 30px; top: 27px; width: 4px; height: 20px; }
.p3 { left: 45px; top: 27px; width: 4px; height: 20px; }
.brand { font-size: 34px; font-weight: 800; letter-spacing: -.02em; }
h1 { font-size: 62px; line-height: 1.12; font-weight: 800; letter-spacing: -.025em; max-width: 940px; }
h1 em { font-style: normal; color: #FF9966; }
.foot { display: flex; align-items: center; justify-content: space-between; font-size: 24px; color: #C9D5F2; }
.chips { display: flex; gap: 12px; }
.chip { border: 1px solid rgba(255,255,255,.28); border-radius: 999px; padding: 8px 20px; font-size: 20px; color: #fff; }
</style>
<div class="top">
  <div class="glyph"><i class="arch"></i><i class="p1"></i><i class="p2"></i><i class="p3"></i></div>
  <div class="brand">CoreBridge</div>
</div>
<h1>Интеграция 1С с маркетплейсами,<br>сайтами и <em>CRM</em></h1>
<div class="foot">
  <div class="chips">
    <span class="chip">УТ 11</span><span class="chip">УНФ</span>
    <span class="chip">КА 2 / ERP</span><span class="chip">БП 3.0</span>
  </div>
  <div>corebridge.ru</div>
</div>`;

const browser = await firefox.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: join(ROOT, 'public', 'og.png') });
await browser.close();
console.log('public/og.png — 1200×630');
