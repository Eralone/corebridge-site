import { test, expect } from '@playwright/test';

/**
 * Экраны авторизации. Проверяем не вёрстку (за ней следит попиксельная сверка),
 * а то, что механика подключена к живому API и что из макета убрано лишнее.
 *
 * Регистрацию настоящего аккаунта здесь не делаем: тесты гоняются против прода,
 * и мусорные тенанты никому не нужны. Проверяем валидацию до отправки и разбор
 * ответов сервера на заведомо неверных данных.
 */

test.describe('Вход', () => {
  test('в форме нет Google — вход через Яндекс ID', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText('Google')).toHaveCount(0);
    const yandex = page.getByRole('link', { name: /Яндекс ID/ });
    await expect(yandex).toBeVisible();
    // ссылка ведёт на серверный редирект, а не на oauth.yandex.ru напрямую
    await expect(yandex).toHaveAttribute('href', '/lk/auth/yandex');
  });

  test('выдуманного отзыва из макета нет', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText(/Ритейл-М/)).toHaveCount(0);
  });

  test('неверная пара почта-пароль объясняется человеческим текстом', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('textbox', { name: 'Email' }).fill('no-such-user@example.com');
    await page.getByRole('textbox', { name: 'Пароль' }).fill('definitely-wrong-1');
    await page.getByRole('button', { name: 'Войти', exact: true }).click();

    // сервер отвечает INVALID_CREDENTIALS одинаково на плохую почту и плохой пароль
    await expect(page.locator('.auth-alert--error')).toHaveText(/Неверная почта или пароль/);
  });

  test('вход по ссылке из письма не выдаёт, есть ли такой аккаунт', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('textbox', { name: 'Email' }).fill('no-such-user@example.com');
    await page.getByRole('button', { name: 'Прислать ссылку для входа' }).click();
    await expect(page.locator('.auth-alert--success')).toHaveText(/Если такая почта у нас есть/);
  });

  test('без почты ссылку не запрашиваем', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Прислать ссылку для входа' }).click();
    await expect(page.locator('.auth-alert--error')).toHaveText(/Укажите почту/);
  });

  test('код блокировки от middleware превращается в объяснение', async ({ page }) => {
    await page.goto('/login?error=TENANT_BLOCKED');
    await expect(page.locator('.auth-alert--error')).toHaveText(/Доступ компании приостановлен/);
  });

  test('переключатель показа пароля работает', async ({ page }) => {
    await page.goto('/login');
    const pwd = page.getByRole('textbox', { name: 'Пароль' });
    await pwd.fill('секрет');
    await expect(pwd).toHaveAttribute('type', 'password');
    await page.getByRole('button', { name: 'Показать пароль' }).click();
    await expect(pwd).toHaveAttribute('type', 'text');
  });
});

test.describe('Регистрация', () => {
  test('тексты приведены к реальному тарифу', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByText('Бессрочный пробный тариф')).toBeVisible();
    await expect(page.getByText(/500 операций в месяц/)).toBeVisible();
    // из макета: срок «30 дней», суточный лимит и выдуманный счётчик компаний
    await expect(page.getByText(/5 операций в сутки/)).toHaveCount(0);
    await expect(page.getByText(/1 247 компаний/)).toHaveCount(0);
    await expect(page.getByText('Google')).toHaveCount(0);
  });

  test('несовпадающие пароли не уходят на сервер', async ({ page }) => {
    await page.goto('/register');
    await page.getByRole('textbox', { name: 'Рабочий email' }).fill('someone@example.com');
    await page.getByRole('textbox', { name: 'Пароль', exact: true }).fill('correct-horse-1');
    await page.getByRole('textbox', { name: 'Подтвердить пароль' }).fill('другое-совсем');

    let sent = false;
    page.on('request', (r) => {
      if (r.url().includes('/lk/auth/register')) sent = true;
    });
    await page.getByRole('button', { name: 'Зарегистрироваться', exact: true }).click();

    await expect(page.locator('.auth-alert--error')).toHaveText(/Пароли не совпадают/);
    expect(sent, 'запрос на сервер не должен уходить').toBe(false);
  });

  test('без согласия с офертой регистрация не идёт', async ({ page }) => {
    await page.goto('/register');
    await page.getByRole('textbox', { name: 'Рабочий email' }).fill('someone@example.com');
    await page.getByRole('textbox', { name: 'Пароль', exact: true }).fill('correct-horse-1');
    await page.getByRole('textbox', { name: 'Подтвердить пароль' }).fill('correct-horse-1');
    await page.getByRole('button', { name: 'Зарегистрироваться', exact: true }).click();
    await expect(page.locator('.auth-alert--error')).toHaveText(/примите оферту/);
  });

  test('полоска надёжности реагирует на пароль', async ({ page }) => {
    await page.goto('/register');
    const pwd = page.getByRole('textbox', { name: 'Пароль', exact: true });
    await pwd.fill('123');
    await expect(page.locator('.pwd-strength')).toHaveClass(/weak/);
    await pwd.fill('Длинный-Пароль-9!');
    await expect(page.locator('.pwd-strength')).toHaveClass(/strong/);
  });
});

