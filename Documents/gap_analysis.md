# Карта расхождений: дизайн ↔ реальный сервер

> ## 🟢 ОБНОВЛЕНИЕ 2026-07-27 — пакеты S1–S7 РЕАЛИЗОВАНЫ И НА ПРОДЕ
>
> Ответ сервера: `Documents/server_ask/site_S1_S7_RESPONSE.md` (837 тестов зелёные).
> **Раздел B ниже почти целиком закрыт** — читать его как историю. Актуальное состояние:
>
> | Было 🟡 mock | Стало |
> |---|---|
> | B1 регистрация / сброс пароля / verify-email | ✅ REAL: `POST /lk/auth/register`, `GET /lk/auth/verify-email`, `POST /lk/auth/verify-email/resend`, `POST /lk/auth/password/reset-request`, `POST /lk/auth/password/reset` |
> | B1 соцвход | ✅ REAL `GET /lk/auth/yandex` + `/callback`. **Google удалён совсем — `/lk/auth/google*` отдаёт 404** |
> | B2 сессии | ✅ REAL оба шага: `GET /lk/sessions`, `POST /lk/sessions/logout-others`, `DELETE /lk/sessions/:id` |
> | B3 уведомления | ✅ REAL `GET/PUT /lk/notifications/settings` + Telegram deep-link (`@CoreBridgeRu_bot`, вебхук зарегистрирован). Диспетчер F17 написан, но **на прод ещё не раскатан** (+ миграция 023) |
> | B5 verify ключей | ✅ REAL `POST /lk/integrations/:id/verify`, семантика `200 + ok:false` |
> | B5 OAuth-reauth | ✅ **не нужен**: клиент передаёт готовые доступы. Вместо редиректа — поле `reauth_action: "credentials_form"` → открывать форму ввода ключей |
> | B6 admin-users | ✅ REAL `GET /admin/users` (кросс-тенантно) + `POST /admin/tenants/:id/set-plan` |
> | B7 форма контактов | ✅ REAL, но путь **`POST /lk/contact`**, а не `/api/v1/public/contact` |
> | D канон тарифов | ✅ приведён к `pricing.html`; `PLAN_LIMITS` синхронизирован тестом |
>
> **Остаётся 🟡 / ⛔:** смена email (B8), тикеты поддержки (B4, вне MVP), учёт лимита
> `monthly_operations` (числа с прайса ни на что не влияют), события `reports`/`news`
> (ключи есть, генерации нет).
>
> **Новое, чего не было в моих промтах:**
> - **trial бессрочный**: `days_left: null` и `valid_until: null` = «бессрочно», не «0 дней».
>   Флаг `is_perpetual: true` у trial в `GET /lk/plans`. **Отдельная ветка отображения.**
> - `GET /lk/plans`: `is_custom_price`, `is_perpetual`, `promo`, `marketing_features`,
>   `price.yearly_monthly`, `price.discount_percent`.
> - `POST /lk/billing/pay` принимает `promo: "first30"`; `enterprise` → `400 CUSTOM_PRICE_PLAN`.
> - `POST /lk/profile/password`: код ошибки `GOOGLE_ACCOUNT` переименован в **`OAUTH_ACCOUNT`**.
> - `GET /lk/profile`: + `user.email_verified`.
> - Промо `first30` работает целиком; **автопродления нет** — лицензия истекает, платят вручную.
>   Так и писать в интерфейсе.
>
> **Инфраструктура (проверено 2026-07-27):** DNS переведён на VPS, сертификат
> `corebridge.ru`+`www` до 24.10.2026, vhost поднят, `/lk/*` проксируется (`GET /lk/plans` → 200),
> `/internal/` закрыт `403`. Почта: свой Postfix+OpenDKIM, SPF/DKIM/DMARC/PTR в порядке.
> Не хватает: vhost `admin.corebridge.ru` и самого Next.js на 3005.

> Сверено с **фактическим** реестром маршрутов `Documents/server_ask/API_ENDPOINTS.md`
> (282 маршрута, сгенерирован из кода сервера на 2026-07-26) и контрактами
> `site_server_integration_reference.md` §9b/§9c. Дата: 2026-07-26.
>
> ⚠️ `answers_from_server.md` местами **устарел**: многие пункты, помеченные там как «❌ НЕТ»,
> уже реализованы. Источник истины — `API_ENDPOINTS.md`.

## Легенда

- ✅ **REAL** — эндпоинт есть на сервере, контракт зафиксирован → сайт бьёт напрямую
- 🟡 **MOCK** — эндпоинта нет, есть согласованный `[PROPOSED]` контракт → MSW-мок, потом флип
- ⛔ **BLOCKED** — нет ни эндпоинта, ни решения → нужен продуктовый/архитектурный ответ
- ⚪ **STATIC** — сервер не нужен

