/**
 * Собирает раздел «Инструкции по .epf» из markdown-исходников в готовый HTML.
 *
 *   node tools/build-docs.mjs          собрать
 *   node tools/build-docs.mjs --check  проверить, что собирается и все ссылки живые
 *
 * Вход:  content/epf-docs/**\/*.md  — исходники, как их отдаёт команда модуля
 *        public/docs/images/*.png   — скриншоты экранов 1С из тех же исходников
 * Выход: content/docs/epf/<slug>.html  — тело статьи
 *        content/docs/epf/manifest.json — оглавление, заголовки, TOC
 *
 * ── Почему сборка, а не разбор markdown в рантайме ──────────────────────────
 * Страницы статические, содержимое меняется раз в релиз модуля. Разбирать 270 КБ
 * markdown на каждый запрос незачем, а тащить парсер в бандл клиента — тем более.
 * `marked` живёт в devDependencies и в рантайм сайта не попадает.
 *
 * Скрипт падает, если ссылка ведёт в никуда: битая ссылка в документации хуже,
 * чем несобравшийся билд.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, basename, normalize, sep } from 'node:path';
import { Marked } from 'marked';
import { ROOT } from './lib/pages.mjs';

const check = process.argv.includes('--check');
const SRC = join(ROOT, 'content', 'epf-docs');
const IMG = join(ROOT, 'public', 'docs', 'images');
const OUT = join(ROOT, 'content', 'docs', 'epf');

/** Базовый путь раздела на сайте. */
const BASE = '/docs/epf';

/**
 * Разделы и инструкции: `[файл, слаг, пометка в карточке, имя в навигации]`.
 *
 * Слаг задан руками, а не транслитерацией: адрес страницы — часть публичного
 * контракта, и он не должен меняться от того, что в исходнике переименовали
 * файл или поправили регистр буквы.
 *
 * Имя в навигации тоже задано руками: заголовки инструкций длинные и почти все
 * начинаются одинаково («Как настроить…»), в колонке 240px они не помещаются,
 * а срезать начало регуляркой — значит получить «Заказы и отгрузку» в
 * винительном падеже.
 */
