/**
 * Сквозной путь нового клиента: от «увидел сайт» до «скачал файл .epf».
 * Единственная проверка, которая заводит настоящий аккаунт на проде.
 *
 *   node tools/journey.mjs           пройти путь и вычистить за собой
 *   node tools/journey.mjs --keep    не вычищать (для разбора, если что-то упало)
 *
 * ⚠️ Создаёт тенанта. В конце удаляет его полностью — вместе с пользователем,
 * лицензиями, журналом и самой строкой тенанта. Порядок чистки тот же, что
 * в `Documents/test_account.md` §3, поэтому заодно проверяется и он.
 *
 * Адрес берём в своём домене, но ВНЕ списка алиасов `deploy/mail/virtual`:
 * письма на него отбиваются на SMTP и не засоряют ящик Дмитрия.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { launch, newContext } from './lib/shot.mjs';

const SITE = 'https://corebridge.ru';
const keep = process.argv.includes('--keep');

const stamp = Date.now().toString(36);
const EMAIL = `qa-journey-${stamp}@corebridge.ru`;
const PASSWORD = 'Qa-Journey-2026!';
const NAME = 'Сквозной Прогон';

let pass = 0;
let fail = 0;
const failures = [];
const check = (what, ok, detail = '') => {
  if (ok) pass++;
  else {
    fail++;
    failures.push(`${what}${detail ? ` (${detail})` : ''}`);
  }
  console.log(`  ${ok ? '✓' : '✗'} ${what}${ok || !detail ? '' : ` — ${detail}`}`);
};

const psql = (sql) =>
  execFileSync(
    'docker',
    ['exec', 'corebridge-postgres', 'psql', '-U', 'corebridge', '-d', 'corebridge', '-tAc', sql],
    { encoding: 'utf8' },
  ).trim();

console.log(`Аккаунт прогона: ${EMAIL}\n`);

const browser = await launch();
const ctx = await newContext(browser, { viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

let tenantId = null;

try {
  // ── 1. Приходит на сайт и идёт регистрироваться ───────────────────────────
  console.log('1. С лендинга в регистрацию');
  await page.goto(SITE, { waitUntil: 'networkidle' });
  await page.locator('.hero .btn-primary').first().click();
  await page.waitForURL(/\/register/, { timeout: 10_000 });
  check('кнопка с главной ведёт в регистрацию', page.url().includes('/register'));

  // ── 2. Заводит аккаунт ────────────────────────────────────────────────────
  console.log('\n2. Регистрация');
  await page.locator('input[type="email"]').fill(EMAIL);
  const pwd = page.locator('input[type="password"]');
  for (let i = 0; i < (await pwd.count()); i++) await pwd.nth(i).fill(PASSWORD);
  const nameField = page.locator('input[name="name"], #name, #reg-name');
  if (await nameField.count()) await nameField.first().fill(NAME);
  for (const cb of await page.locator('form input[type="checkbox"]').all()) {
    await cb.check().catch(() => {});
  }
  await page.locator('form button[type="submit"]').first().click();
  await page.waitForURL(/\/dashboard|\/verify-email|\/login/, { timeout: 20_000 }).catch(() => {});
  check('после регистрации попали в продукт', /dashboard|verify-email/.test(page.url()), page.url());

  tenantId = psql(`select tenant_id from platform.users where email='${EMAIL}'`);
  check('тенант заведён в базе', tenantId.length === 36, tenantId || 'нет записи');

  const plan = psql(`select plan from platform.tenants where id='${tenantId}'`);
  check('тариф — пробный', plan === 'trial', plan);

  const perpetual = psql(
    `select coalesce(valid_until::text,'бессрочно') from platform.licenses where tenant_id='${tenantId}'`,
  );
  check('лицензия бессрочная, как обещает сайт', perpetual === 'бессрочно', perpetual);

  // ── 3. Кабинет открывается и показывает своё ──────────────────────────────
  console.log('\n3. Кабинет');
  if (!page.url().includes('/dashboard')) {
    await page.goto(`${SITE}/dashboard`, { waitUntil: 'networkidle' });
  }
  check('дашборд доступен без повторного входа', page.url().includes('/dashboard'), page.url());
  const kpi = await page.locator('.kpi-grid').textContent();
  check('на дашборде виден пробный тариф', kpi.includes('Пробный'), kpi.slice(0, 60));

  // ── 4. Забирает файл .epf ─────────────────────────────────────────────────
  console.log('\n4. Файл .epf');
  await page.goto(`${SITE}/epf`, { waitUntil: 'networkidle' });
  const epfText = await page.locator('.page').first().textContent();
  check('токен выдан новому владельцу', /ey[A-Za-z0-9_-]{20,}/.test(epfText));
  check('предлагаются четыре конфигурации', (await page.locator('.cfg').count()) === 4, `${await page.locator('.cfg').count()}`);

  // скачивание через API: в браузере это файл, а нам нужен код ответа
  const cookies = await ctx.cookies();
  const session = cookies.find((c) => c.name === 'lk_session')?.value;
  check('cookie сессии поставлена', Boolean(session));

  const grant = await fetch(`${SITE}/lk/epf/download?config=ut11`, {
    headers: { cookie: `lk_session=${session}` },
  }).then((r) => r.json());
  check('одноразовый токен на скачивание выдан', Boolean(grant.token), JSON.stringify(grant).slice(0, 80));

  const file = await fetch(`${SITE}${grant.download_url}`);
  const body = Buffer.from(await file.arrayBuffer());
  check('файл скачался', file.status === 200 && body.length > 0, `${file.status}, ${body.length} байт`);

  /**
   * Клиент должен получить ровно ту сборку, что зарегистрирована. Проверяем
   * содержимое, а не факт ответа 200: в июле на прод уехали 731-байтовые
   * текстовые заглушки, и «скачивание работает» было правдой, а толку — ноль.
   */
  const got = createHash('sha256').update(body).digest('hex');
  check('содержимое совпадает с зарегистрированной версией', got === grant.sha256,
    `скачано ${got.slice(0, 16)}, в базе ${String(grant.sha256).slice(0, 16)}`);
  check('это не заглушка, а настоящая сборка', body.length > 51200, `${body.length} байт`);

  const again = await fetch(`${SITE}${grant.download_url}`);
  check('повторное скачивание по тому же токену закрыто', again.status === 410, String(again.status));

  // ── 5. Ограничения пробного тарифа честны ─────────────────────────────────
  console.log('\n5. Ограничения пробного тарифа');
  const refresh = await fetch(`${SITE}/lk/token/refresh`, {
    method: 'POST',
    headers: { cookie: `lk_session=${session}` },
  });
  check('перевыпуск токена требует оплаты', refresh.status === 402, String(refresh.status));

  await page.goto(`${SITE}/billing`, { waitUntil: 'networkidle' });
  const billing = await page.locator('.billing-grid').textContent();
  check('в биллинге показан пробный тариф', billing.includes('Пробный'));
  check('обещано отсутствие автопродления', billing.includes('Автопродления нет'));

  // ── 6. Выходит ────────────────────────────────────────────────────────────
  console.log('\n6. Выход');
  await page.goto(`${SITE}/settings`, { waitUntil: 'networkidle' });
  await page.locator('.sidebar-nav a', { hasText: 'Выйти' }).first().click();
  await page.waitForURL(/\/login/, { timeout: 15_000 }).catch(() => {});
  check('выход уводит на форму входа', page.url().includes('/login'), page.url());

  const after = await fetch(`${SITE}/lk/dashboard`, { headers: { cookie: `lk_session=${session}` } });
  check('сессия погашена на сервере', after.status === 401, String(after.status));

  check('ошибок в консоли не было', errors.length === 0, errors[0] ?? '');
} catch (e) {
  fail++;
  failures.push(`сорвался: ${e.message.split('\n')[0]}`);
  console.log(`  ✗ сорвался: ${e.message.split('\n')[0]}`);
} finally {
  await browser.close();
}

