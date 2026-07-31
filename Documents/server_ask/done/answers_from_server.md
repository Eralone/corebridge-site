# Ответы corebridge-server → corebridge-site

> **🟢 ОБНОВЛЕНИЕ 2026-07-26 — часть пунктов уже РЕАЛИЗОВАНА на сервере** (покрыто тестами lk-api):
> добавлен 5-й тариф **`business`** (2 490 ₽, 10 проектов, 30 000 операций, без n8n-UI); единый каталог
> тарифов `config/plans.js`; **`GET /lk/plans`** (G18/J25), **`GET/PATCH /lk/profile`** (A1),
> **`GET /lk/token/full`** (I22/J26, owner-only), **`POST /lk/integrations/:id/pause|resume`** +
> обогащённый `GET /lk/integrations` со `status/display_name/last_sync_at` (C7/C8),
> **`GET /lk/dashboard/activity`** (D11). Финальные контракты — в
> `site_server_integration_reference.md` §9b. Ниже по этим пунктам статусы «❌ НЕТ» считать
> закрытыми; остальное (пароль/email, команда, сессии, API-ключи, поддержка, уведомления, admin-stats,
> публичный contact/register) — прежний бэклог.
>
> **🟢 ОБНОВЛЕНИЕ #2 (тот же день) — ещё пакет реализован:** **A2** `POST /lk/profile/password`
> (смена пароля; email-смена — ещё в бэклоге); **J28** реальный `executions_this_month`+`n8n_usage`
> в `/lk/dashboard`; **A3** команда — `GET /lk/users`, `POST /lk/users/invite|accept`,
> `PATCH /lk/users/:id/role`, `DELETE /lk/users/:id` (лимит `users_per_company` по тарифу);
> **I23** `GET /lk/epf/versions`; **H19** `GET /admin/stats`; **H21** `GET /admin/integrations`.
> Контракты — `site_server_integration_reference.md` §9c. **C6** (`POST /lk/integrations` создание)
> отложен — нужно решение по схеме `adapter_configs` (nullable `encrypted_config` + релаксация CHECK
> на `adapter_type`, скоординированно с bridge). Остаётся в бэклоге: смена email, листинг сессий (A4),
> API-ключи cb_* (B5), OAuth-reauth (C9), тикеты поддержки (E), уведомления/Telegram (F), публичные
> contact/register (G17/J24), cookie-`verify` (J27), admin-admins CRUD (H20).


> Ответ на `questions_to_server.md` (30 вопросов, A–J). Сверено с кодом сервера и схемой БД на 2026-07-23.
> Легенда статуса: **✅ ЕСТЬ** (эндпоинт реализован) · **⚠️ ЧАСТИЧНО** (данные/таблица есть, эндпоинта нет) ·
> **❌ НЕТ** (нужно добавить на сервере) · **🚫 УБРАТЬ** (функционала нет и не планируется — прятать в дизайне).
>
> Для каждого «нужно добавить» дан контракт: метод, путь, тело, пример ответа, коды ошибок —
> чтобы сайт сразу собрал типизированный клиент. **Важно:** контракты помечены `[PROPOSED]` — это
> предложение сервера, финал фиксируем после реализации (пути/поля могут уточниться на 1 итерацию).

## TL;DR — что реально готово, а что нет