test.describe('Восстановление пароля', () => {
  test('ответ одинаков для любого адреса — перебор не работает', async ({ page }) => {
    /**
     * ⚠️ Адрес уникальный на каждый прогон. С фиксированным
     * (`nobody-here@example.com`) тест сам себя блокировал: сервер ограничивает
     * запросы сброса **по адресу**, а не по IP — другой адрес с того же IP
     * получает 202 сразу же, а исчерпанный отвечает 429 и через 16 минут.
     * Проявилось при частых прогонах набора 2026-08-01; для сути проверки
     * подходит любой несуществующий адрес.
     */
    const nobody = `nobody-${Date.now().toString(36)}@example.com`;

    await page.goto('/forgot-password');
    await page.getByRole('textbox', { name: 'Email' }).fill(nobody);
    await page.getByRole('button', { name: 'Отправить инструкции' }).click();
    await expect(page.getByRole('heading', { name: 'Проверьте почту' })).toBeVisible();
    await expect(page.getByText(/Если такой аккаунт у нас есть/)).toBeVisible();
  });

  test('ссылка без токена объясняет, что делать', async ({ page }) => {
    await page.goto('/reset-password');
    await expect(page.getByRole('heading', { name: 'Ссылка неполная' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Запросить новую ссылку' })).toBeVisible();
  });

  test('просроченный или чужой токен не выглядит как успех', async ({ page }) => {
    await page.goto('/reset-password?token=obviously-not-a-real-token');
    await page.getByRole('textbox', { name: 'Новый пароль' }).fill('correct-horse-1');
    await page.getByRole('textbox', { name: 'Подтвердить пароль' }).fill('correct-horse-1');
    await page.getByRole('button', { name: 'Сохранить пароль' }).click();
    await expect(page.locator('.auth-alert--error')).toHaveText(/Ссылка недействительна/);
  });
});

test.describe('Подтверждение почты', () => {
  test('без токена показывает ожидание письма', async ({ page }) => {
    await page.goto('/verify-email');
    await expect(page.getByRole('heading', { name: 'Подтвердите email' })).toBeVisible();
    // кнопка повторной отправки заблокирована, пока идёт отсчёт
    await expect(page.getByRole('button', { name: 'Отправить повторно' })).toBeDisabled();
    await expect(page.locator('.timer')).toContainText('Повторная отправка через');
  });

  test('негодный токен объясняется, а не молчит', async ({ page }) => {
    await page.goto('/verify-email?token=obviously-not-a-real-token');
    await expect(page.getByRole('heading', { name: 'Не получилось подтвердить' })).toBeVisible();
    await expect(page.getByText(/Ссылка недействительна/)).toBeVisible();
  });
});

test.describe('Приглашение в команду', () => {
  // Сервер шлёт ссылку на ${LK_BASE_URL}/lk/invite/accept, а весь /lk/* забирает
  // API — раньше письмо приводило в 404. Держим оба адреса рабочими.
  for (const path of ['/invite/accept', '/lk/invite/accept']) {
    test(`${path} открывает форму присоединения`, async ({ page }) => {
      const res = await page.goto(`${path}?token=probe-token`);
      expect(res?.status()).toBe(200);
      await expect(page.getByRole('heading', { name: 'Присоединиться к команде' })).toBeVisible();
    });
  }

  test('без токена не предлагает заполнять форму', async ({ page }) => {
    await page.goto('/invite/accept');
    await expect(page.getByRole('heading', { name: 'Ссылка неполная' })).toBeVisible();
  });

  test('недействительное приглашение объясняется', async ({ page }) => {
    await page.goto('/invite/accept?token=obviously-not-a-real-token');
    await page.getByRole('textbox', { name: 'Имя' }).fill('Тест');
    await page.getByRole('textbox', { name: 'Пароль', exact: true }).fill('correct-horse-1');
    await page.getByRole('textbox', { name: 'Подтвердить пароль' }).fill('correct-horse-1');
    await page.getByRole('button', { name: 'Присоединиться' }).click();
    await expect(page.locator('.auth-alert--error')).toHaveText(/Приглашение недействительно/);
  });
});
