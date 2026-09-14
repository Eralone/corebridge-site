import { test, expect } from '@playwright/test';

/**
 * Платёжный контур: маршруты возврата с Robokassa и то, что кнопка «Оплатить»
 * закрыта флагом.
 *
 * Проверяется механика, а не вёрстка: главное здесь — адреса из кабинета
 * Robokassa (`/lk/billing/success` и `/lk/billing/fail`) доходят до сайта,
 * а не до lk-api, которому принадлежит весь префикс `/lk/`. Ровно на этом
 * в своё время сломалась ссылка из письма-приглашения.
 */

/** Адреса, прописанные в кабинете Robokassa, и наши канонические */
const RETURN_PATHS = [
  ['/lk/billing/success', '/billing/success'],
  ['/lk/billing/fail', '/billing/fail'],
  ['/billing/success', '/billing/success'],
  ['/billing/fail', '/billing/fail'],
] as const;

test.describe('Возврат с Robokassa', () => {
  for (const [entry, canonical] of RETURN_PATHS) {
    test(`${entry} обслуживает сайт, а не API`, async ({ page }) => {
      const res = await page.goto(entry);

      // Ключевое: это не 404 от lk-api и не его JSON. Без сессии guard уводит
      // на форму входа — значит, запрос дошёл до Next.js и был опознан
      // как закрытый экран кабинета.
      expect(res?.status()).toBe(200);
      const url = new URL(page.url());
      expect(url.pathname).toBe('/login');
      // возвращаем на нашу страницу, а не на префикс API
      expect(url.searchParams.get('next')).toBe(canonical);
    });
  }

  test('параметры Robokassa не теряются при подмене пути', async ({ page }) => {
    await page.goto('/lk/billing/success?InvId=1042&OutSum=5990.00');
    const next = new URL(page.url()).searchParams.get('next');
    expect(next).toContain('/billing/success');
    expect(next).toContain('InvId=1042');
  });
});

test.describe('Гость не получает кнопок оплаты', () => {
  /**
   * Проверка **не зависит от флага** `BILLING_PAY_ENABLED`, и в этом весь смысл:
   * оплата требует сессии и роли `owner`, поэтому неавторизованному посетителю
   * платить нечем — тенанта ещё не существует, сервер ответит 401. Раньше набор
   * пропускался при включённом флаге и переставал что-либо проверять именно
   * тогда, когда оплата становится настоящей.
   */
  test('на странице тарифов гостя ведут в регистрацию, а не в оплату', async ({ page }) => {
    await page.goto('/pricing');
    await expect(page.locator('.plan')).not.toHaveCount(0);
    await expect(page.locator('a[href^="/billing/pay"]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Оплатить' })).toHaveCount(0);
  });

  test('оформление оплаты закрыто guard\'ом', async ({ page }) => {
    await page.goto('/billing/pay?plan=professional');
    const url = new URL(page.url());
    expect(url.pathname).toBe('/login');
    expect(url.searchParams.get('next')).toContain('/billing/pay');
  });
});

test.describe('Подпись платежа считает сервер', () => {
  /**
   * 🔴 F20 §4: подпись в браузере означала бы `Password1` магазина в исходниках —
   * любой посетитель выписал бы себе «Профессионал» за 1 ₽, и подпись сошлась бы.
   * Тест держит это на уровне собранного бандла, а не намерений: ищем в коде
   * страниц биллинга следы криптографии и пароля магазина.
   */
  for (const path of ['/pricing', '/login']) {
    test(`в бандле ${path} нет ни MD5, ни пароля магазина`, async ({ page }) => {
      const scripts: string[] = [];
      page.on('response', async (r) => {
        if (r.url().endsWith('.js') && r.status() === 200) {
          scripts.push(await r.text().catch(() => ''));
        }
      });
      await page.goto(path);
      await page.waitForLoadState('networkidle');

      const code = scripts.join('\n');
      expect(code).not.toMatch(/ROBOKASSA_PASSWORD/i);
      expect(code).not.toMatch(/MerchantLogin["']?\s*:\s*["'][A-Za-z]/);
      expect(code).not.toMatch(/crypto-js|createHash\(['"]md5/i);
    });
  }
});