const SECTIONS = [
  {
    id: 'install',
    title: 'Установка',
    hint: 'Выберите инструкцию под свою конфигурацию 1С',
    docs: [
      ['01-Установка/Установка-УТ11.md', 'ustanovka-ut11', '1С:Управление торговлей 11', '1С:УТ 11'],
      ['01-Установка/Установка-УНФ.md', 'ustanovka-unf', '1С:Управление нашей фирмой', '1С:УНФ'],
      ['01-Установка/Установка-КА2-ERP.md', 'ustanovka-ka-erp', '1С:Комплексная автоматизация 2 / ERP', '1С:КА 2 / ERP'],
      ['01-Установка/Установка-БП30.md', 'ustanovka-bp30', '1С:Бухгалтерия предприятия 3.0', '1С:БП 3.0'],
    ],
  },
  {
    id: 'basics',
    title: 'Основы',
    hint: 'Общий сценарий для любой интеграции — прочитайте до тематических инструкций',
    docs: [
      ['02-Основы/Мастер-подключения.md', 'master-podklyucheniya', 'Все 5 шагов создания проекта', 'Мастер подключения'],
      ['02-Основы/Каталог-проектов-и-рабочий-стол.md', 'katalog-proektov', 'Повседневная работа: где что находится', 'Каталог проектов и рабочий стол'],
    ],
  },
  {
    id: 'marketplaces',
    title: 'Маркетплейсы',
    hint: 'Ozon, Wildberries, Яндекс.Маркет — подключение площадки и отдельные механики',
    docs: [
      ['03-Маркетплейсы/Подключить-Ozon.md', 'podklyuchit-ozon', '11 механик', 'Подключить Ozon'],
      ['03-Маркетплейсы/Подключить-Wildberries.md', 'podklyuchit-wildberries', '8 механик', 'Подключить Wildberries'],
      ['03-Маркетплейсы/Подключить-Яндекс-Маркет.md', 'podklyuchit-yandex-market', '8 механик', 'Подключить Яндекс.Маркет'],
      ['03-Маркетплейсы/Заказы-и-отгрузка.md', 'zakazy-i-otgruzka', 'Все площадки', 'Заказы и отгрузка'],
      ['03-Маркетплейсы/Возвраты.md', 'vozvraty', 'Все площадки', 'Возвраты'],
      ['03-Маркетплейсы/Остатки.md', 'ostatki', 'Все площадки', 'Остатки'],
      ['03-Маркетплейсы/Цены.md', 'tseny', 'Все площадки', 'Цены'],
      ['03-Маркетплейсы/Каталог-и-сопоставление.md', 'katalog-i-sopostavlenie', 'Все площадки', 'Каталог и сопоставление'],
      ['03-Маркетплейсы/Маркировка-Честный-знак.md', 'markirovka-chestny-znak', 'Все площадки', 'Маркировка «Честный знак»'],
      ['03-Маркетплейсы/Финансовые-отчёты.md', 'finansovye-otchyoty', 'Все площадки', 'Финансовые отчёты'],
      ['03-Маркетплейсы/Этикетки.md', 'etiketki', 'Все площадки', 'Этикетки'],
      ['03-Маркетплейсы/FBM-FBO-поставки.md', 'fbm-fbo-postavki', 'Схемы FBO / FBM', 'FBM/FBO поставки'],
      ['03-Маркетплейсы/ГТД.md', 'gtd', 'Только Ozon', 'ГТД'],
      ['03-Маркетплейсы/Резервы.md', 'rezervy', 'Только Ozon', 'Резервы'],
      ['03-Маркетплейсы/Акции-Promo.md', 'aktsii-promo', 'Только Ozon', 'Акции / Promo'],
    ],
  },
  {
    id: 'sites',
    title: 'Сайты',
    hint: 'Битрикс, WordPress, OpenCart, InSales, Ecwid, Tilda и свой сайт через REST',
    docs: [
      ['04-Сайты/Подключить-интернет-магазин.md', 'podklyuchit-internet-magazin', '1С-Битрикс, WordPress, OpenCart, InSales, Ecwid, Tilda, REST API', 'Подключить интернет-магазин'],
    ],
  },
  {
    id: 'crm',
    title: 'CRM',
    hint: 'Битрикс24, AmoCRM, Мегаплан, СБИС, Neaktor',
    docs: [
      ['05-CRM/Подключить-CRM.md', 'podklyuchit-crm', 'Подключение и общие настройки', 'Подключить CRM'],
      ['05-CRM/Контрагенты.md', 'kontragenty', 'Контакты и компании ↔ контрагенты 1С', 'Контрагенты'],
      ['05-CRM/Сделки.md', 'sdelki', 'Сделки CRM → документы 1С', 'Сделки'],
      ['05-CRM/Счета.md', 'scheta', 'Выгрузка счетов из 1С в CRM', 'Счета'],
      ['05-CRM/Статусы.md', 'statusy', 'Проведение документа двигает стадию сделки', 'Статусы'],
    ],
  },
  {
    id: 'services',
    title: 'Сервисы',
    hint: 'Доставка, приём оплаты, CDP и рассылки, уведомления, аналитика',
    docs: [
      ['06-Сервисы/Доставка.md', 'dostavka', 'СДЭК, Почта России, ЯМ Доставка', 'Доставка'],
      ['06-Сервисы/Приём-оплаты.md', 'priyom-oplaty', 'ЮKassa, СБП, Тинькофф, Сбер', 'Приём оплаты'],
      ['06-Сервисы/CDP-и-рассылки.md', 'cdp-i-rassylki', 'MindBox, SendPulse, Unisender, DashaMail, МойСклад', 'CDP и рассылки'],
      ['06-Сервисы/Уведомления-и-соцсети.md', 'uvedomleniya-i-socseti', 'Telegram, VK, WhatsApp, Max, Одноклассники, Viber', 'Уведомления и соцсети'],
      ['06-Сервисы/Аналитика.md', 'analitika', 'Google Sheets, Power BI, Roistat, МойСклад', 'Аналитика'],
    ],
  },
  {
    id: 'other',
    title: 'Иное',
    hint: 'Сервис, для которого нет готового адаптера',
    docs: [
      ['07-Иное/Произвольная-интеграция.md', 'proizvolnaya-integratsiya', 'Свой сервис через персональный воркфлоу', 'Произвольная интеграция'],
    ],
  },
];

