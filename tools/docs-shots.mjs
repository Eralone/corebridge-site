/**
 * Скриншоты для документации: путь клиента от формы входа до JWT-токена.
 *
 *   node tools/docs-shots.mjs           снять и вычистить за собой
 *   node tools/docs-shots.mjs --keep    не вычищать (для разбора, если упало)
 *
 * Кладёт в public/docs/lk/: login.png, dashboard.png, epf-config.png,
 * epf-token.png, epf-download.png — их показывает раздел «Как получить
 * JWT-токен» на /docs.
 *
 * ⚠️ Заводит настоящий аккаунт на проде и в конце удаляет его полностью —
 * порядок чистки тот же, что в `Documents/test_account.md` §3 и в
 * `tools/journey.mjs`. Своего аккаунта у документации быть не может:
 * страница /epf показывает токен, а токен выдаётся только живой лицензии.
 *
 * ── Что на снимках подменено и почему ───────────────────────────────────────
 * · **JWT-токен** заменён на образец той же формы. Настоящий токен — ключ
 *   к данным аккаунта, и хотя аккаунт тут же удаляется, публиковать его
 *   в документации нельзя ни в каком виде.
 * · **Почта и имя** заменены на `client@example.ru` / «Иван Петров»: адрес
 *   прогона (`qa-docs-…@corebridge.ru`) в инструкции только сбивает с толку.
 * Остальное на снимках — настоящий прод: тариф, версии сборок, размеры файлов.
 */
import { execFileSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { launch, newContext } from './lib/shot.mjs';
import { ROOT } from './lib/pages.mjs';

const SITE = 'https://corebridge.ru';
const OUT = join(ROOT, 'public', 'docs', 'lk');
const keep = process.argv.includes('--keep');

const stamp = Date.now().toString(36);
const EMAIL = `qa-docs-${stamp}@corebridge.ru`;
const PASSWORD = 'Qa-Docs-2026!';
const NAME = 'Иван Петров';

/** Образец токена: форма настоящая (три части base64url), содержимое — нет. */
const SAMPLE_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0ZW5hbnRfaWQiOiJkZW1vIiwicGxhbiI6InRyaWFsIn0.' +
  'S1gnAtURa_obRaZeC_zDeMoNsTrAtSiOnOnLy';

const psql = (sql) =>
  execFileSync(
    'docker',
    ['exec', 'corebridge-postgres', 'psql', '-U', 'corebridge', '-d', 'corebridge', '-tAc', sql],
    { encoding: 'utf8' },
  ).trim();

/**
 * Рисует поверх страницы рамку у нужного элемента: без указания, куда нажимать,
 * скриншот кабинета — просто картинка.
 *
 * ⚠️ `number` — необязательный, и на экране «Файл .epf» его не ставим: у самой
 * страницы уже есть кружки шагов 1-2-3, и вторая нумерация поверх неё читалась
 * бы как продолжение первой. Там достаточно рамки, а номер шага несёт подпись
 * под картинкой в статье.
 *
 * @param where  'top' | 'bottom' | 'left' | 'right' — с какой стороны номер
 */
async function point(page, selector, number = null, where = 'left') {
  await page.evaluate(
    ({ selector, number, where }) => {
      const el = document.querySelector(selector);
      if (!el) throw new Error(`нечего подсвечивать: ${selector}`);
      const r = el.getBoundingClientRect();
      const top = r.top + window.scrollY;
      const left = r.left + window.scrollX;
      const pad = 6;

      const ring = document.createElement('div');
      ring.className = 'doc-mark';
      Object.assign(ring.style, {
        position: 'absolute',
        top: `${top - pad}px`,
        left: `${left - pad}px`,
        width: `${r.width + pad * 2}px`,
        height: `${r.height + pad * 2}px`,
        border: '3px solid #FF6B35',
        borderRadius: '12px',
        boxShadow: '0 0 0 4px rgba(255,107,53,.18)',
        pointerEvents: 'none',
        zIndex: '9998',
      });

      document.body.append(ring);
      if (number === null) return;

      const badge = document.createElement('div');
      badge.className = 'doc-mark';
      badge.textContent = String(number);
      Object.assign(badge.style, {
        position: 'absolute',
        width: '30px',
        height: '30px',
        borderRadius: '50%',
        background: '#FF6B35',
        color: '#fff',
        font: '700 16px/30px -apple-system,Segoe UI,Roboto,sans-serif',
        textAlign: 'center',
        boxShadow: '0 2px 8px rgba(0,0,0,.25)',
        pointerEvents: 'none',
        zIndex: '9999',
      });
      const pos = {
        left: { top: `${top + r.height / 2 - 15}px`, left: `${left - pad - 38}px` },
        right: { top: `${top + r.height / 2 - 15}px`, left: `${left + r.width + pad + 8}px` },
        top: { top: `${top - pad - 38}px`, left: `${left - pad}px` },
        bottom: { top: `${top + r.height + pad + 8}px`, left: `${left - pad}px` },
      }[where];
      Object.assign(badge.style, pos);
      document.body.append(badge);
    },
    { selector, number, where },
  );
}

/** Подменяет на странице всё, чего не должно быть в публичной документации. */
async function sanitize(page, email) {
  await page.evaluate(
    ({ email, sample }) => {
      const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = walk.nextNode(); n; n = walk.nextNode()) {
        if (!n.nodeValue) continue;
        n.nodeValue = n.nodeValue
          .replace(/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, sample)
          .replaceAll(email, 'client@example.ru');
      }
      for (const input of document.querySelectorAll('input')) {
        if (input.value === email) input.value = 'client@example.ru';
      }
      // кружок аватара рисуется первой буквой адреса — после подмены почты
      // он показывал бы «Q» от qa-docs@… и выдавал служебный аккаунт
      for (const av of document.querySelectorAll('.avatar, .av, .topbar-avatar, .user-av')) {
        if (av.textContent.trim().length === 1) av.textContent = 'C';
      }
    },
    { email, sample: SAMPLE_TOKEN },
  );
}

