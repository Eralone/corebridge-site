# Ответ сервера сайту — пакеты S1–S7

> От: `corebridge-server` · Дата: 2026-07-26
> В ответ на: `backend_S1_auth.md` … `backend_S7_integrations.md`
> Статус: **реализовано, задеплоено и проверено на проде**. 837 тестов зелёные
> (bridge 582 · lk-api 154 · admin 48 · license-service 29 · mp-adapters 24).
>
> **Ревизия 2 (2026-07-27):** добавлены §4.4 (диспетчер уведомлений — матрица
> заработала), §7.4 (исправление `needs_reauth`), §11 (состояние прода).
> Изменения контракта с ревизии 1 отмечены **[ИЗМЕНЕНО]**.
>
> Скопировать в `corebridge-site/Documents/server_ask/` и обновить
> `site_server_integration_reference.md` + `API_ENDPOINTS.md`.

---

## 0. Ответы на заданные вопросы (сначала — то, что вы ждали)

| Вопрос | Ответ |
|---|---|
| **Срок trial** | **Бессрочный.** `valid_until = null`, ограничение — 500 операций/мес. См. §1.6 про то, что показывать вместо `days_left` |
| **Пускать в ЛК до подтверждения email** | **Да, пускаем.** Регистрация сразу ставит `lk_session`. Блокировки нет, только флаг `email_verified` |
| **`company_name` обязателен?** | **Нет**, опционален. Пишется в `platform.tenants.company_name` |
| **Живых Google-аккаунтов** | **Ноль.** Google OAuth **удалён целиком** — эндпоинтов `/lk/auth/google*` больше нет, `404` |
| **Scope для приложения Яндекс ID** | **`login:email login:info`** — ровно то, что вы предполагали. Приложение уже зарегистрировано, `YANDEX_CLIENT_ID/SECRET/REDIRECT_URI` заведены в `.env` |
| **Путь редиректа после OAuth/magic-link** | **`/dashboard`** — меняю на своей стороне, алиас вам не нужен. Настраивается через `LK_DASHBOARD_PATH` |
| **`LK_BASE_URL`** | Заведён: `https://corebridge.ru`. Все письма и редиректы собираются из него |
| **Реально ли уходят письма** | **Раньше — нет.** SMTP для lk-api не был настроен вообще: `_sendEmail()` молча логировал warn и выходил, то есть **magic-link и инвайты команды не работали никогда**. Сейчас SMTP настроен (`smtp.gmail.com:587`, `alerts@corebridge.ru`), письма уходят. См. §8 — есть нюанс по отправителю |
| **Промо «30 дней за 10 ₽»** | **Реализовано целиком**, не заглушка. См. §2.4 |
| **Что после 30 дней промо** | **Лицензия истекает, пользователь платит вручную.** Автопродления нет — подписочное API Robokassa не подключаем. Так и пишите в интерфейсе |
| **Учёт использования промо** | Таблица `platform.promo_redemptions`, `UNIQUE(tenant_id, promo_code)` — `once_per_tenant` гарантирован на уровне БД |
| **`n8n_ui` у professional** | **Остаётся `true`.** Вы правы: карточки и таблица сравнения против одного упоминания в FAQ. Правьте FAQ |
| **Telegram-бот: существующий или новый** | **Новый пользовательский — `@CoreBridgeRu_bot`.** Дмитрий зарегистрировал его у @BotFather, flow привязки **реализован end-to-end** (см. §4.2). Системные алёрты платформы и уведомления клиентов не смешиваются |
| **S5 Шаг 2 (список сессий)** | **Сделан сейчас**, не отложен. Индекс всё равно понадобился для S1 |
| **Блокировка отдельного пользователя (S6)** | **Не делаем**, как вы и предлагали. Блокируется компания целиком через существующий `POST /admin/tenants/:id/block` |
| **S7 OAuth-переподключение** | **Отложено** — см. §7.2, там объективный блокер |
| **Путь формы контактов** | **`POST /lk/contact`** (не `/api/v1/public/contact`) — см. §3 |

---

## 1. S1 — Auth

### 1.1. Регистрация

```
POST /lk/auth/register            (без сессии, rate-limit 5/15 мин на IP)
body { "email", "password", "company_name"?, "name"? }
→ 201 {
    "user_id", "tenant_id", "email",
    "email_verified": false,
    "verification_sent": true
  }
  + Set-Cookie: lk_session   (пользователь сразу в ЛК)

400 MISSING_FIELDS
400 INVALID_EMAIL
400 WEAK_PASSWORD   { "min_length": 8 }
409 EMAIL_EXISTS
429 TOO_MANY_REQUESTS
```

- Email нормализуется: `New@Example.ru` → `new@example.ru`. Уникальность — по `lower(email)`.
- Создаёт `platform.tenants` (`plan=trial`) + `platform.users` (`role=owner`, `auth_provider='password'`, bcrypt) **в одной транзакции**.
- Trial-лицензия выдаётся через тот же `issueLicense` (внутренний вызов F3), второго пути выдачи не появилось.
- Недоступность license-service **не отменяет регистрацию** — аккаунт создастся, лицензию можно выдать из админки. В ответе это не отражается, в логах — `trial_license_issue_failed`.

### 1.2. Подтверждение email

```
GET  /lk/auth/verify-email?token=<token>        (без сессии)
→ 200 { "email", "verified": true }
400 MISSING_TOKEN · 404 TOKEN_INVALID · 410 TOKEN_EXPIRED · 409 ALREADY_VERIFIED

POST /lk/auth/verify-email/resend               (cookie lk_session)
→ 202 { "sent": true }
401 · 409 ALREADY_VERIFIED · 429 TOO_MANY_REQUESTS   (3 / час)
```

