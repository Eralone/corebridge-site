import { test, expect } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Раздел инструкций по .epf: 33 страницы, собранные из markdown команды модуля
 * (`tools/build-docs.mjs`), и путь до JWT-токена на /docs.
 *
 * Что здесь проверяется и почему именно это:
 *
 * · **все страницы открываются**. Список берём из манифеста сборки, а не пишем
 *   руками: добавили инструкцию — она проверяется сама, без правки теста;
 * · **картинки отдаются**. Их 69, они лежат в public и легко разъезжаются
 *   с разметкой при переименовании. Битая картинка в инструкции по установке —
 *   это человек, который не понял, куда нажимать;
 * · **ссылки между инструкциями живые**. Сборщик проверяет это на своей стороне,
 *   но только по своему манифесту; здесь — по живому серверу.
 */

type Manifest = {
  docs: Record<string, { title: string; nav: string; toc: { id: string; text: string }[] }>;
  sections: { id: string; title: string; docs: string[] }[];
};

const DOCS = join(process.cwd(), 'content', 'docs', 'epf');
const manifest: Manifest = JSON.parse(readFileSync(join(DOCS, 'manifest.json'), 'utf8'));
const SLUGS = manifest.sections.flatMap((s) => s.docs);

test.describe('Инструкции по .epf', () => {
  test('в левой панели все инструкции разложены по группам', async ({ page }) => {
    await page.goto('/docs/epf');

    const groups = page.locator('.docs-side .docs-nav-group');
    await expect(groups).toHaveCount(manifest.sections.length);

    // каждая группа сворачивается: это <details>, и содержимое лежит внутри неё.
    // В «Установке» на пункт больше — первым идёт «Первичная настройка» (/docs)
    for (const [i, section] of manifest.sections.entries()) {
      const group = groups.nth(i);
      const extra = section.id === 'install' ? 1 : 0;
      await expect(group.locator('summary')).toContainText(section.title);
      await expect(group.locator('a')).toHaveCount(section.docs.length + extra);
    }

    const install = groups.nth(0).locator('a').first();
    await expect(install).toHaveAttribute('href', '/docs');
    await expect(install).toHaveText('Первичная настройка');

    // и вместе они дают полный список — ни одна инструкция не потерялась
    for (const slug of SLUGS) {
      await expect(page.locator(`.docs-side a[href="/docs/epf/${slug}"]`)).toHaveCount(1);
    }
  });

  test('инструкции по установке ведут на первичную настройку', async ({ page }) => {
    /**
     * Разделы «Что нужно до начала» и «Получение файла» описывают получение
     * токена одной строкой — подробное описание живёт на /docs. Ссылку туда
     * добавляет сборщик правилом CROSSREFS, и она обязана быть на всех
     * четырёх инструкциях по установке.
     */
    for (const slug of manifest.sections[0].docs) {
      await page.route('**/docs/images/**', (route) => route.abort());
      await page.goto(`/docs/epf/${slug}`);
      await expect(
        page.locator('.doc-body a[href^="/docs#token"]'),
        `ссылка на первичную настройку в ${slug}`,
      ).not.toHaveCount(0);
    }
  });

  test('названия механик в таблицах особенностей ведут на свои инструкции', async ({ page }) => {
    await page.route('**/docs/images/**', (route) => route.abort());
    await page.goto('/docs/epf/ustanovka-ut11');

    // «Маркировка», «FBM/FBO», «Финансовые отчёты» и прочее упомянуты одной
    // строкой — у каждого своя инструкция, и попасть в неё нужно отсюда
    const links = page.locator('.doc-body td strong a[href^="/docs/epf/"]');
    expect(await links.count()).toBeGreaterThan(4);
  });

  test('на странице про токен отмечена она сама, а не инструкция', async ({ page }) => {
    await page.route('**/docs/lk/**', (route) => route.abort());
    await page.goto('/docs');

    const current = page.locator('.docs-side a[aria-current="page"]');
    await expect(current).toHaveCount(1);
    await expect(current).toHaveAttribute('href', '/docs');
    // панель всё равно показывает весь раздел: уйти в инструкции можно отсюда же
    await expect(page.locator('.docs-side .docs-nav-group')).toHaveCount(manifest.sections.length);
  });

  test('оглавление раздела перечисляет все инструкции', async ({ page }) => {
    await page.goto('/docs/epf');  // картинок на оглавлении нет — грузить нечего
    for (const slug of SLUGS) {
      await expect(
        page.locator(`.docs-content a[href="/docs/epf/${slug}"]`).first(),
        `карточка ${slug} на оглавлении`,
      ).toHaveCount(1);
    }
  });

  /**
   * Разметку проверяем браузером на выборке — по одной инструкции из каждого
   * раздела. Гонять все 33 страницы через браузер бессмысленно: разметка у них
   * общая, а четыре воркера на 33 навигации кладут прод-процесс в таймауты.
   */
  const SAMPLE = manifest.sections.map((s) => s.docs[0]);

  for (const slug of SAMPLE) {
    test(`/docs/epf/${slug} показывает содержимое и подсвечен в навигации`, async ({ page }) => {
      /**
       * ⚠️ Картинки не грузим. Инструкция тянет до 14 скриншотов, семь таких
       * заходов — это сотня запросов сверх набора, и весь прогон начинал
       * упираться в `per_ip` nginx (30 r/s), роняя 429 чужие тесты. Здесь
       * проверяется разметка, а сами файлы — отдельным тестом по диску.
       */
      await page.route('**/docs/images/**', (route) => route.abort());

      await page.goto(`/docs/epf/${slug}`);

      await expect(page.locator('h1')).toHaveText(manifest.docs[slug].title);
      // тело статьи, а не пустая заготовка: у инструкций всегда есть разделы
      expect(await page.locator('.doc-body h3').count()).toBeGreaterThan(0);

      // левая панель: текущая страница отмечена ровно одна, и её группа раскрыта,
      // иначе отметка есть, но человек её не видит
      const current = page.locator('.docs-side a[aria-current="page"]');
      await expect(current).toHaveCount(1);
      await expect(current).toHaveText(manifest.docs[slug].nav);
      await expect(page.locator('.docs-side details[open] a[aria-current="page"]')).toHaveCount(1);

      // правая панель: заголовки этой страницы, и каждый ведёт к своему разделу
      const toc = page.locator('.docs-toc a[href^="#"]');
      await expect(toc).toHaveCount(manifest.docs[slug].toc.length);
      for (const { id } of manifest.docs[slug].toc) {
        await expect(page.locator(`[id="${id}"]`), `якорь #${id}`).toHaveCount(1);
      }
    });
  }

});

