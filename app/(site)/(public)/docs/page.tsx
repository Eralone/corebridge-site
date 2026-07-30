import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicHeader } from '@/components/PublicHeader';
import { PublicFooter } from '@/components/PublicFooter';

export const metadata: Metadata = {
  title: 'Документация — CoreBridge',
  description:
    'Установка файла .epf в 1С, активация токеном и справочник API для обработки: проверка лицензии, очередь событий, версии сборок.',
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
      <PublicHeader active="docs" />

      <section className="docs-hero">
        <h1>Документация</h1>
        <p>
          Как установить файл .epf в 1С, активировать его токеном и что обработка умеет
          спрашивать у платформы.
        </p>
      </section>

      <div className="docs-layout">
        <aside className="docs-side">
          <h5>Начало</h5>
          <a href="#install">Установка .epf в 1С</a>
          <a href="#req">Требования</a>
          <h5>Шаги</h5>
          <a href="#step1">1. Скачать .epf</a>
          <a href="#step2">2. Загрузить в 1С</a>
          <a href="#step3">3. Вставить токен</a>
          <a href="#step4">4. Тестовая синхронизация</a>
          <h5>Справочник</h5>
          <a href="#api">API для обработки</a>
          <a href="#errors">Ошибки</a>
          <h5>Дальше</h5>
          <a href="#next">Что дальше</a>
        </aside>

        <main className="docs-content">
          <div className="p-crumbs">
            <Link href="/">Главная</Link> / Документация
          </div>

          <h1 id="install">Установка .epf в 1С</h1>
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

          <h2 id="step1">Шаг 1. Скачать .epf</h2>
          <p>
            Зайдите в кабинет, откройте <b>Файл .epf</b> и выберите свою конфигурацию.
            Ссылка на скачивание одноразовая и живёт 10 минут — если не успели, запросите
            заново. Рядом показаны версия сборки и её контрольная сумма: по ней можно
            убедиться, что файл скачался целиком.
          </p>

          <h2 id="step2">Шаг 2. Загрузить в 1С</h2>
          <ol>
            <li>
              В 1С откройте <code>Файл → Открыть</code> и укажите скачанный <code>.epf</code>.
              Обработка запустится без установки.
            </li>
            <li>
              Чтобы она была под рукой постоянно, добавьте её в справочник:{' '}
              <code>
                Администрирование → Печатные формы, отчёты и обработки → Дополнительные отчёты
                и обработки
              </code>
              .
            </li>
          </ol>

          <div className="callout warn">
            <b>Если 1С отказывается открывать файл</b>
            Чаще всего дело в правах: у пользователя нет роли на интерактивное открытие внешних
            обработок. Второе по частоте — файл скачан для другой конфигурации.
          </div>

          <h2 id="step3">Шаг 3. Вставить токен</h2>
          <p>
            Обработка авторизуется <b>JWT-токеном</b> вашей лицензии. Он лежит в кабинете
            на странице <b>Файл .epf</b> — там же, где скачивание. Полный токен видит только
            владелец аккаунта; остальным сотрудникам показывается сокращённый.
          </p>
          <p>
            Скопируйте токен и вставьте в поле <code>Токен доступа</code> в обработке.
            В токене уже записаны ваш тариф и лимиты — отдельного идентификатора компании
            вводить не нужно.
          </p>

          <div className="callout warn">
            <b>Токен — это доступ к вашим данным</b>
            Не пересылайте его в переписке и не храните в общих файлах. Если токен утёк,
            перевыпустите его в кабинете: прежний перестанет действовать сразу.
          </div>

          <h2 id="step4">Шаг 4. Тестовая синхронизация</h2>
          <p>
            В обработке отметьте один сервис, вставьте его API-ключ и нажмите{' '}
            <code>Проверить соединение</code>. Обработка обратится к платформе, а та —
            к сервису. Результат появится и в обработке, и в журнале кабинета.
          </p>
          <p>
            После этого включите обмен. Первые заказы и остатки пойдут в течение нескольких
            минут — все события видны в журнале, включая неудачные попытки с причиной.
          </p>

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
          <a href="#step1">Скачать .epf</a>
          <a href="#step2">Загрузить в 1С</a>
          <a href="#step3">Вставить токен</a>
          <a href="#step4">Синхронизация</a>
          <a href="#api">API</a>
          <a href="#errors">Ошибки</a>
          <a href="#next">Что дальше</a>
        </aside>
      </div>

      <PublicFooter />
    </>
  );
}