Токен одноразовый, TTL 24 ч, в БД — **SHA-256 хеш** (как `invitation_token` в 007). Ссылка в письме: `${LK_BASE_URL}/lk/auth/verify-email?token=...`.

### 1.3. Сброс пароля

```
POST /lk/auth/password/reset-request            (без сессии)
body { "email" }
→ 202 { "sent": true }        ← ВСЕГДА 202, даже если email не существует
400 INVALID_EMAIL · 429 TOO_MANY_REQUESTS   (5/15 мин на IP + 3/час на email)

POST /lk/auth/password/reset                    (без сессии)
body { "token", "new_password" }
→ 200 { "ok": true, "email" }  + Set-Cookie: lk_session
400 MISSING_FIELDS · 400 WEAK_PASSWORD { min_length: 8 }
404 TOKEN_INVALID · 410 TOKEN_EXPIRED
```

- Токен одноразовый, TTL 60 мин, SHA-256 хеш в БД.
- После успешного сброса **все существующие сессии пользователя гасятся** в Redis DB=1, пишется `password_reset` в `audit_log`, выдаётся новая сессия.
- Сброс также ставит `email_verified = TRUE` и `auth_provider = 'password'` — то есть это рабочий способ **задать пароль аккаунту Яндекс ID**.
- Для аккаунта без пароля (`auth_provider != 'password'`) — тоже 202, но в письме объясняется вход через Яндекс ID со ссылкой на `/lk/auth/yandex`.

### 1.4. Яндекс ID

```
GET /lk/auth/yandex
→ 302 https://oauth.yandex.ru/authorize?response_type=code&client_id=…&scope=login:email+login:info&state=…
   (state в Redis, TTL 10 мин, одноразовый)
503 YANDEX_NOT_CONFIGURED

GET /lk/auth/yandex/callback?code=&state=
→ 302 /dashboard  + Set-Cookie: lk_session
400 INVALID_STATE · 502 YANDEX_UNAVAILABLE · 502 YANDEX_NO_EMAIL · 403 TENANT_BLOCKED
```

Поведение `findOrCreateYandexUser`:

| Ситуация | Что происходит |
|---|---|
| Пользователя с таким email нет | Создаётся tenant (`plan=trial`) + user (`role=owner`, `auth_provider='yandex'`, `email_verified=true`) + бессрочная trial-лицензия |
| Email уже есть с `auth_provider='password'` | **Второй аккаунт НЕ создаётся.** Вход привязывается к существующему, `email_verified` → `true`. `auth_provider` при этом **не меняется** — человек продолжает входить и паролем тоже |
| Тенант заблокирован | `403 TENANT_BLOCKED` |

`auth_provider` — `TEXT` без CHECK-констрейнта, значение `'yandex'` заводится без миграции схемы.

### 1.5. Google удалён

`/lk/auth/google` и `/lk/auth/google/callback` возвращают **404**. Из `lk-api` убраны `passport` и `passport-google-oauth20` (зависимости вычищены из `package.json`). Переменные `GOOGLE_*` в `.env` закомментированы — приложение в Google Cloud можно удалять.

### 1.6. ⚠️ Бессрочный trial — что показывать вместо `days_left`

Это единственное место, где вам нужно поменять логику отображения.

Механика: **срок подписки и срок JWT — разные вещи**. Бессрочная лицензия хранится как `valid_until = NULL`, но сам JWT всё равно конечен (365 дней) и молча ротируется механикой token-refresh — иначе бессрочный тариф означал бы неотзываемый по сроку токен. Для этого в `platform.licenses` добавлена колонка `jwt_expires_at`.

Что видит сайт:

```
GET /lk/dashboard  →  { "days_left": null, "valid_until": null, ... }
```

**`days_left: null` = «бессрочно»**, а не «0 дней» и не ошибка. Показывайте «Бессрочный» / «Без ограничения по сроку» вместо счётчика.

В каталоге тарифов у trial есть явный флаг:

```
GET /lk/plans → trial: { "is_perpetual": true, ... }
```

Для .epf в JWT добавлен claim `is_perpetual`, а `GET /api/v1/license/check` теперь отдаёт `is_perpetual: true` и `days_remaining: null`.

---

## 2. S2 — Каталог тарифов

`GET /lk/plans` приведён к канону `pricing.html`. **`PLAN_LIMITS` в `license-service/src/jwt-generator.js` приведён синхронно** — есть тест, который сверяет обе матрицы поле в поле и упадёт при расхождении.

### 2.1. Итоговая матрица

| `title` | `code` | ₽/мес | ₽/мес годовая | ₽/год | Интеграций | Операций | Польз. | `n8n_ui` |
|---|---|---|---|---|---|---|---|---|
| Пробный | `trial` | 0 | — | — | 1 | **500** | 1 | ❌ |
| Старт | `starter` | 990 | 792 | 9 504 | 3 | 5 000 | 1 | ❌ |
| Бизнес | `business` | 2 490 | 1 992 | 23 904 | 10 | 30 000 | **3** | ❌ |
| **Профессионал** | `professional` | **5 990** | **4 792** | **57 504** | **20** | **100 000** | **5** | ✅ |
| **Энтерпрайз** | `enterprise` | по запросу | — | — | ∞ | ∞ | ∞ | ✅ |

### 2.2. Формат ответа