---

## A. Что УЖЕ РЕАЛЬНО на сервере (сайт использует сразу, без моков)

Эти 30 маршрутов ЛК подтверждены в коде. Это большая часть MVP.

| Экран дизайна | Эндпоинты | Статус |
|---|---|---|
| `login.html` | `POST /lk/auth/login` · `POST /lk/auth/magic-link` · `GET /lk/auth/magic-link/verify` · `GET /lk/auth/google` (+`/callback`) · `GET /lk/auth/session` · `POST /lk/auth/logout` | ✅ REAL |
| `dashboard.html` | `GET /lk/dashboard` (+ реальный `executions_this_month` и `n8n_usage`) · `GET /lk/dashboard/activity?range=7d\|30d` · `GET /lk/logs?limit=` | ✅ REAL |
| `epf.html` | `GET /lk/token` (masked) · `GET /lk/token/full` (owner) · `POST /lk/token/refresh` · `GET /lk/epf/download?config=` · `GET /lk/epf/versions?config=` | ✅ REAL |
| `integrations-app.html` | `GET /lk/integrations` (обогащён: `display_name/status/paused/error_count/last_sync_at`) · `POST /lk/integrations/:id/credentials` · `POST .../pause` · `POST .../resume` · `DELETE /lk/integrations/:id` | ✅ REAL |
| `n8n.html` | `GET /lk/workflows/catalog` · `POST /lk/workflows/activate` · `GET /lk/workflows/executions` | ✅ REAL |
| `billing.html` | `GET /lk/billing` · `POST /lk/billing/pay` | ✅ REAL |
| `pricing.html`, `index.html`, `for-business.html` | `GET /lk/plans` (**публичный**, без сессии, 5 тарифов, `Cache-Control: max-age=300`) | ✅ REAL |
| `settings.html` — профиль | `GET /lk/profile` · `PATCH /lk/profile` (+ флаг `auth_provider`) | ✅ REAL |
| `settings.html` — пароль | `POST /lk/profile/password` | ✅ REAL |
| `settings.html` — команда | `GET /lk/users` · `POST /lk/users/invite` · `POST /lk/users/accept` · `PATCH /lk/users/:id/role` · `DELETE /lk/users/:id` | ✅ REAL |
| `admin.html` | `GET /admin/stats` | ✅ REAL |
| `admin-integrations.html` | `GET /admin/integrations?tenant_id=&adapter_type=&status=&page=&limit=` | ✅ REAL |
| админка — тенанты/платежи | `GET /admin/tenants` · `block`/`unblock` · `issue-token` · `tokens` · `grant-trial` · `GET /admin/payments` · `POST /admin/payments/:id/refund` | ✅ REAL |
| админка — n8n/очереди/epf | `/admin/n8n/*` · `/admin/queues/*` · `/admin/dlq/*` · `/admin/epf/*` | ✅ REAL |
| админ-логин | `POST /admin/auth/login` · `POST /admin/auth/totp/verify` · `GET /admin/auth/me` · `POST /admin/auth/logout` | ✅ REAL |
| `docs.html`, `integrations.html`, `sitemap.html`, `oferta/privacy/terms` | — | ⚪ STATIC |

**Важное следствие:** правило «фронт живёт на моках» из `implementation_strategy.md` §1 применимо
теперь только к небольшому остатку. Дашборд, epf, интеграции, биллинг, прайс, профиль, команда,
n8n и вся админка — **сразу на реальном API**.

---

## B. Чего НЕТ на сервере, но нужно дизайну

### B1. Аутентификация — 🟡 MOCK (нужен серверный пакет)

| Экран | Требуется | Реальность |
|---|---|---|
| `register.html` | `POST /public/register {email,password,company_name?}` | **нет**. Self-serve только через Google OAuth (авто-создаёт tenant plan=trial + user owner) |
| `forgot-password.html` | `POST /lk/auth/password/reset-request {email}` | **нет** |
| `reset-password.html` | `POST /lk/auth/password/reset {token,new_password}` | **нет** |
| `verify-email.html` | подтверждение email при регистрации | **нет** |
| — (нужна новая страница) | `/lk/invite/accept?token=` → форма → `POST /lk/users/accept` | эндпоинт ✅ REAL, **страницы на сайте нет** — обязательна, иначе приглашения в команду ведут в 404 |

Решение `implementation_strategy.md` §5 = «вариант а» (полноценные механики по дизайну) →
эти 4 эндпоинта нужны на сервере. До них — MSW-моки по контракту.

