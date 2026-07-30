/**
 * Обходчик живого сайта: открывает страницы в Firefox, снимает скриншоты,
 * собирает ошибки консоли и сети, проверяет внутренние ссылки и безопасно
 * прокликивает интерактивные элементы.
 *
 *   node tools/inspect.mjs                   все страницы
 *   node tools/inspect.mjs pricing login     только эти
 *   node tools/inspect.mjs public            по области: none|lk|admin, main|admin
 *   node tools/inspect.mjs --no-click        без прокликивания
 *   node tools/inspect.mjs --no-mobile       только десктоп, без планшета и телефона
 *   node tools/inspect.mjs --design          снять заодно эталон из design-source
 *
 * Куда пишет: artifacts/<id>/desktop.png, tablet.png, mobile.png, clicks/*.png,
 *             artifacts/report.md, artifacts/report.json
 *
 * Закрытые экраны (auth: lk) без CB_SESSION показывают форму входа — это
 * не ошибка, а ожидаемое поведение guard'а. Чтобы снять их по-настоящему:
 *   CB_SESSION=<значение cookie lk_session> node tools/inspect.mjs lk
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { selectPages, liveUrl, designUrl, VIEWPORTS, ROOT } from './lib/pages.mjs';
import { launch, newContext, sessionCookies, openWithDiagnostics, shoot, ARTIFACTS } from './lib/shot.mjs';

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const pages = selectPages(args);
const doClick = !flag('--no-click');
const doMobile = !flag('--no-mobile');
const doDesign = flag('--design');

/**
 * Что можно нажимать без последствий: попапы, вкладки, переключатели,
 * аккордеоны. Ссылки и submit не трогаем — уведём себя со страницы или
 * отправим форму на живой сервер.
 */
const CLICKABLE = [
  '[data-popup]',
  '[data-tab]',
  '.tab',
  '[data-period]',
  '[data-toggle]',
  'details > summary',
  '[role="tab"]',
  'button:not([type="submit"]):not([disabled])',
];
const MAX_CLICKS = 10;

/**
 * Чего не трогаем даже с виду безобидной кнопкой. Обход идёт по живому серверу:
 * «Обновить» на экране .epf перевыпускает JWT, «Отвязать» рвёт Telegram. Один
 * раз уже дёрнул /lk/token/refresh (спасло только то, что на пробном тарифе
 * сервер отвечает 402), второй — «Повторить» в очереди DLQ: событие ушло
 * в настоящую переобработку. Список пополняется по мере таких находок.
 * Скачивание тоже здесь: токен одноразовый, обход сжигал бы его впустую.
 */
const NEVER_CLICK =
  /обнов|удал|отвяз|отключ|сохран|оплат|выйти|прекрат|перевыпуст|сброс|повтор|скачать|включить|пауз|возобнов|заблокир|разблокир|выдать|примен|отправ/i;

async function checkLinks(page, origin) {
  const hrefs = await page
    .$$eval('a[href]', (as) => as.map((a) => a.getAttribute('href')))
    .catch(() => []);
  const seen = new Set();
  const broken = [];
  const external = new Set();

  for (const raw of hrefs) {
    if (!raw || raw.startsWith('#') || raw.startsWith('mailto:') || raw.startsWith('tel:')) continue;
    let url;
    try {
      url = new URL(raw, origin);
    } catch {
      broken.push({ href: raw, status: 'нераспознанный URL' });
      continue;
    }
    if (url.origin !== new URL(origin).origin) {
      external.add(url.origin + url.pathname);
      continue;
    }
    const key = url.pathname + url.search;
    if (seen.has(key)) continue;
    seen.add(key);

    // .html в ссылках — прямой признак недоделанного переноса из макета
    if (url.pathname.endsWith('.html')) {
      broken.push({ href: key, status: 'ссылка на файл макета, а не на маршрут' });
      continue;
    }
    try {
      const res = await fetch(url, { redirect: 'manual' });
      if (res.status >= 400) broken.push({ href: key, status: res.status });
    } catch (e) {
      broken.push({ href: key, status: e.message });
    }
  }
  return { broken, external: [...external] };
}

