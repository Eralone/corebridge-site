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
 * Разведка (посмотреть расхождение на непере­несённых, получить картинки)
 * живёт отдельно: `node tools/compare.mjs`.
 */

type Page = {
  id: string;
  design: string | null;
  ported: boolean;
  maxDiff: number | null;
  note: string | null;
};

const ROOT = join(__dirname, '..', '..');
const pages: Page[] = JSON.parse(readFileSync(join(ROOT, 'tests/visual/pages.json'), 'utf8')).pages;

for (const p of pages) {
  const reason = !p.design
    ? 'макета нет'
    : !p.ported
      ? 'экран ещё не перенесён'
      : p.maxDiff == null
        ? 'сверка не применяется'
        : null;

  test(`${p.id} совпадает с макетом`, async ({ browser }) => {
    test.skip(reason !== null, reason ?? '');
    // .mjs-модули тянем динамически: спеки исполняются как CJS
    const { comparePage } = await import('../../tools/compare.mjs');
    const r = await comparePage(browser, p);
    expect(
      r.ratio,
      `${p.id}: расхождение ${(r.ratio * 100).toFixed(1)}%, смотреть artifacts/${p.id}/diff.png` +
        (p.note ? `\nПомнить: ${p.note}` : ''),
    ).toBeLessThanOrEqual(p.maxDiff!);
  });
}
