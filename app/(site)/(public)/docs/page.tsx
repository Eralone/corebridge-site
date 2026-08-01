import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicHeader } from '@/components/PublicHeader';
import { PublicFooter } from '@/components/PublicFooter';
import { DocsNav } from '@/components/DocsNav';
import { BreadcrumbLd } from '@/components/JsonLd';

export const metadata: Metadata = {
  title: 'Настройка интеграции 1С: модуль .epf и JWT-токен — CoreBridge',
  description:
    'Как установить модуль интеграции 1С, получить JWT-токен в личном кабинете и запустить обмен — ' +
    'пошагово со скриншотами. Плюс справочник API для обработки.',
  alternates: { canonical: 'https://corebridge.ru/docs' },
};

/**
 * Документация. Перенос design-source/docs.html.
 *
 * Решение от 2026-07-28: документируем **только API типа 1** — тот, которым
 * пользуется сама обработка `.epf`. Внутренние маршруты (`/internal/v1/*`),
 * админские и кабинетные в публичную документацию не выносим.
 *
 * Отличия от эталона:
 *
 * · **поиск по документации убран** — искать нечем, поле было декоративным;
 * · **«Шаг 3. Активировать API-ключом» переписан под JWT.** В макете фигурировал
 *   ключ вида `cb_live_…` — таких ключей на сервере нет вовсе, механика другая:
 *   в обработку вставляется JWT-токен со страницы «Файл .epf» в кабинете;
 * · **справочник API заменён целиком.** В макете были выдуманные
 *   `/workflows/{id}/run` и `/usage`. Здесь только маршруты, проверенные живым
 *   запросом с настоящим токеном 2026-07-30;
 * · **база — `api.corebridge.ru`.** С 2026-07-30 тот же префикс отвечает и на
 *   `corebridge.ru` (маршрут зарезервирован в нашем vhost), но в документации
 *   называем один адрес: два равноправных вида одного API в инструкции только
 *   путают, а исторический адрес уже зашит в существующие сборки;
 * · конфигурация 1С в примерах — `ut11`, а не `ut`; четвёртая — `bp`, не `erp`.
 *
 * Страница ничего не запрашивает, поэтому остаётся серверной и статической.
 */
