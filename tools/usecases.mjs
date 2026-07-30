/**
 * Прогон пользовательских сценариев: не «страница открылась», а «человек
 * дошёл до цели». Кликает так, как кликал бы клиент, и проверяет результат.
 *
 *   CB_SESSION=<cookie> node tools/usecases.mjs
 *   CB_SESSION=<cookie> node tools/usecases.mjs public   только публичные
 *
 * ⚠️ Ничего не меняет на сервере. Действия, которые создают или правят данные
 * (оплата, выпуск токена, приглашение), доводятся до последнего шага и там
 * останавливаются — проверяется, что форма собралась и кнопка активна.
 * Один раз уже дёрнул реальный /lk/token/refresh, больше так не делаем.
 */
import { launch, newContext, sessionCookies } from './lib/shot.mjs';

const SITE = 'https://corebridge.ru';
const only = process.argv[2];
const browser = await launch();

let pass = 0;
let fail = 0;
const failures = [];

/**
 * Один сценарий: открыть страницу, поделать, проверить.
 *
 * ⚠️ `asGuest` обязателен для публичных сценариев. Первый прогон шёл с cookie
 * во всех контекстах, и «гость» на самом деле был вошедшим клиентом: страница
 * тарифов показывала ему «Текущий тариф» и кнопки оплаты. Гостевой путь при
 * этом не проверялся вовсе, хотя выглядело, будто проверяется.
 */
async function scenario(name, url, body, { asGuest = false } = {}) {
  const ctx = await newContext(browser, {
    viewport: { width: 1440, height: 900 },
    cookies: asGuest ? [] : sessionCookies(),
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text().slice(0, 80)));

  const check = (what, ok, detail = '') => {
    if (ok) {
      pass++;
    } else {
      fail++;
      failures.push(`${name} → ${what}${detail ? ` (${detail})` : ''}`);
    }
    console.log(`   ${ok ? '✓' : '✗'} ${what}${ok || !detail ? '' : ` — ${detail}`}`);
  };

  console.log(`\n· ${name}`);
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
    await body(page, check);
  } catch (e) {
    fail++;
    failures.push(`${name} → сорвался: ${e.message.split('\n')[0]}`);
    console.log(`   ✗ сорвался: ${e.message.split('\n')[0]}`);
  }

  if (errors.length) {
    fail++;
    failures.push(`${name} → ошибки в консоли: ${errors[0]}`);
    console.log(`   ✗ ошибки в консоли: ${errors.length}, первая — ${errors[0]}`);
  }
  await ctx.close();
}

/** Публичный сценарий — всегда без cookie */
const scenarioGuest = (name, url, body) => scenario(name, url, body, { asGuest: true });

// ── Публичные сценарии ──────────────────────────────────────────────────────

await scenarioGuest('Гость изучает продукт с главной', `${SITE}/`, async (p, check) => {
  check('видит цену тарифа из каталога', (await p.locator('.plan .pr').first().textContent())?.includes('₽'));

  await p.locator('.cats-grid .cat').first().click();
  // навигация клиентская: события load не будет, ждём сам адрес
  await p.waitForURL(/\/integrations/, { timeout: 10_000 }).catch(() => {});
  check('карточка категории ведёт в каталог', p.url().includes('/integrations'), p.url());

  const cards = await p.locator('.int').count();
  check('в каталоге есть сервисы', cards > 20, `${cards} карточек`);
});

await scenarioGuest('Гость фильтрует каталог', `${SITE}/integrations`, async (p, check) => {
  const before = await p.locator('.cat-section').count();
  await p.locator('.chip-f', { hasText: 'CRM' }).first().click();
  await p.waitForTimeout(300);
  const after = await p.locator('.cat-section').count();
  check('фильтр сузил список', after === 1 && before > 1, `${before} → ${after}`);

  await p.locator('.chip-f', { hasText: 'Все' }).first().click();
  await p.waitForTimeout(300);
  check('«Все» возвращает полный список', (await p.locator('.cat-section').count()) === before);
});

await scenarioGuest('Гость сравнивает тарифы', `${SITE}/pricing`, async (p, check) => {
  const monthly = await p.locator('.plan .pr').nth(1).textContent();
  await p.locator('.toggle button', { hasText: 'Ежегодно' }).click();
  await p.waitForTimeout(300);
  const yearly = await p.locator('.plan .pr').nth(1).textContent();
  check('годовая цена отличается от месячной', monthly !== yearly, `${monthly?.trim()} → ${yearly?.trim()}`);
  check('показана зачёркнутая старая цена', (await p.locator('.plan .old').count()) > 0);

  const rows = await p.locator('.comp-tbl tbody tr').count();
  check('таблица сравнения заполнена', rows >= 10, `${rows} строк`);

  await p.locator('.faq-list summary').nth(1).click();
  await p.waitForTimeout(200);
  check('вопрос FAQ раскрывается', await p.locator('.faq-list details').nth(1).evaluate((d) => d.open));

  // гость не может платить — его ведут регистрироваться
  const cta = p.locator('.plan').nth(1).locator('a.btn, button.btn').first();
  check('у гостя кнопка ведёт на регистрацию', (await cta.getAttribute('href')) === '/register');
});

await scenarioGuest('Гость пишет в компанию', `${SITE}/contacts`, async (p, check) => {
  const submit = p.locator('form.form-card button[type="submit"]');
  check('пустая форма не отправляется', await submit.isDisabled());

  await p.locator('#c-name').fill('Иван Тестов');
  await p.locator('#c-email').fill('ivan@example.com');
  await p.locator('#c-message').fill('Проверка формы, отправлять не нужно.');
  await p.waitForTimeout(200);
  check('заполненная форма готова к отправке', await submit.isEnabled());

  await p.locator('label.cb input[type="checkbox"]').uncheck();
  await p.waitForTimeout(200);
  check('без согласия на обработку данных не отправить', await submit.isDisabled());
  // дальше не идём: обращение ушло бы на настоящую почту
});