### B2. `settings.html` — сессии — 🟡 MOCK

`GET /lk/sessions`, `DELETE /lk/sessions/:id`, `POST /lk/sessions/logout-others` — нет.
Причина: сессия лежит в Redis DB=1 одиночным ключом `lk_session:<id>` без индекса
«все сессии пользователя». Требует доработки хранения на сервере.

Решение §8.4: сначала проектируем настройки, потом отдельным промтом просим доработку.
На Э5 — UI на моке по `[PROPOSED]`.

### B3. `settings.html` — уведомления — 🟡 MOCK

`GET/PUT /lk/notifications/settings` — нет эндпоинтов, но **хранилище готово**:
`platform.tenants.notification_settings JSONB` + `platform.notification_log`.
Привязка Telegram (`POST /lk/notifications/telegram/link` deep-link) — нет, нужен бот-обработчик.
SMS-канал — нет провайдера → в UI дизейблить.

### B4. `support.html` / `admin-support.html` — ⛔ ВНЕ MVP (решено)

Тикет-системы на сервере нет вообще (ни таблиц, ни роутов). Решение §8.6 + указание Дмитрия:
**механику поддержки не реализовываем**, ставим заглушку, обращения — через email.

→ Э6 отложен. На странице поддержки: вёрстка дизайна сохраняется, но тред/статусы/вложения
скрыты; активны только FAQ и кнопка `mailto:info@corebridge.ru`.
Тикеты, ИИ-агент и ретрансляция в админку — в бэклог.

### B5. Интеграции — остаток — 🟡 / ⛔

| Что | Статус |
|---|---|
| `POST /lk/integrations/:id/verify` (cookie-версия «проверить ключи») | 🟡 нет; под Bearer JWT есть `POST /api/v1/integrations/:id/verify` |
| `GET /lk/integrations/:id/oauth/start` + `/callback` (кнопка «Обновить токен» при `Error·401`) | 🟡 нет. Нужен для OAuth-адаптеров: `ym, bitrix24, amocrm, megaplan, sbis_crm, neaktor` |
| `POST /lk/integrations` (создание интеграции из ЛК) | ⛔ **сознательно не реализован**: `marketplace.adapter_configs.encrypted_config NOT NULL` + жёсткий CHECK на 10 `adapter_type` против фактических 33. Нужно согласованное решение по схеме с bridge |
| поля `contractor_name`, `warehouse_name`, `requests_this_month` в карточке | 🟡 не отдаются, отдельный бэклог → верстать опционально, показывать «—» |

По §8.1 создание интеграций на сайте и не нужно: кнопка «+ Добавить интеграцию» ведёт на
`epf.html`, модалка каталога «Подключить» убирается. Значит ⛔ по `POST /lk/integrations`
**не блокирует MVP**.

### B6. `admin-users.html` — ⛔ требует серверного эндпоинта

Решение §8.7: экран = **все пользователи системы** (кросс-тенантно), с блокировкой и сменой тарифа.
На сервере кросс-тенантного списка пользователей **нет** — есть только `GET /admin/tenants`
(список компаний) и `platform.admin_users` (сотрудники CoreBridge, CRUD тоже отсутствует).

Плюс §7 рекомендует `POST /admin/tenants/:id/set-plan {plan, valid_until, reason}` — его нет,
смена тарифа сейчас только через `grant-trial` / `issue-token`.

→ Нужен серверный пакет. До него — Э7 на моках.

### B7. Публичная форма контактов — 🟡 MOCK

`POST /public/contact {name,email,phone?,message,source?}` — нет. Нужен для `contacts.html` и
CTA-форм лендинга. Требует anti-spam (rate-limit по IP + honeypot).

### B8. Смена email — 🟡 MOCK

`POST /lk/profile/email/request` + `GET /lk/profile/email/confirm?token=` — нет (в бэклоге сервера).
Смена пароля (`POST /lk/profile/password`) при этом ✅ REAL.

### B9. API-ключи `cb_live/cb_test` — 🚫 СКРЫТЬ (решено)

Функционала нет и не планируется как пользовательская фича. Решение §8.5: блок в `settings.html`
**скрыт от пользователя**; ключи — только для e2e-тестов .epf (env/fixtures).

---

## C. Инфраструктурные расхождения (не про эндпоинты)