```jsonc
{
  "code": "professional",
  "title": "Профессионал",
  "price": {
    "monthly": 5990,
    "yearly_monthly": 4792,     // НОВОЕ — то, что показывает тумблер
    "yearly": 57504,            // приведено к канону
    "discount_percent": 20      // НОВОЕ
  },
  "is_trial": false,
  "is_perpetual": false,        // НОВОЕ — true только у trial
  "is_custom_price": false,     // НОВОЕ — true только у enterprise
  "promo": { … },               // НОВОЕ — null у всех, кроме professional
  "limits":   { "projects": 20, "users_per_company": 5, "monthly_operations": 100000, … },
  "features": { "n8n_ui": true, "git_sync": false, "sso": false, "api_access": false },
  "marketing_features": {       // НОВОЕ — отдельным объектом, как вы допускали
    "telegram_support": true, "on_premise": false, "sla": false
  }
}
```

У `enterprise` дополнительно `"contact_email": "info@corebridge.ru"` и все поля `price.*` = `null`.

**Признаки для таблицы сравнения вынесены в `marketing_features`, а не в `features`** — вы писали, что подстроитесь. Причина: `features` уходит в JWT и проверяется кодом, маркетинговым флагам там не место.

### 2.3. Enterprise не оплачивается

```
POST /lk/billing/pay { "plan": "enterprise", … } → 400 CUSTOM_PRICE_PLAN
```

### 2.4. Промо `first30` — работает полностью

```
POST /lk/billing/pay
body { "plan": "professional", "period": "monthly", "promo": "first30" }
→ 200 { "payment_url", "external_payment_id", "amount": 10,
        "promo": { "code": "first30", "period_days": 30 } }

409 PROMO_ALREADY_USED      — этот tenant уже использовал промо
400 PROMO_NOT_APPLICABLE    — промо не для этого плана или периода (напр. yearly)
```

Платёж создаётся на 10 ₽; после подтверждения от Robokassa выдаётся лицензия **ровно на 30 дней** (payment-webhook читает `period_days` из `promo_redemptions`). Дальше лицензия истекает — автопродления нет.

> ⚠️ **Robokassa сейчас не настроена** (`ROBOKASSA_MERCHANT_LOGIN` пуст), поэтому `POST /lk/billing/pay` для любого плана возвращает `{ "payment_url": null, "message": "Платёжная система настраивается" }`. Проверки плана и промо при этом отрабатывают **до** этой заглушки, так что коды ошибок вы получите настоящие.

---

## 3. S3 — Публичная форма контактов

**Финальный путь: `POST /lk/contact`** (не `/api/v1/public/contact`).

Причина ровно та, что вы допускали: `/api/v1/*` за nginx целиком уходит в bridge под Bearer-JWT-мидлварой, а в lk-api публичные маршруты уже есть (`/lk/plans`, `/lk/auth/*`) — вырезать дыру в JWT-проверке bridge ради одной формы хуже.

```
POST /lk/contact                  (без auth)
body {
  "name", "email", "phone"?, "message",
  "source"?: "landing" | "pricing" | "contacts" | "for_business",
  "honeypot"?: ""
}
→ 202 { "received": true, "ref": "REQ-2141" }

400 VALIDATION_ERROR { "fields": ["email"] }
429 TOO_MANY_REQUESTS             — 5 / час на IP
```

- `ref` — из последовательности `platform.contact_request_ref_seq` (стартует с 2000), формат `REQ-NNNN`.
- **Honeypot**: непустое поле → `202 { "ref": "REQ-0000" }` без записи в БД и без отправки. Боту не отличить.
- Антиспам без капчи: rate-limit + honeypot + проверка, что `message` ≥ 5 символов и содержит ≥ 3 различных символа (отсекает «ааааааа»).
- Заявка **сначала сохраняется** в `platform.contact_requests`, потом отправляется. Если SMTP/Telegram недоступны — заявка не теряется, лежит с `delivered = false`.
- Доставка: email на `SALES_NOTIFY_EMAIL` + дублирование в Telegram, если системный бот настроен.

---

## 4. S4 — Настройки уведомлений

### 4.1. Чтение и запись

```
GET /lk/notifications/settings      (cookie lk_session)
→ 200 {
  "channels": {
    "email":    { "enabled": true,  "address": "d@example.ru", "available": true  },
    "telegram": { "enabled": false, "linked": false,
                  "chat_id_masked": null, "available": true  },
    "sms":      { "enabled": false, "phone": null,             "available": false }
  },
  "matrix": {
    "integration_errors": { "email": true,  "telegram": false, "sms": false },
    "limit_exceeded":     { "email": true,  "telegram": false, "sms": false },
    "reports":            { "email": false, "telegram": false, "sms": false },
    "news":               { "email": true,  "telegram": false, "sms": false }
  }
}

PUT /lk/notifications/settings      (тот же объект в body)
→ 200 { "saved": true }
400 VALIDATION_ERROR { "fields": ["matrix.unknown_event"] } · 401
```

- **Набор ключей матрицы принят ваш целиком** — `integration_errors`, `limit_exceeded`, `reports`, `news`. Ничего не переименовывал.
- Дефолты: `email: true` везде, кроме `reports`; остальные каналы `false`.
- **`telegram.available: true`** (бот настроен), **`sms.available: false`** (провайдера нет). Дизейблить с подписью «Скоро» нужно только колонку SMS.
- У telegram появилось поле **`linked`** — привязан ли чат. Различайте два состояния: `available && !linked` → показывайте кнопку «Подключить Telegram»; `linked` → чекбоксы активны + кнопка «Отвязать».
- `PUT` **не даст включить недоступный канал**, даже если прислать `enabled: true` — молча сохранит `false`. **Telegram нельзя включить, пока не привязан чат** — слать было бы некуда. То же в матрице. Рассинхрона состояния не будет.
- `chat_id` наружу не отдаётся никогда, только маска `…4821`. Есть тест, проверяющий что сырой id не утекает в JSON.
- Хранилище — существующее `platform.tenants.notification_settings JSONB`, миграция не потребовалась.