| Блок | Готово сейчас | Надо добавить на сервере |
|---|---|---|
| Профиль (A1) | таблицы есть (`users.name/phone`, `tenants.company_*`) | эндпоинты `GET/PATCH /lk/profile` |
| Пароль/email (A2) | — | `POST /lk/profile/password`, смена email |
| Команда (A3) | схема (`users.tenant_id/role`) поддерживает мультиюзер | весь CRUD + invite |
| Сессии (A4) | сессии в Redis DB=1 (по одной, без индекса) | листинг требует переработки хранения |
| API-ключи cb_* (B5) | **нет таблицы, нет функционала** | всё, либо 🚫 прятать |
| Интеграции-конструктор (C6–10) | список/ключи/удаление есть; **нет** display_name/status/pause/oauth/метрик | много (см. раздел C) |
| Дашборд-график/лента (D11–12) | сводка + `/lk/logs` | временной ряд |
| Поддержка (E13–14) | **нет тикет-API и таблиц** | всё, либо форма→n8n |
| Уведомления (F15–16) | `tenants.notification_settings JSONB` есть | эндпоинты + привязка Telegram |
| Публичные (G17–18) | — | `POST /lk/contact`, `GET /lk/plans` |
| Админка (H19–21) | `/admin/n8n/stats`, tenants, payments | общий `/admin/stats`, `/admin/admins`, `/admin/integrations` |
| .epf токен (I22–23) | download отдаёт version+sha256; JWT только masked | механизм выдачи полного JWT |

**Вывод одной строкой:** база данных многое уже поддерживает (мультиюзер, реквизиты, notification_settings),
но **HTTP-слой ЛК покрывает только то, что в референсе**. Почти все «страницы настроек/поддержки/командного
доступа/API-ключей» требуют новых серверных эндпоинтов. Ниже — по пунктам.

---

## A. Профиль пользователя и команда

### A1. Профиль — ⚠️ ЧАСТИЧНО (таблицы есть, эндпоинтов нет)
Поля **уже есть в БД**, писать некуда только из-за отсутствия роутов:
- ФИО, телефон → `platform.users.name`, `platform.users.phone`
- Компания и реквизиты → `platform.tenants.company_name`, `company_inn`, `company_kpp`, `company_address`
- email пользователя → `platform.users.email` (смена — отдельно, см. A2)

**Нужно добавить `[PROPOSED]`:**
```
GET /lk/profile           (cookie lk_session)
→ 200 {
    "user":   { "id", "email", "name", "phone", "role" },
    "company":{ "company_name", "company_inn", "company_kpp", "company_address" }
  }

PATCH /lk/profile         (cookie; company_* — только role=owner)
body { "name"?, "phone"?, "company_name"?, "company_inn"?, "company_kpp"?, "company_address"? }
→ 200 { обновлённый профиль как в GET }
errors: 400 VALIDATION_ERROR {fields[]} · 403 FORBIDDEN (не-owner меняет company_*) · 401
```

### A2. Смена пароля / email — ❌ НЕТ
Сейчас пароль меняется только напрямую в БД (`bcrypt`). Эндпоинтов нет.
**Нужно добавить `[PROPOSED]`:**
```
POST /lk/profile/password   body { "current_password", "new_password" }
→ 200 { ok:true } ; errors 400 WEAK_PASSWORD · 401 INVALID_CURRENT_PASSWORD

POST /lk/profile/email/request   body { "new_email" }        → 200 { sent:true } (письмо-подтверждение)
GET  /lk/profile/email/confirm?token=...                      → 200 { email }
```
**Google-пользователи:** у них `password_hash` = случайный placeholder (вход только через Google/Magic Link).
Показывать: блок «Пароль» скрыт/задизейблен с подписью «Вход через Google», кнопка «Задать пароль»
может вызывать flow сброса через Magic Link. Признак «это Google-аккаунт» сервер сейчас явно не отдаёт —
**добавим флаг `auth_provider: "password"|"google"` в `GET /lk/profile`** (нужно завести колонку).