/**
 * Снимок области страницы. `selectors` — что должно попасть в кадр целиком,
 * в виде `'.css'` или `'.css@2'` (второй такой элемент на странице). Кадр —
 * объединение этих элементов и всех нарисованных пометок, плюс поля.
 *
 * Считаем по объединению, а не по одному элементу, потому что иначе срезается
 * то, что рядом: номер шага сбоку или собственный заголовок шага сверху.
 */
async function shotOf(page, selectors, file, { padding = 12 } = {}) {
  const boxes = [];
  for (const sel of selectors) {
    const [css, n] = sel.split('@');
    const box = await page.locator(css).nth(Number(n ?? 0)).boundingBox();
    if (!box) throw new Error(`не нашёл область для снимка: ${sel}`);
    boxes.push(box);
  }
  boxes.push(
    ...(await page.evaluate(() =>
      [...document.querySelectorAll('.doc-mark')].map((e) => {
        const r = e.getBoundingClientRect();
        return { x: r.left, y: r.top, width: r.width, height: r.height };
      }),
    )),
  );

  const vp = page.viewportSize();
  const x = Math.max(0, Math.min(...boxes.map((b) => b.x)) - padding);
  const y = Math.max(0, Math.min(...boxes.map((b) => b.y)) - padding);
  await page.screenshot({
    path: join(OUT, file),
    clip: {
      x,
      y,
      width: Math.min(Math.max(...boxes.map((b) => b.x + b.width)) + padding - x, vp.width - x),
      height: Math.min(Math.max(...boxes.map((b) => b.y + b.height)) + padding - y, vp.height - y),
    },
  });
  console.log(`  ✓ ${file}`);
}

/** Убирает пометки перед следующим кадром. */
const clearMarks = (page) => page.evaluate(() => document.querySelectorAll('.doc-mark').forEach((e) => e.remove()));

await mkdir(OUT, { recursive: true });
console.log(`Аккаунт съёмки: ${EMAIL}\n`);

