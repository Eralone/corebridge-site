import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PublicHeader } from './PublicHeader';
/* стили этих страниц из эталона; в макете подключались отдельным <link> */
import '../public/assets/legal.css';

/**
 * Юридическая страница: оферта, политика, условия.
 *
 * Текст берётся из `content/legal/<name>.html` — его готовит
 * `tools/build-legal.mjs` из эталона, применяя правки из `legal_corrections.md`.
 * Каждое расхождение с эталоном описано там правилом с основанием, и скрипт
 * падает, если правка перестала находить своё место.
 *
 * ⚠️ Почему `dangerouslySetInnerHTML`, а не перенос в разметку. Это документы,
 * которые клиент акцептует: текст должен совпадать с редакцией дословно, а ручной
 * перенос 25 КБ юридического текста в JSX — верный способ потерять запятую
 * в существенном условии. Источник здесь — файл в репозитории, а не ввод
 * пользователя, так что подставить сюда чужую разметку неоткуда.
 *
 * Файл читается на сервере при сборке: страницы статические, в браузер уходит
 * готовый HTML.
 *
 * ⚠️ Подвала в эталоне у этих страниц нет — только шапка. Так и оставляем:
 * навигация по документу идёт через своё содержание (`.legal-toc`).
 */
export function LegalPage({ name }: { name: 'oferta' | 'privacy' | 'terms' }) {
  const html = readFileSync(join(process.cwd(), 'content', 'legal', `${name}.html`), 'utf8');

  return (
    <>
      <PublicHeader />
      {/* .legal-body в эталоне висел на <body> и задавал только фон страницы;
          вешаем на обёртку — до <body> из вложенного маршрута не достать */}
      <div className="legal-body">
        <main className="legal-shell" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </>
  );
}
