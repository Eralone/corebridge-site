import { test, expect } from '@playwright/test';

/**
 * Каркас: маршрутизация, guard ЛК, разводка субдоменов, подключённые стили.
 * Содержимое экранов здесь не проверяем — оно появляется по этапам Э1–Э8,
 * а за вёрсткой следит tests/visual/compare.spec.ts.
 */

const ADMIN = process.env.ADMIN_BASE_URL ?? 'https://admin.corebridge.ru';

const PUBLIC = [
  '/',
  '/pricing',
  '/docs',
  '/integrations',
  '/n8n',
  '/contacts',
  '/for-business',
  '/oferta',
  '/privacy',
  '/terms',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
];

/** Закрыто guard'ом из middleware.ts */
const LK = ['/dashboard', '/epf', '/my-integrations', '/workflows', '/billing', '/settings'];

test.describe('Публичные страницы', () => {
  for (const path of PUBLIC) {
    test(`${path} открывается и подключает site.css`, async ({ page }) => {
      const res = await page.goto(path);
      expect(res?.status(), `HTTP на ${path}`).toBe(200);

      // site.css — вся вёрстка держится на нём; Tailwind запрещён (ограничение 4)
      const css = await page.$$eval('link[rel="stylesheet"]', (ls) => ls.map((l) => l.getAttribute('href')));
      expect(css.some((h) => h?.includes('site.css')), `site.css на ${path}`).toBe(true);

      // и он реально отдался, а не 404: у body должен быть цвет из темы
      const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
      expect(bg, `фон применился на ${path}`).not.toBe('rgba(0, 0, 0, 0)');

      await expect(page).toHaveTitle(/.+/);
    });
  }

  test('язык страницы русский — от него зависят переносы и шрифт', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  });
});

test.describe('Шрифты', () => {
  // Подключение с fonts.googleapis.com молча блокировалось CSP, и весь сайт
  // рисовался системным шрифтом. Теперь Inter лежит у нас — тест держит это.
  test('Inter действительно загружается, а не подменяется системным', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.fonts.check('16px Inter'))).toBe(true);
    const family = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
    expect(family).toContain('Inter');
  });

  test('шрифты отдаются со своего домена — без обращения к Google', async ({ page }) => {
    const external: string[] = [];
    page.on('request', (r) => {
      if (/fonts\.(googleapis|gstatic)\.com/.test(r.url())) external.push(r.url());
    });
    await page.goto('/pricing');
    await page.evaluate(() => document.fonts.ready);
    expect(external, 'запросы к Google Fonts').toEqual([]);
  });

  test('CSP ничего не блокирует на публичных страницах', async ({ page }) => {
    const blocked: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error' && /Content-Security-Policy/i.test(m.text())) blocked.push(m.text());
    });
    for (const path of ['/', '/pricing', '/login']) {
      await page.goto(path);
      await page.evaluate(() => document.fonts.ready);
    }
    expect(blocked).toEqual([]);
  });
});

test.describe('Guard личного кабинета', () => {
  for (const path of LK) {
    test(`${path} без сессии уводит на вход и помнит, куда шли`, async ({ page }) => {
      await page.goto(path);
      const url = new URL(page.url());
      expect(url.pathname).toBe('/login');
      expect(url.searchParams.get('next')).toBe(path);
    });
  }
});

test.describe('Разводка субдоменов', () => {
  test('на основном домене админка закрыта: /admin отдаёт 404', async ({ page }) => {
    const res = await page.goto('/admin', { waitUntil: 'domcontentloaded' });
    expect(res?.status()).toBe(404);
  });

  test('/admin/users с основного домена тоже 404', async ({ page }) => {
    const res = await page.goto('/admin/users', { waitUntil: 'domcontentloaded' });
    expect(res?.status()).toBe(404);
  });

  for (const path of ['/', '/users', '/integrations']) {
    test(`админ-субдомен ${path} рендерит оболочку админки`, async ({ page }) => {
      const res = await page.goto(ADMIN + path);
      expect(res?.status()).toBe(200);
      await expect(page.locator('aside.sidebar')).toBeVisible();
      await expect(page.locator('.admin-badge')).toBeVisible();
      // app--admin отличает админскую сетку от кабинета
      await expect(page.locator('.app--admin')).toHaveCount(1);
    });
  }

  test('на админ-субдомене подсвечен нужный пункт меню', async ({ page }) => {
    await page.goto(ADMIN + '/users');
    await expect(page.locator('.sidebar-nav a.active')).toHaveAttribute('href', '/users');
    await expect(page.locator('.sidebar-nav a.active')).toHaveCount(1);
  });

  test('/admin/* на субдомене остаётся за API и middleware его не перехватывает', async ({ request }) => {
    // whitelist по IP: с сервера прилетит 403 от nginx, но не страница Next.js
    const res = await request.get(ADMIN + '/admin/health', { failOnStatusCode: false });
    expect(res.status()).toBe(403);
    expect(await res.text()).not.toContain('__next');
  });
});

test.describe('Оболочка кабинета', () => {
  test('страница входа не тянет сайдбар кабинета', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('aside.sidebar')).toHaveCount(0);
  });

  test('в разметке не осталось ссылок на файлы макета', async ({ page }) => {
    for (const path of ['/', '/pricing', '/login']) {
      await page.goto(path);
      const hrefs = await page.$$eval('a[href]', (as) => as.map((a) => a.getAttribute('href') ?? ''));
      const html = hrefs.filter((h) => h.endsWith('.html'));
      expect(html, `ссылки на макет на ${path}`).toEqual([]);
      expect(hrefs.filter((h) => h.includes('about.html'))).toEqual([]);
    }
  });
});

test.describe('Эталон дизайна', () => {
  test('design-source отдаётся на 3006 — без этого сверка не поедет', async ({ request }) => {
    const res = await request.get('http://127.0.0.1:3006/index.html');
    expect(res.status()).toBe(200);
    expect(await res.text()).toContain('CoreBridge');
  });

  test('и его стили тоже', async ({ request }) => {
    const res = await request.get('http://127.0.0.1:3006/assets/site.css');
    expect(res.status()).toBe(200);
  });
});
