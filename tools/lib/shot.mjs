/**
 * Общее для инспектора и сверки: запуск Firefox, снятие детерминированных
 * скриншотов и сбор диагностики со страницы.
 */
import { firefox } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOT } from './pages.mjs';

export const ARTIFACTS = join(ROOT, 'artifacts');

/**
 * Гасим всё, что меняется от снимка к снимку: анимации, переходы, курсор
 * в полях ввода, «умное» сглаживание при плавном скролле. Без этого
 * попиксельная сверка ловит шум вместо расхождений вёрстки.
 */
const FREEZE_CSS = `
  *, *::before, *::after {
    animation-duration: 0s !important;
    animation-delay: 0s !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0s !important;
    transition-delay: 0s !important;
    scroll-behavior: auto !important;
    caret-color: transparent !important;
  }
`;

export async function launch() {
  return firefox.launch();
}

export async function newContext(browser, { viewport, cookies } = {}) {
  const ctx = await browser.newContext({
    viewport: viewport ?? { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    locale: 'ru-RU',
    timezoneId: 'Europe/Moscow',
    reducedMotion: 'reduce',
    // сертификаты у нас настоящие, но при запуске против 127.0.0.1 по https
    // проверка имени хоста мешала бы
    ignoreHTTPSErrors: true,
  });
  await ctx.addInitScript(() => {
    // фиксируем время: макеты и экраны рисуют «сегодня» в разных местах
    // (заголовки периодов, «последняя синхронизация»), иначе сверка плывёт
    // от запуска к запуску
    const FIXED = new Date('2026-01-15T12:00:00+03:00').getTime();
    const RealDate = Date;
    // @ts-expect-error подмена глобального Date — только внутри страницы
    globalThis.Date = class extends RealDate {
      constructor(...a) {
        return a.length ? new RealDate(...a) : new RealDate(FIXED);
      }
      static now() {
        return FIXED;
      }
    };
  });
  if (cookies?.length) await ctx.addCookies(cookies);
  return ctx;
}

/** Cookie сессии ЛК из переменной окружения — чтобы снимать закрытые экраны */
export function sessionCookies() {
  const value = process.env.CB_SESSION;
  if (!value) return [];
  return [
    { name: 'lk_session', value, domain: '.corebridge.ru', path: '/', httpOnly: true, secure: true },
  ];
}

/**
 * Открывает страницу и попутно собирает всё, на что стоит смотреть:
 * ошибки консоли, упавшие запросы, ответы 4xx/5xx, конечный URL после редиректов.
 */
export async function openWithDiagnostics(ctx, url, { waitFor = 'networkidle' } = {}) {
  const page = await ctx.newPage();
  const diag = {
    url,
    status: null,
    finalUrl: null,
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
    badResponses: [],
  };

  page.on('console', (m) => {
    if (m.type() === 'error') diag.consoleErrors.push(m.text());
  });
  page.on('pageerror', (e) => diag.pageErrors.push(String(e)));
  page.on('requestfailed', (r) => {
    const err = r.failure()?.errorText ?? '';
    // отменённые самим браузером префетчи Next.js — не ошибка страницы
    if (err.includes('NS_BINDING_ABORTED')) return;
    diag.failedRequests.push({ url: r.url(), error: err });
  });
  page.on('response', (r) => {
    if (r.status() >= 400) diag.badResponses.push({ url: r.url(), status: r.status() });
  });
  page.on('dialog', (d) => void d.dismiss().catch(() => {}));

  try {
    const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    diag.status = res?.status() ?? null;
    await page.waitForLoadState(waitFor, { timeout: 15_000 }).catch(() => {});
  } catch (e) {
    diag.pageErrors.push(`goto: ${e.message}`);
  }
  diag.finalUrl = page.url();

  await page.addStyleTag({ content: FREEZE_CSS }).catch(() => {});
  // шрифты грузятся с fonts.googleapis.com; без ожидания первый снимок
  // выходит в системном шрифте и сверка врёт
  await page.evaluate(() => document.fonts?.ready).catch(() => {});

  return { page, diag };
}

export async function shoot(page, file, { fullPage = true } = {}) {
  await mkdir(join(file, '..'), { recursive: true });
  // прокручиваем до низа и обратно: ленивые изображения и IntersectionObserver
  // иначе не срабатывают и в снимке остаются пустые места
  await page
    .evaluate(async () => {
      const step = window.innerHeight;
      for (let y = 0; y < document.body.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 40));
      }
      window.scrollTo(0, 0);
      await new Promise((r) => setTimeout(r, 120));
    })
    .catch(() => {});
  await page.screenshot({ path: file, fullPage });
  return file;
}
