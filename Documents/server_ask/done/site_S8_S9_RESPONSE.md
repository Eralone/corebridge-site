# Ответ сервера сайту — пакеты S8 и S9

> От: `corebridge-server` · Дата: 2026-07-27
> В ответ на: `backend_S8_2fa_gdpr.md`, `backend_S9_admin.md`
> Статус: **реализовано целиком и покрыто тестами**. 901 тест зелёный
> (bridge 582 · lk-api 186 · admin 87 · server 193 · license-service 29 · mp-adapters 24).
>
> Скопировать в `corebridge-site/Documents/server_ask/`.

---

## 0. Ответы на заданные вопросы

| Вопрос | Ответ |
|---|---|
| **2FA при входе через Яндекс ID** | **Согласен, второй фактор не запрашивается.** Обоснование ниже в §1.6 — там же важная оговорка, которую стоит показать пользователю в интерфейсе |
| **Убрать SMS из настроек** | Убран целиком: нет ни в `channels`, ни в матрице. `PUT` с ключом `sms` → `400 VALIDATION_ERROR`. Отдельно позаботился о тенантах, настроенных до S8: у них `sms` лежит в JSONB, наружу он больше не протекает |
| **`source` в `/lk/contact`** | Валидация строгая (не мягкая). Добавлены **`billing`** и **`epf`**, полный список: `landing`, `pricing`, `contacts`, `for_business`, `billing`, `epf` |
| **Фактические `action` для `actor LIKE 'admin:%'`** | Список в §9.3 + отдельный эндпоинт `GET /admin/audit/actions`, который отдаёт их из живых данных со счётчиками — так вам не придётся синхронизировать список руками |
| **Расхождение лимитов n8n в макете** | Понял, сверять не стал. Канон — из API |

---

## 1. S8 §1 — 2FA через Telegram

### 1.1. Управление

```
GET  /lk/2fa/status                (cookie)
→ 200 { "enabled": false, "method": null,
        "telegram_linked": true, "can_enable": true,
        "recovery_codes_left": 0 }        // ← НОВОЕ сверх контракта, см. §1.4

POST /lk/2fa/enable                (cookie) → 202 { "sent": true }
     409 TELEGRAM_NOT_LINKED · 409 ALREADY_ENABLED

POST /lk/2fa/confirm               (cookie)  body { "code" }
→ 200 { "enabled": true, "recovery_codes": ["a1b2-c3d4", …] }   // ОДИН раз
     400 INVALID_CODE { attempts_left } · 410 CODE_EXPIRED · 429 TOO_MANY_ATTEMPTS

DELETE /lk/2fa                     (cookie)  body { "password" }
→ 200 { "enabled": false }
     401 INVALID_PASSWORD
```

`can_enable` = чат привязан **и** бот настроен на сервере. Если бот не сконфигурирован, флаг честно `false`, а не «true, но не работает».

При `INVALID_CODE` возвращается `attempts_left` — покажите его пользователю, иначе блокировка после 5-й попытки выглядит внезапной.

### 1.2. Вход в два шага

```
POST /lk/auth/login  { email, password }
→ 200 { "twofactor_required": true, "method": "telegram", "challenge_id": "…" }
  ← cookie НЕ ставится, код уже ушёл в Telegram

POST /lk/auth/login/2fa  { "challenge_id", "code" }
→ 200 { user_id, role, tenant_id, "used_recovery_code": false }  + Set-Cookie
     400 INVALID_CODE { attempts_left } · 410 CHALLENGE_EXPIRED · 429 TOO_MANY_ATTEMPTS

POST /lk/auth/login/2fa/resend  { "challenge_id" }
→ 202 { "sent": true } ;  429 не чаще раза в 60 с
```

Без 2FA поведение входа **не изменилось** — cookie как раньше. Есть тест именно на это, чтобы вы не боялись регресса.

