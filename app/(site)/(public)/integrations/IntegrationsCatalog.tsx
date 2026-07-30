'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ADAPTERS, CATEGORIES, NOT_A_SERVICE } from '@/lib/adapters';

/**
 * Публичный каталог интеграций. Перенос design-source/integrations.html.
 *
 * Отличия от эталона:
 *
 * · **карточка перестала быть кнопкой.** В макете `.int` был `<button>` и открывал
 *   модалку подключения с полями API-ключей. На публичной странице подключать
 *   нечего — тенанта ещё нет, ключи вводятся в кабинете. Оставлять нажимаемый
 *   вид у элемента, который ничего не делает, — обман ожидания;
 * · **счётчики «33 сервиса, 8 категорий» считаются по справочнику**, а не написаны
 *   руками: «Иное» и «нужен другой» — не сервисы и в счёт не идут;
 * · класс панели фильтров переименован в `.int-filter`: `.filter-bar` в админке
 *   уже занят другой панелью, и одинаковое имя рано или поздно свело бы правки.
 *
 * Данные — `lib/adapters.ts`, извлечённый из `design-source/assets/integrations-data.js`.
 * Коды сервера (`adapter_type`) с ними пересекаются, но не обязаны совпадать —
 * поэтому в кабинете неизвестный код не ломает экран, а показывается как есть.
 */
export function IntegrationsCatalog() {
  const [active, setActive] = useState<string | null>(null);

  const services = useMemo(
    () => Object.entries(ADAPTERS).filter(([code]) => !NOT_A_SERVICE.has(code)),
    [],
  );

  const shown = active ? CATEGORIES.filter((c) => c === active) : CATEGORIES;

  return (
    <>
      <section className="hero-s">
        <div className="container">
          <div className="p-crumbs">
            <Link href="/">Главная</Link> / Интеграции
          </div>
          <h1>{services.length} сервиса, которые подключаются к 1С</h1>
          <p>
            Все готовые интеграции CoreBridge. Выбираете нужные галочками в файле .epf
            и вставляете API-ключ сервиса. Остальное настраивает .epf сам.
          </p>
          <div className="stat-strip">
            <div className="s">
              <b>{services.length}</b>
              <span>сервиса</span>
            </div>
            <div className="s">
              <b>{CATEGORIES.length}</b>
              <span>категорий</span>
            </div>
            <div className="s">
              <b>4</b>
              <span>конфигурации 1С</span>
            </div>
            <div className="s">
              <b>1</b>
              <span>файл .epf</span>
            </div>
          </div>
        </div>
      </section>

      <div className="int-filter">
        <div className="container">
          <div className="chips">
            <button
              type="button"
              className={`chip-f${active === null ? ' active' : ''}`}
              onClick={() => setActive(null)}
            >
              Все
            </button>
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                className={`chip-f${active === c ? ' active' : ''}`}
                onClick={() => setActive(c)}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main>
        {shown.map((cat) => {
          const items = services.filter(([, a]) => a.cat === cat);
          return (
            <section className="cat-section" id={cat} key={cat}>
              <div className="container">
                <h2>
                  {cat}
                  <span className="cnt">
                    {items.length} {plural(items.length, 'сервис', 'сервиса', 'сервисов')}
                  </span>
                </h2>
                <p className="sub">{CATEGORY_SUBS[cat] ?? ''}</p>
                <div className="int-grid">
                  {items.map(([code, a]) => (
                    <article className="int" key={code}>
                      <div className="cb-ic" style={{ background: a.color, color: a.fg ?? '#fff' }}>
                        {a.glyph}
                      </div>
                      <div>
                        <h4>{a.name}</h4>
                        <p>{a.desc ?? ''}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </section>
          );
        })}
      </main>

      <section className="cta-section">
        <div className="container">
          <h2>Не нашли нужный сервис?</h2>
          <p>
            В пункте «Иное» можно настроить произвольный REST-обмен. Или напишите нам — обсудим,
            что нужно добавить.
          </p>
          <div className="row gap-12" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/register" className="btn btn-primary btn-lg">
              Попробовать бесплатно
            </Link>
            <a
              href="mailto:info@corebridge.ru?subject=Запрос%20интеграции"
              className="btn btn-ghost btn-lg"
              style={{ color: '#fff', borderColor: 'rgba(255,255,255,.3)' }}
            >
              Запросить интеграцию
            </a>
          </div>
        </div>
      </section>
    </>
  );
}

/** Подписи категорий — те же, что в скрипте лендинга (`descs` в index.html) */
const CATEGORY_SUBS: Record<string, string> = {
  'Маркетплейсы': 'Заказы, остатки, цены и возвраты по всем площадкам сразу.',
  'Сайт': 'Каталог, заказы и клиенты между 1С и вашим интернет-магазином.',
  'CRM': 'Сделки, контрагенты и статусы в обе стороны.',
  'Доставка': 'Отправления, трек-номера и статусы доставки в 1С.',
  'Оплата': 'Подтверждение платежей и отметка счетов оплаченными.',
  'CDP / Маркетинг': 'События о заказах и клиентах в маркетинговые системы.',
  'Соцсети': 'Уведомления клиентам и сотрудникам в мессенджеры.',
  'Аналитика': 'Выгрузка данных в отчёты и BI.',
};

function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}