### A3. Команда (пользователи tenant) — ❌ НЕТ (но схема готова)
`platform.users` уже мультиюзерная (`tenant_id`, `role`), лимит `users_per_company` есть в тарифе (§3 референса).
CRUD и invite **не реализованы**. Лимит на сервере при invite сейчас **не проверяется** (некому).
**Нужно добавить `[PROPOSED]`:**
```
GET    /lk/users                       → 200 { users:[{id,email,name,role,status:"active"|"invited",created_at}] }
POST   /lk/users/invite  (owner)       body {email, role:"manager"|"user"} → 201 {invite_id,status:"invited"}
                                          errors 409 USER_EXISTS · 402 USERS_LIMIT_REACHED (users_per_company)
POST   /lk/users/accept                body {token,name,password} → 200 {user_id} + ставит сессию
PATCH  /lk/users/:id/role (owner)      body {role} → 200 {id,role} ; errors 403, 404
DELETE /lk/users/:id     (owner)       → 200 {ok:true} ; нельзя удалить последнего owner → 409 LAST_OWNER
```
Потребуется таблица `platform.user_invites (token, tenant_id, email, role, expires_at)` — сервер заведёт.

### A4. Сессии (список устройств) — ❌ НЕТ, требует переработки хранения
Сейчас сессия хранится в Redis как **одиночный ключ** `lk_session:<id>` (значение `{user_id,tenant_id,role,ip,created_at}`),
без вторичного индекса «все сессии пользователя». Показать список и «завершить конкретную» **сейчас нельзя**
без изменения схемы хранения (добавить `SET lk_user_sessions:<user_id>` со списком session_id + user-agent).
**Рекомендация:** либо запланировать доработку (сервер добавит индекс и эндпоинты ниже), либо на первом
релизе **упростить блок в дизайне** до «Выйти на всех устройствах».
**`[PROPOSED]` (после доработки хранения):**
```
GET    /lk/sessions            → 200 { sessions:[{id, ip, user_agent, created_at, current:bool}] }
DELETE /lk/sessions/:id        → 200 { ok:true }
POST   /lk/sessions/logout-others → 200 { revoked: N }
```
Минимальный вариант, реализуемый сразу без индекса: только `POST /lk/sessions/logout-others`
(инвалидировать все сессии пользователя, кроме текущей) — если сервер заведёт индекс лениво при входе.

---

## B. Сайтовые API-ключи (cb_live / cb_test)

### B5. — 🚫 НЕТ функционала (решение: прятать блок на первом релизе)
Таблицы пользовательских REST API-ключей платформы **нет**, эндпоинтов нет. Фича `api_access`
(из тарифа) есть только как флаг `features.api_access` (enterprise), но самого «внешнего REST API
платформы с ключами `cb_live_*`» на сервере не существует.
**Решение:** на первом релизе **скрыть блок «API ключи»** (или показывать «Доступно на тарифе
Enterprise — скоро»). Если продуктово нужно — это отдельный крупный эпик на сервере (таблица
`platform.api_keys` с хешированием, middleware проверки, rate-limit, скоупы). Оценку дадим отдельно.
**Не** путать с JWT для .epf — это другое (см. раздел I).

---

## C. Интеграции — конструктор

> **Важно (архитектура).** Сейчас есть **два** пути работы с интеграциями:
> — **cookie-сессия (сайт):** `/lk/integrations*` — только список + сохранение ключей + удаление.
> — **Bearer JWT (Мастер в .epf):** `/api/v1/integrations`, `/api/v1/projects` — создание, verify, привязка к проекту.
> Полноценный «конструктор с карточками» из дизайна **сервер по cookie сейчас не покрывает** — нужен
> новый набор `/lk/integrations/*`, зеркалящий bridge-функции под cookie-сессию. Это ключевой пункт.

### C6. Создание интеграции из ЛК (cookie) — ⚠️ ЧАСТИЧНО / ❌
`POST /lk/integrations/:id/credentials` (референс §5.3) требует **уже существующий** `integration_id`
и создаёт строку `adapter_configs` upsert-ом (id придумывает клиент). Полноценного `POST /lk/integrations`
c генерацией `integration_id` и `display_name` **нет**. Сейчас `integration_id` (`MP_001`, `CRM_001`)
назначается на клиенте (в .epf-Мастере / `/api/v1/projects`).
**Нужно добавить `[PROPOSED]`:**
```
POST /lk/integrations   (owner/manager)
body { "adapter_type":"ozon", "display_name":"Основной Ozon", "tab_key"?, "contractor_id"?, "warehouse_id"? }
→ 201 { "integration_id":"MP_003", "adapter_type", "display_name", "status":"pending_credentials", "created_at" }
errors 400 INVALID_ADAPTER_TYPE · 402 PROJECTS_LIMIT_REACHED · 401
```
Далее ключи — тем же `POST /lk/integrations/:id/credentials`. **display_name / tab_key / contractor_id /
warehouse_id — новых колонок в `adapter_configs` сейчас НЕТ** (см. C7), сервер их заведёт.