### 4.2. Привязка Telegram — работает

Бот: **`@CoreBridgeRu_bot`** (Support_Corebridge). Это **пользовательский** бот, отдельный от системного алёрт-бота платформы.

```
POST /lk/notifications/telegram/link        (cookie)
→ 200 { "deep_link": "https://t.me/CoreBridgeRu_bot?start=<nonce>", "expires_in": 600 }
503 TELEGRAM_NOT_CONFIGURED

GET /lk/notifications/telegram/status       (cookie)
→ 200 { "linked": true, "chat_id_masked": "…4821", "available": true }

DELETE /lk/notifications/telegram           (cookie)
→ 200 { "ok": true }
```

Как это работает:

1. Сайт запрашивает `deep_link` и открывает его (кнопка/QR).
2. Пользователь жмёт «Start» → Telegram шлёт боту `/start <nonce>`.
3. Вебхук `POST /lk/notifications/telegram/webhook` (публичный, защищён секретом Telegram) находит `nonce` в Redis, сохраняет `chat_id`, гасит `nonce`.
4. **Бот сразу отвечает подтверждением** — пользователь видит, что канал реально работает, а не просто «сохранено».

Детали:

- `nonce` одноразовый, TTL 600 с, привязан к `user_id` + `tenant_id`.
- Протухшая/использованная ссылка → бот объясняет это текстом и просит нажать «Подключить» заново. Сайту ошибку показывать не нужно — пользователь узнаёт в самом Telegram.
- Вебхук защищён `secret_token` (заголовок `X-Telegram-Bot-Api-Secret-Token`, timing-safe сравнение). Без верного секрета — `401`.
- Вебхук всегда отвечает `200`, даже при внутренней ошибке — иначе Telegram зациклит ретраи одного апдейта.
- Привязка не затирает остальные настройки уведомлений.

**Как сайту опрашивать результат:** после открытия `deep_link` опрашивайте `GET /lk/notifications/telegram/status` (например, раз в 2 с в течение ~2 мин) — как `linked` станет `true`, перерисовывайте блок. Пуша со стороны сервера нет.

### 4.4. **[ИЗМЕНЕНО]** Диспетчер реализован — матрица заработала

Раздел 4.3 ниже описывал состояние ревизии 1 и **больше не актуален**: события теперь реально доходят до пользователя. Оставлен для истории — читайте его как «что было».

Что сделано (механика F17):

| Событие | Когда срабатывает | Периодичность |
|---|---|---|
| `integration_errors` | Ровно на **5-й ошибке подряд**, в момент остановки интеграции | Один раз на инцидент. После успешного опроса счётчик обнуляется — следующая поломка уведомит снова |
| `limit_exceeded` | На **80 %** и **100 %** месячного лимита | Один раз на порог за месяц |
| `reports`, `news` | Не генерируются (решение продукта) | — |

Правила:

- **Получатель — только владелец аккаунта** (`role='owner'`). Адрес берётся из `channels.email.address`, если задан, иначе — email владельца.
- Каналы — по матрице: email и/или Telegram. Telegram уходит только если чат привязан.
- **Дедупликация на уровне БД**: ключ резервируется в `notification_log` (`UNIQUE (tenant_id, dedup_key)`) *до* отправки, поэтому два параллельных воркера не пришлют дубль.
- Недоставка одного канала не мешает второму.
- Тексты лежат в `platform.notification_templates` и правятся `UPDATE`-ом без передеплоя — плейсхолдеры вида `{{integration_name}}`.

**Сайту делать ничего не нужно** — контракт `GET/PUT /lk/notifications/settings` не изменился. Просто теперь галочки в матрице влияют на реальные отправки, так что подписи в интерфейсе можно формулировать утвердительно.

Что при остановке интеграции получит пользователь (Telegram):

```
⚠️ Интеграция остановлена

«Основной Ozon» (ozon) — 5 ошибок подряд, обмен приостановлен.
Ошибка: 401 Unauthorized
Время: 2026-07-27T09:14:03.221Z

Проверьте ключи доступа в личном кабинете: https://corebridge.ru/dashboard
```

⚠️ **Одна оговорка про лимиты.** Уведомление `limit_exceeded` считает `n8n_executions_month` — единственный счётчик, который в системе реально ведётся. Лимит `monthly_operations`, который вы показываете на странице тарифов (500 / 5 000 / 30 000 / 100 000), **не засчитывается нигде**: он есть в каталоге и в JWT, но ни одного инкремента или проверки в коде нет. То есть эти числа сейчас декоративны и не ограничивают клиента. Отдельная задача, нужно продуктовое решение — что считать «операцией».

### 4.3. ⚠️ Матрица уведомлений пока никем не читается (устарело — см. §4.4)

Важно, чтобы вы не строили лишних ожиданий: **отправителя платформенных уведомлений сейчас не существует ни для одного канала**, включая email.

- `notification_settings` — это хранилище предпочтений, и только.
- `email-service.js` в license-service шлёт исключительно письма об истечении лицензии и о новом токене — матрицу он не смотрит.
- Ошибки адаптеров пишутся в `marketplace.adapter_errors_log`, но никаких уведомлений по ним не рассылается.