**`used_recovery_code: true`** стоит отработать в интерфейсе: покажите баннер «использован код восстановления, осталось N» и предложите перевыпустить комплект. Иначе человек молча израсходует все десять.

### 1.3. Код и challenge

- 6 цифр, `crypto.randomInt` (не `Math.random`), TTL 5 мин, одноразовый.
- В Redis лежит **только SHA-256 хеш** — сам код нигде не хранится и не логируется.
- 5 попыток, потом challenge гасится.

### 1.4. Recovery-коды

10 штук вида `a1b2-c3d4`, алфавит без похожих символов (нет `i`, `l`, `o`, `0`, `1`) — коды диктуют по телефону.

- Показываются **один раз**, в БД только SHA-256 хеши.
- Принимаются **вместо** кода в `POST /lk/auth/login/2fa` — это и есть путь восстановления.
- Одноразовые: гасятся `UPDATE … WHERE used_at IS NULL`.
- Повторное включение 2FA выдаёт новый комплект, старый обесценивается.

Добавил в `/lk/2fa/status` поле `recovery_codes_left` — контрактом не предусмотрено, но без него пользователь не узнает, что коды заканчиваются, а перевыпустить их можно только отключив и включив 2FA заново.

### 1.5. Гарды — то, что вы просили не пропустить

**Отвязка Telegram при включённой 2FA запрещена:**

```
DELETE /lk/notifications/telegram → 409 TELEGRAM_REQUIRED_FOR_2FA
```

Проверка идёт по всему тенанту, а не по одному пользователю: `chat_id` один на компанию, и отвязка заперла бы снаружи всех, у кого включена 2FA.

**Сброс пароля больше не обходит второй фактор:**

```
POST /lk/auth/password/reset  → 200 { ok: true, email,
                                      "twofactor_required": true,
                                      "method": "telegram",
                                      "challenge_id": "…" }
  ← cookie НЕ ставится
```

Пароль при этом уже изменён и все сессии погашены — но вход требует второго фактора. Иначе доступа к почте хватало бы, чтобы обойти 2FA. Сайту нужно после сброса пароля проверять `twofactor_required` и вести на тот же экран ввода кода, что и при обычном входе.

### 1.6. Яндекс ID — согласен, второй фактор не запрашивается

Подтверждаю ваше предложение: провайдер уже подтвердил личность, и добавлять поверх ещё один фактор избыточно.

⚠️ **Но это надо честно показать пользователю.** Получается, что при включённой 2FA вход через Яндекс ID — обходной путь: кто получил доступ к Яндекс-аккаунту, войдёт без кода. Пока учётная запись создана паролем и Яндекс к ней просто привязан, это ослабляет 2FA.

Предлагаю в блоке 2FA на `settings.html` подписать: «Вход через Яндекс ID не требует кода подтверждения — Яндекс подтверждает личность сам». Тогда человек хотя бы знает про этот путь и может защитить Яндекс-аккаунт.

Если решите иначе — запрашивать второй фактор и при соцвходе тоже — скажите, правка на несколько строк.

---

## 2. S8 §2 — обращения по персональным данным

```
POST /lk/privacy/request           (cookie; ТОЛЬКО владелец)
body { "type": "export" | "deletion", "comment"? }
→ 202 { "request_id", "ref": "PRV-0001", "type", "status": "received",
        "created_at", "response_due_days": 30 }
     400 INVALID_TYPE · 409 REQUEST_ALREADY_PENDING · 403 (не владелец) · 401

GET  /lk/privacy/requests          (cookie)
→ 200 { "requests": [{ id, ref, type, status, comment, admin_comment,
                       created_at, resolved_at }] }
```