### C7. Схема ответа `GET /lk/integrations` — ⚠️ фактический JSON беднее дизайна
**Фактически сейчас возвращается** (`integration.service.js`):
```json
[{ "integration_id":"MP_001", "adapter_type":"ozon", "is_active":true,
   "last_used_at":"2026-07-20T10:00:00Z", "created_at":"..." }]
```
Полей `display_name, tab_key, status, last_sync_at, error_message, requests_this_month,
contractor_name, warehouse_name` **в ответе НЕТ**. Часть данных существует в **других** таблицах:
- `status` / `last_sync` / ошибки → `marketplace.adapter_state` (`error_count`, `is_active`, `updated_at`)
  и `marketplace.adapter_errors_log` (`error_message`, `http_status`) — **но не джойнятся в ответ**.
- `requests_this_month` — **отдельного счётчика per-integration нет**; ближайшее — агрегат по
  `platform.audit_log` / логам (дорого). Готового числа нет.
- `display_name, tab_key, contractor_*, warehouse_*` — **колонок нет** в БД вообще.

**Нужно (сервер): расширить `adapter_configs` + обогатить ответ `[PROPOSED]`:**
```json
GET /lk/integrations →
[{ "integration_id":"MP_001", "adapter_type":"ozon", "display_name":"Основной Ozon",
   "tab_key":"orders", "status":"active"|"paused"|"error", "error_message":null,
   "http_status":null, "last_sync_at":"...", "requests_this_month":1234,
   "contractor_name":"ООО Ромашка", "warehouse_name":"Основной склад", "created_at":"..." }]
```
Подтверждаем: **до доработки сервера сайт получит только 5 полей выше**. Проектируйте карточку так,
чтобы недостающие поля были опциональны (грациозная деградация), пока сервер их не добавил.

### C8. Пауза / возобновление — ❌ НЕТ
Эндпоинтов `pause`/`resume` нет. Есть только soft-delete (`DELETE /lk/integrations/:id` → `is_active=FALSE`)
и накопительная авто-приостановка polling при `error_count>=5` (внутренняя, F5). Статуса «Paused»
как пользовательского действия нет.
**Нужно добавить `[PROPOSED]`:**
```
POST /lk/integrations/:id/pause   → 200 {id,status:"paused"}
POST /lk/integrations/:id/resume  → 200 {id,status:"active"} ; errors 404, 409 ALREADY_IN_STATE
```

### C9. Reauth OAuth (Битрикс24 / AmoCRM / ЯМ) — ❌ НЕТ (в ЛК)
OAuth-переподключение из ЛК по cookie **не реализовано**. В `/lk/n8n/*` (Bearer) есть активация с
`credentials`, но полноценного redirect-flow «Обновить токен» из ЛК нет.
**Нужно добавить `[PROPOSED]`:**
```
GET  /lk/integrations/:id/oauth/start   → 302 на провайдера (state привязан к tenant+integration)
GET  /lk/integrations/:id/oauth/callback?code=&state=  → сервер меняет токен → 302 назад в ЛК
```
Для карточки в `Error·401` — кнопка ведёт на `/lk/integrations/:id/oauth/start`. Список адаптеров,
которым нужен OAuth: `ym, bitrix24, amocrm, megaplan, sbis_crm, neaktor` (CREDENTIAL_TYPE_MAP=oAuth2Api).