const browser = await launch();
const ctx = await newContext(browser, { viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
let tenantId = null;

try {
  // ── Регистрация. На снимки не идёт: документация описывает путь того,
  //    у кого аккаунт уже есть, а форма регистрации показана на /register.
  await page.goto(`${SITE}/register`, { waitUntil: 'networkidle' });
  await page.locator('input[type="email"]').fill(EMAIL);
  const pwd = page.locator('input[type="password"]');
  for (let i = 0; i < (await pwd.count()); i++) await pwd.nth(i).fill(PASSWORD);
  const nameField = page.locator('input[name="name"], #name, #reg-name');
  if (await nameField.count()) await nameField.first().fill(NAME);
  for (const cb of await page.locator('form input[type="checkbox"]').all()) {
    await cb.check().catch(() => {});
  }
  await page.locator('form button[type="submit"]').first().click();
  await page.waitForURL(/\/dashboard|\/verify-email/, { timeout: 20_000 });

  tenantId = psql(`select tenant_id from platform.users where email='${EMAIL}'`);
  if (tenantId.length !== 36) throw new Error('тенант не завёлся, снимать нечего');

  // ── Шаг 1. Форма входа ────────────────────────────────────────────────────
  // Снимаем гостевой вид, поэтому в отдельном контексте без cookie сессии
  const guest = await ctx.browser().newContext({ viewport: { width: 1280, height: 900 }, locale: 'ru-RU' });
  const guestPage = await guest.newPage();
  await guestPage.goto(`${SITE}/login`, { waitUntil: 'networkidle' });
  await guestPage.locator('input[type="email"]').fill('client@example.ru');
  await guestPage.locator('input[type="password"]').fill('••••••••••');
  await point(guestPage, 'input[type="email"]', 1, 'left');
  await point(guestPage, 'form button[type="submit"]', 2, 'left');
  const authCard = (await guestPage.locator('.auth-card').count()) ? '.auth-card' : 'form';
  await shotOf(guestPage, [authCard], 'login.png', { padding: 28 });
  await guest.close();

  // ── Шаг 2. Дашборд: путь к странице «Файл .epf» ───────────────────────────
  await page.goto(`${SITE}/dashboard`, { waitUntil: 'networkidle' });
  await sanitize(page, EMAIL);
  await point(page, '.sidebar-nav a[href="/epf"]', 3, 'right');
  await page.screenshot({ path: join(OUT, 'dashboard.png') });
  console.log('  ✓ dashboard.png');

  // ── Шаг 3–5. Страница «Файл .epf» ─────────────────────────────────────────
  await page.goto(`${SITE}/epf`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.token-box code, .lk-error', { timeout: 15_000 });
  await sanitize(page, EMAIL);

  await point(page, '.cfg-grid');
  await shotOf(page, ['.step-head@0', '.cfg-grid'], 'epf-config.png');

  await clearMarks(page);
  await point(page, '.token-box .token-line button');
  await shotOf(page, ['.step-head@1', '.token-box'], 'epf-token.png');

  await clearMarks(page);
  await page.locator('.dl-btn').first().scrollIntoViewIfNeeded();
  await point(page, '.dl-btn');
  await shotOf(page, ['.step-head@2', '.dl-btn'], 'epf-download.png');

  // ⚠️ Кнопку скачивания не нажимаем: ссылка одноразовая, нажатие сожгло бы её впустую
} finally {
  await browser.close();
}

// ── Чистка ───────────────────────────────────────────────────────────────────
if (tenantId && tenantId.length === 36 && !keep) {
  console.log('\nЧистка за собой');
  const company = psql(`select coalesce(company_name,'') from platform.tenants where id='${tenantId}'`);
  const confirm = company || tenantId;
  execFileSync(
    'docker',
    [
      'exec', 'corebridge-admin', 'node', '-e',
      `const s=require('/app/src/services/admin/privacy_admin.service');` +
        `s.scheduleDeletion('${tenantId}',{reason:'скриншоты документации',confirm_company_name:'${confirm}'},null,'qa@corebridge.ru')` +
        `.then(()=>s.purgeTenant('${tenantId}')).then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1)});`,
    ],
    { encoding: 'utf8', stdio: 'pipe' },
  );

  // очередь наполняется асинхронно — ждём отложенные записи, иначе останутся сироты
  execFileSync('sleep', ['8']);

  psql(
    `begin;` +
      `delete from platform.privacy_requests where tenant_id='${tenantId}';` +
      `delete from platform.payments where tenant_id='${tenantId}';` +
      `delete from platform.dead_letter_queue where tenant_id='${tenantId}';` +
      `delete from platform.tenants where id='${tenantId}';` +
      `delete from platform.dead_letter_queue d where not exists ` +
      `(select 1 from platform.tenants t where t.id = d.tenant_id);` +
      `commit;`,
  );

  const left = psql(
    `select (select count(*) from platform.tenants where id='${tenantId}')+` +
      `(select count(*) from platform.users where email='${EMAIL}')+` +
      `(select count(*) from platform.licenses where tenant_id='${tenantId}')`,
  );
  console.log(left === '0' ? '  ✓ аккаунт вычищен полностью' : `  ✗ осталось записей: ${left}`);
  if (left !== '0') process.exit(1);
} else if (tenantId) {
  console.log(`\n⚠️ Аккаунт оставлен (--keep): ${EMAIL}, тенант ${tenantId}`);
}