/** Путь исходника → слаг. Нужен для переписывания перекрёстных ссылок. */
const BY_FILE = new Map();
for (const s of SECTIONS) for (const [file, slug] of s.docs) BY_FILE.set(file, slug);

/**
 * ── Заголовок и описание страницы для поиска ────────────────────────────────
 *
 * H1 инструкции написан для того, кто уже внутри раздела: «Как настроить
 * выгрузку остатков». В выдаче такой заголовок ни о чём не говорит — там ищут
 * «синхронизация остатков 1с с маркетплейсом». Поэтому у страниц, которые
 * отвечают на реальный поисковый запрос, свой `title` и `description`;
 * у остальных берётся заголовок инструкции и первый абзац.
 *
 * Формулировки взяты из семантического ядра (`CoreBridge_filtered.csv`,
 * 2026-08-01) — но только те, на которые страница действительно отвечает.
 * Половина ядра к продукту не относится вовсе: «карточки для маркетплейсов» —
 * это про дизайн карточек, «1с элемент» и «интеграция ЕНС в 1с» — про другое
 * ПО. Такие запросы не берём: они приводят человека не туда, а нам дают отказы.
 *
 * ⚠️ Ни одна формулировка не обещает того, чего модуль не делает. ЭДО
 * (Диадок, СБИС, Контур) в ядре есть и спрос заметный, но документооборота
 * в модуле нет — этих слов здесь нет тоже.
 */