### C10. Источник `requests/мес` и `last_sync` — ⚠️ частично
- `last_sync` ≈ `adapter_configs.last_used_at` (уже отдаётся) либо `adapter_state.updated_at`.
- `requests/мес` per-integration **готового числа нет**. Строить из `/lk/logs` дорого и неточно.
  Рекомендация: сервер заведёт лёгкий счётчик (по аналогии с `platform.usage_counters` для n8n) и
  добавит `requests_this_month` в ответ C7. **До этого — не показывать число (или «—»).**

---

## D. Дашборд — график и лента

### D11. Временной ряд активности — ❌ НЕТ
`GET /lk/dashboard` отдаёт только сводные счётчики. Эндпоинта временного ряда нет.
**Нужно добавить `[PROPOSED]`:**
```
GET /lk/dashboard/activity?range=7d|30d[&adapter=ozon]
→ 200 { "range":"7d", "points":[{ "date":"2026-07-17", "ok":120, "error":3, "total":123 }, ...] }
```
Источник — агрегат по `platform.audit_log` / очереди событий по дням. До реализации сайт может
строить приблизительный ряд из `/lk/logs` (но там аудит-действия, не все события — неполно).

### D12. Лента последних событий — ⚠️ используйте `/lk/logs`
Отдельного `/lk/dashboard/events` нет. Лента = первые N строк `GET /lk/logs?limit=N`
(`{id, action, actor, entity_type, entity_id, new_value, created_at}`). Маппинг на ok/err/info делайте
по `action` (например `*_error`/`cross_tenant_attempt` → err). Если нужен именно поток «событий
интеграций» (order_new и т.п.), а не аудит — это другой источник (очередь `marketplace.events`),
**отдельный эндпоинт надо добавить** (сообщите, если нужен — спроектируем `GET /lk/events?limit=`).

---

## E. Поддержка (тикеты)

### E13–E14. Тикет-API — ❌ НЕТ (ни таблиц, ни эндпоинтов)
Тикет-системы на сервере нет: таблиц `support_tickets`/`ticket_messages` нет, роутов `/lk/support/*`
и `/admin/support/*` нет. «Через n8n» — это была идея о нотификации, не хранилище переписки.
**Два варианта — нужно продуктовое решение:**

**Вариант 1 (быстрый, для первого релиза): форма → n8n, без истории.**
```
POST /lk/support/request   (cookie)  body {subject, message, integration_id?, priority?}
→ 202 {ticket_ref:"REQ-2141", status:"received"}   // сервер шлёт в n8n/Telegram менеджеру
```
Экран «Поддержка» = только форма отправки + FAQ. Тред переписки/статусы/вложения — **прятать**.

**Вариант 2 (полноценный, эпик): тикет-API `[PROPOSED]`.**
```
GET  /lk/support/tickets                  → [{id,ref:"#2141",subject,status,priority,updated_at,integration_id}]
GET  /lk/support/tickets/:id              → {..., messages:[{id,author:"user"|"agent",text,attachments[],created_at}]}
POST /lk/support/tickets                  body {subject,message,priority,integration_id?} → 201 {id,ref}
POST /lk/support/tickets/:id/messages     body {text} (+ multipart для 📎) → 201 {message_id}
Админ: GET /admin/support/tickets, POST /admin/support/tickets/:id/messages, PATCH /admin/support/tickets/:id (status/priority)
```
Требует таблиц + хранилище вложений. **Рекомендация сервера: релиз 1 = Вариант 1**, полноценные тикеты
как отдельная механика позже.

---

## F. Настройки уведомлений

