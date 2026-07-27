/* CoreBridge — модуль подключения и управления интеграциями
 * Содержит:
 *   1) каталог из 26 сервисов (поля, шаги, ограничения)
 *   2) каталог-пикер (модальное окно «Выберите интеграцию»)
 *   3) модальное окно подключения / настройки выбранного сервиса
 *   4) панель управления (Запустить/Остановить/Удалить с подтверждением)
 *
 * Использование (см. integrations-app.html):
 *   CBIntegrations.openCatalog();          // выбор + первичное подключение
 *   CBIntegrations.openManager('ozon', { mode:'settings' | 'reauth', meta:{...} });
 *   CBIntegrations.openManager('bitrix24', { mode:'reauth', meta:{name:'Битрикс24 (продажи)', id:'CRM_001'} });
 */
(function () {
'use strict';

/* ───────────────────── КАТАЛОГ ──────────────────────
 *  Каждая интеграция:
 *    id, name, group, icon{glyph,bg,fg}, tagline, badges[], steps[], notes[], fields[],
 *    autoNote (что 1С даёт автоматически)
 */
const CATALOG = {

/* ── МАРКЕТПЛЕЙСЫ ─────────────────────────── */
ozon: {
  group: 'marketplace', name: 'Ozon',
  icon: { glyph:'O', bg:'#005bff', fg:'#fff' },
  tagline:'Заказы FBS и FBO, остатки, цены, отгрузка, финансы, этикетки, ГТД и маркировка.',
  badges:[{t:'Polling + Webhook', k:'info'},{t:'httpHeaderAuth', k:'neutral'}],
  steps:[
    'Войдите в <b>Личный кабинет Ozon Seller</b> → <b>Настройки → API-ключи</b>',
    'Нажмите <b>«Сгенерировать ключ»</b>, выберите тип <b>Admin read&write</b>. Скопируйте <b>Client-ID</b> и <b>API-Key</b>',
    'Вставьте оба значения в поля справа'
  ],
  notes:[
    'Тип ключа строго <b>Admin read&write</b> — read-only не позволит подтверждать отгрузку',
    'Обновление остатков: не более <b>100 SKU</b> за запрос — большие каталоги бьются на пачки',
    'Обновление цен: не более <b>1 000 SKU</b> за запрос',
    'Webhook от Ozon проверяется подписью <b>HMAC-SHA256</b> по заголовку <code>X-Ozon-Signature</code>'
  ],
  fields:[
    { id:'client_id', label:'Client-ID продавца', req:true, value:'12345678',
      hint:'Числовой ID — в разделе <b>Настройки → API-ключи</b> личного кабинета' },
    { id:'api_key', label:'API-Key', req:true, type:'password',
      hint:'Секретный ключ типа <b>Admin read&write</b>. Не передавайте третьим лицам' }
  ],
  autoNote:'Склад отгрузки FBS, контрагент «Ozon», организация и договор подгружаются из 1С'
},

wb: {
  group:'marketplace', name:'Wildberries',
  icon:{ glyph:'WB', bg:'#CB11AB', fg:'#fff' },
  tagline:'Заказы FBS, остатки, цены и скидки, поставки FBM, этикетки, финансовый отчёт.',
  badges:[{t:'Polling', k:'info'},{t:'Bearer Token', k:'neutral'}],
  steps:[
    'WB Seller Portal: <b>Настройки → Доступ к API</b>',
    'Нажмите <b>«Создать новый токен»</b>, дайте название «CoreBridge»',
    'Включите права: <b>Заказы, Склад, Цены и скидки, Статистика</b> (на чтение и запись)',
    'Скопируйте токен — он показывается <b>только один раз</b>'
  ],
  notes:[
    'Токен показывается <b>один раз</b> при создании — не скопировали, придётся создавать новый',
    'Остатки: до <b>1 000 SKU</b> за запрос. Пустой <code>stocks: []</code> сбрасывает остатки',
    'Цены передаются через <b>nmID</b>, а не <code>offer_id</code>',
    'Финансовый отчёт — отдельный API-домен статистики, тот же токен'
  ],
  fields:[
    { id:'token', label:'API-токен (Bearer)', req:true, type:'password',
      hint:'Начинается с <code>eyJ...</code>. Один токен со всеми четырьмя правами' }
  ],
  autoNote:'Склад FBS и контрагент «Wildberries» подгружаются из 1С'
},

ym: {
  group:'marketplace', name:'Яндекс Маркет',
  icon:{ glyph:'ЯМ', bg:'#FFCC00', fg:'#000' },
  tagline:'Заказы, остатки, цены, отгрузка, финансовая статистика, этикетки. OAuth 2.0 — токен обновляется автоматически.',
  badges:[{t:'Polling + Webhook', k:'warning'},{t:'OAuth 2.0', k:'neutral'}],
  steps:[
    'Партнёрский кабинет ЯМ: <b>Настройки → Интеграции → API</b>',
    'Создайте OAuth-токен. Он начинается с <code>AgAAA...</code>',
    'Campaign ID — числовой ID в URL кабинета: <code>partner.market.yandex.ru/portal/<b>12345678</b>/...</code>'
  ],
  notes:[
    'OAuth-токен действует <b>1 год</b>. CoreBridge напомнит за 30 дней до истечения',
    'Даты в API ЯМ — формат <b>DD-MM-YYYY</b> (не ISO), нормализатор конвертирует автоматически',
    'Один токен и Campaign ID — на одну кампанию. На каждый магазин нужна отдельная интеграция'
  ],
  fields:[
    { id:'token', label:'OAuth-токен', req:true, type:'password',
      hint:'Начинается с <code>AgAAA</code>. Срок действия 1 год' },
    { id:'campaign_id', label:'Campaign ID', req:true, value:'12345678',
      hint:'Числовой ID из URL партнёрского кабинета' }
  ],
  autoNote:'Склад отгрузки и контрагент «Яндекс Маркет» подгружаются из 1С'
},

/* ── САЙТЫ ─────────────────────────────────── */
bitrix: {
  group:'site', name:'1С-Битрикс (интернет-магазин)',
  icon:{ glyph:'1С', bg:'#FF6B35', fg:'#fff' },
  tagline:'Заказы с сайта, остатки и цены на сайт, статусы в обе стороны.',
  badges:[{t:'Webhook входящий', k:'success'},{t:'или OAuth', k:'neutral'}],
  steps:[
    'В панели сайта: <b>Настройки → REST API → Входящие вебхуки → Добавить</b>',
    'Дайте права: <b>Заказы (sale), Каталог (catalog), Склад</b>',
    'Скопируйте полный URL вебхука — он уже содержит токен'
  ],
  notes:[
    'OAuth-токен — альтернатива вебхуку. Используйте, если вебхук недоступен',
    'URL вебхука уже включает токен — поле OAuth можно оставить пустым'
  ],
  fields:[
    { id:'site_url', label:'URL сайта', req:true, value:'https://myshop.ru', kind:'url' },
    { id:'webhook', label:'URL входящего вебхука', req:true, value:'https://myshop.ru/rest/1/токен/', kind:'url',
      hint:'Полный URL из настроек REST API — уже содержит токен' },
    { id:'oauth', label:'OAuth-токен', req:false, type:'password', opt:'необязательно — альтернатива вебхуку' }
  ],
  autoNote:'Контрагент по умолчанию и склад подгружаются из 1С'
},

woocommerce: {
  group:'site', name:'WordPress / WooCommerce',
  icon:{ glyph:'Wo', bg:'#7F54B3', fg:'#fff' },
  tagline:'Заказы с сайта, остатки и цены, статусы. Авторизация через пару Consumer Key / Secret.',
  badges:[{t:'WooCommerce REST API', k:'info'}],
  steps:[
    'Панель WordPress: <b>WooCommerce → Настройки → Дополнительно → REST API</b>',
    '<b>«Добавить ключ»</b>, права <b>«Чтение/Запись»</b>',
    '<b>«Создать ключ API»</b>. Сохраните <b>Consumer Key</b> и <b>Consumer Secret</b> — показываются один раз'
  ],
  notes:[
    'Consumer Key и Secret показываются только при создании — сохраните сразу',
    'Consumer Key начинается с <code>ck_</code>, Secret — с <code>cs_</code>',
    'Нужны права <b>«Чтение и запись»</b>, не только чтение'
  ],
  fields:[
    { id:'site_url', label:'URL сайта', req:true, value:'https://myshop.ru', kind:'url' },
    { id:'ck', label:'Consumer Key', req:true, value:'ck_••••••••••••••••••••••••••••••••', hint:'Начинается с <code>ck_</code>' },
    { id:'cs', label:'Consumer Secret', req:true, type:'password', hint:'Начинается с <code>cs_</code>' }
  ],
  autoNote:'Контрагент и склад подгружаются из 1С'
},

tilda: {
  group:'site', name:'Tilda',
  icon:{ glyph:'Ti', bg:'#FFD700', fg:'#000' },
  tagline:'Приём заказов через webhook. Скопируйте один URL — и готово.',
  badges:[{t:'Webhook входящий', k:'neutral'}],
  steps:[
    'Скопируйте <b>Endpoint CoreBridge</b> (поле справа)',
    'Редактор Tilda: <b>Настройки сайта → Формы → Webhook</b>',
    'Вставьте URL в поле <b>«URL для отправки данных»</b>'
  ],
  notes:[
    'Tilda отправляет только <b>новые заказы</b> — обновление и отмена не поддерживаются',
    'Public Key / Secret Key нужны только для pull-запросов к API Tilda — для базовой работы необязательны'
  ],
  fields:[
    { id:'endpoint', label:'Endpoint CoreBridge', req:true, kind:'copy',
      value:'https://api.corebridge.ru/api/v1/webhooks/tilda_a1b2c3d4',
      hint:'Вставьте в Tilda → Настройки сайта → Формы → Webhook' },
    { id:'pk', label:'Public Key Tilda', opt:'необязательно' },
    { id:'sk', label:'Secret Key Tilda', opt:'необязательно', type:'password' }
  ],
  autoNote:'Контрагент по умолчанию подгружается из 1С',
  noTest:true
},

insales: {
  group:'site', name:'InSales',
  icon:{ glyph:'IS', bg:'#0096FF', fg:'#fff' },
  tagline:'Заказы, остатки, цены через API частного приложения InSales.',
  badges:[{t:'InSales REST API', k:'success'}],
  steps:[
    'Панель InSales: <b>Приложения → Разработка → Мои приложения</b>',
    '<b>«Создать частное приложение»</b>, название «CoreBridge»',
    'Скопируйте <b>API Key</b> и <b>API Password</b>'
  ],
  notes:[
    'Ключи выдаются от <b>частного приложения</b> — ключи администратора аккаунта не подходят'
  ],
  fields:[
    { id:'shop_url', label:'URL магазина', req:true, value:'https://myshop.myinsales.ru', kind:'url' },
    { id:'api_key', label:'API Key', req:true, value:'abc123def456' },
    { id:'api_pwd', label:'API Password', req:true, type:'password' }
  ],
  autoNote:'Контрагент и склад подгружаются из 1С'
},

ecwid: {
  group:'site', name:'Ecwid',
  icon:{ glyph:'Ec', bg:'#1AAB8B', fg:'#fff' },
  tagline:'Заказы и остатки через Legacy API.',
  badges:[{t:'Ecwid API', k:'info'}],
  steps:[
    'Панель Ecwid: <b>Мой профиль → API Legacy</b>',
    '<b>Store ID</b> — числовой ID в URL кабинета. <b>Secret Token</b> — в разделе «Ключи API»'
  ],
  fields:[
    { id:'store_id', label:'Store ID', req:true, value:'12345678', hint:'Числовой ID — виден в URL кабинета' },
    { id:'token', label:'Secret Token', req:true, type:'password', hint:'Из раздела <b>Legacy API keys</b>' }
  ],
  autoNote:'Контрагент подгружается из 1С'
},

opencart: {
  group:'site', name:'OpenCart',
  icon:{ glyph:'OC', bg:'#1F9D55', fg:'#fff' },
  tagline:'Заказы, остатки и цены через встроенный API OpenCart.',
  badges:[{t:'OpenCart API', k:'success'}],
  steps:[
    'Панель OpenCart: <b>Система → Пользователи → API</b>',
    'Создайте пользователя API, скопируйте ключ'
  ],
  fields:[
    { id:'site_url', label:'URL сайта', req:true, value:'https://myshop.ru', kind:'url' },
    { id:'user', label:'Имя пользователя API', req:true, value:'corebridge_api', hint:'Из раздела <b>Система → Пользователи → API</b>' },
    { id:'key', label:'API-ключ', req:true, type:'password' }
  ],
  autoNote:'Контрагент и склад подгружаются из 1С'
},

restapi: {
  group:'site', name:'Свой сайт (REST API)',
  icon:{ glyph:'API', bg:'#5B647A', fg:'#fff' },
  tagline:'Универсальный адаптер для любого REST API. Подходит для собственных разработок.',
  badges:[{t:'Любой REST API', k:'neutral'},{t:'Bearer / Custom Header', k:'neutral'}],
  notes:[
    'Имя заголовка авторизации по умолчанию <code>Authorization</code>. Измените, если ваш API использует нестандартный (например, <code>X-API-Key</code>)',
    'Если есть Swagger/OpenAPI — укажите URL для автоматической настройки маппинга',
    'Для нестандартного маппинга полей заказа обратитесь в поддержку CoreBridge'
  ],
  fields:[
    { id:'base_url', label:'Base URL API', req:true, value:'https://myshop.ru/api/v2', kind:'url' },
    { id:'token', label:'API-ключ / Bearer-токен', req:true, type:'password',
      hint:'Передаётся в заголовке <code>Authorization: Bearer {ключ}</code>' },
    { id:'auth_header', label:'Имя заголовка авторизации', opt:'необязательно', value:'Authorization' },
    { id:'swagger', label:'URL OpenAPI / Swagger', opt:'необязательно', value:'https://myshop.ru/api/swagger.json', kind:'url' }
  ],
  autoNote:'Контрагент и склад подгружаются из 1С'
},

/* ── CRM ──────────────────────────────────── */
bitrix24: {
  group:'crm', name:'Битрикс24',
  icon:{ glyph:'Б24', bg:'#2D8CFF', fg:'#fff' },
  tagline:'Сделки, контрагенты, счета, статусы воронки — двусторонняя синхронизация с 1С.',
  badges:[{t:'Webhook + OAuth', k:'admin'}],
  steps:[
    'В Б24: <b>Приложения → Вебхуки → Добавить → Входящий вебхук</b>',
    'Права: <b>CRM (crm)</b>',
    'Скопируйте URL вебхука: <code>https://company.bitrix24.ru/rest/1/токен/</code>'
  ],
  notes:[
    'OAuth-токен — альтернатива вебхуку. Заполняйте либо вебхук, либо OAuth',
    'Верификация входящих событий — по полю <code>application_token</code> в теле'
  ],
  fields:[
    { id:'portal', label:'URL портала', req:true, value:'https://company.bitrix24.ru', kind:'url' },
    { id:'webhook', label:'URL входящего вебхука', req:true, value:'https://company.bitrix24.ru/rest/1/токен/', kind:'url',
      hint:'Уже содержит токен — отдельно вводить не нужно' },
    { id:'oauth', label:'OAuth-токен', opt:'необязательно — альтернатива вебхуку', type:'password' }
  ],
  autoNote:'Контрагент по умолчанию и договор подгружаются из 1С'
},

amocrm: {
  group:'crm', name:'AmoCRM',
  icon:{ glyph:'AM', bg:'#339AF0', fg:'#fff' },
  tagline:'Сделки, контакты, стадии воронки. OAuth 2.0 с автообновлением Refresh Token.',
  badges:[{t:'OAuth 2.0', k:'info'},{t:'Auto-refresh', k:'neutral'}],
  steps:[
    '<b>Настройки → Интеграции → Создать интеграцию</b>',
    'Скопируйте <b>Client ID</b> (ID интеграции) и <b>Client Secret</b>',
    'В OAuth-разделе нажмите <b>«Предоставить доступ»</b> — получите Access и Refresh Token'
  ],
  notes:[
    'Refresh Token обновляется CoreBridge автоматически каждые 24 часа',
    'Поддомен — без <code>.amocrm.ru</code>: только <code>company</code>, не <code>company.amocrm.ru</code>',
    'Access и Refresh вводятся при первичном подключении — далее CoreBridge управляет ими сам'
  ],
  fields:[
    { id:'subdomain', label:'Поддомен AmoCRM', req:true, value:'company', hint:'Только название, без <code>.amocrm.ru</code>' },
    { id:'client_id', label:'Integration ID (Client ID)', req:true, value:'abc123def-456g-...' },
    { id:'client_secret', label:'Client Secret', req:true, type:'password' },
    { id:'access', label:'Access Token', req:true, type:'password' },
    { id:'refresh', label:'Refresh Token', req:true, type:'password',
      hint:'Обновляется автоматически — повторно вводить не потребуется' }
  ],
  autoNote:'Контрагент по умолчанию подгружается из 1С'
},

megaplan: {
  group:'crm', name:'Мегаплан',
  icon:{ glyph:'МП', bg:'#00B956', fg:'#fff' },
  tagline:'Сделки и статусы через Access Token API Мегаплана.',
  badges:[{t:'Bearer Token', k:'neutral'}],
  steps:[
    'В Мегаплане: <b>Настройки → Интеграции → API</b>',
    '<b>«Создать токен»</b>, скопируйте значение'
  ],
  fields:[
    { id:'domain', label:'Домен портала', req:true, value:'company.megaplan.ru', hint:'Полный домен вашего Мегаплана' },
    { id:'token', label:'Access Token', req:true, type:'password' }
  ],
  autoNote:'Контрагент и договор подгружаются из 1С'
},

sbis_crm: {
  group:'crm', name:'СБИС CRM',
  icon:{ glyph:'СБ', bg:'#E32D24', fg:'#fff' },
  tagline:'Сделки и контрагенты через API СБИС Online.',
  badges:[{t:'СБИС API', k:'success'}],
  steps:[
    'СБИС Online: <b>Настройки → Интеграция → API СБИС</b>',
    'Создайте API-ключ. <b>SID организации</b> — в настройках аккаунта'
  ],
  notes:[
    'СБИС использует сессионную авторизацию — CoreBridge сам получает и обновляет <code>session_id</code>'
  ],
  fields:[
    { id:'key', label:'API-ключ СБИС', req:true, type:'password' },
    { id:'sid', label:'SID организации', req:true, value:'123456789', hint:'Числовой идентификатор организации в СБИС' }
  ],
  autoNote:'Контрагент и договор подгружаются из 1С'
},

neaktor: {
  group:'crm', name:'Neaktor',
  icon:{ glyph:'Ne', bg:'#5B647A', fg:'#fff' },
  tagline:'Задачи и заявки через Bearer Token.',
  badges:[{t:'Bearer Token', k:'neutral'}],
  steps:[
    'Настройки аккаунта Neaktor: <b>Настройки → API</b> → создайте токен'
  ],
  fields:[
    { id:'token', label:'Bearer Token', req:true, type:'password' },
    { id:'deal_type', label:'ID типа записи «Сделка»', opt:'необязательно', value:'deal_type_001',
      hint:'Если несколько типов записей — укажите нужный. Иначе автоопределение' }
  ],
  autoNote:'Контрагент и договор подгружаются из 1С'
},

/* ── ДОСТАВКА ─────────────────────────────── */
cdek: {
  group:'delivery', name:'СДЭК',
  icon:{ glyph:'СД', bg:'#00B956', fg:'#fff' },
  tagline:'Заявки на доставку, трекинг, расчёт стоимости, отмена. OAuth 2.0 client_credentials.',
  badges:[{t:'OAuth 2.0 + Webhook', k:'success'}],
  steps:[
    'Личный кабинет cdek.ru: <b>Интеграции → API → API v2</b>',
    'Скопируйте <b>Client ID</b> и <b>Client Secret</b>'
  ],
  notes:[
    'OAuth 2.0 client_credentials — токен получается автоматически (срок 1 час)',
    'Город отправителя — как в справочнике СДЭК (например, «Москва», не «г. Москва»)',
    'Статусы доставки приходят через webhook — URL CoreBridge покажет после подключения'
  ],
  fields:[
    { id:'client_id', label:'Client ID', req:true, value:'EMscd6r9JnFiQ3bL', col:'half' },
    { id:'client_secret', label:'Client Secret', req:true, type:'password', col:'half' },
    { id:'city', label:'Город отправителя', req:true, value:'Москва', hint:'Как в справочнике СДЭК' },
    { id:'address', label:'Адрес отправителя', req:true, value:'ул. Ленина, д. 1, оф. 10' },
    { id:'contact', label:'Контактное лицо', req:true, value:'Иванов Иван', col:'half' },
    { id:'phone', label:'Телефон', req:true, value:'+7 999 123-45-67', col:'half' }
  ],
  autoNote:'Склад отправления и организация подгружаются из 1С'
},

pochta: {
  group:'delivery', name:'Почта России',
  icon:{ glyph:'ПР', bg:'#005BFF', fg:'#fff' },
  tagline:'Отправления через сервис «Отправка» — трекинг и создание заявок.',
  badges:[{t:'Двойная авторизация', k:'info'}],
  steps:[
    'Зарегистрируйтесь на <b>otpravka.pochta.ru</b>',
    '<b>Настройки → Доступ к API</b> → запросите доступ. Скопируйте <b>Access Token</b>',
    'Логин и пароль — те же, что для входа на otpravka.pochta.ru'
  ],
  notes:[
    'Требуются <b>одновременно</b> два вида авторизации: <code>AccessToken</code> и <code>X-User-Authorization: Basic</code>',
    'Индекс места приёма — индекс отделения, куда вы сдаёте посылки'
  ],
  fields:[
    { id:'login', label:'Логин', req:true, value:'ivan@mail.ru', col:'half' },
    { id:'password', label:'Пароль', req:true, type:'password', col:'half' },
    { id:'token', label:'Access Token', req:true, type:'password', hint:'Из ЛК otpravka.pochta.ru' },
    { id:'index', label:'Индекс места приёма', req:true, value:'101000', hint:'Индекс отделения, куда сдаёте посылки' }
  ],
  autoNote:'Склад отправления и организация подгружаются из 1С'
},

ym_delivery: {
  group:'delivery', name:'Яндекс Маркет Доставка',
  icon:{ glyph:'ЯД', bg:'#FFCC00', fg:'#000' },
  tagline:'Использует тот же OAuth-токен, что и ЯМ-маркетплейс.',
  badges:[{t:'Использует токен ЯМ', k:'warning'}],
  notes:[
    'Если уже подключили <b>Яндекс Маркет как маркетплейс</b> — токен и Campaign ID подставятся автоматически'
  ],
  fields:[
    { id:'token', label:'OAuth-токен ЯМ', req:true, type:'password', hint:'Тот же токен, что и для маркетплейса' },
    { id:'campaign_id', label:'Campaign ID', req:true, value:'12345678' }
  ],
  autoNote:'Склад отправления и организация подгружаются из 1С'
},

/* ── ОПЛАТА ──────────────────────────────── */
yookassa: {
  group:'pay', name:'ЮKassa',
  icon:{ glyph:'ЮК', bg:'#8E44AD', fg:'#fff' },
  tagline:'Уведомления об оплате, отмене и возврате → документы в 1С. Верификация HMAC-SHA256.',
  badges:[{t:'Webhook входящий', k:'admin'},{t:'Basic Auth', k:'neutral'}],
  steps:[
    'В ЮKassa: <b>Интеграция → HTTP-уведомления</b> → вставьте Endpoint CoreBridge',
    '<b>Интеграция → Ключи API</b>: скопируйте <b>shopId</b> и <b>Секретный ключ</b>'
  ],
  notes:[
    'Боевой ключ — <code>live_</code>, тестовый — <code>test_</code>. Тестовый не создаёт документов',
    'Webhook верифицируется <b>HMAC-SHA256</b> — поддельные уведомления отклоняются',
    'События: <code>payment.succeeded</code>, <code>payment.canceled</code>, <code>refund.succeeded</code>'
  ],
  fields:[
    { id:'endpoint', label:'Endpoint CoreBridge', req:true, kind:'copy',
      value:'https://api.corebridge.ru/api/v1/webhooks/yk_a1b2c3d4',
      hint:'Вставьте в ЮKassa → Интеграция → HTTP-уведомления' },
    { id:'shop_id', label:'Shop ID', req:true, value:'123456', hint:'Числовой <b>shopId</b>' },
    { id:'key', label:'Секретный ключ', req:true, type:'password', value:'live_••••••••••••••••••••••••••••••••••••', hint:'Начинается с <code>live_</code> или <code>test_</code>' },
    { id:'redirect', label:'URL редиректа после оплаты', opt:'необязательно', value:'https://myshop.ru/payment/success', kind:'url' }
  ],
  autoNote:'Статья ДДС и контрагент подгружаются из 1С'
},

sbp: {
  group:'pay', name:'СБП',
  icon:{ glyph:'СБП', bg:'#1F9D55', fg:'#fff' },
  tagline:'Оплата по QR-кодам. Выберите банк-эквайер — ключи возьмутся из его профиля.',
  badges:[{t:'Webhook входящий', k:'success'},{t:'HMAC-SHA256', k:'neutral'}],
  notes:[
    'Доступные банки: <b>ЮKassa, Тинькофф (Т-Банк), Сбербанк</b>',
    'Если банк уже подключён — ключи подставятся автоматически',
    'Сумма приходит в <b>копейках</b> — конвертируется в рубли автоматически'
  ],
  fields:[
    { id:'bank', label:'Банк-эквайер', req:true, kind:'select',
      options:['Выберите банк-эквайер','ЮKassa (Яндекс)','Тинькофф (Т-Банк)','Сбербанк'],
      hint:'После выбора появятся поля для ключей конкретного банка' }
  ],
  autoNote:'Статья ДДС и контрагент подгружаются из 1С',
  noTest:true
},

tinkoff: {
  group:'pay', name:'Тинькофф (Т-Касса)',
  icon:{ glyph:'Т', bg:'#FFDD2D', fg:'#000' },
  tagline:'Приём платежей через Т-Кассу. Подпись запросов SHA-256.',
  badges:[{t:'Webhook входящий', k:'warning'},{t:'SHA-256 подпись', k:'neutral'}],
  steps:[
    'ЛК Т-Кассы: <b>Мой магазин → Подключение к API</b>',
    'Скопируйте <b>TerminalKey</b> и <b>SecretKey</b> — это разные значения'
  ],
  notes:[
    'Тестовый TerminalKey оканчивается на <code>_DEMO</code> — не использовать в бою',
    'Сумма приходит в <b>копейках</b> — конвертируется автоматически'
  ],
  fields:[
    { id:'terminal', label:'Terminal Key', req:true, value:'TinkoffBankTest_abc123', hint:'Публичный ключ терминала' },
    { id:'secret', label:'Secret Key', req:true, type:'password', hint:'Секретный ключ подписи — не путайте с Terminal Key' }
  ],
  autoNote:'Статья ДДС и контрагент подгружаются из 1С'
},

sber: {
  group:'pay', name:'Сбер (Эквайринг)',
  icon:{ glyph:'Сб', bg:'#1F9D55', fg:'#fff' },
  tagline:'Интернет-эквайринг Сбербанка. Тестовый стенд — отдельным переключателем.',
  badges:[{t:'Webhook входящий', k:'success'},{t:'Basic Auth', k:'neutral'}],
  notes:[
    'Тестовый стенд: <code>3dsec.sberbank.ru</code> — не использовать с боевыми картами',
    'Webhook приходит как GET-параметрами или POST — оба обрабатываются',
    'Логин и пароль выдаются Сбербанком при подключении эквайринга'
  ],
  fields:[
    { id:'user', label:'Логин (userName)', req:true, value:'myshop-api', hint:'Выдаётся Сбербанком при подключении' },
    { id:'password', label:'Пароль', req:true, type:'password' },
    { id:'test', label:'Тестовый стенд (3dsec.sberbank.ru)', kind:'checkbox' }
  ],
  autoNote:'Статья ДДС и контрагент подгружаются из 1С'
},

/* ── CDP / МАРКЕТИНГ ─────────────────────── */
mindbox: {
  group:'cdp', name:'MindBox',
  icon:{ glyph:'MB', bg:'#FF6B35', fg:'#fff' },
  tagline:'События заказов, профили клиентов, баланс бонусов. Async API.',
  badges:[{t:'HTTP Header Auth', k:'warning'}],
  steps:[
    'MindBox → <b>Настройки → Интеграции → API</b> → скопируйте <b>Secret Key</b>',
    '<b>Endpoint name</b> — название точки продаж в схеме MindBox. Уточните у менеджера'
  ],
  notes:[
    'Запрос баланса — <b>синхронно</b> (<code>/v3/operations/sync</code>) с таймаутом 3 сек. Не ответил — заказ создаётся без бонусов',
    'Остальные события — <b>асинхронно</b>, не блокируют 1С'
  ],
  fields:[
    { id:'key', label:'Secret Key', req:true, type:'password' },
    { id:'endpoint', label:'Endpoint name', req:true, value:'MainWebsite', hint:'Название точки продаж в схеме MindBox' }
  ],
  autoNote:'Контрагент по умолчанию подгружается из 1С'
},

sendpulse: {
  group:'cdp', name:'SendPulse',
  icon:{ glyph:'SP', bg:'#FF002B', fg:'#fff' },
  tagline:'Рассылки, автоматизации, транзакционные письма. OAuth 2.0 client_credentials.',
  badges:[{t:'OAuth 2.0', k:'info'}],
  steps:[
    'SendPulse → <b>Настройки аккаунта → API</b>',
    'Скопируйте <b>API ID</b> (Client ID) и <b>API Secret</b>'
  ],
  fields:[
    { id:'client_id', label:'API ID (Client ID)', req:true, value:'abc123def456ghi789' },
    { id:'client_secret', label:'API Secret', req:true, type:'password' },
    { id:'list_id', label:'ID списка рассылки', opt:'необязательно', value:'1234567', hint:'Если нужно добавлять клиентов в конкретный список' }
  ],
  autoNote:'Контрагент по умолчанию подгружается из 1С'
},

moysklad: {
  group:'cdp', name:'МойСклад',
  icon:{ glyph:'МС', bg:'#10b981', fg:'#fff' },
  tagline:'Каталог, остатки, цены — двусторонняя синхронизация с 1С.',
  badges:[{t:'Bearer Token', k:'neutral'}],
  steps:[
    'МойСклад → <b>Настройки → Токены → Создать</b>. Показывается один раз'
  ],
  fields:[
    { id:'token', label:'Bearer Token', req:true, type:'password',
      hint:'Создаётся в МойСклад → Настройки → Токены. Показывается <b>только один раз</b>' }
  ],
  autoNote:'Контрагент по умолчанию подгружается из 1С'
},

/* ── СОЦСЕТИ ──────────────────────────────── */
telegram: {
  group:'social', name:'Telegram',
  icon:{ glyph:'TG', bg:'#229ED9', fg:'#fff' },
  tagline:'Уведомления о заказах через Telegram-бота. Только исходящие.',
  badges:[{t:'Bot API', k:'info'},{t:'Только исходящие', k:'neutral'}],
  steps:[
    'Найдите в Telegram <b>@BotFather</b>',
    'Отправьте <code>/newbot</code>, следуйте инструкциям. Скопируйте <b>Bot Token</b>',
    'Добавьте бота в чат/канал и назначьте администратором',
    'Узнайте <b>Chat ID</b> через <b>@userinfobot</b> или <b>@getmyid_bot</b>'
  ],
  notes:[
    'Лимит: <b>30 сообщений/сек</b>. Массовая рассылка разбивается автоматически',
    'Chat ID групп и каналов начинается с <code>-100</code>'
  ],
  fields:[
    { id:'token', label:'Bot Token', req:true, type:'password',
      value:'1234567890:AAF••••••••••••••••••••••••••••••••', hint:'Формат: <code>числа:буквы_и_цифры</code>' },
    { id:'chat_buyer', label:'Chat ID покупателя', req:true, value:'123456789' },
    { id:'chat_team', label:'Chat ID команды / канала алертов', opt:'необязательно',
      value:'-1001234567890', hint:'Начинается с <code>-100</code> для групп и каналов' }
  ]
},

whatsapp: {
  group:'social', name:'WhatsApp (Meta / WABA)',
  icon:{ glyph:'WA', bg:'#25D366', fg:'#fff' },
  tagline:'Уведомления через официальный WhatsApp Business API. Только одобренные шаблоны.',
  badges:[{t:'Meta WABA', k:'success'},{t:'Только шаблоны', k:'warning'}],
  steps:[
    '<b>Meta Business Suite → WhatsApp → Настройки API</b>',
    'Скопируйте <b>Phone Number ID</b> и <b>WhatsApp Business Account ID</b>',
    '<b>Системные пользователи</b>: создайте <b>постоянный</b> Access Token с правами на отправку'
  ],
  notes:[
    'WhatsApp разрешает только <b>заранее одобренные шаблоны</b> — произвольный текст не допускается',
    'Используйте <b>постоянный</b> System User Access Token — временные истекают через 1 час',
    'После подключения список шаблонов будет доступен в CoreBridge'
  ],
  fields:[
    { id:'phone_id', label:'Phone Number ID', req:true, value:'123456789012345' },
    { id:'waba_id', label:'WhatsApp Business Account ID', req:true, value:'987654321098765' },
    { id:'token', label:'System User Access Token', req:true, type:'password',
      value:'EAABs••••••••••••••••••••••••••••••••••••••••', hint:'Постоянный токен — не временный' }
  ]
},

vk: {
  group:'social', name:'ВКонтакте (VK)',
  icon:{ glyph:'VK', bg:'#0077FF', fg:'#fff' },
  tagline:'Уведомления через сообщения сообщества. Community Access Token.',
  badges:[{t:'VK API', k:'info'}],
  steps:[
    'Сообщество VK: <b>Управление → Работа с API → Ключи доступа</b>',
    'Создайте ключ с правом <b>«Сообщения сообщества»</b>',
    'Group ID — в URL сообщества: <code>vk.com/public<b>123456</b></code>'
  ],
  fields:[
    { id:'token', label:'Community Access Token', req:true, type:'password',
      value:'vk1.a.••••••••••••••••••••••••••••••••••••' },
    { id:'group_id', label:'ID сообщества (Group ID)', req:true, value:'123456789',
      hint:'Числовой ID из URL: <code>vk.com/public<b>123456789</b></code>' }
  ]
},

viber: {
  group:'social', name:'Viber',
  icon:{ glyph:'Vi', bg:'#7360F2', fg:'#fff' },
  tagline:'Уведомления через Viber-бота с partners.viber.com.',
  badges:[{t:'Viber Bot API', k:'admin'}],
  steps:[
    'Зарегистрируйте бота на <b>partners.viber.com</b> — получите Auth Token'
  ],
  fields:[
    { id:'token', label:'Auth Token', req:true, type:'password' },
    { id:'sender', label:'Отображаемое имя отправителя', req:true, value:'Мой магазин' }
  ]
},

ok: {
  group:'social', name:'Одноклассники',
  icon:{ glyph:'OK', bg:'#EE8208', fg:'#fff' },
  tagline:'Уведомления через OK API. Подпись MD5 по параметрам запроса.',
  badges:[{t:'OK API', k:'warning'},{t:'MD5 подпись', k:'neutral'}],
  steps:[
    'Зарегистрируйте приложение на <b>apiok.ru</b> — получите Application ID, Application Key и Secret Key',
    'Access Token группы — через OAuth-авторизацию от админа группы'
  ],
  fields:[
    { id:'app_id', label:'Application ID', req:true, value:'123456789012345' },
    { id:'app_key', label:'Application Key', req:true, value:'ABCDEFGHIJKLMNOP' },
    { id:'app_secret', label:'Application Secret Key', req:true, type:'password' },
    { id:'access', label:'Access Token группы', req:true, type:'password', hint:'OAuth-токен от администратора группы' }
  ]
},

/* ── АНАЛИТИКА ────────────────────────────── */
gsheets: {
  group:'analytics', name:'Google Sheets',
  icon:{ glyph:'GS', bg:'#0F9D58', fg:'#fff' },
  tagline:'Экспорт данных из 1С в таблицы Google. До 5 000 строк за обновление.',
  badges:[{t:'Service Account', k:'success'},{t:'Sheets API v4', k:'neutral'}],
  steps:[
    '<b>Google Cloud Console</b>: создайте Service Account, роль «Редактор»',
    'Создайте JSON-ключ для Service Account, скачайте файл',
    'Google Таблица: <b>Настройки доступа</b> → добавьте email Service Account как редактора',
    '<b>Spreadsheet ID</b> — из URL: <code>spreadsheets/d/<b>ВОТ_ЭТО</b>/edit</code>'
  ],
  notes:[
    'Максимум <b>5 000 строк</b> за вызов — большие объёмы разбиваются на пакеты',
    'Перед записью CoreBridge очищает указанный диапазон, затем записывает заново'
  ],
  fields:[
    { id:'spreadsheet', label:'Spreadsheet ID', req:true, value:'1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms',
      hint:'Из URL таблицы: <code>/d/<b>ВОТ_ЭТО</b>/edit</code>' },
    { id:'sa_json', label:'Service Account JSON', req:true, kind:'textarea',
      value:'{"type": "service_account", "project_id": "...", ...}',
      hint:'Вставьте содержимое JSON-файла ключа' }
  ]
},

powerbi: {
  group:'analytics', name:'Power BI',
  icon:{ glyph:'PB', bg:'#F2C811', fg:'#000' },
  tagline:'Отправка строк в Streaming Dataset через Push URL.',
  badges:[{t:'Streaming Dataset', k:'warning'}],
  steps:[
    'Power BI Service: <b>Рабочая область → Создать → Набор данных → API</b>',
    'Настройте схему таблицы, скопируйте <b>Dataset Push URL</b>'
  ],
  notes:[
    'Push URL содержит ключ авторизации — не передавайте третьим лицам',
    'Перед загрузкой новых данных CoreBridge очищает таблицу через DELETE'
  ],
  fields:[
    { id:'push_url', label:'Dataset Push URL', req:true, value:'https://api.powerbi.com/beta/...rows?key=...', kind:'url',
      hint:'Полный URL из настроек Streaming Dataset. Содержит ключ — храните в тайне' }
  ]
},

roistat: {
  group:'analytics', name:'Roistat',
  icon:{ glyph:'Rs', bg:'#993C1D', fg:'#fff' },
  tagline:'Заказы и выручка из 1С в Roistat для сквозной аналитики и расчёта ROI.',
  badges:[{t:'Roistat API', k:'warning'},{t:'Header Auth', k:'neutral'}],
  steps:[
    'Roistat: <b>Настройки → Интеграции → API</b>',
    'Скопируйте <b>API-ключ</b> и <b>Project ID</b>'
  ],
  fields:[
    { id:'key', label:'API-ключ проекта', req:true, type:'password' },
    { id:'project_id', label:'Project ID', req:true, value:'123456', hint:'Числовой ID из URL проекта Roistat' }
  ]
}

}; // /CATALOG

/* ───────────────────── СТИЛИ ────────────────────── */
function injectStyles() {
  if (document.getElementById('cbi-styles')) return;
  const css = `
  .cbi-bd { position:fixed; inset:0; background:rgba(10,36,99,.55); backdrop-filter:blur(4px);
    z-index:1000; display:none; align-items:flex-start; justify-content:center; padding:32px 16px; overflow-y:auto; }
  .cbi-bd.open { display:flex; }
  .cbi-modal { background:#fff; border-radius:16px; max-width:880px; width:100%;
    box-shadow:0 24px 80px rgba(0,0,0,.3); position:relative; margin:auto; overflow:hidden; }
  .cbi-modal.sm { max-width:520px; }

  .cbi-head { padding:20px 28px; border-bottom:1px solid var(--border); display:flex; align-items:center; gap:14px; }
  .cbi-head .cbi-ic { width:44px; height:44px; border-radius:11px; display:flex; align-items:center;
    justify-content:center; font-weight:800; font-size:14px; flex-shrink:0;
    box-shadow:inset 0 0 0 1px rgba(0,0,0,.08); }
  .cbi-head h2 { font-size:20px; margin:0 0 2px; }
  .cbi-head .sub { font-size:13px; color:var(--text-muted); margin:0; }
  .cbi-head .x { margin-left:auto; width:36px; height:36px; border-radius:8px; border:1px solid var(--border);
    background:#fff; color:var(--text-muted); font-size:18px; cursor:pointer; }
  .cbi-head .x:hover { background:var(--bg-alt); }

  .cbi-tabs { display:flex; gap:0; padding:0 28px; border-bottom:1px solid var(--border); background:#fff; }
  .cbi-tabs button { padding:14px 4px; margin-right:24px; border:0; background:transparent; cursor:pointer;
    font-size:14px; font-weight:600; color:var(--text-muted); border-bottom:2px solid transparent; font-family:inherit; }
  .cbi-tabs button.on { color:var(--navy-900); border-bottom-color:var(--orange-500); }
  .cbi-tabs button:hover:not(.on) { color:var(--text); }

  .cbi-body { padding:24px 28px; max-height:calc(100vh - 280px); overflow-y:auto; }
  .cbi-body.split { display:grid; grid-template-columns:1fr 1fr; gap:24px; }
  @media (max-width: 820px) { .cbi-body.split { grid-template-columns:1fr; } }

  .cbi-section-label { font-size:11px; letter-spacing:.08em; text-transform:uppercase;
    color:var(--text-faint); font-weight:700; margin-bottom:12px; }

  .cbi-steps { background:var(--bg-tinted); border:1px solid var(--border); border-radius:10px; padding:14px 16px; margin-bottom:14px; }
  .cbi-step { display:flex; gap:10px; padding:7px 0; border-bottom:1px solid var(--border); font-size:13px; line-height:1.55; color:var(--text); }
  .cbi-step:last-child { border-bottom:none; padding-bottom:0; }
  .cbi-step:first-child { padding-top:0; }
  .cbi-step-n { width:20px; height:20px; border-radius:50%; background:#fff; border:1px solid var(--border-strong);
    display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:600; color:var(--text-muted); flex-shrink:0; margin-top:1px; }

  .cbi-notes { background:#fff; border:1px solid var(--border); border-left:3px solid var(--danger);
    border-radius:8px; padding:12px 14px; }
  .cbi-notes .lbl { color:var(--danger); }
  .cbi-notes ul { list-style:none; margin:0; padding:0; }
  .cbi-notes li { font-size:13px; color:var(--text-muted); padding:5px 0; border-bottom:1px solid var(--border); line-height:1.55; display:flex; gap:8px; }
  .cbi-notes li::before { content:"—"; color:var(--danger); flex-shrink:0; font-weight:600; }
  .cbi-notes li:last-child { border-bottom:none; padding-bottom:0; }

  .cbi-form { display:flex; flex-direction:column; gap:14px; }
  .cbi-form .row2 { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
  .cbi-field label { display:flex; align-items:center; gap:6px; font-size:13px; font-weight:600; color:var(--text); margin-bottom:5px; }
  .cbi-field .req { color:var(--danger); font-size:13px; }
  .cbi-field .opt { font-size:12px; color:var(--text-faint); font-weight:400; margin-left:auto; }
  .cbi-field .hint { font-size:12px; color:var(--text-muted); margin-top:5px; line-height:1.5; }
  .cbi-field .hint code { background:var(--bg-alt); padding:1px 5px; border-radius:3px; font-family:var(--mono); font-size:11px; }

  .cbi-input, .cbi-textarea, .cbi-select { width:100%; padding:9px 12px; border:1px solid var(--border-strong);
    border-radius:8px; background:#fff; font-size:13px; font-family:inherit; color:var(--text); }
  .cbi-input.pw { font-family:var(--mono); letter-spacing:.08em; color:var(--text-muted); }
  .cbi-input.url { color:var(--blue-500); font-family:var(--mono); font-size:12px; }
  .cbi-input:focus, .cbi-textarea:focus, .cbi-select:focus { outline:none; border-color:var(--blue-500); box-shadow:0 0 0 3px rgba(62,146,204,.18); }
  .cbi-textarea { font-family:var(--mono); font-size:12px; min-height:80px; resize:vertical; }
  .cbi-input.copyfield { background:var(--bg-tinted); display:flex; align-items:center; gap:8px; padding:0; }
  .cbi-input.copyfield .v { flex:1; padding:9px 12px; font-family:var(--mono); font-size:12px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .cbi-input.copyfield button { border:0; background:#fff; border-left:1px solid var(--border-strong); padding:9px 14px;
    font-size:12px; font-weight:600; color:var(--text); cursor:pointer; flex-shrink:0; font-family:inherit; }
  .cbi-input.copyfield button:hover { background:var(--bg-alt); }
  .cbi-checkrow { display:flex; align-items:center; gap:8px; font-size:13px; }
  .cbi-checkrow input { width:16px; height:16px; accent-color:var(--blue-500); }

  .cbi-auto { background:var(--success-bg); border:1px solid #B5DEC2; border-radius:8px; padding:10px 14px;
    font-size:12.5px; color:var(--success); display:flex; gap:8px; line-height:1.5; }
  .cbi-auto::before { content:"✓"; font-weight:700; }

  .cbi-foot { padding:16px 28px; border-top:1px solid var(--border); display:flex; gap:8px; align-items:center;
    background:var(--bg-tinted); }
  .cbi-foot .spacer { flex:1; }
  .cbi-foot .danger-link { background:none; border:0; color:var(--danger); font-size:13px; font-weight:600;
    cursor:pointer; padding:8px 0; font-family:inherit; }
  .cbi-foot .danger-link:hover { text-decoration:underline; }

  .cbi-badges { display:flex; gap:6px; flex-wrap:wrap; margin-top:6px; }
  .cbi-bdg { display:inline-block; padding:2px 8px; border-radius:99px; font-size:11px; font-weight:600; line-height:1.6; }
  .cbi-bdg.info { background:var(--info-bg); color:var(--info); }
  .cbi-bdg.success { background:var(--success-bg); color:var(--success); }
  .cbi-bdg.warning { background:var(--warning-bg); color:var(--warning); }
  .cbi-bdg.admin { background:rgba(107,70,193,.12); color:var(--admin); }
  .cbi-bdg.neutral { background:var(--bg-alt); color:var(--text-muted); }

  /* MANAGE bar (status, run/stop/delete actions on top of settings) */
  .cbi-status { padding:18px 28px; background:var(--bg-tinted); border-bottom:1px solid var(--border);
    display:flex; gap:24px; align-items:center; flex-wrap:wrap; }
  .cbi-status .stat { display:flex; flex-direction:column; gap:2px; }
  .cbi-status .stat-lbl { font-size:11px; text-transform:uppercase; letter-spacing:.06em; color:var(--text-faint); font-weight:600; }
  .cbi-status .stat-val { font-size:14px; font-weight:600; color:var(--text); }
  .cbi-status .actions { margin-left:auto; display:flex; gap:8px; }

  /* CATALOG picker */
  .cbi-search { width:100%; padding:11px 14px 11px 38px; border:1px solid var(--border); border-radius:10px;
    font-size:14px; font-family:inherit; background:#fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%238A93A6' stroke-width='2'%3E%3Ccircle cx='11' cy='11' r='7'/%3E%3Cpath d='m20 20-3-3'/%3E%3C/svg%3E") 12px center no-repeat; }
  .cbi-cat-section { margin-top:18px; }
  .cbi-cat-section h4 { font-size:11px; text-transform:uppercase; letter-spacing:.08em; color:var(--text-faint);
    font-weight:700; margin:0 0 10px; padding-bottom:8px; border-bottom:1px solid var(--border); }
  .cbi-cat-grid { display:grid; grid-template-columns:repeat(4, 1fr); gap:10px; }
  @media (max-width:700px) { .cbi-cat-grid { grid-template-columns:repeat(2,1fr); } }
  .cbi-cat-tile { border:1px solid var(--border); border-radius:10px; padding:12px 10px; text-align:center;
    cursor:pointer; display:flex; flex-direction:column; align-items:center; gap:8px;
    font-size:12px; font-weight:600; color:var(--text); background:#fff; transition:all .12s; }
  .cbi-cat-tile:hover { border-color:var(--blue-500); transform:translateY(-1px); box-shadow:var(--shadow-sm); }
  .cbi-cat-tile.sel { border-color:var(--blue-500); background:var(--blue-100); box-shadow:0 0 0 3px rgba(62,146,204,.15); }
  .cbi-cat-tile .ic { width:36px; height:36px; border-radius:9px; display:flex; align-items:center;
    justify-content:center; font-weight:800; font-size:12px; box-shadow:inset 0 0 0 1px rgba(0,0,0,.08); }
  .cbi-cat-empty { padding:32px 12px; text-align:center; color:var(--text-muted); font-size:13px; }

  /* Confirm */
  .cbi-confirm-icon { width:56px; height:56px; border-radius:50%; background:var(--danger-bg); color:var(--danger);
    display:flex; align-items:center; justify-content:center; font-size:24px; margin-bottom:14px; }

  /* Toast */
  .cbi-toast { position:fixed; bottom:20px; right:20px; background:var(--text); color:#fff; padding:12px 18px;
    border-radius:10px; font-size:13px; font-weight:600; z-index:1100; box-shadow:0 8px 24px rgba(0,0,0,.2);
    transform:translateY(100px); opacity:0; transition:all .25s ease; }
  .cbi-toast.show { transform:translateY(0); opacity:1; }
  .cbi-toast.success { background:var(--success); }
  .cbi-toast.danger { background:var(--danger); }
  `;
  const s = document.createElement('style');
  s.id = 'cbi-styles';
  s.textContent = css;
  document.head.appendChild(s);
}

/* ───────────────────── DOM helpers ──────────────────── */
function ensureBackdrop() {
  let bd = document.getElementById('cbi-backdrop');
  if (!bd) {
    bd = document.createElement('div');
    bd.id = 'cbi-backdrop';
    bd.className = 'cbi-bd';
    document.body.appendChild(bd);
    bd.addEventListener('click', e => { if (e.target === bd) close(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  }
  return bd;
}
function close() {
  const bd = document.getElementById('cbi-backdrop');
  if (bd) bd.classList.remove('open');
  document.body.style.overflow = '';
}
function toast(msg, kind) {
  let t = document.getElementById('cbi-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'cbi-toast';
    t.className = 'cbi-toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.className = 'cbi-toast' + (kind ? ' ' + kind : '');
  requestAnimationFrame(() => t.classList.add('show'));
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove('show'), 2200);
}

const GROUP_LABELS = {
  marketplace: 'Маркетплейсы',
  site: 'Сайты',
  crm: 'CRM-системы',
  delivery: 'Службы доставки',
  pay: 'Платёжные системы',
  cdp: 'CDP / Маркетинг',
  social: 'Соцсети и мессенджеры',
  analytics: 'Аналитика'
};
const GROUP_ORDER = ['marketplace','site','crm','delivery','pay','cdp','social','analytics'];

/* ───────────────────── CATALOG PICKER ──────────────── */
function openCatalog() {
  injectStyles();
  const bd = ensureBackdrop();
  document.body.style.overflow = 'hidden';

  const html = `
  <div class="cbi-modal sm" style="max-width:680px">
    <div class="cbi-head">
      <div>
        <h2>Выберите интеграцию</h2>
        <p class="sub">26 готовых сервисов · подключение примерно за 30 минут</p>
      </div>
      <button class="x" data-act="close" aria-label="Закрыть">×</button>
    </div>
    <div class="cbi-body" style="padding-top:20px">
      <input class="cbi-search" id="cbi-cat-search" placeholder="Поиск по названию (Ozon, Telegram, СДЭК…)" autofocus />
      <div id="cbi-cat-list"></div>
    </div>
  </div>`;
  bd.innerHTML = html;
  bd.classList.add('open');

  function renderList(query) {
    const q = (query || '').toLowerCase().trim();
    const list = document.getElementById('cbi-cat-list');
    let buckets = {};
    Object.keys(CATALOG).forEach(id => {
      const it = CATALOG[id];
      const hay = (it.name + ' ' + (it.tagline||'')).toLowerCase();
      if (q && !hay.includes(q)) return;
      (buckets[it.group] = buckets[it.group] || []).push({ id, ...it });
    });
    let any = false;
    let html = '';
    GROUP_ORDER.forEach(g => {
      if (!buckets[g] || !buckets[g].length) return;
      any = true;
      html += `<div class="cbi-cat-section"><h4>${GROUP_LABELS[g]}</h4><div class="cbi-cat-grid">`;
      buckets[g].forEach(it => {
        html += `<button class="cbi-cat-tile" data-pick="${it.id}">
          <div class="ic" style="background:${it.icon.bg};color:${it.icon.fg||'#fff'}">${it.icon.glyph}</div>
          ${it.name}
        </button>`;
      });
      html += `</div></div>`;
    });
    list.innerHTML = any ? html : `<div class="cbi-cat-empty">Ничего не найдено по запросу «${query}»</div>`;
  }

  renderList('');
  bd.querySelector('#cbi-cat-search').addEventListener('input', e => renderList(e.target.value));
  bd.addEventListener('click', e => {
    const x = e.target.closest('[data-act="close"]'); if (x) return close();
    const t = e.target.closest('[data-pick]'); if (t) {
      const id = t.getAttribute('data-pick');
      openManager(id, { mode:'connect' });
    }
  });
}

/* ───────────────────── MANAGER MODAL ──────────────── */
/*
 * mode:
 *   'connect'  — первичное подключение (нет блока статуса / удаления)
 *   'settings' — настройка существующей интеграции
 *   'reauth'   — настройка с акцентом на токены (открывается из «Обновить токен»)
 */
function openManager(id, opts) {
  const cfg = CATALOG[id];
  if (!cfg) { console.warn('Unknown integration:', id); return; }
  injectStyles();
  const bd = ensureBackdrop();
  document.body.style.overflow = 'hidden';

  const o = opts || {};
  const mode = o.mode || 'connect';
  const meta = o.meta || {};
  const isExisting = mode !== 'connect';
  const titleName = meta.name || cfg.name;
  const subtitle = isExisting
    ? (meta.id ? `${meta.id} · ${cfg.tagline}` : cfg.tagline)
    : cfg.tagline;

  // Manage status bar (only for existing integrations)
  const statusBar = isExisting ? `
    <div class="cbi-status">
      <div class="stat"><div class="stat-lbl">Статус</div>
        <div class="stat-val">
          <span class="badge ${meta.statusKind||'badge-success'} badge-dot">${meta.status||'Active'}</span>
        </div>
      </div>
      <div class="stat"><div class="stat-lbl">Запросов в месяце</div><div class="stat-val">${meta.requests||'—'}</div></div>
      <div class="stat"><div class="stat-lbl">Последняя</div><div class="stat-val">${meta.lastRun||'—'}</div></div>
      <div class="actions">
        ${meta.running===false
          ? `<button class="btn btn-outline btn-sm" data-mng="start">▶ Запустить</button>`
          : `<button class="btn btn-outline btn-sm" data-mng="stop">⏸ Остановить</button>`}
        <button class="btn btn-danger-outline btn-sm" data-mng="delete">Удалить</button>
      </div>
    </div>` : '';

  // Build form
  function fieldHtml(f) {
    const reqMark = f.req ? '<span class="req">*</span>' : '';
    const optMark = f.opt ? `<span class="opt">${f.opt}</span>` : '';
    let control;
    if (f.kind === 'textarea') {
      control = `<textarea class="cbi-textarea" placeholder="${f.placeholder||''}">${f.value||''}</textarea>`;
    } else if (f.kind === 'copy') {
      control = `<div class="cbi-input copyfield"><div class="v">${f.value||''}</div><button type="button" data-copy="${(f.value||'').replace(/"/g,'&quot;')}">Скопировать</button></div>`;
    } else if (f.kind === 'select') {
      control = `<select class="cbi-select">${(f.options||[]).map(o=>`<option>${o}</option>`).join('')}</select>`;
    } else if (f.kind === 'checkbox') {
      return `<div class="cbi-field"><div class="cbi-checkrow"><input type="checkbox" id="cbi-${f.id}" /><label for="cbi-${f.id}">${f.label}</label></div></div>`;
    } else {
      const cls = ['cbi-input'];
      if (f.type==='password') cls.push('pw');
      if (f.kind==='url') cls.push('url');
      const val = f.value || '';
      const ph = f.placeholder || '';
      control = `<input class="${cls.join(' ')}" type="${f.type==='password'?'password':'text'}" placeholder="${ph}" value="${val.replace(/"/g,'&quot;')}" />`;
    }
    return `<div class="cbi-field">
      <label>${f.label} ${reqMark} ${optMark}</label>
      ${control}
      ${f.hint ? `<div class="hint">${f.hint}</div>` : ''}
    </div>`;
  }

  let formInner = '';
  // Group consecutive col:'half' fields into a row
  const fs = cfg.fields || [];
  let i = 0;
  while (i < fs.length) {
    if (fs[i].col === 'half' && fs[i+1] && fs[i+1].col === 'half') {
      formInner += `<div class="row2">${fieldHtml(fs[i])}${fieldHtml(fs[i+1])}</div>`;
      i += 2;
    } else {
      formInner += fieldHtml(fs[i]);
      i++;
    }
  }
  if (cfg.autoNote) formInner += `<div class="cbi-auto">${cfg.autoNote}</div>`;

  // Left column: steps + notes
  let leftCol = '';
  if (cfg.steps && cfg.steps.length) {
    leftCol += `<div class="cbi-steps">
      <div class="cbi-section-label">Как получить ключи</div>
      ${cfg.steps.map((s,idx)=>`<div class="cbi-step"><div class="cbi-step-n">${idx+1}</div><div>${s}</div></div>`).join('')}
    </div>`;
  }
  if (cfg.notes && cfg.notes.length) {
    leftCol += `<div class="cbi-notes">
      <div class="cbi-section-label lbl">Ограничения и особенности</div>
      <ul>${cfg.notes.map(n=>`<li>${n}</li>`).join('')}</ul>
    </div>`;
  }

  const badges = (cfg.badges||[]).map(b=>`<span class="cbi-bdg ${b.k||'neutral'}">${b.t}</span>`).join('');

  bd.innerHTML = `
    <div class="cbi-modal">
      <div class="cbi-head">
        <div class="cbi-ic" style="background:${cfg.icon.bg};color:${cfg.icon.fg||'#fff'}">${cfg.icon.glyph}</div>
        <div style="min-width:0">
          <h2>${isExisting?'Управление: ':'Подключение: '}${titleName}</h2>
          <p class="sub">${subtitle}</p>
          ${badges?`<div class="cbi-badges">${badges}</div>`:''}
        </div>
        <button class="x" data-act="close" aria-label="Закрыть">×</button>
      </div>
      ${statusBar}
      <div class="cbi-body split">
        <div>${leftCol || `<div class="cbi-section-label">Подключение</div><p style="color:var(--text-muted);font-size:13px">Заполните поля справа и нажмите «${isExisting?'Сохранить':'Подключить'}». ${cfg.noTest?'':'Используйте «Проверить соединение», чтобы убедиться в корректности ключей.'}</p>`}</div>
        <div>
          <div class="cbi-section-label">${isExisting?'Параметры подключения':'Данные для подключения'}</div>
          <div class="cbi-form">${formInner}</div>
        </div>
      </div>
      <div class="cbi-foot">
        ${!cfg.noTest ? `<button class="btn btn-outline" data-act="test">Проверить соединение</button>` : ''}
        <div class="spacer"></div>
        <button class="btn btn-ghost" data-act="close">Отмена</button>
        <button class="btn btn-primary" data-act="save">${isExisting?'Сохранить':'Подключить'}</button>
      </div>
    </div>`;
  bd.classList.add('open');

  // Wire events
  bd.addEventListener('click', e => {
    const act = e.target.closest('[data-act]');
    if (act) {
      const a = act.getAttribute('data-act');
      if (a === 'close') return close();
      if (a === 'test') return toast('Соединение установлено · ключи валидны', 'success');
      if (a === 'save') {
        toast(isExisting ? 'Изменения сохранены' : `${cfg.name} подключён`, 'success');
        return close();
      }
    }
    const cp = e.target.closest('[data-copy]');
    if (cp) {
      const v = cp.getAttribute('data-copy');
      try { navigator.clipboard && navigator.clipboard.writeText(v); } catch(_) {}
      toast('Скопировано в буфер');
      cp.textContent = '✓ Скопировано';
      setTimeout(() => cp.textContent = 'Скопировать', 1600);
    }
    const mn = e.target.closest('[data-mng]');
    if (mn) {
      const a = mn.getAttribute('data-mng');
      if (a === 'start') { toast(`${cfg.name} запущен`, 'success'); close(); }
      else if (a === 'stop') {
        if (confirm(`Остановить интеграцию «${titleName}»?\n\nДанные перестанут синхронизироваться, новые заказы и обновления остатков не будут передаваться, пока вы не запустите её снова.`)) {
          toast(`${cfg.name} остановлен`); close();
        }
      } else if (a === 'delete') {
        openConfirmDelete(cfg, titleName);
      }
    }
  });
}

/* ───────────────────── DELETE CONFIRM ──────────────── */
function openConfirmDelete(cfg, titleName) {
  injectStyles();
  const bd = ensureBackdrop();
  document.body.style.overflow = 'hidden';
  bd.innerHTML = `
    <div class="cbi-modal sm">
      <div class="cbi-body" style="padding:32px 28px;">
        <div class="cbi-confirm-icon">⚠</div>
        <h3 style="margin:0 0 8px;font-size:20px">Удалить интеграцию «${titleName}»?</h3>
        <p style="margin:0 0 6px;color:var(--text-muted);font-size:14px;line-height:1.55">
          Это действие <b>необратимо</b>. Будут удалены:
        </p>
        <ul style="margin:8px 0 16px 20px;color:var(--text-muted);font-size:14px;line-height:1.7">
          <li>API-ключи и токены ${cfg.name}</li>
          <li>Настройки маппинга полей и склада</li>
          <li>История логов и счётчики запросов</li>
        </ul>
        <p style="margin:0;color:var(--text-muted);font-size:13px;background:var(--warning-bg);border:1px solid #F0DDA0;border-radius:8px;padding:10px 12px;">
          <b>Документы 1С</b>, ранее созданные через эту интеграцию, <b>останутся в базе</b> — удаляется только подключение.
        </p>
      </div>
      <div class="cbi-foot">
        <div class="spacer"></div>
        <button class="btn btn-ghost" data-act="close">Отмена</button>
        <button class="btn btn-danger" data-act="confirm-delete">Удалить интеграцию</button>
      </div>
    </div>`;
  bd.classList.add('open');
  bd.addEventListener('click', e => {
    if (e.target.closest('[data-act="close"]')) return close();
    if (e.target.closest('[data-act="confirm-delete"]')) {
      toast(`${cfg.name} удалён`, 'danger');
      close();
    }
  }, { once:false });
}

/* ───────────────────── PUBLIC API ──────────────────── */
window.CBIntegrations = {
  CATALOG,
  openCatalog,
  openManager,
  close
};

})();
