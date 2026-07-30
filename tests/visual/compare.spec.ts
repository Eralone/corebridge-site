import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Гейт попиксельной сверки с макетом.
 *
 * Проверяются только страницы с `ported: true` в pages.json — пока экран
 * заглушка, сравнивать нечего, и тест помечается пропущенным, а не красным.
 * Перенёс экран → поставил ported: true → тест начинает держать вёрстку.
 *
 * ⚠️ Закрытые экраны (ЛК, админка) без cookie покажут форму входа и завалят
 * сверку. Гоняются с `CB_SESSION` и `CB_ADMIN_SESSION` в окружении.
 *
 * Разведка (посмотреть расхождение на непере­несённых, получить картинки)
 * живёт отдельно: `node tools/compare.mjs`.
 */

type Page = {
  id: string;
  design: string | null;
  ported: boolean;
  maxDiff: number | null;
  note: string | null;
  auth: 'none' | 'lk' | 'admin';
};

const ROOT = join(__dirname, '..', '..');
const pages: Page[] = JSON.parse(readFileSync(join(ROOT, 'tests/visual/pages.json'), 'utf8')).pages;

for (const p of pages) {
  /**
   * ⚠️ Закрытые экраны без cookie покажут форму входа, и сверка честно провалится
   * — но это будет означать «нет доступа», а не «вёрстка съехала». Красный тест
   * с таким смыслом приучает не смотреть на красное, поэтому пропускаем.
   * Тестовый аккаунт после сдачи вычищен, так что без переменных окружения
   * это обычное состояние, а не оплошность.
   */
  const needsSession =
    (p.auth === 'lk' && !process.env.CB_SESSION) ||
    (p.auth === 'admin' && !process.env.CB_ADMIN_SESSION);

  const reason = !p.design
    ? 'макета нет'
    : !p.ported
      ? 'экран ещё не перенесён'
      : p.maxDiff == null
        ? 'сверка не применяется'
        : needsSession
          ? `нет сессии для закрытого экрана (${p.auth}) — задайте CB_SESSION / CB_ADMIN_SESSION`
          : null;

  test(`${p.id} совпадает с макетом`, async ({ browser }) => {
    test.skip(reason !== null, reason ?? '');
    // .mjs-модули тянем динамически: спеки исполняются как CJS
    const { comparePage } = await import('../../tools/compare.mjs');
    const r = await comparePage(browser, p);
    /**
     * Держим ПЕРВЫЙ ЭКРАН, а не всю страницу.
     *
     * Доля по всей странице ломается от одного переписанного абзаца: всё ниже
     * съезжает по вертикали, и дальше сравниваются разные секции. На лендинге
     * это давало 15,5 % при полностью совпадающей вёрстке — страница просто
     * на 328px выше макета, а по первому экрану там 0,1 %.
     *
     * Первый экран от длины текста ниже не зависит, поэтому ловит именно то,
     * ради чего сверка и нужна: съехавшую сетку, чужой шрифт, другие отступы.
     */
    expect(
      r.foldRatio,
      `${p.id}: первый экран расходится на ${(r.foldRatio * 100).toFixed(1)}% ` +
        `(вся страница ${(r.ratio * 100).toFixed(1)}%), ` +
        `смотреть artifacts/${p.id}/diff-fold.png` +
        (p.note ? `\nПомнить: ${p.note}` : ''),
    ).toBeLessThanOrEqual(p.maxDiff!);
  });
}