/**
 * Сплошные проверки: 33 страницы, 69 картинок, перекрёстные ссылки.
 *
 * ⚠️ **Проверяем по файлам, а не запросами.** Первая версия дёргала по HTTP
 * каждую страницу и каждую картинку — 120 запросов сверх набора. nginx держит
 * на сайте `per_ip` 30 r/s с запасом 100 (`deploy/nginx/corebridge.ru.conf`),
 * воркеры Playwright делят лимит на всех, и полный прогон стал ронять 429
 * куда попало: то `/docs`, то `/verify-email`, то чужой тест про субдомены.
 * На скриншоте упавшего теста была страница nginx «429 Too Many Requests».
 *
 * Ловить это по HTTP незачем: картинки — статические файлы в `public/`,
 * маршруты страниц строит `generateStaticParams` из того же манифеста, а битые
 * перекрёстные ссылки и якоря ловит сам сборщик (`tools/build-docs.mjs` падает
 * на них). Реальные поломки — переименовали картинку, потеряли статью — видно
 * по файлам. Живой сервер проверяется выборкой: она подтверждает, что маршрут
 * и раздача статики работают, и стоит пять запросов вместо ста двадцати.
 */
test.describe('Инструкции по .epf — сплошная проверка', () => {
  const html = SLUGS.map((slug) => readFileSync(join(DOCS, `${slug}.html`), 'utf8')).join('\n');
  const uniq = (re: RegExp) => [...new Set([...html.matchAll(re)].map((m) => m[1]))];

  test('у каждой инструкции из манифеста собран HTML', () => {
    expect(SLUGS.length).toBe(33);
    for (const slug of SLUGS) {
      expect(existsSync(join(DOCS, `${slug}.html`)), `тело статьи ${slug}`).toBe(true);
    }
  });

  test('каждая картинка из инструкций лежит в public', () => {
    const images = uniq(/<img[^>]+src="([^"]+)"/g);
    expect(images.length, 'картинки вообще нашлись').toBeGreaterThan(50);

    for (const src of images) {
      expect(src.startsWith('/docs/images/'), `путь картинки ${src}`).toBe(true);
      expect(existsSync(join(process.cwd(), 'public', src)), `файл ${src}`).toBe(true);
    }
  });

  test('перекрёстные ссылки ведут на существующие инструкции', () => {
    const links = uniq(/<a href="(\/docs\/epf\/[^"#]+)[^"]*"/g);
    expect(links.length, 'перекрёстные ссылки нашлись').toBeGreaterThan(10);

    for (const href of links) {
      const slug = href.replace('/docs/epf/', '');
      expect(SLUGS, `ссылка ${href}`).toContain(slug);
    }
  });

  test('сервер отдаёт страницы и картинки раздела', async ({ request }) => {
    // выборка: маршрут статьи, картинка инструкции и снимок кабинета
    for (const url of [
      '/docs/epf',
      `/docs/epf/${SLUGS[0]}`,
      '/docs/images/master-step1-connect.png',
      '/docs/lk/epf-token.png',
    ]) {
      const res = await request.get(url);
      expect(res.status(), url).toBe(200);
    }
  });
});