async function clickAround(page, dir, id) {
  const results = [];
  const before = page.url();
  let n = 0;

  for (const sel of CLICKABLE) {
    const els = await page.$$(sel).catch(() => []);
    for (const el of els) {
      if (n >= MAX_CLICKS) return results;
      const visible = await el.isVisible().catch(() => false);
      if (!visible) continue;

      const label =
        (await el.textContent().catch(() => ''))?.trim().slice(0, 40) ||
        (await el.getAttribute('aria-label').catch(() => '')) ||
        sel;

      if (NEVER_CLICK.test(label)) {
        results.push({ selector: sel, label, outcome: 'пропущено: меняет данные', errors: [], shot: null });
        continue;
      }

      const errors = [];
      const onErr = (e) => errors.push(String(e));
      page.on('pageerror', onErr);

      let outcome = 'ok';
      try {
        await el.click({ timeout: 3000 });
        await page.waitForTimeout(350);
        if (page.url() !== before) {
          outcome = `ушли на ${page.url()}`;
          await page.goto(before, { waitUntil: 'domcontentloaded' });
        } else {
          n += 1;
          await page.screenshot({ path: join(dir, 'clicks', `${n}.png`) });
          // закрываем то, что открылось, чтобы следующий клик стартовал чисто
          await page.keyboard.press('Escape').catch(() => {});
          await page.waitForTimeout(150);
        }
      } catch (e) {
        outcome = `клик не прошёл: ${e.message.split('\n')[0]}`;
      }
      page.off('pageerror', onErr);

      results.push({ selector: sel, label, outcome, errors, shot: outcome === 'ok' ? `${id}/clicks/${n}.png` : null });
    }
  }
  return results;
}

async function inspectPage(browser, p) {
  const dir = join(ARTIFACTS, p.id);
  await mkdir(join(dir, 'clicks'), { recursive: true });

  const url = liveUrl(p);
  const ctx = await newContext(browser, {
    viewport: VIEWPORTS.desktop,
    cookies: sessionCookies(),
  });
  const { page, diag } = await openWithDiagnostics(ctx, url);

  const record = {
    id: p.id,
    url,
    design: p.design,
    auth: p.auth,
    ported: p.ported,
    note: p.note,
    ...diag,
    redirected: diag.finalUrl && !diag.finalUrl.startsWith(url.split('?')[0]),
    siteCss: false,
    title: null,
    h1: null,
    shots: {},
    links: { broken: [], external: [] },
    clicks: [],
  };

  record.title = await page.title().catch(() => null);
  record.h1 = await page.$eval('h1', (e) => e.textContent.trim()).catch(() => null);
  record.siteCss = await page
    .$$eval('link[rel="stylesheet"]', (ls) => ls.some((l) => l.href.includes('site.css')))
    .catch(() => false);

  record.shots.desktop = `${p.id}/desktop.png`;
  await shoot(page, join(dir, 'desktop.png'));

  record.links = await checkLinks(page, url);
  if (doClick) record.clicks = await clickAround(page, dir, p.id);

  await ctx.close();

  /**
   * Планшет и телефон. Горизонтальную прокрутку проверяем на обеих ширинах:
   * это почти всегда блок, вылезший за экран, и на планшете он ловится не реже,
   * чем на телефоне, — там ломаются сетки в три-четыре колонки.
   */
  if (doMobile) {
    record.overflow = {};
    for (const name of ['tablet', 'mobile']) {
      const vctx = await newContext(browser, {
        viewport: VIEWPORTS[name],
        cookies: sessionCookies(),
      });
      const { page: vp } = await openWithDiagnostics(vctx, url);
      await shoot(vp, join(dir, `${name}.png`));
      record.overflow[name] = await vp
        .evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
        .catch(() => null);
      record.shots[name] = `${p.id}/${name}.png`;
      await vctx.close();
    }
    // сохраняем прежнее имя поля: по нему отчёт печатает замечание
    record.horizontalOverflow = record.overflow.mobile || record.overflow.tablet;
  }

  if (doDesign && p.design) {
    const dctx = await newContext(browser, { viewport: VIEWPORTS.desktop });
    const { page: dp } = await openWithDiagnostics(dctx, designUrl(p));
    await shoot(dp, join(dir, 'design.png'));
    record.shots.design = `${p.id}/design.png`;
    await dctx.close();
  }

  return record;
}

/**
 * Без CB_SESSION закрытый экран обязан увести на вход — это работа guard'а из
 * middleware.ts, а не поломка. Снимок при этом показывает форму входа, и сверять
 * его с макетом дашборда бессмысленно.
 */
function guarded(r) {
  return r.auth === 'lk' && !process.env.CB_SESSION && /\/login\b/.test(r.finalUrl ?? '');
}