### F15. Настройки уведомлений — ⚠️ хранилище есть, эндпоинтов нет
`platform.tenants.notification_settings JSONB DEFAULT '{}'` **уже существует** — матрицу «событие×канал»
есть куда писать. Также есть `platform.notification_log` (история отправок, 018). Эндпоинтов чтения/записи
настроек нет.
**Нужно добавить `[PROPOSED]`:**
```
GET /lk/notifications/settings → 200 {
  "channels": { "email":{enabled,address}, "telegram":{enabled,chat_id}, "sms":{enabled,phone} },
  "matrix": { "integration_errors":{email:true,telegram:true,sms:false},
              "limit_exceeded":{...}, "reports":{...}, "news":{...} }
}
PUT /lk/notifications/settings  body { тот же объект } → 200 {saved:true}
```
Привязки каналов (chat_id, номер) хранить внутри того же JSONB. Дефолт для новых событий — email on.

### F16. Привязка Telegram — ❌ НЕТ
Механизма привязки Telegram (deep-link/бот) для уведомлений ЛК нет. (Есть системный
`TELEGRAM_BOT_TOKEN` для алёртов **платформы**, не пользователей.)
**Нужно добавить `[PROPOSED]` (deep-link flow):**
```
POST /lk/notifications/telegram/link   → 200 { deep_link:"https://t.me/CoreBridgeBot?start=<nonce>", expires_in:600 }
// пользователь жмёт → бот ловит /start <nonce> → сервер сохраняет chat_id в notification_settings
GET  /lk/notifications/telegram/status → 200 { linked:bool, chat_id_masked? }
DELETE /lk/notifications/telegram      → 200 {ok:true}
```
Нужен бот-обработчик на сервере. SMS-канал — потребует SMS-провайдера (сейчас нет).

---

## G. Публичные эндпоинты (без сессии)

### G17. Форма «Контакты» / заявки с лендинга — ❌ НЕТ
Публичного `POST /lk/contact` нет.
**Нужно добавить `[PROPOSED]`:**
```
POST /api/v1/public/contact   (без auth, с anti-spam: rate-limit по IP + honeypot/капча-токен)
body { "name", "email", "phone"?, "message", "source"?:"pricing"|"landing" }
→ 202 { received:true }   // сервер → n8n → менеджеру/CRM
errors 400 VALIDATION_ERROR · 429 TOO_MANY_REQUESTS
```

### G18. Публичный прайс — ❌ НЕТ (но данные готовы)
`GET /lk/plans` пока нет. Данные (лимиты/фичи) уже зашиты в `PLAN_LIMITS`, цены в `PRICE_MAP`.
**Нужно добавить `[PROPOSED]` (публичный, кешируемый):**
```
GET /api/v1/public/plans → 200 { "plans":[
  { "code":"trial", "title":"Пробный", "price":{monthly:0,yearly:0},
    "limits":{projects:1,users_per_company:1,monthly_operations:150,n8n_executions_month:500,...},
    "features":{n8n_ui:false,git_sync:false,sso:false,api_access:false} },
  { "code":"starter", ... }, { "code":"professional", ... }, { "code":"enterprise", ... }
]}
```
Это **закрывает открытый вопрос §10.2 референса** (единый источник прайса И названий). См. также J25.
⚠️ Финальные **названия и цены** планов должны согласовать продукт+backend (сейчас в коде цены
starter 990 / professional 4990 / enterprise 19900, что расходится со спекой F3 790/1990/4990/12990).

---

## H. Админка

### H19. Общий админ-дашборд — ❌ НЕТ (есть только n8n-срез)
Сейчас единственная сводка — `GET /admin/n8n/stats` (только про n8n). Общего `GET /admin/stats`
(тенанты по статусам/планам, выручка, активные интеграции) нет.
**Нужно добавить `[PROPOSED]`:**
```
GET /admin/stats  (admin session) → 200 {
  "tenants": { "total":N, "by_status":{active,blocked}, "by_plan":{trial,starter,professional,enterprise} },
  "revenue": { "month_confirmed":₽, "year_confirmed":₽ },   // из platform.payments status=confirmed
  "integrations": { "active_total":N, "by_adapter":{ozon:..,wb:..} },
  "n8n": { ... как в /admin/n8n/stats ... }
}
```