export default function Page() {
  return (
    <>
      <BreadcrumbLd
        items={[
          { name: 'Главная', path: '/' },
          { name: 'Документация', path: '/docs' },
        ]}
      />
      <PublicHeader active="docs" />

      <section className="docs-hero">
        <h1>Документация</h1>
        <p>
          Как установить файл .epf в 1С, активировать его токеном и что обработка умеет
          спрашивать у платформы.
        </p>
      </section>

      <div className="docs-layout">
        {/* Левая панель одна на всю документацию: все инструкции по группам,
            текущая страница отмечена. Прежний список якорей этой страницы отсюда
            убран — он дублировал правую панель, где ему и место */}
        <DocsNav active="platform" />

        <main className="docs-content">
          <div className="p-crumbs">
            <Link href="/">Главная</Link> / Документация
          </div>

          {/* ⚠️ был <h1>, и на странице оказывалось два первых заголовка: один
              в шапке раздела, второй здесь. Для поиска это спор о том, чему
              страница посвящена. Вид не изменился — размер задан классом */}
          <h2 id="install" className="docs-title">
            Установка .epf в 1С
          </h2>
          <p>
            CoreBridge — это одна внешняя обработка для вашей 1С. Она сама обращается
            к платформе и передаёт только те события, которые вы включили. Публиковать 1С
            в интернет, заводить белый IP и пробрасывать порты не нужно.
          </p>

          <h2 id="req">Требования</h2>
          <ul>
            <li>
              Одна из конфигураций: <b>1С:Управление торговлей 11</b>,{' '}
              <b>1С:Управление нашей фирмой</b>, <b>1С:Комплексная автоматизация</b> или{' '}
              <b>1С:Бухгалтерия предприятия 3.0</b>.
            </li>
            <li>Платформа 1С:Предприятие 8.3.18 или новее.</li>
            <li>Право запускать внешние обработки у пользователя, под которым работаете.</li>
            <li>Исходящий доступ в интернет с компьютера или сервера, где работает 1С.</li>
          </ul>

          <div className="callout tip">
            <b>Про четыре конфигурации</b>
            Сборка своя для каждой конфигурации, но обновления выходят одновременно.
            Файл для чужой конфигурации не подойдёт — 1С не примет объекты метаданных.
          </div>

          <h2 id="token">Где взять JWT-токен</h2>
          <p>
            Токен — это ключ, которым обработка представляется платформе. Он выдаётся вместе
            с лицензией сразу после регистрации: отдельно запрашивать или ждать одобрения
            не нужно. Весь путь занимает пару минут и выглядит так.
          </p>

          <h3 id="token-1">Шаг 1. Войдите в личный кабинет</h3>
          <p>
            Откройте <Link href="/login">corebridge.ru/login</Link>, введите почту и пароль
            <b> (1)</b> и нажмите <b>«Войти» (2)</b>. Если аккаунт заводили через Яндекс ID —
            входите той же кнопкой; пароль в этом случае не спрашивается.
          </p>
          <figure className="step-shot">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/docs/lk/login.png"
              alt="Форма входа: подсвечены поле почты и кнопка «Войти»"
              width={506}
              height={754}
              loading="lazy"
            />
            <figcaption>Форма входа. Забыли пароль — ссылка «Забыли пароль?» под полем.</figcaption>
          </figure>

          <h3 id="token-2">Шаг 2. Откройте «Файл .epf»</h3>
          <p>
            После входа открывается дашборд. В левом меню выберите пункт{' '}
            <b>«Файл .epf» (3)</b> — на этой странице лежит и токен, и сам файл обработки.
          </p>
          <figure className="step-shot">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/docs/lk/dashboard.png"
              alt="Дашборд кабинета: в левом меню подсвечен пункт «Файл .epf»"
              width={1280}
              height={900}
              loading="lazy"
            />
            <figcaption>
              Дашборд после входа. Кнопка «Скачать .epf» справа вверху ведёт на ту же страницу.
            </figcaption>
          </figure>

          <h3 id="token-3">Шаг 3. Выберите свою конфигурацию 1С</h3>
          <p>
            Дальше страница ведёт по трём шагам сама. Первый — конфигурация: у каждой своя
            сборка, и скачать можно только подходящую вашей базе.
          </p>
          <figure className="step-shot">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/docs/lk/epf-config.png"
              alt="Шаг 1 на странице «Файл .epf»: выбор конфигурации 1С"
              width={996}
              height={207}
              loading="lazy"
            />
            <figcaption>
              Под названием видно версию сборки и её размер. «Сборки пока нет» означает, что
              файл для этой конфигурации ещё не публиковался.
            </figcaption>
          </figure>

          <h3 id="token-4">Шаг 4. Скопируйте токен</h3>
          <p>
            Второй шаг страницы — сам токен. Нажмите <b>«Скопировать»</b>: он попадёт в буфер
            обмена целиком. Токен длинный и на экране обрезан — копируйте кнопкой, а не
            выделением мышью, иначе в 1С уедет обрезанная строка.
          </p>
          <figure className="step-shot">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/docs/lk/epf-token.png"
              alt="Шаг 2 на странице «Файл .epf»: JWT-токен и кнопка «Скопировать»"
              width={984}
              height={247}
              loading="lazy"
            />
            <figcaption>
              На снимке — образец, не рабочий токен. Рядом видно срок действия: на пробном
              тарифе лицензия бессрочная.
            </figcaption>
          </figure>

          <div className="callout warn">
            <b>Если токена на странице нет</b>
            Полный токен видит только владелец аккаунта — сотрудникам с ролью «менеджер»
            и «пользователь» страница честно об этом пишет, токен нужно попросить у владельца.
            Если же написано, что активной лицензии нет, — оформите тариф, токен появится
            сразу после оплаты.
          </div>

          <h3 id="token-5">Шаг 5. Скачайте файл .epf</h3>
          <p>
            Третий шаг — сам файл. Ссылка одноразовая и живёт 10 минут: если не успели, просто
            нажмите кнопку ещё раз. Рядом — кнопка <b>«Инструкция по установке»</b>, она ведёт
            в инструкцию под выбранную конфигурацию.
          </p>
          <figure className="step-shot">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/docs/lk/epf-download.png"
              alt="Шаг 3 на странице «Файл .epf»: кнопка скачивания файла"
              width={990}
              height={135}
              loading="lazy"
            />
            <figcaption>
              В имени файла видно конфигурацию и версию сборки — по ним же проверяется
              обновление.
            </figcaption>
          </figure>

          <div className="callout tip">
            <b>Токен и файл получены — что дальше</b>
            Установите модуль в 1С по инструкции для вашей конфигурации, затем пройдите мастер
            подключения. Обе ссылки — в разделе{' '}
            <Link href="/docs/epf">«Инструкции по модулю .epf»</Link>.
          </div>

          <h2 id="install-1c">Установка модуля в 1С</h2>
          <p>
            Файл можно просто открыть через <code>Файл → Открыть</code> — обработка запустится
            без установки. Но так её придётся открывать каждый раз вручную, поэтому обычно её
            добавляют в справочник дополнительных обработок: тогда она доступна всем
            пользователям базы прямо из меню раздела.
          </p>
          <p>
            Путь в меню и состав механик в каждой конфигурации свои, поэтому инструкция
            тоже своя:
          </p>
          <div className="docs-cards">
            <Link href="/docs/epf/ustanovka-ut11" className="docs-card">
              <div className="ttl">1С:УТ 11</div>
              <div className="sub">Управление торговлей 11 — все механики</div>
            </Link>
            <Link href="/docs/epf/ustanovka-unf" className="docs-card">
              <div className="ttl">1С:УНФ</div>
              <div className="sub">Управление нашей фирмой</div>
            </Link>
            <Link href="/docs/epf/ustanovka-ka-erp" className="docs-card">
              <div className="ttl">1С:КА 2 / ERP</div>
              <div className="sub">Организация в документах обязательна</div>
            </Link>
            <Link href="/docs/epf/ustanovka-bp30" className="docs-card">
              <div className="ttl">1С:БП 3.0</div>
              <div className="sub">Бухгалтерия предприятия — есть ограничения</div>
            </Link>
          </div>

          <div className="callout warn">
            <b>Если 1С отказывается открывать файл</b>
            Чаще всего дело в правах: у пользователя нет роли на интерактивное открытие внешних
            обработок. Второе по частоте — файл скачан для другой конфигурации.
          </div>

          <h2 id="first-sync">Первое подключение</h2>
          <p>
            При открытии модуля появляется <b>«CoreBridge. Каталог проектов»</b>. Нажмите{' '}
            <b>«+ Добавить интеграцию»</b> и пройдите мастер: на первом шаге вставьте
            скопированный токен в поле <code>JWT-токен</code> и нажмите{' '}
            <code>Проверить подключение</code> — до успешной проверки мастер дальше не пустит.
          </p>
          <p>
            Дальше мастер спросит категорию, сервис, набор механик и реквизиты 1С, а на пятом
            шаге запустит обмен. Все пять шагов со скриншотами разобраны в{' '}
            <Link href="/docs/epf/master-podklyucheniya">мастере подключения</Link> — это общий
            сценарий для любой интеграции, от Ozon до собственного сайта.
          </p>

          <div className="callout warn">
            <b>Токен — это доступ к вашим данным</b>
            Не пересылайте его в переписке и не храните в общих файлах. Если токен утёк,
            перевыпустите его в кабинете: прежний перестанет действовать сразу.
          </div>

          <h2 id="api">API для обработки</h2>
          <p>
            Этот раздел нужен, если вы дописываете свою логику поверх платформы или отлаживаете
            обмен. Обработке .epf он не требуется — она обращается к этим маршрутам сама.
          </p>
          <p>
            База: <code>https://api.corebridge.ru/api/v1</code>. Авторизация — заголовок{' '}
            <code>Authorization: Bearer &lt;ваш JWT&gt;</code>. Ответы в JSON.
          </p>

          <div className="api-tbl-wrap">
            <table className="api-tbl">
              <thead>
                <tr>
                  <th>Метод</th>
                  <th>Что делает</th>
                  <th>Авторизация</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <code>GET /license/check</code>
                  </td>
                  <td>Тариф, срок действия и лимиты по вашему токену</td>
                  <td>Bearer</td>
                </tr>
                <tr>
                  <td>
                    <code>POST /license/refresh</code>
                  </td>
                  <td>Перевыпуск токена до истечения срока</td>
                  <td>Bearer</td>
                </tr>
                <tr>
                  <td>
                    <code>GET /events</code>
                  </td>
                  <td>Очередь событий для вашей 1С: новые заказы, изменения статусов</td>
                  <td>Bearer</td>
                </tr>
                <tr>
                  <td>
                    <code>POST /events/{'{id}'}/ack</code>
                  </td>
                  <td>Подтвердить, что событие обработано в 1С</td>
                  <td>Bearer</td>
                </tr>
                <tr>
                  <td>
                    <code>GET /epf/{'{config}'}/version</code>
                  </td>
                  <td>
                    Актуальная версия сборки. <code>config</code>: <code>ut11</code>,{' '}
                    <code>unf</code>, <code>ka</code>, <code>bp</code>
                  </td>
                  <td>не нужна</td>
                </tr>
                <tr>
                  <td>
                    <code>GET /health</code>
                  </td>
                  <td>Проверка доступности платформы</td>
                  <td>Bearer</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p>Проверка лицензии:</p>
          <pre>
            <code>
              <span className="c-k">curl</span> -H{' '}
              <span className="c-s">&quot;Authorization: Bearer $TOKEN&quot;</span> \{'\n'}
              {'  '}
              <span className="c-s">https://api.corebridge.ru/api/v1/license/check</span>
              {'\n\n'}
              <span className="c-g">
                {'{'} &quot;status&quot;: &quot;trial&quot;, &quot;plan&quot;: &quot;trial&quot;,
                &quot;is_perpetual&quot;: true, &quot;valid_until&quot;: null {'}'}
              </span>
            </code>
          </pre>

          <p>Актуальная версия сборки — без токена:</p>
          <pre>
            <code>
              <span className="c-k">curl</span>{' '}
              <span className="c-s">https://api.corebridge.ru/api/v1/epf/ut11/version</span>
              {'\n\n'}
              <span className="c-g">
                {'{'} &quot;version&quot;: &quot;0.0.1&quot;, &quot;sha256&quot;:
                &quot;ebe154…&quot;, &quot;force_update&quot;: false {'}'}
              </span>
            </code>
          </pre>

          <div className="callout tip">
            <b>Как обработка узнаёт об обновлении</b>
            Она сама спрашивает <code>/epf/{'{config}'}/version</code> и сравнивает с той,
            что установлена. Если у версии стоит <code>force_update</code>, обмен продолжится
            только после обновления файла — так выпускаются изменения, ломающие совместимость.
          </div>

          <h2 id="errors">Ошибки</h2>
          <p>
            Ошибки приходят с кодом в поле <code>error</code> — на него и стоит опираться,
            а не на текст сообщения: тексты мы правим, коды нет.
          </p>
          <div className="api-tbl-wrap">
            <table className="api-tbl">
              <thead>
                <tr>
                  <th>Код</th>
                  <th>Когда бывает</th>
                  <th>Что делать</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>401</td>
                  <td>Токен не передан, истёк или отозван</td>
                  <td>Взять новый токен в кабинете</td>
                </tr>
                <tr>
                  <td>402</td>
                  <td>Действие требует платного тарифа</td>
                  <td>Оформить тариф</td>
                </tr>
                <tr>
                  <td>403</td>
                  <td>Доступ закрыт: компания заблокирована или прав не хватает</td>
                  <td>Написать на info@corebridge.ru</td>
                </tr>
                <tr>
                  <td>429</td>
                  <td>Слишком частые запросы</td>
                  <td>Увеличить интервал опроса</td>
                </tr>
                <tr>
                  <td>5xx</td>
                  <td>Сбой на нашей стороне</td>
                  <td>Повторить с задержкой — событие не потеряется</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h2 id="next">Что дальше</h2>
          <Link href="/docs/epf" className="card-link">
            <div className="ic">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
            </div>
            <div>
              <div className="ttl">Инструкции по модулю .epf</div>
              <div className="sub">
                Установка под четыре конфигурации, мастер подключения и настройка каждой
                механики — со скриншотами экранов 1С
              </div>
            </div>
          </Link>
          <Link href="/integrations" className="card-link">
            <div className="ic">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 6h16M4 12h16M4 18h10" />
              </svg>
            </div>
            <div>
              <div className="ttl">Каталог интеграций</div>
              <div className="sub">33 сервиса и что каждый из них умеет</div>
            </div>
          </Link>
          <Link href="/pricing" className="card-link">
            <div className="ic">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </div>
            <div>
              <div className="ttl">Тарифы и лимиты</div>
              <div className="sub">Сколько интеграций и операций входит в каждый план</div>
            </div>
          </Link>
          <Link href="/n8n" className="card-link">
            <div className="ic">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="6" cy="6" r="2" />
                <circle cx="18" cy="18" r="2" />
                <path d="M8 6h4a4 4 0 0 1 4 4v6" />
              </svg>
            </div>
            <div>
              <div className="ttl">Сценарии n8n</div>
              <div className="sub">Своя логика поверх готовых интеграций</div>
            </div>
          </Link>

          <p className="text-muted" style={{ marginTop: 28 }}>
            Не нашли ответ? Напишите на{' '}
            <a href="mailto:info@corebridge.ru">info@corebridge.ru</a> — отвечаем в течение
            рабочего дня.
          </p>
        </main>

        <aside className="docs-toc">
          <h5>На этой странице</h5>
          <a href="#req">Требования</a>
          <a href="#token">Где взять JWT-токен</a>
          {/* пять шагов пути до токена — к ним и возвращаются чаще всего */}
          <a href="#token-1" className="sub">1. Войти в кабинет</a>
          <a href="#token-2" className="sub">2. Открыть «Файл .epf»</a>
          <a href="#token-3" className="sub">3. Выбрать конфигурацию</a>
          <a href="#token-4" className="sub">4. Скопировать токен</a>
          <a href="#token-5" className="sub">5. Скачать файл</a>
          <a href="#install-1c">Установка в 1С</a>
          <a href="#first-sync">Первое подключение</a>
          <a href="#api">API для обработки</a>
          <a href="#errors">Ошибки</a>
          <a href="#next">Что дальше</a>
        </aside>
      </div>

      <PublicFooter />
    </>
  );
}