| # | Факт | Следствие |
|---|---|---|
| C1 | `corebridge.ru` → `216.198.79.1` (Vercel), `www` → `cname.vercel-dns.com` | блокер, DNS переводим на `77.90.61.5` → `Documents/manual_setup.md` §1 |
| C2 | `admin.corebridge.ru` → NXDOMAIN | нужна A-запись |
| C3 | порт **3000 занят** `corebridge-lk-api` | Next.js на **3005** |
| C4 | `/lk/*` в nginx отдаётся **без CORS-заголовков вообще** (CORS есть только на `/api/v1/*`, и только для `app.corebridge.ru`) | кросс-доменная схема из `implementation_strategy.md` §2 нерабочая → **single-origin** (решение Дмитрия) |
| C5 | cookie `lk_session`: `httpOnly, sameSite=strict` | при single-origin работает как есть, менять на сервере ничего не надо |
| C6 | nginx на **хосте** под systemd (`/etc/nginx`), docker-compose nginx не запущен. `/opt/corebridge/nginx/*` — конфиги для неиспользуемого Docker-варианта | правки vhost делаю в `/etc/nginx/sites-enabled/`, копии храню в `deploy/` этого репо |
| C7 | nginx слушает 443 только на IPv4 (нет `listen [::]:443`) | AAAA-запись **не добавлять**, иначе IPv6-клиенты получат отказ |
| C8 | `ROBOKASSA_*` в `.env` пустые | `POST /lk/billing/pay` → `payment_url: null` → обязательна заглушка «Платёжная система настраивается» |
| C9 | нет `LK_BASE_URL` / `DOMAIN` в `.env` | `invite_url` из `/lk/users/invite` и redirect после magic-link могут собираться неверно → уточнить у backend |
| C10 | SMTP для lk-api не найден (есть только `GF_SMTP_*` = Grafana) | magic-link и приглашения могут не доходить → уточнить у backend |
| C11 | `/admin/` в nginx: IP-whitelist `188.130.154.24/32` | доступ к админке с других IP не будет работать |
| C12 | Google OAuth: `GOOGLE_CLIENT_ID` заполнен, redirect URI под `corebridge.ru` не зарегистрирован | → `manual_setup.md` §2 |

---

## D. Канон тарифов — расхождение дизайна и сервера

`implementation_strategy.md` §8a объявляет канон «сайт», но сервер уже реализовал свой каталог
(`lk-api/src/config/plans.js`) и отдаёт его через `GET /lk/plans`. Цифры **разошлись**:

| План | Сайт (`pricing.html`, §8a) | Сервер (`GET /lk/plans`) | Расхождение |
|---|---|---|---|
| trial | 0 ₽ · 1 инт. · 500 оп. | 0 ₽ · 1 · **150** оп. | операции |
| starter | 990 ₽ · год 792/мес · 3 инт. · 5 000 оп. | 990 ₽ · год **9 500**/год · 3 · 5 000 | год |
| business | 2 490 ₽ · год 1 992/мес · 10 инт. · 30 000 оп. | 2 490 ₽ · год **24 900**/год · 10 · 30 000 | год |
| professional | **5 990 ₽** · 20 инт. · 100 000 оп. | **4 990 ₽** · **30** инт. · **150 000** оп. | цена, лимиты |
| enterprise | «По запросу» | **19 900 ₽** | подача |
| Названия | Профессионал / Энтерпрайз | Профессиональный / Корпоративный | тексты |
| Промо «30 дней за 10 ₽» | есть у professional | в каталоге сервера нет | промо |

**Решение (моё, для подтверждения):** источник истины — `GET /lk/plans`, сайт прайс **не хардкодит**
(прямое указание §3 референса). Расхождение цифр — продуктовый вопрос: см. `Documents/questions_open.md`.
Вёрстку `pricing.html` переносим 1:1, но значения подставляем из API.

---

## E. Сводка: сколько нужно от сервера

| Пакет | Экраны | Приоритет |
|---|---|---|
| **S1.** register + password-reset + verify-email | `register`, `forgot-password`, `reset-password`, `verify-email` | высокий (Э1) |
| **S2.** `POST /public/contact` | `contacts`, CTA лендинга | средний (Э4) |
| **S3.** notifications settings + Telegram link | `settings` | средний (Э5) |
| **S4.** sessions listing (+ переработка хранения в Redis) | `settings` | средний (Э5) |
| **S5.** кросс-тенантные пользователи + `set-plan` | `admin-users` | средний (Э7) |
| **S6.** cookie-`verify` + OAuth-reauth интеграций | `integrations-app` | низкий (Э3, деградирует) |
| **S7.** смена email | `settings` | низкий |
| **S8.** `POST /lk/integrations` (схема `adapter_configs`) | не нужен по §8.1 | бэклог |
| **S9.** тикеты поддержки | `support`, `admin-support` | бэклог (вне MVP) |