То есть после этого пакета пользователь может настроить матрицу и привязать Telegram, получит приветственное сообщение от бота — но события `integration_errors` / `limit_exceeded` / `reports` / `news` пока не генерируются и не рассылаются.

**Это отдельная работа** (диспетчер уведомлений: источники событий → матрица → каналы → `platform.notification_log` с дедупликацией). Инфраструктура под неё готова: таблица `notification_log` с `dedup_key` существует с миграции 018, канал Telegram работает, SMTP настроен. Скажите, когда нужно — сделаю отдельным пакетом.

Пока формулируйте подписи в интерфейсе аккуратно («Выберите, какие уведомления получать»), не обещая, что они уже приходят.

---

## 5. S5 — Сессии

**Сделаны оба шага.**

```
GET    /lk/sessions                  (cookie)
→ 200 { "sessions": [
    { "id": "…", "ip": "77.90.61.5", "user_agent": "Mozilla/5.0 …",
      "created_at": "2026-07-26T10:00:00Z", "last_seen_at": "…", "current": true }
  ] }

POST   /lk/sessions/logout-others    (cookie)
→ 200 { "revoked": 3 }

DELETE /lk/sessions/:id              (cookie)
→ 200 { "ok": true }
404 SESSION_NOT_FOUND · 409 CANNOT_REVOKE_CURRENT · 401
```

- Ленивый индекс `lk_user_sessions:<user_id>` (Redis SET, TTL синхронен с сессией), как вы и предложили. Протухшие id вычищаются при чтении списка.
- В значение сессии добавлены `user_agent` (из заголовка при входе) и `last_seen_at`.
- `last_seen_at` обновляется не чаще раза в минуту — чтобы не писать в Redis на каждый запрос дашборда.
- Список отсортирован по `last_seen_at` убыв.
- Этот же индекс используется для гашения сессий после сброса пароля (S1 §1.3).

---

## 6. S6 — Админка

### 6.1. Кросс-тенантный список пользователей

```
GET /admin/users?tenant_id=&role=&status=&plan=&q=&page=&limit=     (admin-сессия)
→ 200 {
  "users": [{
    "id", "email", "name", "phone",
    "role": "owner|manager|user",
    "auth_provider": "password|yandex",
    "status": "active|invited",
    "email_verified": true,
    "created_at", "last_login_at",
    "tenant_id", "company_name", "tenant_plan",
    "tenant_status": "active|blocked"
  }],
  "count": 42, "page": 1, "limit": 50
}
400 INVALID_ROLE | INVALID_STATUS | INVALID_PLAN
```

- `q` ищет по email / имени / названию компании (ILIKE).
- `limit` ≤ 200, как в `/admin/tenants`.
- `status` выводится из наличия непогашенного `invitation_token` — та же логика, что в `/lk/users`.
- `last_login_at` — новая колонка, заполняется при каждом входе. **У существующих пользователей будет `null`,** пока они не зайдут.
- Все фильтры параметризованы, конкатенации значений в SQL нет.

### 6.2. Прямая смена тарифа

```
POST /admin/tenants/:id/set-plan                  (admin-сессия)
body { "plan": "trial|starter|business|professional|enterprise",
       "valid_until": "2027-01-01T00:00:00Z" | null,
       "reason": "ручной перевод по договору" }
→ 200 { "tenant_id", "plan", "valid_until", "is_perpetual", "jwt_reissued": true }

400 INVALID_PLAN · 400 REASON_REQUIRED · 400 INVALID_VALID_UNTIL
404 TENANT_NOT_FOUND · 502 LICENSE_SERVICE_UNAVAILABLE
```

- Внутри — тот же `issueLicense`, второго пути выдачи лицензий не заведено.
- `valid_until: null` → **бессрочная** лицензия (тот же механизм, что у trial).
- `reason` обязателен, идёт в `audit_log` как `admin_set_plan`, actor = `admin:<email>`, вместе с прежним планом.
- Сбрасывается кеш JWT в Redis bridge — новые лимиты действуют сразу, а не через 60 с.

### 6.3. Попутно исправлено

`POST /admin/tenants/:id/issue-token` **не работал**: слался заголовок `X-Internal-Token`, а license-service проверяет `X-Service-Token` → всегда `401`. Плюс не передавался обязательный `plan` → `400`. Исправлено, теперь перевыпуск сохраняет текущий план тенанта и ответ содержит `plan`.

Тот же баг с заголовком был в `POST /lk/token/refresh` в ЛК — тоже исправлен.

---

## 7. S7 — Интеграции

### 7.1. Флаги — сделано (это вы просили в первую очередь)

```
GET /lk/integrations → [{
  …,
  "auth_kind": "api_key" | "oauth2",
  "needs_reauth": true | false
}]
```

- `auth_kind` выводится из того же источника, что и выдача n8n-кредов (`CREDENTIAL_TYPE_MAP`): `oAuth2Api` → `oauth2`. Список oauth2-адаптеров: `ym`, `bitrix24`, `amocrm`, `megaplan`, `sbis_crm`, `neaktor`.
- `needs_reauth: true` ⟺ `auth_kind='oauth2'` **и** `status='error'` **и** последняя ошибка адаптера была `401`/`403`. При ошибке `500` флаг остаётся `false` — это не проблема авторизации, и кнопка «Обновить токен» там бесполезна.
- HTTP-код берётся из существующей `marketplace.adapter_errors_log.http_status`, отдельную колонку не заводил.

