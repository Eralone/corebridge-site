import { defineConfig, devices } from '@playwright/test';

/**
 * Браузер — Firefox: он есть в системе и ставится одной командой
 *   npx playwright install firefox
 * (в образ браузеры не входят — сорвётся первый же запуск).
 *
 * Гоняем против прода: там крутится ровно та сборка, что лежит в репозитории,
 * и по пути проверяются nginx, сертификаты и разводка субдоменов — то есть
 * настоящая цепочка, а не только Next.js. Локально:
 *   BASE_URL=http://127.0.0.1:3005 npx playwright test
 * но тогда тесты админ-субдомена отвалятся: Host подменить в Firefox нельзя,
 * а разводку делает middleware.ts именно по Host.
 */
const MAIN = process.env.BASE_URL ?? 'https://corebridge.ru';
const ADMIN = process.env.ADMIN_BASE_URL ?? 'https://admin.corebridge.ru';

export default defineConfig({
  testDir: './tests',
  testMatch: ['e2e/**/*.spec.ts', 'visual/**/*.spec.ts'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 4,
  reporter: [['list'], ['html', { outputFolder: 'artifacts/playwright-report', open: 'never' }]],
  outputDir: 'artifacts/playwright',
  timeout: 45_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: MAIN,
    ignoreHTTPSErrors: true,
    locale: 'ru-RU',
    timezoneId: 'Europe/Moscow',
    // reducedMotion живёт в contextOptions, а не рядом с locale (Playwright 1.62)
    contextOptions: { reducedMotion: 'reduce' },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'], viewport: { width: 1440, height: 900 } },
    },
  ],

  // Эталон дизайна для попиксельной сверки. Живой сайт держит systemd,
  // поэтому его здесь нет — поднимать второй процесс на 3005 нечем.
  webServer: {
    command: 'node tools/design-server.mjs',
    url: 'http://127.0.0.1:3006/index.html',
    reuseExistingServer: true,
    timeout: 20_000,
  },
});

export { MAIN, ADMIN };