// ── 7. Чистка ───────────────────────────────────────────────────────────────
if (tenantId && tenantId.length === 36 && !keep) {
  console.log('\n7. Чистка за собой');
  try {
    /**
     * ⚠️ Подтверждение удаления. У тенанта с названием компании передаётся
     * название, у безымянного — его же `id`. Прежняя инструкция говорила
     * передавать `null`; сервер это больше не принимает и отвечает
     * `COMPANY_NAME_MISMATCH`. Найдено этим самым прогоном 2026-07-30.
     */
    const company = psql(`select coalesce(company_name,'') from platform.tenants where id='${tenantId}'`);
    const confirm = company || tenantId;

    /**
     * Обе фазы штатной механикой. С 2026-07-31 они проходят целиком:
     * сервер убрал бессмысленное обезличивание `actor` (uuid — не персональные
     * данные) и вычистил настоящую утечку из `new_value` миграцией 027.
     * Если тут снова упадёт — это регрессия, и прогон должен покраснеть.
     */
    execFileSync(
      'docker',
      [
        'exec', 'corebridge-admin', 'node', '-e',
        `const s=require('/app/src/services/admin/privacy_admin.service');` +
          `s.scheduleDeletion('${tenantId}',{reason:'сквозной прогон',confirm_company_name:'${confirm}'},null,'qa@corebridge.ru')` +
          `.then(()=>s.purgeTenant('${tenantId}')).then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1)});`,
      ],
      { encoding: 'utf8', stdio: 'pipe' },
    );

    /**
     * ⚠️ Очередь наполняется асинхронно: запись `workspace_init_failed` прилетает
     * через несколько секунд после регистрации — то есть уже после чистки.
     * Первые прогоны оставляли по осиротевшей записи каждый. Ждём и подчищаем
     * всё, у чего тенанта больше нет, — заодно за прошлыми прогонами.
     */
    execFileSync('sleep', ['8']);

    // Строку тенанта удаляем сами: каскад уносит пользователей, лицензии,
    // интеграции и счётчики. Журнал не трогаем — он неизменяем и должен остаться.
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
    check('аккаунт прогона вычищен полностью', left === '0', `осталось записей: ${left}`);
    /**
     * Журнал остаётся намеренно и должен быть анонимным: `lk_user:<uuid>` —
     * псевдоним, а не персональные данные, а почта из `new_value` убрана
     * сервером (миграция 027). Проверяем именно отсутствие ПДн.
     */
    const pii = psql(
      `select count(*) from platform.audit_log where tenant_id='${tenantId}'` +
        ` and new_value::text ~* '"(email|phone)"'`,
    );
    check('в журнале не осталось персональных данных', pii === '0', `записей с ПДн: ${pii}`);
  } catch (e) {
    check('чистка выполнена', false, e.message.split('\n')[0]);
  }
} else if (keep) {
  console.log(`\n7. Чистка пропущена (--keep). Тенант ${tenantId} остался в базе.`);
}

console.log(`\n${'─'.repeat(60)}`);
console.log(`Пройдено: ${pass}, провалено: ${fail}`);
if (failures.length) {
  console.log('\nЧто не сошлось:');
  for (const f of failures) console.log(`  · ${f}`);
}
process.exit(fail > 0 ? 1 : 0);