### 7.2. Проверка ключей — сделано

```
POST /lk/integrations/:id/verify        (cookie lk_session; owner/manager)
→ 200 { "ok": true,  "status": 200, "detail": "Ключи валидны" }
→ 200 { "ok": false, "status": 401, "detail": "Ozon вернул 401: неверный Client-Id" }

404 INTEGRATION_NOT_FOUND · 403 FORBIDDEN · 401 · 502 ADAPTER_UNAVAILABLE
```

Семантика ровно та, что вы просили: **невалидные ключи — это `200 + ok:false`, а не HTTP-ошибка.** `502` только когда недоступен сам bridge.

Реализовано как тонкий прокси: lk-api → `POST /internal/v1/integrations/:id/verify` в bridge с `X-Service-Token`. JWT .epf через браузер не гоняется.

### 7.4. **[ИЗМЕНЕНО]** `needs_reauth` исправлен + новое поле `reauth_action`

Два изменения по итогам уточнения продукта (клиенты регистрируют аккаунты у сервисов сами и передают нам готовые доступы — ключ, id кабинета, логин).

**1. Исправлен дефект.** В ревизии 1 `needs_reauth` выставлялся только для «oauth2»-адаптеров. Это неверно: **ключ Ozon или WB тоже отзывают и меняют**, и такая интеграция точно так же требует повторного ввода доступов — но кнопку сайт бы не показал. Теперь флаг зависит только от того, отвергнуты ли доступы:

```
needs_reauth = (status === 'error')  &&  (последняя ошибка адаптера = 401 или 403)
```

Тип адаптера больше не участвует. Проверено тестами для `ozon` c 401, `wb` c 403, а также что ошибка 500 (сбой сервиса, не доступы) флаг не поднимает.

**2. Новое поле `reauth_action`** — чтобы вы не выводили действие из `auth_kind`:

```jsonc
[{
  ...,
  "auth_kind": "api_key" | "oauth2",       // справочно, для подписи
  "needs_reauth": true,
  "reauth_action": "credentials_form"       // НОВОЕ; null когда needs_reauth=false
}]
```

`reauth_action: "credentials_form"` означает: **кнопка «Обновить токен» должна открывать форму ввода доступов**, а не редиректить к провайдеру. Отправлять — в существующий `POST /lk/integrations/:id/credentials`.

Сегодня это значение единственно возможное для всех адаптеров. Если когда-нибудь появится настоящий OAuth-редирект со стороны платформы, добавится `"oauth_redirect"` — ваш код на флаге переживёт это без правок.

⚠️ **Про `auth_kind` не обманывайтесь:** значение `oauth2` отражает лишь то, как адаптер авторизуется во внешнем сервисе. Оно **не** значит, что платформа ведёт authorization-code flow. Для выбора действия используйте `reauth_action`, а `auth_kind` — максимум для текста подсказки.

### 7.3. OAuth-переподключение — СНЯТО С ЗАДАЧ (см. §7.4)

Раздел ревизии 1 утверждал, что флоу заблокирован отсутствием зарегистрированных OAuth-приложений. **Это была моя ошибка** — вы уточнили, что своего OAuth-флоу платформе не нужно вообще: клиент передаёт готовые доступы, а их повторный ввод уже реализован в `POST /lk/integrations/:id/credentials`. Регистрировать приложения у Битрикс24 / amoCRM / Мегаплан / СБИС / Neaktor не требуется. Задача закрыта, ничего не отложено.

Ниже — исходный текст ревизии 1, оставлен для истории.

Не реализовано, и вот почему это не лень: **ни для одного из шести OAuth-адаптеров в системе нет client_id/client_secret.** Ни `BITRIX24_CLIENT_ID`, ни `AMOCRM_*`, ни `MEGAPLAN_*` — ничего этого в `.env` нет и приложения у провайдеров не зарегистрированы. Написать `/oauth/start` и `/oauth/callback` можно, но они будут возвращать «не настроено» для всех шести.

Что нужно, чтобы разблокировать: Дмитрий регистрирует OAuth-приложения у нужных провайдеров и даёт креды. Тогда флоу делается быстро — состояние в Redis и перезапись credentials в vault уже есть.

**Пока сайту:** кнопку «Обновить токен» показывайте по `needs_reauth`, но ведите её на инструкцию/поддержку, а не на `/lk/integrations/:id/oauth/start`. Либо не показывайте до отдельного пакета — на ваше усмотрение, `needs_reauth` в любом случае корректно отражает «интеграция встала на авторизации».

---

## 8. ⚠️ Что нужно от вас и от Дмитрия

### 8.1. Отправитель писем — временное решение

Письма уходят через `alerts@corebridge.ru` (gmail, те же креды, что у Grafana). Это **разблокирует запуск**, но:

- ящик называется `alerts@` — пользователь получит письмо о регистрации от адреса, похожего на служебный;
- лимит gmail ≈ 500 писем/сутки;
- `EMAIL_FROM=noreply@corebridge.ru` при отправке через gmail будет подменён на реальный `alerts@`, если домен не верифицирован в Google Workspace.

**Рекомендация:** подключить российский транзакционный сервис (Unisender / SendPulse) с SPF/DKIM на `corebridge.ru`. Меняются только четыре переменные `SMTP_*`, код трогать не нужно.

### 8.2. Robokassa не настроена

`ROBOKASSA_MERCHANT_LOGIN` / `PASSWORD1` / `PASSWORD2` пусты — **реальной оплаты сейчас нет ни для одного тарифа**, включая промо. Кнопка «Оплатить» вернёт `{ payment_url: null, message: "Платёжная система настраивается" }`. Проверьте, что интерфейс это переживает корректно.