function problems(r) {
  const out = [];
  if (r.status === null) out.push('страница не открылась');
  else if (r.status >= 400) out.push(`HTTP ${r.status}`);
  if (r.redirected && !guarded(r)) out.push(`редирект → ${r.finalUrl}`);
  if (!r.siteCss) out.push('site.css не подключён');
  if (r.pageErrors.length) out.push(`JS-ошибок: ${r.pageErrors.length}`);
  if (r.consoleErrors.length) out.push(`ошибок в консоли: ${r.consoleErrors.length}`);
  if (r.failedRequests.length) out.push(`упавших запросов: ${r.failedRequests.length}`);
  if (r.badResponses.length) out.push(`ответов 4xx/5xx: ${r.badResponses.length}`);
  if (r.links.broken.length) out.push(`битых ссылок: ${r.links.broken.length}`);
  if (r.overflow?.tablet && r.overflow?.mobile) out.push('горизонтальная прокрутка на планшете и телефоне');
  else if (r.overflow?.mobile) out.push('горизонтальная прокрутка на телефоне');
  else if (r.overflow?.tablet) out.push('горизонтальная прокрутка на планшете');
  const clickErrors = r.clicks.filter((c) => c.errors.length || c.outcome.startsWith('клик не прошёл'));
  if (clickErrors.length) out.push(`проблемных кликов: ${clickErrors.length}`);
  return out;
}

function toMarkdown(records) {
  const lines = [
    '# Обход сайта',
    '',
    `Снято: ${new Date().toISOString()}`,
    `Страниц: ${records.length}`,
    '',
    '> Экраны со статусом «заглушка» ещё не перенесены — редирект на `/login`',
    '> у закрытых разделов без `CB_SESSION` тоже ожидаем.',
    '',
    '| Страница | URL | Статус | Что нашли |',
    '|---|---|---|---|',
  ];
  for (const r of records) {
    const p = problems(r);
    lines.push(
      `| ${r.id}${r.ported ? '' : ' (заглушка)'} | ${r.url} | ${r.status ?? '—'} | ${
        p.length ? p.join('; ') : guarded(r) ? 'нет сессии — показан вход' : 'чисто'
      } |`,
    );
  }

  for (const r of records) {
    const p = problems(r);
    if (!p.length && !r.clicks.length) continue;
    lines.push('', `## ${r.id}`, '', `\`${r.url}\` → \`${r.finalUrl}\``, '');
    if (r.title) lines.push(`Заголовок: ${r.title}`);
    if (r.h1) lines.push(`H1: ${r.h1}`);
    if (r.note) lines.push('', `Помнить: ${r.note}`);
    const block = (name, items, fmt) => {
      if (!items?.length) return;
      lines.push('', `**${name}**`, '');
      items.slice(0, 15).forEach((i) => lines.push(`- ${fmt(i)}`));
      if (items.length > 15) lines.push(`- …ещё ${items.length - 15}`);
    };
    block('JS-ошибки', r.pageErrors, (i) => i.split('\n')[0]);
    block('Консоль', r.consoleErrors, (i) => i.slice(0, 200));
    block('Упавшие запросы', r.failedRequests, (i) => `${i.url} — ${i.error}`);
    block('Ответы 4xx/5xx', r.badResponses, (i) => `${i.status} ${i.url}`);
    block('Битые ссылки', r.links.broken, (i) => `${i.href} — ${i.status}`);
    block(
      'Клики',
      r.clicks.filter((c) => c.errors.length || c.outcome !== 'ok'),
      (i) => `${i.label} (${i.selector}) — ${i.outcome}${i.errors.length ? '; ' + i.errors[0] : ''}`,
    );
    lines.push('', `Скриншоты: ${Object.values(r.shots).join(', ')}`);
  }
  return lines.join('\n') + '\n';
}

const browser = await launch();
const records = [];
try {
  for (const p of pages) {
    process.stdout.write(`· ${p.id} … `);
    try {
      const r = await inspectPage(browser, p);
      records.push(r);
      const pr = problems(r);
      console.log(pr.length ? pr.join('; ') : guarded(r) ? 'нет сессии — показан вход' : 'чисто');
    } catch (e) {
      console.log(`сорвалось: ${e.message.split('\n')[0]}`);
      records.push({
        id: p.id,
        url: liveUrl(p),
        status: null,
        ported: p.ported,
        note: p.note,
        pageErrors: [e.message],
        consoleErrors: [],
        failedRequests: [],
        badResponses: [],
        links: { broken: [], external: [] },
        clicks: [],
        shots: {},
      });
    }
  }
} finally {
  await browser.close();
}

await mkdir(ARTIFACTS, { recursive: true });
await writeFile(join(ARTIFACTS, 'report.json'), JSON.stringify(records, null, 2));
await writeFile(join(ARTIFACTS, 'report.md'), toMarkdown(records));
console.log(`\nОтчёт: artifacts/report.md · скриншоты: artifacts/<страница>/`);

const bad = records.filter((r) => problems(r).length);
if (bad.length) console.log(`С замечаниями: ${bad.map((r) => r.id).join(', ')}`);
