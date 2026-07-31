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

test.describe('Guard пропускает с сессией', () => {
  // Держит баг, который жил незамеченным: guard собирал адрес проверки из
  // req.url, а внутри middleware это https://localhost:3005 — https поверх
  // обычного http-порта. Запрос падал на TLS, и человека с рабочей сессией
  // всё равно уводило на вход. Отказ без cookie при этом работал исправно,
  // поэтому тесты ничего не замечали.
  const session = process.env.CB_SESSION;
  test.skip(!session, 'нужен CB_SESSION — см. Documents/test_account.md');

  test.use({
    storageState: {
      cookies: [
        {
          name: 'lk_session',
          value: process.env.CB_SESSION ?? '',
          domain: 'corebridge.ru',
          path: '/',
          expires: -1,
          httpOnly: true,
          secure: true,
          sameSite: 'Strict',
        },
      ],
      origins: [],
    },
  });

  for (const path of LK) {
    test(`${path} открывается, а не редиректит`, async ({ page }) => {
      const res = await page.goto(path);
      expect(res?.status()).toBe(200);
      expect(new URL(page.url()).pathname).toBe(path);
      await expect(page.locator('aside.sidebar')).toBeVisible();
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

  /**
   * Что здесь проверяется — именно **разводка**: субдомен уводит в админку,
   * а не на публичный сайт. Саму оболочку без входа увидеть нельзя и не нужно:
   * `AdminGuard` спрашивает `GET /admin/auth/me` из браузера и без сессии
   * показывает форму входа (почему проверка не в middleware — в самом guard'е).
   *
   * ⚠️ Раньше здесь ждали сайдбар и `.app--admin` у анонима. Это поведение
   * до появления входа в админку (коммит 7d62375): тесты остались, а экран
   * изменился, и четыре проверки держались красными, ничего не охраняя.
   * Оболочку под живой сессией смотрит `npm run inspect -- admin`.
   */
  for (const path of ['/', '/users', '/integrations']) {
    test(`админ-субдомен ${path} уводит в админку, а не на сайт`, async ({ page }) => {
      const res = await page.goto(ADMIN + path);
      expect(res?.status()).toBe(200);

      // без сессии — форма входа админки
      await expect(page.locator('.adm-login')).toBeVisible();

      // и ничего от публичного сайта: ни шапки, ни подвала
      await expect(page.locator('header.site-header')).toHaveCount(0);
      await expect(page.locator('.app--admin, aside.sidebar')).toHaveCount(0);
    });
  }

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

test.describe('Индексация', () => {
  test('sitemap.xml перечисляет публичные страницы и не выдаёт кабинет', async ({ request }) => {
    const res = await request.get('/sitemap.xml');
    expect(res.status()).toBe(200);
    const xml = await res.text();

    for (const path of ['/', '/pricing', '/docs', '/integrations', '/n8n', '/contacts', '/oferta']) {
      expect(xml, `${path} в карте`).toContain(`<loc>https://corebridge.ru${path}</loc>`);
    }
    for (const path of ['/dashboard', '/billing', '/settings', '/login', '/admin']) {
      expect(xml, `${path} не должен попадать в карту`).not.toContain(`corebridge.ru${path}<`);
    }
  });

  test('robots.txt закрывает кабинет и указывает на карту', async ({ request }) => {
    const res = await request.get('/robots.txt');
    expect(res.status()).toBe(200);
    const txt = await res.text();
    expect(txt).toContain('Sitemap: https://corebridge.ru/sitemap.xml');
    for (const path of ['/dashboard', '/billing', '/settings', '/lk/', '/admin']) {
      expect(txt, `${path} закрыт`).toContain(`Disallow: ${path}`);
    }
  });

  test('админ-субдомен закрыт от обхода целиком', async ({ request }) => {
    // отдаёт nginx: Next.js на 3005 общий и вернул бы robots основного домена
    const res = await request.get(ADMIN + '/robots.txt');
    expect(res.status()).toBe(200);
    expect((await res.text()).replace(/\s+/g, ' ')).toContain('Disallow: /');
    expect(await res.text()).not.toContain('Allow: /');
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