test.describe('Путь до JWT-токена на /docs', () => {
  test('раздел на месте и показывает все пять шагов', async ({ page }) => {
    // сами снимки проверяет соседний тест запросами; здесь нужна только разметка
    await page.route('**/docs/lk/**', (route) => route.abort());
    await page.goto('/docs#token');
    await expect(page.locator('#token')).toHaveText('Где взять JWT-токен');

    const shots = page.locator('.step-shot img');
    await expect(shots).toHaveCount(5);
  });

  test('скриншоты кабинета отдаются и не подписаны настоящим токеном', async ({ page, request }) => {
    await page.route('**/docs/lk/**', (route) => route.abort());
    await page.goto('/docs#token');
    const srcs = await page.locator('.step-shot img').evaluateAll((els) =>
      els.map((e) => e.getAttribute('src') ?? ''),
    );
    for (const src of srcs) {
      const res = await request.get(src);
      expect(res.status(), `снимок ${src}`).toBe(200);
    }

    /**
     * ⚠️ В тексте страницы не должно быть ничего похожего на живой JWT.
     * На снимках токен подменён образцом (`tools/docs-shots.mjs`), но текст
     * страницы пишется руками, и туда токен может попасть по невнимательности.
     */
    const body = (await page.locator('body').textContent()) ?? '';
    expect(body).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./);
  });

  test('из раздела есть переход к инструкциям по установке', async ({ page }) => {
    await page.goto('/docs');
    for (const slug of ['ustanovka-ut11', 'ustanovka-unf', 'ustanovka-ka-erp', 'ustanovka-bp30']) {
      await expect(page.locator(`a[href="/docs/epf/${slug}"]`).first()).toHaveCount(1);
    }
    await expect(page.locator('a[href="/docs/epf"]').first()).toHaveCount(1);
  });
});