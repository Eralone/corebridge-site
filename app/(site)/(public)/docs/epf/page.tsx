import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicHeader } from '@/components/PublicHeader';
import { PublicFooter } from '@/components/PublicFooter';
import { DocsNav } from '@/components/DocsNav';
import { BreadcrumbLd } from '@/components/JsonLd';
import { docSections, docsBySlug, docExtrasToc, getIndexExtrasHtml } from '@/lib/docs';

export const metadata: Metadata = {
  title: 'Инструкции по интеграции 1С: установка модуля — CoreBridge',
  description:
    'Установка модуля интеграции в 1С:УТ 11, УНФ, КА 2 / ERP и Бухгалтерию 3.0, мастер подключения ' +
    'и настройка механик: заказы, остатки, цены, маркировка, CRM, доставка.',
  alternates: { canonical: 'https://corebridge.ru/docs/epf' },
};

/**
 * Оглавление раздела инструкций по .epf.
 *
 * Содержимое собирается из markdown-исходников команды модуля
 * (`content/epf-docs/`) скриптом `tools/build-docs.mjs`. Здесь — только
 * навигация и сводные таблицы, которые в README были, а в отдельных
 * инструкциях своих аналогов не имеют.
 */
export default function Page() {
  const extras = getIndexExtrasHtml();

  return (
    <>
      <BreadcrumbLd
        items={[
          { name: 'Главная', path: '/' },
          { name: 'Документация', path: '/docs' },
          { name: 'Инструкции по .epf', path: '/docs/epf' },
        ]}
      />
      <PublicHeader active="docs" />

      <section className="docs-hero">
        <h1>Инструкции по модулю для 1С</h1>
        <p>
          Установка .epf под вашу конфигурацию, мастер подключения и настройка каждой
          механики — со скриншотами реальных экранов модуля.
        </p>
      </section>

      <div className="docs-layout">
        <DocsNav active="index" />

        <main className="docs-content">
          <div className="p-crumbs">
            <Link href="/">Главная</Link> / <Link href="/docs">Документация</Link> / Инструкции
            по .epf
          </div>

          {/* второй <h1> на странице — см. пояснение в docs/page.tsx */}
          <h2 className="docs-title">С чего начать</h2>
          <ol className="docs-start">
            <li>
              <b>Получите JWT-токен и файл модуля.</b> Токен лежит в кабинете на странице
              «Файл .epf» — путь до него показан{' '}
              <Link href="/docs#token">пошагово со скриншотами</Link>.
            </li>
            <li>
              <b>Установите модуль</b> — выберите инструкцию под свою конфигурацию 1С
              в разделе «Установка» ниже.
            </li>
            <li>
              <b>Пройдите </b>
              <Link href="/docs/epf/master-podklyucheniya">мастер подключения</Link> — это общий
              сценарий для всех интеграций, все 5 шагов.
            </li>
            <li>
              <b>Откройте инструкцию под свою задачу</b> — маркетплейсы, сайты, CRM, сервисы.
            </li>
          </ol>

          {docSections.map((s) => (
            <section key={s.id} className="docs-section">
              <h2 id={s.id}>{s.title}</h2>
              <p className="text-muted">{s.hint}</p>
              <div className="docs-cards">
                {s.docs.map((slug) => {
                  const d = docsBySlug[slug];
                  return (
                    // prefetch выключен: 33 карточки + столько же в навигации
                    // давали всплеск запросов `?_rsc=` и 429 от nginx
                    <Link key={slug} href={`/docs/epf/${slug}`} prefetch={false} className="docs-card">
                      <div className="ttl">{d.nav}</div>
                      <div className="sub">{d.hint}</div>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}

          {/* Сводные таблицы из README исходников: что где доступно, частые проблемы.
              Класс тот же, что у тела инструкции: HTML собран тем же рендерером,
              и заголовки в нём такого же уровня */}
          <div className="doc-body" dangerouslySetInnerHTML={{ __html: extras }} />

          <p className="text-muted" style={{ marginTop: 28 }}>
            Не нашли ответ? Напишите на <a href="mailto:info@corebridge.ru">info@corebridge.ru</a> —
            отвечаем в течение рабочего дня.
          </p>
        </main>

        <aside className="docs-toc">
          <h5>На этой странице</h5>
          {docSections.map((s) => (
            <a key={s.id} href={`#${s.id}`}>
              {s.title}
            </a>
          ))}
          {docExtrasToc.map((t) => (
            <a key={t.id} href={`#${t.id}`}>
              {t.text}
            </a>
          ))}
        </aside>
      </div>

      <PublicFooter />
    </>
  );
}