### H20. `admin-users.html` — уточнение + ❌ CRUD нет
Нужно различать:
- **Сотрудники CoreBridge** (admin-аккаунты, `platform.admin_users`, bcrypt+TOTP, миграция 010) —
  их **CRUD не реализован** (референс §7.1 = только их логин). Если экран про них — нужен
  `/admin/admins` (`[PROPOSED]` ниже).
- **Пользователи тенантов** — управляются в контексте тенанта; кросс-тенантного «всех пользователей»
  эндпоинта нет.
**Если экран про сотрудников — `[PROPOSED]`:**
```
GET    /admin/admins                 → [{id,email,role,totp_enabled,last_login_at,created_at}]
POST   /admin/admins                 body {email,role} → 201 {id, invite/temp_setup} (+ TOTP enroll)
PATCH  /admin/admins/:id             body {role,is_active}
DELETE /admin/admins/:id
```
**Подтвердите у продукта**, что за сущность на `admin-users.html`.

### H21. `admin-integrations.html` (кросс-тенантный обзор) — ❌ НЕТ
`GET /admin/integrations` нет. Аналог для n8n есть (`/admin/n8n/tenants/:id/workflows`), но не для
`adapter_configs` всех тенантов.
**Нужно добавить `[PROPOSED]`:**
```
GET /admin/integrations?tenant_id=&adapter_type=&status=&page=&limit=
→ 200 { integrations:[{tenant_id, company_name, integration_id, adapter_type, is_active,
        last_used_at, error_count}], count }
```

---

## I. .epf и токен

### I22. Полный JWT для вставки в .epf — ⚠️ РЕШЕНИЕ НУЖНО (сейчас masked)
`GET /lk/token` отдаёт только `masked_token`. Полный JWT рождается при выдаче лицензии
(оплата/grant-trial/issue-token) и лежит в `platform.licenses.jwt_token`. Три возможных механизма
(**нужно выбрать один — продукт+backend**):
1. **Письмом** при выдаче лицензии (сервер уже умеет слать email) — на epf-странице кнопка
   «Отправить токен на почту».
2. **Защищённый показ owner-у:** `[PROPOSED] GET /lk/token/full` (только `role=owner`, свежая
   сессия / повторный ввод пароля, аудит-лог, возможно rate-limit 1/час) → `{ token, valid_until }`.
   Кнопка «Показать/Скопировать токен» на epf-странице.
3. **Одноразовая ссылка** (как download EPF): `[PROPOSED] POST /lk/token/reveal` → `{ url, expires_in:120 }`.

Рекомендация сервера: **Вариант 2** (`GET /lk/token/full`, owner-only, с аудитом) — проще всего для UX
«скопировать токен», при этом контролируемо. Подтвердите — реализуем.

### I23. Версии / «что нового» .epf — ⚠️ достаточно данных из download, списка версий нет
`GET /lk/epf/download?config=` отдаёт актуальную `version` + `sha256` + `download_url`. Отдельного
«списка версий / changelog» для ЛК нет. В БД есть `platform.epf_versions` (поле `release_notes`,
`force_update`, `file_size`, миграция 015). Если нужен экран «что нового» —
**`[PROPOSED] GET /lk/epf/versions?config=ut11` → `[{version, release_notes, sha256, file_size,
force_update, published_at, is_current}]`**. Для простого случая хватит текущего download-ответа
(показать «Версия X.Y, обновить»).

---

## J. Подтверждение открытых вопросов из §10 референса