const SEO = {
  'ustanovka-ut11': {
    title: 'Интеграция 1С:УТ 11 с маркетплейсами',
    description:
      'Установка модуля в 1С:Управление торговлей 11 и 11.5: внешняя обработка, JWT-токен, ' +
      'первый запуск. Синхронизация заказов, остатков и цен с Ozon, WB и Яндекс.Маркетом.',
  },
  'ustanovka-unf': {
    title: 'Интеграция 1С:УНФ с маркетплейсами',
    description:
      'Установка модуля в 1С:Управление нашей фирмой: обработка, JWT-токен, первый запуск. ' +
      'Синхронизация заказов, остатков и цен, особенности и ограничения УНФ.',
  },
  'ustanovka-ka-erp': {
    title: 'Интеграция 1С:КА 2 и 1С:ERP — установка обработки',
    description:
      'Установка модуля в 1С:Комплексная автоматизация 2 и 1С:ERP: обязательная организация ' +
      'в документах, виды цен, учёт ГТД, расширенные схемы финансовых отчётов.',
  },
  'ustanovka-bp30': {
    title: 'Интеграция 1С:Бухгалтерия 3.0 с маркетплейсами',
    description:
      'Установка модуля в 1С:Бухгалтерия предприятия 3.0 и что работает иначе: счёт на оплату ' +
      'вместо заказа, остатки без разбивки по складам, ограничения маркировки.',
  },
  'master-podklyucheniya': {
    title: 'Настройка интеграции 1С: мастер подключения',
    description:
      'Пять шагов мастера: подключение по JWT-токену, конфигурация 1С, выбор сервиса и схемы ' +
      'работы, механики, реквизиты и запуск обмена. Сценарий для любой интеграции.',
  },
  'podklyuchit-ozon': {
    title: 'Интеграция Ozon и 1С: заказы, остатки, цены',
    description:
      'Как подключить Ozon к 1С: ключи Seller API, схемы FBS, FBO и realFBS, загрузка заказов, ' +
      'выгрузка остатков и цен, возвраты, маркировка и отчёты.',
  },
  'podklyuchit-wildberries': {
    title: 'Интеграция Wildberries и 1С: заказы и остатки',
    description:
      'Как подключить Wildberries к 1С: токен продавца, сборочные задания и поставки, выгрузка ' +
      'остатков и цен, возвраты, этикетки и финансовые отчёты.',
  },
  'podklyuchit-yandex-market': {
    title: 'Интеграция Яндекс.Маркета и 1С: заказы и остатки',
    description:
      'Как подключить Яндекс.Маркет к 1С: campaignId и токен, схемы FBS и FBY, загрузка заказов, ' +
      'выгрузка остатков и цен, возвраты и отчётность.',
  },
  'podklyuchit-internet-magazin': {
    title: 'Интеграция 1С с сайтом: Битрикс, WordPress, Tilda',
    description:
      'Интеграция 1С с интернет-магазином: 1С-Битрикс, WordPress, OpenCart, InSales, Ecwid, ' +
      'Tilda и свой сайт через REST API. Заказы, остатки, цены и каталог.',
  },
  'podklyuchit-crm': {
    title: 'Интеграция 1С и CRM: Битрикс24, AmoCRM, Мегаплан',
    description:
      'Как подключить CRM к 1С: Битрикс24, AmoCRM, Мегаплан, СБИС CRM, Neaktor. Синхронизация ' +
      'контрагентов, сделки в документы 1С, выгрузка счетов и передача статусов.',
  },
  'dostavka': {
    title: 'Интеграция 1С и СДЭК, Почты России, Яндекса',
    description:
      'Как подключить доставку к 1С: СДЭК, Почта России, Яндекс Доставка. Отправления ' +
      'из документов 1С, расчёт стоимости, накладные и статусы.',
  },
  'priyom-oplaty': {
    title: 'Приём оплаты в 1С: ЮKassa, СБП, Тинькофф, Сбер',
    description:
      'Как подключить приём оплаты к 1С: ЮKassa, СБП, Тинькофф и Сбер. Выставление счетов, ' +
      'ссылки на оплату, автоматическое отражение поступлений в 1С.',
  },
  'uvedomleniya-i-socseti': {
    title: 'Уведомления из 1С в Telegram, WhatsApp и VK',
    description:
      'Как настроить уведомления из 1С: Telegram-бот, WhatsApp, VK, Max, Одноклассники, Viber. ' +
      'Событие в 1С — сообщение клиенту или в рабочий чат.',
  },
  'analitika': {
    title: 'Выгрузка данных из 1С в Google Sheets и Power BI',
    description:
      'Как настроить выгрузку аналитики из 1С: Google Sheets, Power BI, Roistat, МойСклад. ' +
      'Наборы данных по продажам, заказам, остаткам и оплатам, расписание выгрузки.',
  },
  'cdp-i-rassylki': {
    title: 'Интеграция 1С с МойСклад и сервисами рассылок',
    description:
      'Как подключить CDP и рассылки к 1С: МойСклад, MindBox, SendPulse, Unisender, DashaMail. ' +
      'Синхронизация контактов, каталога, цен и остатков.',
  },
  'markirovka-chestny-znak': {
    title: 'Честный знак в 1С: маркировка для маркетплейсов',
    description:
      'Как передавать коды маркировки «Честный знак» из 1С на маркетплейс: подбор кодов, ' +
      'вывод из оборота, отличия УТ 11, УНФ, КА 2 / ERP и БП 3.0.',
  },
  'ostatki': {
    title: 'Синхронизация остатков 1С с маркетплейсами',
    description:
      'Как настроить выгрузку остатков из 1С: выбор складов, расчёт доступного количества, ' +
      'частота обновления и что делать, если остатки не уходят.',
  },
  'tseny': {
    title: 'Синхронизация цен 1С с маркетплейсами и сайтом',
    description:
      'Как настроить выгрузку цен из 1С: виды и типы цен, цена до скидки, округление, частота ' +
      'обновления и разбор частых ошибок.',
  },
  'zakazy-i-otgruzka': {
    title: 'Заказы маркетплейсов в 1С: загрузка и отгрузка',
    description:
      'Как настроить загрузку заказов с маркетплейса в 1С и отгрузку: какие документы создаются, ' +
      'статусы, схемы FBS и FBO, частые проблемы.',
  },
  'katalog-i-sopostavlenie': {
    title: 'Сопоставление номенклатуры 1С и товаров МП',
    description:
      'Как связать номенклатуру 1С с артикулами маркетплейса: автоматическое сопоставление по ' +
      'артикулу и штрихкоду, ручная привязка, выгрузка каталога.',
  },
  'finansovye-otchyoty': {
    title: 'Финансовые отчёты маркетплейсов в 1С',
    description:
      'Как загружать отчёты о продажах маркетплейса в 1С: комиссии, логистика, эквайринг и удержания, ' +
      'схемы отражения и сверка выплат.',
  },
  'proizvolnaya-integratsiya': {
    title: 'Интеграция 1С с любым сервисом через API',
    description:
      'Как подключить к 1С сервис, для которого нет готового адаптера: персональный воркфлоу, ' +
      'обмен через REST API, произвольные схемы данных.',
  },
};