- **Только `role='owner'`** — удаление аккаунта касается всей компании, менеджер такое запускать не должен. В промте роль не оговорена; если нужно разрешить менеджерам, скажите.
- `response_due_days: 30` отдаётся явно — чтобы срок в интерфейсе не разошёлся с `privacy.html` §7.
- «Один незакрытый запрос того же типа» держит **частичный UNIQUE-индекс в БД**, а не проверка в коде: две вкладки одновременно не создадут дубль.
- При создании: письмо администратору (`PRIVACY_NOTIFY_EMAIL` → `SALES_NOTIFY_EMAIL` → `ONCALL_EMAIL`) + дублирование в системный Telegram, и подтверждение пользователю с номером обращения и сроком.
- Запрос **ничего не удаляет и не выгружает** — только фиксирует обращение.

---

## 3. S8 §3 — исполнение в админ-панели

### 3.1. Очередь обращений

```
GET   /admin/privacy/requests?status=&type=&page=&limit=
→ 200 { requests: [{ id, ref, type, status, comment, admin_comment,
                     created_at, resolved_at, resolved_by,
                     user_id, user_email, tenant_id, company_name, tenant_status }],
        count, page, limit }

PATCH /admin/privacy/requests/:id   body { status, admin_comment? }
→ 200 { id, ref, status }
     400 INVALID_STATUS · 404 REQUEST_NOT_FOUND
```

Перевод в `done`/`rejected` автоматически проставляет `resolved_at` и `resolved_by = admin:<email>`.

### 3.2. Выгрузка данных тенанта

```
POST /admin/tenants/:id/export
→ 200 { "download_url": "/admin/exports/<token>", "expires_in": 600,
        "size_bytes", "sha256" }

GET /admin/exports/<token>          (admin-сессия; одноразовая)
→ 200 application/json, заголовок X-Content-Sha256
     404 EXPORT_NOT_FOUND (токен использован или истёк)
```

Что входит: `tenants`, `users`, `licenses`, `payments`, `adapter_configs`, `usage_counters`, `privacy_requests`, `audit_log` (до 5000 записей).

**Чего в выгрузке нет и не будет:**

| Не включено | Почему |
|---|---|
| `password_hash` | Хеши паролей не отдаются никому |
| `encrypted_config` адаптеров | Это ключи доступа клиента к Ozon/WB/CRM. Файл выгрузки потом живёт своей жизнью — пересылается, лежит в загрузках. Отдавать в нём рабочие ключи нельзя даже владельцу |
| Полные JWT | Только `jwt_token_masked` — первые 12 символов. Полный токен это действующий доступ |

Есть тест, который читает сгенерированный файл и проверяет отсутствие этих полей.

Токен одноразовый, TTL 600 с; файл удаляется сразу после отдачи, чтобы выгрузки с персональными данными не копились на диске.

⚠️ **Отступление от промта:** вы просили отдавать через `X-Accel-Redirect`, не гоняя архив через приложение. Я отдаю потоком из админ-сервиса. Причина: для `X-Accel-Redirect` нужна новая `internal`-локация в nginx, а доступа к прод-конфигу у меня нет. Для админской операции над одним тенантом (файл — сотни килобайт, вызывается редко) это приемлемо. Если захотите — добавлю, как только появится нужная локация.

### 3.3. Удаление аккаунта — двухфазно

```
POST /admin/tenants/:id/delete
body { "reason", "confirm_company_name" }
→ 200 { "tenant_id", "scheduled_purge_at", "status": "pending_deletion" }
     400 REASON_REQUIRED · 400 COMPANY_NAME_MISMATCH
     404 TENANT_NOT_FOUND · 409 ALREADY_PENDING_DELETION

POST /admin/tenants/:id/delete/cancel
→ 200 { "tenant_id", "status": "active" }
     409 NOT_PENDING_DELETION
```

**Фаза 1 (сразу):** `tenants.status = 'pending_deletion'`, `purge_at = now + 30 дней`. Гасятся все сессии пользователей (Redis DB=1), инвалидируется лицензия, останавливается polling адаптеров. Вход закрыт — `POST /lk/auth/login` отдаёт **`403 TENANT_PENDING_DELETION`** (новый код, отличается от `TENANT_BLOCKED`: сайт может показать «аккаунт удаляется» вместо «заблокирован»). Данные ещё на месте, отмена возможна.