await scenarioGuest('Гость ищет ответ в документации', `${SITE}/docs`, async (p, check) => {
  await p.locator('.docs-side a', { hasText: 'Вставить токен' }).first().click();
  await p.waitForTimeout(300);
  const y = await p.locator('#step3').evaluate((el) => el.getBoundingClientRect().top);
  check('якорь в оглавлении прокручивает к разделу', Math.abs(y) < 200, `отступ ${Math.round(y)}px`);

  const api = await p.locator('.api-tbl code').allTextContents();
  check('в справочнике есть проверка лицензии', api.some((t) => t.includes('/license/check')));
  check('нет выдуманных маршрутов из макета', !api.some((t) => t.includes('/usage') || t.includes('/run')));
});

await scenarioGuest('Гость читает оферту', `${SITE}/oferta`, async (p, check) => {
  const text = await p.locator('.legal-shell').textContent();
  check('реквизиты — реальные', text.includes('120704119287'));
  check('домашнего адреса нет', !text.includes('Красноармейская'));
  await p.locator('.legal-toc a').nth(3).click();
  await p.waitForTimeout(300);
  check('оглавление документа работает', p.url().includes('#s'));
});

if (only === 'public') {
  report();
} else {
  // ── Сценарии в кабинете ───────────────────────────────────────────────────

  await scenario('Клиент смотрит состояние дел', `${SITE}/dashboard`, async (p, check) => {
    check('не выкинуло на вход', p.url().includes('/dashboard'), p.url());
    const kpi = await p.locator('.kpi-grid .kv, .kpi-grid .kpi-value').allTextContents();
    check('KPI заполнены', kpi.length >= 4 && kpi.every((t) => t.trim() !== ''), kpi.join(' | '));

    await p.locator('label[for="r-7d"]').click();
    await p.waitForTimeout(800);
    check('переключение периода не роняет график', (await p.locator('.chart-card svg').count()) > 0);
  });

  await scenario('Клиент забирает файл .epf', `${SITE}/epf`, async (p, check) => {
    const configs = await p.locator('.cfg').count();
    check('конфигурации показаны', configs >= 1, `${configs}`);
    const text = await p.locator('main, .page').first().textContent();
    check('ERP из макета не предлагается', !text.includes('1С:ERP'));
    check('токен на экране есть', /ey[A-Za-z0-9_-]{10,}|Токен/.test(text));
    // «Скачать» не жмём: токен одноразовый, следующий человек получил бы протухший
  });

  await scenario('Клиент разбирается со сценариями', `${SITE}/workflows`, async (p, check) => {
    const cards = await p.locator('.icard').count();
    check('каталог сценариев не пуст', cards > 0, `${cards} карточек`);
    const first = p.locator('.icard').first();
    check('кнопка включения заблокирована без интеграции', await first.locator('button').first().isDisabled());
    const hint = await first.textContent();
    check('объяснено, почему нельзя включить', hint.includes('интеграц'), hint.slice(0, 60));
  });

  await scenario('Клиент проверяет тариф и лимиты', `${SITE}/billing`, async (p, check) => {
    const text = await p.locator('.billing-grid').textContent();
    check('лимиты показаны фактом, а не только планом', /\d+\s*\/\s*\d+/.test(text));
    check('написано про отсутствие автопродления', text.includes('Автопродления нет'));

    await p.locator('button', { hasText: 'Запросить счёт' }).click();
    await p.waitForTimeout(400);
    check('форма счёта открывается', (await p.locator('.cb-modal, [role="dialog"]').count()) > 0);
    await p.locator('button', { hasText: 'Отмена' }).first().click();
    await p.waitForTimeout(200);
  });

  await scenario('Клиент ходит по настройкам', `${SITE}/settings`, async (p, check) => {
    const tabs = p.locator('.set-side [role="tab"]');
    const n = await tabs.count();
    check('вкладки настроек на месте', n >= 4, `${n} вкладок`);
    check('до вкладок можно добраться с клавиатуры', await tabs.first().evaluate((el) => el.tagName === 'BUTTON' || el.hasAttribute('href')));
    for (let i = 0; i < Math.min(n, 6); i++) {
      await tabs.nth(i).click();
      await p.waitForTimeout(250);
    }
    const text = await p.locator('main, .page').first().textContent();
    check('вкладки переключаются без пустого экрана', text.trim().length > 200);
    check('SMS нигде не обещается', !/SMS/i.test(text));
  });

  await scenario('Клиент пишет в поддержку', `${SITE}/support`, async (p, check) => {
    const submit = p.locator('form button.btn-primary');
    check('пустое обращение не отправить', await submit.isDisabled());
    await p.locator('#s-subject').fill('Проверка формы');
    await p.locator('#s-message').fill('Отправлять не нужно.');
    await p.waitForTimeout(200);
    check('заполненное обращение готово к отправке', await submit.isEnabled());
    check('адрес ответа подставлен из аккаунта', (await p.locator('#s-email').inputValue()).includes('@'));
  });

  report();
}

function report() {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`Проверок пройдено: ${pass}, провалено: ${fail}`);
  if (failures.length) {
    console.log('\nЧто не сошлось:');
    for (const f of failures) console.log(`  · ${f}`);
  }
}

await browser.close();
process.exit(fail > 0 ? 1 : 0);