/**
 * ── Перекрёстные ссылки, которых нет в исходниках ───────────────────────────
 *
 * Инструкции описывают вкратце то, что подробно расписано на соседней странице:
 * «JWT-токен — берётся в Личном кабинете» и всё. Читателю в этот момент нужна
 * ссылка «где подробнее», а не пересказ. Здесь эти ссылки и добавляются.
 *
 * Почему правилами сборки, а не правкой markdown: `content/epf-docs/` — это
 * поставка команды модуля. Следующая поставка перезапишет файлы, и ручные
 * правки молча исчезнут. Правило переживает обновление, а если формулировка
 * в исходнике изменилась — сборка падает и об этом становится известно сразу
 * (тот же приём, что в `tools/build-legal.mjs`).
 *
 * `count` — сколько раз правило обязано сработать по всему корпусу.
 */
const CROSSREFS = [
  {
    why: 'Требования: где взять токен, у нас показано по шагам со скриншотами кабинета',
    from: /\*\*JWT-токен\*\* — берётся в Личном кабинете\./g,
    to: '**JWT-токен** — берётся в Личном кабинете, [как именно](/docs#token).',
    count: 1,
  },
  {
    why: 'То же, краткая формулировка трёх остальных конфигураций',
    from: /\*\*JWT-токен\*\* из Личного кабинета\./g,
    to: '**JWT-токен** из Личного кабинета — [как его получить](/docs#token).',
    count: 3,
  },
  {
    why: 'Получение файла: пять строк вместо пяти экранов кабинета — ведём на подробное описание',
    from: /^## 2\. Получение файла$/gm,
    to: '## 2. Получение файла\n\n> Тот же путь по шагам, со скриншотами каждого экрана кабинета: **[Первичная настройка](/docs#token)**.',
    count: 4,
  },
  {
    why: 'Шаг 1 мастера: откуда берётся токен, который тут просят вставить',
    from: /\| Токен из Личного кабинета на corebridge\.ru \|/g,
    to: '| Токен из Личного кабинета на corebridge.ru — [где его взять](/docs#token-4) |',
    count: 1,
  },
];

/**
 * Названия механик в таблицах «Особенности конфигурации» — это ровно те пункты,
 * о которых сказано одной строкой, а подробности лежат отдельной инструкцией.
 * Ключ — текст в жирной ячейке слева, значение — файл инструкции.
 *
 * Ссылку ставим только в первой ячейке строки таблицы и только если в строке
 * ещё нет ссылки на ту же инструкцию: в УТ 11 у «Резервирования» она уже есть
 * в правой ячейке, второй раз незачем.
 */
const MECHANIC_LINKS = {
  'Заказы': '03-Маркетплейсы/Заказы-и-отгрузка.md',
  'Отгрузка': '03-Маркетплейсы/Заказы-и-отгрузка.md',
  'Триггер отгрузки': '03-Маркетплейсы/Заказы-и-отгрузка.md',
  'Возвраты': '03-Маркетплейсы/Возвраты.md',
  'Остатки товаров': '03-Маркетплейсы/Остатки.md',
  'Складской учёт': '03-Маркетплейсы/Остатки.md',
  'Склады': '03-Маркетплейсы/Остатки.md',
  'Типы цен': '03-Маркетплейсы/Цены.md',
  'Резервирование': '03-Маркетплейсы/Резервы.md',
  'Резервирование запасов': '03-Маркетплейсы/Резервы.md',
  'FBM/FBO': '03-Маркетплейсы/FBM-FBO-поставки.md',
  'Маркировка «Честный знак»': '03-Маркетплейсы/Маркировка-Честный-знак.md',
  'Вывод из оборота «Честный знак»': '03-Маркетплейсы/Маркировка-Честный-знак.md',
  'Финансовые отчёты МП': '03-Маркетплейсы/Финансовые-отчёты.md',
  'Учёт ГТД': '03-Маркетплейсы/ГТД.md',
  'Аналитика: набор данных «Остатки»': '06-Сервисы/Аналитика.md',
};