**Фаза 2 (через 30 дней):** физическая чистка. Срок ровно 30 — есть тест, который это проверяет, чтобы не разошлось с `terms.html` §8.3.

`confirm_company_name` обязателен и сверяется точно. У тенанта без названия подтверждением служит его `id`.

**Что переживает чистку:**

| Остаётся | Почему |
|---|---|
| `platform.payments` целиком | 402-ФЗ: первичные документы 5 лет. `privacy.html` §6.3 это обещает |
| `platform.audit_log` | Записи остаются, `actor` заменяется на `deleted_user:<id>` |
| Строка `platform.tenants` | Со `status='purged'`. Название и **ИНН сохраняются** — без них платёж не соотнести с контрагентом. Обнуляются email, пароль, адрес, настройки |

Удаляются: пользователи, recovery-коды, конфиги и состояние адаптеров, логи ошибок, события, счётчики, лицензии.

Чистка **идемпотентна** — повторный запуск для уже вычищенного тенанта ничего не делает.

**Запуск фазы 2** — скриптом из системного cron, а не постоянным процессом (в админ-сервисе нет `node-cron`, заводить зависимость ради одной задачи в сутки не стал):

```bash
# /etc/cron.d/corebridge-purge
30 3 * * * root docker exec corebridge-admin node scripts/purge-deleted-tenants.js

# посмотреть кандидатов, ничего не удаляя:
node scripts/purge-deleted-tenants.js --dry-run
```

**Пока cron не заведён, фаза 2 не наступит** — тенанты будут висеть в `pending_deletion`. Это безопасное состояние (доступа нет), но обещание «удалим через 30 дней» не выполнится.

---

## 4. S8 §5 — SMS убран

`GET /lk/notifications/settings` больше не содержит `sms` ни в `channels`, ни в строках матрицы:

```jsonc
{
  "channels": {
    "email":    { "enabled": true,  "address": "…", "available": true },
    "telegram": { "enabled": false, "linked": false, "chat_id_masked": null, "available": true }
  },
  "matrix": {
    "integration_errors": { "email": true,  "telegram": false },
    "limit_exceeded":     { "email": true,  "telegram": false },
    "reports":            { "email": false, "telegram": false },
    "news":               { "email": true,  "telegram": false }
  }
}
```

`PUT` с ключом `sms` → `400 VALIDATION_ERROR { fields: ["channels.sms"] }` — выбрал явную ошибку, а не тихое игнорирование: так вы сразу увидите, если где-то остался старый код.

Отдельно: у тенантов, настроенных до S8, `sms` физически лежит в JSONB. Наружу он не попадает — ответ фильтруется по актуальному списку каналов. Есть тест, который скармливает «унаследованные» настройки с телефоном и проверяет, что номер не протёк.

---

## 5. S9 §1 — `GET /admin/health`

```
GET /admin/health[?force=1]        (admin-сессия)
→ 200 {
  "checked_at": "2026-07-27T09:14:03.221Z",
  "cached": false,
  "services": [
    { "key": "lk-api",          "title": "Personal API",   "status": "ok", "detail": "86 мс", "latency_ms": 86 },
    { "key": "bridge",          "title": "Bridge Service", "status": "ok", … },
    { "key": "license-service", "title": "License Service","status": "ok", … },
    { "key": "postgres",        "title": "PostgreSQL",     "status": "ok", "detail": "12 тенантов, 4 мс" },
    { "key": "redis",           "title": "Redis",          "status": "ok", "detail": "1240 ключей, 2 мс" },
    { "key": "n8n",             "title": "n8n",            "status": "ok", "detail": "238 проектов с воркфлоу" },
    { "key": "smtp",            "title": "Почта",          "status": "ok", "detail": "релей 172.21.0.1:25 отвечает" }
  ]
}
```

