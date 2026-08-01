import { test, expect } from '@playwright/test';

/**
 * Что страница показывает о себе поисковику и мессенджеру.
 *
 * Проверяем не «есть ли ключевые слова» — это вкусовщина, — а то, что ломается
 * молча и надолго: пропавший canonical (дубли в индексе), заголовок длиннее
 * строки выдачи, описание, обрезанное на полуслове, потерянный `og:image`
 * (ссылка в Telegram без картинки) и разметка, которая не разбирается.
 *
 * ⚠️ Выборка, а не все 41 страница: набор идёт по живому проду за лимитером
 * nginx, и сплошной обход отсюда ронял 429 в чужие тесты (разбор — в BACKLOG,
 * раздел про документацию). Сплошную проверку делает `tools/seo-audit.mjs`.
 */

/** По одной странице каждого типа: лендинг, каталог, документация, инструкция. */
const PAGES = ['/', '/pricing', '/integrations', '/n8n', '/docs', '/docs/epf', '/docs/epf/ustanovka-ut11'];

test.describe('Выдача и карточка в мессенджерах', () => {
  /**
   * ⚠️ Разбираем ответ сервера, а не открываем страницу браузером. Заход
   * браузера тянет стили, шрифты и скрипты — десяток запросов на страницу,
   * и семь таких заходов снова подводили набор под `per_ip` nginx, роняя 429
   * в чужие тесты. В `<head>` смотреть нечего, кроме самого HTML.
   */
  for (const path of PAGES) {
    test(`${path}: заголовок, описание, canonical и og:image на месте`, async ({ request }) => {
      const res = await request.get(path);
      expect(res.status(), path).toBe(200);
      const html = await res.text();
      const pick = (re: RegExp) => (html.match(re) ?? [])[1];

      const title = pick(/<title>([^<]*)<\/title>/);
      expect(title, `title на ${path}`).toBeTruthy();
      expect(title!.length).toBeGreaterThan(20);
      // за ~65 знаками выдача обрезает — хвост заголовка виден не будет
      expect(title!.length, `title на ${path}: «${title}»`).toBeLessThanOrEqual(65);

      const desc = pick(/<meta name="description" content="([^"]*)"/);
      expect(desc, `description на ${path}`).toBeTruthy();
      expect(desc!.length).toBeGreaterThan(70);
      expect(desc!.length).toBeLessThanOrEqual(175);

      expect(html, `canonical на ${path}`).toMatch(/<link rel="canonical" href="[^"]+"/);
      expect(html, `og:image на ${path}`).toMatch(/property="og:image" content="[^"]+"/);

      // ровно один <h1>: он объявляет, о чём страница
      expect((html.match(/<h1[ >]/g) ?? []).length, `<h1> на ${path}`).toBe(1);
    });
  }

  test('структурированные данные разбираются и описывают то, что на странице', async ({ page }) => {
    await page.goto('/');
    const types = await page
      .locator('script[type="application/ld+json"]')
      .evaluateAll((els) => els.map((e) => JSON.parse(e.textContent ?? '{}')['@type']));
    expect(types).toEqual(expect.arrayContaining(['Organization', 'WebSite', 'SoftwareApplication']));

    await page.route('**/docs/images/**', (route) => route.abort());
    await page.goto('/docs/epf/ustanovka-ut11');
    const article = await page
      .locator('script[type="application/ld+json"]')
      .evaluateAll((els) => els.map((e) => JSON.parse(e.textContent ?? '{}')));

    const crumbs = article.find((d) => d['@type'] === 'BreadcrumbList');
    expect(crumbs, 'хлебные крошки размечены').toBeTruthy();
    // порядок в разметке должен совпадать с видимой строкой над заголовком
    expect(crumbs.itemListElement.map((i: { name: string }) => i.name)).toEqual([
      'Главная',
      'Документация',
      'Инструкции по .epf',
      '1С:УТ 11',
    ]);
    expect(article.some((d) => d['@type'] === 'TechArticle'), 'страница размечена как статья').toBe(true);
  });

  test('карта сайта перечисляет раздел инструкций и не выдаёт кабинет', async ({ request }) => {
    const xml = await (await request.get('/sitemap.xml')).text();
    expect(xml).toContain('https://corebridge.ru/docs/epf/ustanovka-ut11');
    expect(xml).not.toContain('/dashboard');
    expect(xml).not.toContain('/billing');
    // даты должны быть разными: одинаковые = «изменилось всё сразу», пустой сигнал
    const dates = new Set([...xml.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map((m) => m[1]));
    expect(dates.size, 'даты изменения берутся из истории файлов').toBeGreaterThan(3);
  });

  test('картинка для соцсетей отдаётся и это картинка нужного размера', async ({ request }) => {
    const res = await request.get('/og.png');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('image/png');

    const png = await res.body();
    expect(png.readUInt32BE(16)).toBe(1200);
    expect(png.readUInt32BE(20)).toBe(630);
  });
});