/** Применяет перекрёстные ссылки к тексту одного файла. */
function crossref(md, file, hits) {
  let out = md;

  for (const rule of CROSSREFS) {
    out = out.replace(rule.from, (m) => {
      hits.set(rule, (hits.get(rule) ?? 0) + 1);
      return typeof rule.to === 'function' ? rule.to(m) : rule.to;
    });
  }

  // ссылки на инструкции по названию механики в таблицах особенностей
  if (file.startsWith('01-Установка/')) {
    out = out.replace(/^\| \*\*([^*]+)\*\* \| (.+)$/gm, (row, label, rest) => {
      const target = MECHANIC_LINKS[label];
      if (!target) return row;
      const slug = BY_FILE.get(target);
      if (!slug || rest.includes(`${basename(target, '.md')}.md`)) return row;
      hits.set('mechanic', (hits.get('mechanic') ?? 0) + 1);
      return `| **[${label}](${'../' + target})** | ${rest}`;
    });
  }

  return out;
}

/**
 * Якорь заголовка в стиле GitHub: исходники ссылаются друг на друга
 * с якорями вида `#что-делать-если-что-то-пошло-не-так`, и они должны
 * продолжать работать на сайте.
 */
function anchor(text) {
  return text
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[«»"'`.,:;!?()[\]{}/\\|@#$%^&*+=~—–]/g, '')
    .replace(/[^\wа-яё\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-');
}

/** Размеры PNG из заголовка IHDR — чтобы картинки не дёргали вёрстку при загрузке. */
function pngSize(file) {
  const b = readFileSync(file);
  if (b.length < 24 || b.readUInt32BE(0) !== 0x89504e47) return null;
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

const errors = [];

/**
 * Обрезает текст до последней точки, уместившейся в лимит. Если предложение
 * длиннее лимита целиком — режем по слову и ставим многоточие.
 */
function clamp(text, limit) {
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit);
  const dot = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  if (dot > limit * 0.5) return cut.slice(0, dot + 1);
  return cut.slice(0, cut.lastIndexOf(' ')) + '…';
}
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Переписывает ссылку исходника в адрес на сайте.
 * `from` — путь исходного файла, ссылки в markdown относительные.
 */
function rewriteLink(href, from) {
  if (/^(https?:|mailto:|tel:|#)/.test(href)) return href;
  // адрес страницы сайта — его добавили правила CROSSREFS, переписывать нечего
  if (href.startsWith('/')) return href;

  const [path, hash] = href.split('#');
  const clean = path.replace(/^\.\//, '');

  if (/\.png$/i.test(clean)) {
    const name = basename(clean);
    if (!existsSync(join(IMG, name))) errors.push(`${from}: нет картинки ${name}`);
    return `/docs/images/${name}`;
  }

  if (/README\.md$/.test(clean)) return BASE + (hash ? `#${hash}` : '');

  // Ссылки в исходниках относительные и в двух видах: `../03-Маркетплейсы/Остатки.md`
  // на соседний раздел и `Сделки.md` на файл рядом. Резолвим от каталога исходника.
  const target = normalize(join(dirname(from), clean)).split(sep).join('/');
  const slug = BY_FILE.get(target);
  if (!slug) {
    errors.push(`${from}: ссылка в никуда — ${href}`);
    return href;
  }
  return `${BASE}/${slug}${hash ? `#${hash}` : ''}`;
}

/** Рендерер: свои правила для заголовков, таблиц, картинок и ссылок. */
function renderer(from, toc) {
  return {
    heading({ tokens, depth }) {
      const text = this.parser.parseInline(tokens);
      const id = anchor(text);
      // h1 на странице рисует сама страница, в теле статьи заголовки со второго
      const level = Math.min(depth + 1, 6);
      if (depth === 2) toc.push({ id, text: text.replace(/<[^>]+>/g, '') });
      return `<h${level} id="${id}">${text}</h${level}>\n`;
    },
    table(token) {
      const head = token.header
        .map((c, i) => `<th${align(token.align[i])}>${this.parser.parseInline(c.tokens)}</th>`)
        .join('');
      const body = token.rows
        .map(
          (row) =>
            `<tr>${row
              .map((c, i) => `<td${align(token.align[i])}>${this.parser.parseInline(c.tokens)}</td>`)
              .join('')}</tr>`,
        )
        .join('');
      // таблицы в инструкциях широкие — на телефоне прокручиваем их, а не страницу
      return `<div class="api-tbl-wrap"><table class="api-tbl"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>\n`;
    },
    image({ href, text }) {
      const src = rewriteLink(href, from);
      const size = existsSync(join(IMG, basename(src))) ? pngSize(join(IMG, basename(src))) : null;
      const dim = size ? ` width="${size.width}" height="${size.height}"` : '';
      // подпись под скриншотом — это alt из исходника, он осмысленный
      return (
        `<figure class="doc-shot">` +
        `<a href="${src}" target="_blank" rel="noopener">` +
        `<img src="${src}" alt="${esc(text)}" loading="lazy" decoding="async"${dim}></a>` +
        (text ? `<figcaption>${esc(text)}</figcaption>` : '') +
        `</figure>\n`
      );
    },
    link({ href, title, tokens }) {
      const url = rewriteLink(href, from);
      const ext = /^https?:/.test(url) ? ' target="_blank" rel="noopener"' : '';
      return `<a href="${url}"${title ? ` title="${esc(title)}"` : ''}${ext}>${this.parser.parseInline(
        tokens,
      )}</a>`;
    },
  };
}

const align = (a) => (a ? ` style="text-align:${a}"` : '');

/** Разбирает один файл: заголовок, лид, тело, оглавление второго уровня. */
function build(file, hits) {
  const raw = crossref(readFileSync(join(SRC, file), 'utf8'), file, hits);
  const toc = [];
  const md = new Marked({ gfm: true, breaks: false });
  md.use({ renderer: renderer(file, toc) });

  const title = raw.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? basename(file, '.md');
  const body = raw.replace(/^#\s+.+\n/, '');

  // Лид для карточки и <meta description>: первый осмысленный абзац.
  // ⚠️ Режем по границе предложения, а не по счётчику символов: описание
  // длиннее ~175 знаков поисковик обрезает сам, и обрывается оно на полуслове.
  const raw_lead = body
    .split('\n\n')
    .map((p) => p.trim())
    .find((p) => p && !p.startsWith('|') && !p.startsWith('#') && !p.startsWith('---'))
    ?.replace(/^>\s*/gm, '')
    .replace(/[*_`[\]]|\]\([^)]*\)/g, '')
    .replace(/\s+/g, ' ');
  const lead = clamp(raw_lead ?? '', 170);

  // marked заворачивает одиночную картинку в абзац, а <figure> внутри <p>
  // недопустима: браузер закрывает абзац сам и вёрстка разъезжается
  const html = md.parse(body).replace(/<p>(<figure[\s\S]*?<\/figure>)\s*<\/p>/g, '$1').trim();

  return { html, title, lead: lead ?? '', toc, ids: [...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]) };
}

// ── README: из него берём только хвостовые сводные разделы ───────────────────
// Оглавление 1–7 на сайте рисует навигация раздела, дублировать его незачем,
// а таблицы «что где доступно» и «частые проблемы» — ценные и своих аналогов
// в отдельных инструкциях не имеют.
const KEEP_FROM_README = ['Поддерживаемые сервисы', 'Что где доступно: сводка по конфигурациям', 'Быстрое решение частых проблем', 'О скриншотах'];

function buildIndexExtras() {
  const raw = readFileSync(join(SRC, 'README.md'), 'utf8');
  const kept = raw
    .split(/\n(?=## )/)
    .filter((chunk) => KEEP_FROM_README.some((h) => chunk.startsWith(`## ${h}`)))
    .join('\n')
    .replace(/\n---\n/g, '\n');
  if (kept.split('## ').length - 1 !== KEEP_FROM_README.length) {
    errors.push('README.md: не нашлись сводные разделы — проверьте KEEP_FROM_README');
  }
  const toc = [];
  const md = new Marked({ gfm: true });
  md.use({ renderer: renderer('README.md', toc) });
  return { html: md.parse(kept).trim(), toc };
}

// ── Сборка ───────────────────────────────────────────────────────────────────
const manifest = { sections: [], docs: {} };
const pages = new Map(); // slug → { html, ids }
const hits = new Map(); // правило перекрёстных ссылок → сколько раз сработало

for (const s of SECTIONS) {
  const docs = [];
  for (const [file, slug, hint, nav] of s.docs) {
    if (!existsSync(join(SRC, file))) {
      errors.push(`нет исходника ${file}`);
      continue;
    }
    const { html, title, lead, toc, ids } = build(file, hits);
    pages.set(slug, { html, ids, source: file });
    manifest.docs[slug] = { slug, title, nav, lead, hint, toc, seo: SEO[slug] ?? null, section: s.id, source: file };
    docs.push(slug);
  }
  manifest.sections.push({ id: s.id, title: s.title, hint: s.hint, docs });
}

// Правило, переставшее срабатывать, — это молча потерянная ссылка: формулировку
// в исходнике поменяли, а мы об этом не узнали. Поэтому расхождение — ошибка.
for (const rule of CROSSREFS) {
  const got = hits.get(rule) ?? 0;
  if (got !== rule.count) {
    errors.push(`перекрёстная ссылка «${rule.why}»: сработала ${got} раз(а), ожидалось ${rule.count}`);
  }
}
if ((hits.get('mechanic') ?? 0) < 20) {
  errors.push(`ссылок по названиям механик всего ${hits.get('mechanic') ?? 0} — таблицы особенностей изменились`);
}

const extras = buildIndexExtras();
manifest.extras = extras.toc;
pages.set('', { html: extras.html, ids: [...extras.html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]), source: 'README.md' });

// Якоря: и внутренние (`#шаг-1`), и межстраничные. Разъехавшийся якорь молча
// уводит на верх страницы вместо нужного места — ловим на сборке.
const idsOf = (slug) => pages.get(slug)?.ids ?? null;
for (const [slug, page] of pages) {
  for (const m of page.html.matchAll(/href="([^"]*#[^"]+)"/g)) {
    const [path, hash] = m[1].split('#');
    if (/^https?:/.test(path)) continue;
    const target = path === '' ? slug : path.replace(`${BASE}/`, '').replace(BASE, '');
    const ids = idsOf(target);
    if (ids && !ids.includes(decodeURIComponent(hash))) {
      errors.push(`${page.source}: якоря #${hash} нет ${path ? `в ${target || 'оглавлении'}` : 'на странице'}`);
    }
  }
}

// картинки, на которые никто не ссылается — обычно признак опечатки в пути
const used = new Set();
for (const page of pages.values()) {
  for (const m of page.html.matchAll(/\/docs\/images\/([^"]+)/g)) used.add(m[1]);
}
const orphans = readdirSync(IMG).filter((f) => !used.has(f));

if (errors.length) {
  console.error('Ошибки сборки документации:');
  for (const e of errors) console.error('  ·', e);
  process.exit(1);
}

if (!check) {
  mkdirSync(OUT, { recursive: true });
  for (const [slug, page] of pages) if (slug) writeFileSync(join(OUT, `${slug}.html`), page.html);
  writeFileSync(join(OUT, 'index-extras.html'), extras.html);
  writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
}

const total = Object.keys(manifest.docs).length;
console.log(
  `${check ? 'Проверено' : 'Собрано'}: ${total} инструкций, ${used.size} скриншотов, ` +
    `${CROSSREFS.reduce((n, r) => n + (hits.get(r) ?? 0), 0) + (hits.get('mechanic') ?? 0)} перекрёстных ссылок добавлено`,
);
if (orphans.length) console.log(`Не используются: ${orphans.join(', ')}`);