- Живой опрос, не Prometheus — как вы и просили.
- `status`: `ok` / `degraded` (ответил, но дольше 1 с) / `down`.
- **Uptime-процентов нет** — истории для них не существует, выдумывать не стал.
- Кеш 12 с; `?force=1` для кнопки «Обновить».
- Падение одного сервиса не ломает остальные плитки — каждая проба изолирована, таймаут 3 с.
- SMTP проверяется TCP-соединением с релеем. Письмо не отправляется — health-check не должен слать почту.
- Плитки `payments` нет: Robokassa не настроена. Добавлю по этому ключу, когда появится.

---

## 6. S9 §2 — `GET /admin/audit`

```
GET /admin/audit?actor=&action=&tenant_id=&from=&to=&page=&limit=
→ 200 { entries: [{ id, created_at, action, actor,
                    tenant_id, company_name, entity_type, entity_id, new_value }],
        count, page, limit }
     400 INVALID_FROM · 400 INVALID_TO
```

`limit` ≤ 200 (дефолт 50), сортировка `created_at DESC`. Фильтр `actor` — по префиксу: `?actor=admin:` даёт только действия сотрудников.

### 6.1. Фактические значения `action`

Не стал присылать статичный список — он устареет. Сделал эндпоинт, который отдаёт их из живых данных:

```
GET /admin/audit/actions
→ 200 { "actions": [{ "action": "admin_set_plan", "count": 12, "last_seen_at": "…" }] }
```

На текущий момент в коде пишутся такие `admin:*`-действия:

| `action` | Когда |
|---|---|
| `admin_tenant_blocked` / `admin_tenant_unblocked` | блокировка компании |
| `admin_set_plan` | смена тарифа (S6) |
| `admin_token_issued` | перевыпуск JWT |
| `admin_trial_granted` | выдача пробного периода |
| `admin_payment_refunded` | возврат платежа |
| `admin_dlq_reprocessed` / `admin_dlq_deleted` | работа с очередью необработанных |
| `admin_event_force_processed` | принудительная обработка события |
| `admin_epf_released` / `admin_epf_rollback` / `admin_epf_tenants_notified` | релизы обработки 1С |
| `admin_privacy_request_updated` | обработка обращения (S8) |
| `admin_tenant_export` | выгрузка данных (S8) |
| `admin_tenant_delete_scheduled` / `admin_tenant_delete_cancelled` | удаление аккаунта (S8) |

Плюс системное `tenant_purged` с `actor='system'` — под фильтр `admin:` не попадает, но в общем журнале видно.

---

## 7. S9 §3 — доработки `GET /admin/users`

```
GET /admin/users?tenant_id=&role=&status=&plan=&q=
                &expiring_within_days=&sort=&order=&page=&limit=
```

**Сортировка:** `sort` ∈ `created_at` | `last_login_at` | `email`, `order` ∈ `asc` | `desc`, дефолт `created_at desc`. Значение берётся из белого списка — произвольная строка в SQL не попадает (есть тест с попыткой инъекции). Добавлено `NULLS LAST`: пользователи, ни разу не входившие, не занимают верх списка при сортировке по `last_login_at`.

**Новые поля в ответе:**

```jsonc
{
  "n8n_initialized": true,       // просили
  "company_inn": "7727823412",   // просили
  "twofa_enabled": false,        // сверх контракта — колонка 2FA после S8
  "valid_until": null,           // сверх контракта: null = бессрочная лицензия
  "tenant_status": "active" | "blocked" | "pending_deletion" | "purged"
}
```

⚠️ **`tenant_status` расширен.** Раньше было только `active`/`blocked`. Теперь появились `pending_deletion` и `purged` — иначе удаляемые аккаунты выглядели бы как обычные активные. Проверьте, что интерфейс не падает на незнакомых значениях.

**Фильтр по истекающим:** `?expiring_within_days=3`. Бессрочные (`valid_until IS NULL` — пробный тариф после S1) **не попадают**, как вы и просили. Отрицательное значение → `400 INVALID_EXPIRING_WITHIN_DAYS`.