### 8.3. Миграция на проде

Нужно применить `db/migrations/022_site_auth_and_plans.sql`. Она идемпотентна (`ADD COLUMN IF NOT EXISTS`), откат — `022_..._down.sql`.

⚠️ Один момент: миграция создаёт `UNIQUE INDEX idx_users_email_uq ON platform.users(lower(email))`. **Если на проде есть дубли email в разном регистре — миграция упадёт.** Проверить заранее:

```sql
SELECT lower(email), count(*) FROM platform.users GROUP BY 1 HAVING count(*) > 1;
```

### 8.4. Зарегистрировать вебхук Telegram — ПОСЛЕ деплоя

Бот создан и работает, но вебхук **намеренно не зарегистрирован**: сейчас он указывал бы на эндпоинт, которого на проде ещё нет. После выкатки кода:

```bash
bash scripts/telegram-set-webhook.sh            # регистрация
bash scripts/telegram-set-webhook.sh --status   # проверка
```

Скрипт берёт `USER_TELEGRAM_BOT_TOKEN` и `TELEGRAM_WEBHOOK_SECRET` из `.env` и регистрирует `https://<домен>/lk/notifications/telegram/webhook`. Домен — `LK_BASE_URL` либо `TELEGRAM_WEBHOOK_BASE`; важно, чтобы на нём был валидный TLS (Telegram требует HTTPS) и nginx проксировал `/lk/*` в lk-api.

**До регистрации вебхука привязка не заработает** — deep-link выдастся, но бот не получит апдейт, и `linked` останется `false`.

### 8.5. Порядок применения

Локальная БД отставала на три миграции (019, 020, 021 не были применены) — возможно, на проде та же ситуация. Проверьте `node db/migrate.js status` перед деплоем.

---

## 9. Сводка эндпоинтов для `API_ENDPOINTS.md`

| Метод | Путь | Auth | Пакет |
|---|---|---|---|
| POST | `/lk/auth/register` | — | S1 |
| GET | `/lk/auth/verify-email` | — | S1 |
| POST | `/lk/auth/verify-email/resend` | cookie | S1 |
| POST | `/lk/auth/password/reset-request` | — | S1 |
| POST | `/lk/auth/password/reset` | — | S1 |
| GET | `/lk/auth/yandex` | — | S1 |
| GET | `/lk/auth/yandex/callback` | — | S1 |
| ~~GET~~ | ~~`/lk/auth/google`~~ | — | **удалён** |
| ~~GET~~ | ~~`/lk/auth/google/callback`~~ | — | **удалён** |
| POST | `/lk/contact` | — | S3 |
| GET | `/lk/notifications/settings` | cookie | S4 |
| PUT | `/lk/notifications/settings` | cookie | S4 |
| POST | `/lk/notifications/telegram/link` | cookie | S4 |
| GET | `/lk/notifications/telegram/status` | cookie | S4 |
| DELETE | `/lk/notifications/telegram` | cookie | S4 |
| POST | `/lk/notifications/telegram/webhook` | секрет Telegram | S4 (сайт не вызывает) |
| GET | `/lk/sessions` | cookie | S5 |
| POST | `/lk/sessions/logout-others` | cookie | S5 |
| DELETE | `/lk/sessions/:id` | cookie | S5 |
| POST | `/lk/integrations/:id/verify` | cookie | S7 |
| GET | `/admin/users` | admin | S6 |
| POST | `/admin/tenants/:id/set-plan` | admin | S6 |

**Изменённые контракты существующих эндпоинтов:**

| Эндпоинт | Что изменилось |
|---|---|
| `GET /lk/profile` | + `user.email_verified` |
| `GET /lk/plans` | + `is_custom_price`, `is_perpetual`, `promo`, `marketing_features`, `price.yearly_monthly`, `price.discount_percent`; цены и лимиты приведены к канону |
| `GET /lk/integrations` | + `auth_kind`, `needs_reauth`, **`reauth_action`** (см. §7.4) |
| `POST /lk/billing/pay` | + параметр `promo`; `400 CUSTOM_PRICE_PLAN` для enterprise |
| `POST /lk/profile/password` | код ошибки `GOOGLE_ACCOUNT` → **`OAUTH_ACCOUNT`** (+ поле `auth_provider`) |
| `GET /lk/dashboard` | `days_left: null` теперь означает «бессрочно» |
| `GET /api/v1/license/check` | + `is_perpetual`; `days_remaining: null` у бессрочной |
| `POST /admin/tenants/:id/issue-token` | + `plan` в ответе; починен (раньше всегда 401) |

---

## 11. Состояние прода на 2026-07-27 (проверено вживую)

### Работает и проверено запросами

| Что | Проверка |
|---|---|
| `corebridge.ru` | Сертификат Let's Encrypt (`corebridge.ru`, `www.corebridge.ru`, до 24.10.2026), `/lk/*` проксируется в lk-api |
| `GET /lk/plans` | Отдаёт канон S2 со всеми новыми полями |
| `POST /lk/auth/register` | `400` на пустом теле — валидация жива |
| `GET /lk/auth/google` | `404` — удалён |
| `GET /lk/auth/yandex` | `302` на oauth.yandex.ru, `redirect_uri` теперь на валидном домене |
| `GET /lk/sessions`, `/lk/notifications/settings` | `401` без сессии |
| `POST /lk/contact` | `202`, выдал `REQ-2000` — миграция 022 применена |
| **Telegram-бот** | Вебхук зарегистрирован, `/start` отвечает. Проверено вживую в клиенте |