| # | Вопрос | Статус / ответ |
|---|---|---|
| **24** | Публичная регистрация email+пароль `POST /lk/auth/register` | ❌ **сейчас нет** (self-serve только Google OAuth). **Нужен ли** — продуктовое решение. Если да, `[PROPOSED]`: `POST /api/v1/public/register` body `{email,password,company_name?}` → создаёт tenant(plan=trial)+user(owner), шлёт подтверждение email, ставит сессию. Ответ `{user_id,tenant_id}`; errors 409 EMAIL_EXISTS, 400 WEAK_PASSWORD. |
| **25** | `GET /lk/plans` единый прайс | ❌ добавить (см. **G18** — `GET /api/v1/public/plans`). Дубль. |
| **26** | Показ полного JWT в ЛК | ⚠️ выбрать механизм (см. **I22**). Дубль. |
| **27** | Cookie-версия `verify` ключей | ❌ сейчас `verify` только под Bearer (`POST /api/v1/integrations/:id/verify`). `[PROPOSED]` cookie-зеркало: `POST /lk/integrations/:id/verify` → `{ ok:bool, status:int, detail:string }` (лёгкий read к API адаптера). Добавим. |
| **28** | `executions_this_month`=0 в dashboard | ✅ **факт**: в `/lk/dashboard` это поле-заглушка (0). Реальное значение — `GET /lk/n8n/usage` (Bearer). **Решение:** сервер добавит `n8n_usage:{used,limit,period}` прямо в `/lk/dashboard`, чтобы сайту не звать Bearer-эндпоинт. До этого — не показывать 0, брать из `/lk/n8n/usage` при наличии JWT. |
| **29** | CORS `https://corebridge.ru` + credentials | ⚠️ **нужно подтвердить в конфиге прод-Nginx/сервисов.** lk-api сейчас отдаёт security-заголовки, admin — CORS с `ADMIN_CORS_ORIGIN`. Backend проверит и явно выставит `Access-Control-Allow-Origin: https://corebridge.ru` + `Allow-Credentials: true` для `/lk/*` (и `/admin/*` при необходимости). Ответим отдельным подтверждением после проверки прод-конфига. |
| **30** | Прод-монтирование `/lk/n8n/*` и `/admin/n8n/*` | ⚠️ F6.7 и F6.7-A задеплоены (по README). `/admin/n8n/*` смонтирован в admin-app (`/admin/n8n`). `/lk/n8n/*` — Bearer-роутер shared-сервера; **точку монтирования за прод-Nginx backend подтвердит явно** (в текущем bridge index.js он не виден среди `/api/v1/*` — уточняем, где именно висит `/lk/n8n`). Не полагайтесь на него как на cookie-эндпоинт: он Bearer. |

---

## Что нужно от сайта / продукта, чтобы двинуться (блокеры-решения)
1. **Финал прайса и названий планов** (4 плана: коды trial/starter/professional/enterprise зафиксированы;
   цифры и «продающие» названия — за продуктом). Без этого `GET /public/plans` отдавать нечего.
2. **Регистрация:** нужна ли форма email+пароль (J24) или достаточно Google?
3. **Поддержка:** Вариант 1 (форма→n8n) или Вариант 2 (полные тикеты)? (E13–14)
4. **Механизм показа полного JWT** (I22): письмо / `GET /lk/token/full` / одноразовая ссылка.
5. **API-ключи cb_* (B5):** прячем на релиз 1 или ставим в бэклог как эпик?
6. **`admin-users.html`:** сотрудники CoreBridge или пользователи тенантов? (H20)

## Что backend делает без доп. вопросов (подтверждённый бэклог)
Расширение `adapter_configs` (display_name/tab_key/contractor/warehouse/status-джойн) [C6,C7] ·
`GET/PATCH /lk/profile` [A1] · `POST /lk/profile/password` [A2] · команда+invite [A3] ·
pause/resume [C8] · cookie-`verify` [27] · `notification_settings` эндпоинты [F15] ·
`GET /public/plans` + `POST /public/contact` [G] · `GET /admin/stats` + `/admin/integrations` [H19,H21] ·
usage в dashboard [28]. Порядок и сроки — согласуем спринтом.

> Формат под ваш API-клиент соблюдён: у каждого `[PROPOSED]` есть метод/путь/тело/ответ/ошибки.
> Помечайте типы как «tentative» до фиксации — финализируем перед реализацией каждого эпика.