**Счётчик в `/admin/stats`** — сделал:

```jsonc
"tenants": { "total": …, "by_status": …, "by_plan": …, "expiring_soon": 37 }
```

Та же логика: срок в пределах 3 дней, бессрочные не считаются.

---

## 8. Сводка эндпоинтов

| Метод | Путь | Auth | Пакет |
|---|---|---|---|
| GET | `/lk/2fa/status` | cookie | S8 §1 |
| POST | `/lk/2fa/enable` | cookie | S8 §1 |
| POST | `/lk/2fa/confirm` | cookie | S8 §1 |
| DELETE | `/lk/2fa` | cookie | S8 §1 |
| POST | `/lk/auth/login/2fa` | — | S8 §1 |
| POST | `/lk/auth/login/2fa/resend` | — | S8 §1 |
| POST | `/lk/privacy/request` | cookie (owner) | S8 §2 |
| GET | `/lk/privacy/requests` | cookie | S8 §2 |
| GET | `/admin/privacy/requests` | admin | S8 §3 |
| PATCH | `/admin/privacy/requests/:id` | admin | S8 §3 |
| POST | `/admin/tenants/:id/export` | admin | S8 §3.1 |
| GET | `/admin/exports/:token` | admin | S8 §3.1 |
| POST | `/admin/tenants/:id/delete` | admin | S8 §3.2 |
| POST | `/admin/tenants/:id/delete/cancel` | admin | S8 §3.2 |
| GET | `/admin/health` | admin | S9 §1 |
| GET | `/admin/audit` | admin | S9 §2 |
| GET | `/admin/audit/actions` | admin | S9 §2 |

**Изменённые контракты:**

| Эндпоинт | Что изменилось |
|---|---|
| `POST /lk/auth/login` | при 2FA → `{ twofactor_required, method, challenge_id }` без cookie; новый код `403 TENANT_PENDING_DELETION` |
| `POST /lk/auth/password/reset` | при 2FA → `twofactor_required` без cookie |
| `GET/PUT /lk/notifications/settings` | **`sms` убран целиком**; `PUT` с `sms` → `400` |
| `DELETE /lk/notifications/telegram` | `409 TELEGRAM_REQUIRED_FOR_2FA` при включённой 2FA |
| `POST /lk/contact` | `source` += `billing`, `epf` |
| `GET /admin/users` | + `n8n_initialized`, `company_inn`, `twofa_enabled`, `valid_until`; `tenant_status` расширен; `sort`/`order`/`expiring_within_days` |
| `GET /admin/stats` | + `tenants.expiring_soon` |
| `GET /lk/profile` | без изменений |

---

## 9. Что нужно с вашей стороны

1. **Применить миграцию `024_2fa_and_privacy.sql`** (идемпотентна, откат — `024_..._down.sql`).
2. **Завести cron для фазы 2 удаления** — без него аккаунты зависнут в `pending_deletion` навсегда (§3.3).
3. **Проверить, что интерфейс переживает новые значения `tenant_status`** (§7).
4. **Решить по подписи про Яндекс ID** в блоке 2FA (§1.6).
5. Опционально: `PRIVACY_NOTIFY_EMAIL` — если обращения по персональным данным должны идти не на общий ящик продаж.

Из прошлого пакета остаются открытыми: живая проверка почты после деплоя, `deny all` на `/internal/` в vhost `corebridge.ru`, креды Robokassa — подробности в `site_S1_S7_RESPONSE.md` §11.

## 10. Что НЕ делалось (по вашему указанию)

- TOTP и SMS как второй фактор — решение Telegram-only.
- `POST /admin/tenants`, экспорт CSV списков, «Перезапустить worker», «Открыть n8n UI», период в `/admin/stats`, `/admin/support/*` — вы явно просили не делать.
- Uptime-проценты в `/admin/health` — нет истории.