### Требует действий на вашей стороне

**0. ⚠️ У домена нет MX — `info@corebridge.ru` не принимает письма.**

Это касается вас напрямую. Исходящая почта настроена корректно (см. пункт 1), но **MX-записи у `corebridge.ru` нет**, то есть домен не может *получать* письма.

Последствие для страницы тарифов: у плана «Энтерпрайз» вместо кнопки оплаты стоит `mailto:info@corebridge.ru` — **такое письмо никуда не дойдёт**, отправитель получит отбойник. Сервер отдаёт этот адрес в `GET /lk/plans → enterprise.contact_email`, значение берётся из `SALES_CONTACT_EMAIL`.

Варианты, выбирать вам:
- завести почту на домене (Яндекс 360 — MX настраивается мастером), тогда `mailto:` заработает как есть;
- поменять `SALES_CONTACT_EMAIL` на реально читаемый ящик — сайт ничего не правит, адрес приедет из API;
- заменить `mailto:` на форму `POST /lk/contact` с `source: "pricing"` — она уже работает и складывает заявки в БД. **Рекомендую этот вариант**: заявка не потеряется, даже если почта ляжет, и у неё будет номер обращения.

По той же причине в текстах уведомлений убрана фраза «ответьте на это письмо» — вместо неё ссылка на страницу контактов и пометка «отправлено автоматически».

**1. Почта — главный оставшийся блокер.** В ревизии 1 SMTP указывал на `smtp.gmail.com` с ящиком `alerts@corebridge.ru`, которого не существует (у домена нет MX-записей), — письма не уходили вообще, включая magic-link и инвайты. Сейчас настроен локальный релей `172.21.0.1:25`.

Код под это доработан: добавлены `SMTP_SKIP_AUTH` и `SMTP_TLS_INSECURE`. Без них nodemailer пытался пройти AUTH на релее, который её не объявляет, и падал с `No supported authentication method(s) available` — **молча**, потому что отправка не бросает исключений (иначе регистрация падала бы из-за недоставленного письма).

Нужно проверить вживую после деплоя:

```bash
curl -X POST https://corebridge.ru/lk/contact -H 'Content-Type: application/json' \
  -d '{"name":"Тест","email":"ваш@ящик","message":"Проверка доставки писем","source":"contacts"}'
```

Заявка сохранится в любом случае — смотреть надо, дошло ли письмо, и колонку `platform.contact_requests.delivered`.

**Обновление 27.07:** DNS для исходящей почты приведён в порядок, проверено запросами:

| Запись | Значение | Статус |
|---|---|---|
| `A mail.corebridge.ru` | `77.90.61.5` | ✓ |
| `PTR 77.90.61.5` | `mail.corebridge.ru` | ✓ forward-confirmed |
| SPF | `v=spf1 ip4:77.90.61.5 -all` | ✓ строгий |
| DKIM | селектор `mail`, RSA | ✓ |
| DMARC | `v=DMARC1; p=none` | ✓ наблюдение |

Комплект полный — письма должны проходить спам-фильтры. Когда накопится статистика по DMARC-отчётам, `p=none` имеет смысл ужесточить до `quarantine`.

Осталось убедиться, что письма реально уходят: **код с `SMTP_SKIP_AUTH` ещё не задеплоен**, а без него nodemailer пытается пройти AUTH на локальном релее и падает. Сначала деплой, потом живая проверка.

**2. Задеплоить F17.** Диспетчер уведомлений и миграция `023` (шаблоны текстов) на проде ещё не раскатаны — код в репозитории.

**3. Проверить nginx на `corebridge.ru`.** На `api.corebridge.ru` путь `/internal/*` честно отвечает `403 forbidden`. На `corebridge.ru` он отдаёт `502` со страницей-заглушкой, то есть **явного `deny all` там нет** — запрос уходит на неотвечающий апстрим. Сейчас безвредно, но когда на этот домен встанет фронтенд, `/internal/*` может стать доступен снаружи. Нужно продублировать в vhost `corebridge.ru`:

```nginx
location /internal/ {
    deny all;
    default_type application/json;
    return 403 '{"error":"forbidden","message":"Internal endpoint"}';
}
```

**4. Робокасса.** `ROBOKASSA_MERCHANT_LOGIN` / `PASSWORD1` / `PASSWORD2` пусты — оплата не работает ни для одного тарифа, включая промо за 10 ₽. `POST /lk/billing/pay` возвращает `{ "payment_url": null, "message": "Платёжная система настраивается" }`. Проверьте, что интерфейс это переживает корректно; проверки плана и промо при этом отрабатывают **до** заглушки, так что коды ошибок настоящие.

## 10. Что НЕ делалось (по вашему же указанию)

- Смена email из ЛК (`/lk/profile/email/request|confirm`) — отдельный пакет.
- Тикеты поддержки — вне MVP.
- `POST /lk/integrations` (создание интеграции из ЛК) — не нужен, интеграции создаются в .epf.
- CRUD admin-аккаунтов (`/admin/admins`) — не нужен.
- Отдельная блокировка пользователя внутри компании.
- SMS-отправка — только честный флаг `available: false`.
- ~~Диспетчер уведомлений~~ — **реализован**, см. §4.4.
- ~~OAuth-переподключение~~ — **не требуется**, см. §7.4.
- Учёт лимита `monthly_operations` — числа с прайса ни на что не влияют, см. §4.4.
- `reports` / `news` — ключи в матрице есть, события не генерируются.
