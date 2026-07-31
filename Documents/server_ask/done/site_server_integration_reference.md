# CoreBridge Server → Site: полный интеграционный референс

> **Назначение.** Всё, что нужно знать `corebridge-site` (Next.js на Vercel) о серверной части
> (`api.corebridge.ru`), чтобы реализовать регистрацию, Личный кабинет, биллинг, тарифы, лимиты,
> JWT-токены, интеграции и отображение n8n — для пользователя и для администратора.
> Источник истины — код `corebridge-server` (не документация). Актуально на 2026-07-23.

---

## 0. Топология и базовые URL

| Хост | Что | Кто обслуживает |
|---|---|---|
| `https://corebridge.ru` | Сайт + ЛК (SSR/CSR) | **corebridge-site** (Vercel) |
| `https://api.corebridge.ru` | Весь backend-API | corebridge-server (VPS, Nginx) |

**Сайт всегда ходит на `https://api.corebridge.ru`.** Nginx на VPS маршрутизирует по префиксу пути
на внутренние сервисы (сайт про внутренние порты знать не должен):

| Внешний префикс | Внутренний сервис | Назначение для сайта |
|---|---|---|
| `/lk/*` | lk-api (3000) | **Основной API Личного кабинета** (cookie-сессия) |
| `/api/v1/license/*` | license-service (3002) | Проверка/продление лицензии (Bearer JWT) |
| `/api/v1/*` | bridge (3001) | API для .epf и Мастера проектов (Bearer JWT) |
| `/admin/*` | admin (3003) | Admin-панель (отдельная сессия + IP-whitelist + 2FA) |
| `/n8n/*` | n8n (5678) | UI n8n (проксируется; доступ по фиче тарифа) |
| `/api/v1/webhooks/*` | bridge | Приём вебхуков платёжек/МП (HMAC/IP, не для сайта) |
| `/cdn/epf/*` | bridge + Nginx | Скачивание .epf по one-time токену |

> ⚠ CORS: lk-api и admin отдают CORS только для своих префиксов. Для cookie-сессии ЛК запросы
> с сайта идут с `credentials: 'include'`. Убедиться, что `LK_BASE_URL`/CORS-origin на сервере
> включает `https://corebridge.ru`.

---

## 1. Три независимые системы авторизации (КРИТИЧНО)

Сервер держит **три несовместимых** механизма. Сайт использует ТОЛЬКО первый (LK Session).
Никогда не смешивать — сервер их строго разделяет.

| Система | Кто | Транспорт | Что внутри |
|---|---|---|---|
| **LK Session** | Пользователь ЛК (сайт) | Cookie `lk_session` (httpOnly, sameSite=strict, secure в prod) | `session_id` → Redis DB=1 → `{user_id, tenant_id, role}` |
| **JWT (.epf)** | Клиентский модуль 1С | `Authorization: Bearer <jwt>` | `tenant_id`, `plan`, `limits`, `features`, `enabled_modules` |
| **Admin Session** | Сотрудник CoreBridge | Cookie `admin_session_id` (Redis DB=2) | email + bcrypt + TOTP (2FA), отдельно от всего |

**Практика для сайта:**
- Все запросы ЛК → `/lk/*` с `fetch(url, { credentials: 'include' })`. Куку ставит и читает сервер.
- Сессия живёт `SESSION_TTL_SEC` (по умолчанию 86400 = 24 ч).
- JWT .epf сайт **показывает** пользователю (маскированный) и умеет **обновлять** через `/lk/token/refresh`,
  но сам JWT для авторизации в ЛК не используется.

---

## 2. Регистрация и создание пользователей/тенантов

Модель данных: `platform.tenants` (компания-клиент) → `platform.users` (пользователи ЛК, роль `owner|manager|...`).
Один tenant = одна компания = одна лицензия/план. У tenant есть `owner` (первый пользователь).

### Что уже реализовано на сервере
- **Google OAuth авто-регистрация.** `GET /lk/auth/google` → callback. Если пользователя с таким email
  нет — сервер **создаёт tenant (plan=`trial`) + user (role=`owner`)** автоматически
  (`auth.service.js → findOrCreateGoogleUser`). Отдельный signup-эндпоинт не нужен.
- **Magic Link.** `POST /lk/auth/magic-link` → письмо со ссылкой. Вход без пароля. Пользователь при этом
  **должен уже существовать** (magic-link не создаёт tenant).
- **Login по паролю.** `POST /lk/auth/login` (email + password, bcrypt).

### Чего на сервере ПОКА нет (нужно согласовать/добавить)
- **Нет публичного `POST /lk/auth/register`** (email+пароль с нуля создающего tenant+user).
  Сейчас self-serve регистрация возможна только через Google OAuth. Если сайту нужна
  классическая форма «регистрация по email/паролю» — это новый серверный эндпоинт (запросить у backend).
- Ручное заведение tenant/пользователя доступно через Admin-панель (`/admin/tenants`, см. §7).

### Эндпоинты аутентификации (lk-api, cookie-сессия)

| Метод | Путь | Тело/параметры | Ответ |
|---|---|---|---|
| POST | `/lk/auth/login` | `{ email, password }` | `{ user_id, role, tenant_id }` + ставит cookie `lk_session` |
| POST | `/lk/auth/logout` | — (нужна сессия) | `{ ok: true }`, чистит cookie |
| POST | `/lk/auth/magic-link` | `{ email }` | `{ sent: true }` (всегда, чтобы не палить наличие email) |
| GET | `/lk/auth/magic-link/verify?token=` | `token` из письма | ставит cookie → **302 redirect** `/lk/dashboard` |
| GET | `/lk/auth/google` | — | 302 на Google OAuth |
| GET | `/lk/auth/google/callback` | от Google | ставит cookie → 302 `/lk/dashboard` |
| GET | `/lk/auth/session` | (нужна сессия) | `{ user_id, tenant_id, role, expires_at }` или 401 |

**Ошибки login:** `MISSING_FIELDS` (400), `INVALID_CREDENTIALS` (401, одинаково для плохого email и пароля —
без enumeration), `TENANT_BLOCKED` (403), `TOO_MANY_REQUESTS` (429, лимит 5 попыток / 15 мин на IP),
`INTERNAL_ERROR` (500).

**Роли (`role`)** влияют на доступ к части эндпоинтов ЛК: `owner` (полный), `manager` (активация
интеграций/воркфлоу), прочие — чтение. Проверка `requireRole(...)` на сервере, но сайту стоит
дублировать в UI (скрывать кнопки).

---

## 3. Тарифы, лимиты и фичи (единый источник — license-service)

Канонические коды планов (везде в API): **`trial` · `starter` · `business` · `professional` · `enterprise`**
(5 планов — добавлен **`business`**). **Единый источник для сайта — `GET /lk/plans`** (публичный,
без сессии, см. раздел «Подтверждённые эндпоинты»). Матрица лимитов дублируется в
`license-service/src/jwt-generator.js → PLAN_LIMITS` (то, что кладётся в JWT) и
`lk-api/src/config/plans.js` (каталог с ценами/названиями для сайта) — держатся синхронно.

| Лимит / фича | trial | starter | **business** | professional | enterprise |
|---|---|---|---|---|---|
| `title` | Пробный | Старт | **Бизнес** | Профессиональный | Корпоративный |
| `projects` | 1 | 3 | **10** | 30 | ∞ (99999) |
| `users_per_company` | 1 | 1 | **5** | 10 | ∞ |
| `monthly_operations` | 150 | 5 000 | **30 000** | 150 000 | ∞ |
| `n8n_executions_month` | 500 | 500 | **10 000** | 20 000 | ∞ |
| `n8n_concurrent` | 2 | 2 | **5** | 10 | ∞ |
| `log_retention_days` | 7 | 7 | **30** | 90 | 36500 |
| `is_trial` | ✅ | — | — | — | — |
| feature `n8n_ui` (UI-конструктор n8n) | ❌ | ❌ | **❌** | ✅ | ✅ |
| feature `git_sync` | ❌ | ❌ | ❌ | ❌ | ✅ |
| feature `sso` | ❌ | ❌ | ❌ | ❌ | ✅ |
| feature `api_access` | ❌ | ❌ | ❌ | ❌ | ✅ |

`enabled_modules` (какие группы интеграций доступны) сейчас одинаковы для всех планов:
`['marketplace', 'crm', 'services', 'social', 'analytics']`.

### Цены (₽) — единый источник `config/plans.js` (env `PRICE_MAP` переопределяет)

| План | monthly | yearly |
|---|---|---|
| trial | 0 | 0 |
| starter | 990 | 9 500 |
| **business** | **2 490** | **24 900** |
| professional | 4 990 | 47 900 |
| enterprise | 19 900 | 190 000 |

> ✅ **Расхождение устранено (2026-07-26):** введён единый каталог `lk-api/src/config/plans.js`
> (коды/названия/цены/лимиты/фичи), из него берут и биллинг, и публичный `GET /lk/plans`. Названия
> согласованы со спекой F3 (Старт/Бизнес/Профессиональный/Корпоративный). **Сайт хардкодить прайс
> не должен — только `GET /lk/plans`.**

---

## 4. JWT-токен лицензии (что показывать и как обновлять)

JWT — это «ключ», который пользователь вставляет в .epf-модуль 1С. Генерируется license-service
(`RS256` в prod, `HS256` в dev), внутри — `tenant_id`, `plan`, `limits`, `features`,
`enabled_modules`, `valid_until`, `exp`, `jti`. Хранится в `platform.licenses.jwt_token` и
`platform.refresh_tokens`. **Полный JWT в ЛК-API намеренно НЕ отдаётся** (только маскированный).

### Эндпоинты токена (lk-api)

| Метод | Путь | Роль | Ответ |
|---|---|---|---|
| GET | `/lk/token` | любая | `{ expires_at, days_left, plan, masked_token }` (`masked_token` = `xxxxxxxx...xxx`) |
| POST | `/lk/token/refresh` | `owner` | продлевает лицензию, возвращает тот же формат, что GET |

`refresh` требует **подтверждённого платежа** (`platform.payments.status='confirmed'`), иначе
`402 NO_ACTIVE_SUBSCRIPTION`. Делегирует выдачу в license-service `POST /internal/v1/license/issue`.

### Проверка лицензии из .epf (для справки, не для сайта)
`GET /api/v1/license/check` (Bearer JWT) → `{ status: active|trial|expired|blocked, plan, is_trial,
valid_until, days_remaining, enabled_modules, limits, features }`. `.epf` вызывает при каждом старте.

### Как выдаётся полный токен пользователю
Полный JWT рождается при **выдаче лицензии** (`issueLicense`): при подтверждении платежа (webhook),
при grant-trial из админки, при первичной активации. Если сайту нужно показать пользователю **полный**
JWT для копирования в .epf — сейчас lk-api его не отдаёт (только masked). Варианты:
1. Пользователь получает JWT письмом/в момент выдачи (согласовать с backend).
2. Добавить серверный эндпоинт «показать полный токен owner-у» (запросить у backend, есть риск-нюанс).

**Не изобретать генерацию JWT на сайте** — только сервер владеет ключом подписи.

---

## 5. Личный кабинет — полный API (lk-api, cookie `lk_session`)

Все пути ниже требуют валидной сессии (иначе 401). Ответы — JSON. Ошибки в формате `{ error: CODE }`.

### 5.1 Dashboard — `GET /lk/dashboard`
```json
{
  "plan": "professional",
  "company_name": "ООО Ромашка",
  "days_left": 21,
  "valid_until": 1737590400,        // unix seconds (или null)
  "integrations_count": 4,          // активных интеграций
  "executions_this_month": 0        // ⚠ сейчас всегда 0 (usage-счётчик см. §6)
}
```
> Для реального счётчика запусков n8n используйте `/lk/n8n/usage` (§6), а не поле dashboard.

### 5.2 Биллинг — `/lk/billing` (роль `owner`)

| Метод | Путь | Тело | Ответ |
|---|---|---|---|
| GET | `/lk/billing` | — | массив платежей `[{ id, amount, status, plan, period, robokassa_inv_id, created_at }]` (последние 50) |
| POST | `/lk/billing/pay` | `{ plan, period }` | `{ payment_url, external_payment_id, amount }` — редиректить пользователя на `payment_url` |

- `plan` ∈ `trial|starter|professional|enterprise`; `period` ∈ `monthly|yearly`.
- Если платёжка не настроена на сервере (`ROBOKASSA_MERCHANT_LOGIN` пуст) → `{ payment_url: null,
  message: "Платёжная система настраивается" }`. Сайт должен обработать этот кейс (показать заглушку).
- Ошибки: `MISSING_FIELDS` (400), `INVALID_PLAN` (400), `INVALID_PERIOD` (400).
- `status` платежа: `pending` → `confirmed` (после вебхука платёжки) / `refunded`.

**Как активируется тариф после оплаты:** пользователь платит на стороне Robokassa/ЮKassa →
платёжка шлёт вебхук на `POST /api/v1/webhooks/payment/:integration_id` → сервер проверяет
подпись/IP, ставит платёж `confirmed`, вызывает `issueLicense` → у tenant меняется `plan` и
`valid_until`, генерится новый JWT. **Сайту делать ничего не нужно** — после возврата с платёжки
достаточно перечитать `/lk/dashboard` и `/lk/token` (может быть задержка до прихода вебхука —
показывать «ожидаем подтверждение оплаты» и опрашивать).

### 5.3 Интеграции — `/lk/integrations`

| Метод | Путь | Роль | Тело | Назначение |
|---|---|---|---|---|
| GET | `/lk/integrations` | любая | — | список интеграций tenant (ключи **не** возвращаются) |
| POST | `/lk/integrations/:id/credentials` | `owner`/`manager` | `{ adapter_type, api_key, api_secret?, extra? }` | сохранить ключи (шифруются AES-256-GCM, F7) |
| DELETE | `/lk/integrations/:id` | `owner` | — | удалить интеграцию |

- `adapter_type` — код адаптера (`ozon`, `wb`, `ym`, `bitrix24`, `amocrm`, `cdek`, `yukassa`,
  `telegram`, `google_sheets`, …; полный список из 33 адаптеров — в README «CC1»).
- Ключи никогда не возвращаются в открытом виде. В UI показывать «ключ сохранён / замаскирован».
- Ошибки: `MISSING_FIELDS` (400), `INTERNAL_ERROR` (500).

> Есть **параллельный** набор для интеграций на bridge (Bearer JWT, для .epf/Мастера):
> `GET/POST /api/v1/integrations`, `POST /api/v1/integrations/:id/verify` (реальная проверка живости
> ключей). Сайт по cookie-сессии использует `/lk/integrations`; `verify` пока только под JWT —
> если нужен «проверить ключи» из ЛК, запросить у backend cookie-версию `verify`.

### 5.4 Каталог воркфлоу и запуски — `/lk/workflows`

| Метод | Путь | Роль | Ответ |
|---|---|---|---|
| GET | `/lk/workflows/catalog` | любая | `[{ template_id, name, description, required_integrations[], tags[] }]` |
| POST | `/lk/workflows/activate` | `owner`/`manager` | `{ workflow_id, name, active, webhook_url }` |
| GET | `/lk/workflows/executions` | любая | `[{ workflow_name, execution_id, status, startedAt, duration_ms }]` |

- `activate` тело: `{ template_id, integration_id }`. Сервер проверяет, что нужные интеграции
  (`required_integrations`) активны у tenant, клонирует шаблон в n8n, тегирует `tenant_id:<id>`.
- Ошибки activate: `MISSING_FIELDS` (400), `TEMPLATE_NOT_FOUND` (404),
  `MISSING_REQUIRED_INTEGRATION` (409, + поле `missing[]`), `N8N_CREATE_FAILED` (502).

### 5.5 Логи (аудит) — `GET /lk/logs`
Параметры: `?action=&from=&to=&limit=` (limit ≤ 500, по умолч. 100). Возвращает строки
`platform.audit_log` tenant-а: `[{ id, action, actor, entity_type, entity_id, new_value, created_at }]`.
Примеры `action`: `license_issued`, `license_refreshed`, `payment_confirmed`, `integration_created`,
`integration_activated`, `integration_deactivated`. Учитывать `log_retention_days` тарифа (§3).

### 5.6 Скачивание .epf — `GET /lk/epf/download?config=`
`config` ∈ `ut11|unf|ka|bp`. Ответ: `{ token, version, sha256, expires_in: 600, download_url }`.
Сайт даёт пользователю кнопку → переходит на `download_url` (`/cdn/epf/download?token=...`),
Nginx отдаёт файл по X-Accel-Redirect. Токен одноразовый, TTL 600 с. Ошибка: `INVALID_CONFIG`
(400, + `allowed[]`).

---

## 6. Отображение n8n — для ПОЛЬЗОВАТЕЛЯ

Есть два уровня показа n8n в ЛК:

### 6.1 «Мягкий» показ через lk-api (cookie-сессия) — по умолчанию
Используйте `/lk/workflows/*` (§5.4): каталог шаблонов, активация, история запусков. Пользователь
**не** видит внутренний UI n8n — только карточки воркфлоу и их запуски. Это работает на любом тарифе.

### 6.2 Богатый конструктор через bridge `/lk/n8n/*` (Bearer JWT)
Отдельный набор (`server/routes/lk_n8n.js`), защищён **Bearer JWT** (не cookie), rate-limit 60/мин на tenant.
Предназначен в первую очередь для Мастера в .epf, но сайт может использовать его, если получит JWT tenant-а.

| Метод | Путь | Назначение |
|---|---|---|
| GET | `/lk/n8n/workflows` | воркфлоу tenant-а; если фича `n8n_ui` включена (проф/энтерпрайз) — добавляет `n8n_ui_url` (ссылка в UI n8n `/workflow/:id`) |
| GET | `/lk/n8n/templates` | метаданные шаблонов (без сырого JSON) |
| POST | `/lk/n8n/integrations/:id/activate` | `{ integration_type, credentials }` → создаёт credential в n8n + provision воркфлоу |
| DELETE | `/lk/n8n/integrations/:id` | деактивация (только `role=owner`) |
| GET | `/lk/n8n/executions?workflow_id=&limit=` | история запусков воркфлоу (проверка владения) |
| GET | `/lk/n8n/usage` | **счётчик выполнений и лимит текущего месяца** — для прогресс-бара лимита |

**Показ прямого UI n8n:** доступ к `/n8n/*` (проксируется Nginx) должен открываться только тем,
у кого `features.n8n_ui === true` (professional/enterprise). Для остальных — прятать раздел
«Открыть в n8n», показывать только карточки/историю (6.1). `n8n_ui_url` из `/lk/n8n/workflows`
уже отдаётся только при включённой фиче — опирайтесь на его наличие.

**Лимиты запусков.** При достижении `n8n_executions_month` сервер деактивирует воркфлоу тенанта.
Сайт должен показывать `used/limit` из `/lk/n8n/usage` и предупреждать заранее. Сброс лимита —
1-го числа месяца (cron) либо вручную из админки (§7).

---

## 7. Admin-панель — что доступно администратору (admin, `/admin/*`)

Отдельный сервис, доступ: **IP-whitelist (Nginx) + email/bcrypt + TOTP 2FA** → cookie `admin_session_id`.
Это **не** пользовательский ЛК. Если `corebridge-site` рендерит и админку — это отдельный раздел с
отдельным логином. Все ответы JSON, все роуты (кроме `/admin/auth/*`) требуют admin-сессию.

### 7.1 Аутентификация админа — `/admin/auth/*`
Логин по email+пароль+TOTP (см. `admin_auth.service.js`). Сессия TTL `ADMIN_SESSION_TTL` (8 ч),
Redis DB=2.

### 7.2 Тенанты — `/admin/tenants`

| Метод | Путь | Назначение |
|---|---|---|
| GET | `/admin/tenants?page=&limit=&status=&plan=` | список тенантов (пагинация ≤200) |
| POST | `/admin/tenants/:id/block` | заблокировать (пользователи не смогут войти → `TENANT_BLOCKED`) |
| POST | `/admin/tenants/:id/unblock` | разблокировать |
| POST | `/admin/tenants/:id/issue-token` | выдать/перевыпустить JWT tenant-у |
| GET | `/admin/tenants/:id/tokens` | история токенов tenant-а |

### 7.3 Тарифы/триал/платежи — `/admin/*` (billing)

| Метод | Путь | Назначение |
|---|---|---|
| POST | `/admin/tenants/:id/grant-trial?days=14` | выдать триал (по умолч. 14 дней) — создаёт лицензию+JWT |
| GET | `/admin/payments?tenant_id=&status=&from=&to=&limit=&offset=` | список платежей |
| POST | `/admin/payments/:id/refund` | возврат платежа |

**Смена тарифа/лимитов вручную** делается через выдачу лицензии (`grant-trial` / `issue-token`) —
меняет `plan` в `platform.tenants` и перевыпускает JWT с новыми `limits`/`features`. Отдельного
«поменять план кнопкой» нет — либо через оплату (webhook), либо через админ-выдачу лицензии.

### 7.4 Очереди и DLQ — `/admin/queues`, `/admin/dlq`
Мониторинг очереди событий и Dead Letter Queue (необработанные после 3 ретраев), реобработка.
Для сайта-админки: показ глубины очередей, ручной reprocess.

### 7.5 EPF — `/admin/epf`
Управление версиями .epf-модуля (загрузка/активация/публичность).

### 7.6 n8n для АДМИНА — `/admin/n8n/*`
Кросс-тенантный обзор и управление n8n (admin_n8n.js). Отличия от пользовательского: tenant_id
берётся из URL (админ видит любого), нет rate-limit, доступ к сырому JSON шаблонов.

| Метод | Путь | Назначение |
|---|---|---|
| GET | `/admin/n8n/stats` | сводка по всем тенантам: `{ total_tenants, tenants_at_limit, total_executions_this_month, active_workflows }` + массив по тенантам |
| GET | `/admin/n8n/tenants/:tenant_id/workflows` | воркфлоу любого тенанта |
| PATCH | `/admin/n8n/workflows/:id/activate` | принудительно включить воркфлоу (игнорируя лимит) |
| PATCH | `/admin/n8n/workflows/:id/deactivate` | выключить воркфлоу |
| POST | `/admin/n8n/tenants/:tenant_id/reset-limit` | сбросить флаг лимита + реактивировать воркфлоу тенанта |
| GET | `/admin/n8n/templates` | шаблоны с **полным** JSON (nodes/connections) + метаданные файла |
| POST | `/admin/n8n/templates` | создать/обновить шаблон `{ name, content }` (валидирует `nodes[]`, `tags[]`) |
| DELETE | `/admin/n8n/templates/:name` | удалить шаблон (409 `TEMPLATE_IN_USE`, если используется тенантами) |

Все мутации админа пишутся в `platform.audit_log` (`admin_n8n_*`, `admin:<email>` как actor).

---

## 8. Проекты интеграции (Мастер подключений, F16) — Bearer JWT (bridge)

Не путать с воркфлоу. «Проект» = связка `config (тип 1С) + service + mechanics + integration keys`,
из которого сервер авто-провизионит n8n-воркфлоу. Создаётся из .epf (Bearer JWT), но сайт может
отображать/создавать при наличии JWT tenant-а.

| Метод | Путь | Тело/ответ |
|---|---|---|
| POST | `/api/v1/projects` | `{ name, config, service?, mechanics[], credentials? }` → `201 { project_id, service, mechanics_active, ... }` |
| GET | `/api/v1/projects` | список проектов tenant-а |
| GET | `/api/v1/projects/:id` | детали проекта |

`config` ∈ `ut11|unf|ka|bp|...`. Лимит числа проектов = `limits.projects` тарифа (§3).

---

## 9. Сводная карта эндпоинтов для сайта

> 📖 **Полный реестр ВСЕХ эндпоинтов сервера** (282 маршрута, все сервисы) —
> [`docs/API_ENDPOINTS.md`](../API_ENDPOINTS.md). Ниже — только срез для сайта.

**Через cookie `lk_session` (основное для ЛК):**
```
POST   /lk/auth/login
POST   /lk/auth/logout
POST   /lk/auth/magic-link
GET    /lk/auth/magic-link/verify
GET    /lk/auth/google  ·  GET /lk/auth/google/callback
GET    /lk/auth/session
GET    /lk/dashboard
GET    /lk/billing            ·  POST /lk/billing/pay
GET    /lk/token             ·  POST /lk/token/refresh
GET    /lk/integrations      ·  POST /lk/integrations/:id/credentials  ·  DELETE /lk/integrations/:id
GET    /lk/workflows/catalog ·  POST /lk/workflows/activate  ·  GET /lk/workflows/executions
GET    /lk/logs
GET    /lk/epf/download
GET    /lk/plans                (публичный, без сессии — см. §9b)
GET/PATCH /lk/profile           (§9b)
GET    /lk/token/full           (owner — §9b)
POST   /lk/integrations/:id/pause · /resume   (§9b)
GET    /lk/dashboard/activity   (§9b)
```
**Через Bearer JWT tenant-а (опционально, богатый n8n / проекты / license):**
```
GET/POST/DELETE /lk/n8n/*        (workflows, templates, integrations, executions, usage)
POST/GET        /api/v1/projects
GET/POST        /api/v1/integrations  ·  POST /api/v1/integrations/:id/verify
GET             /api/v1/license/check ·  POST /api/v1/license/refresh
```
**Админка (cookie `admin_session_id` + 2FA + IP-whitelist):**
```
/admin/auth/*  ·  /admin/tenants/*  ·  /admin/payments/*  ·  /admin/tenants/:id/grant-trial
/admin/queues  ·  /admin/dlq  ·  /admin/epf  ·  /admin/n8n/*
```

---

## 9b. Подтверждённые эндпоинты (РЕАЛИЗОВАНЫ на сервере, 2026-07-26)

Эти 5 эндпоинтов **реализованы и покрыты тестами** (lk-api). Сайт может мокать их по этим контрактам —
пути и схемы финальные.

### `GET /lk/plans` — публичный прайс (без сессии)
```
GET /lk/plans
→ 200 { "plans": [
    { "code":"trial", "title":"Пробный", "price":{"monthly":0,"yearly":0}, "is_trial":true,
      "limits":{"projects":1,"users_per_company":1,"monthly_operations":150,
                "n8n_executions_month":500,"n8n_concurrent":2,"log_retention_days":7},
      "features":{"n8n_ui":false,"git_sync":false,"sso":false,"api_access":false} },
    { "code":"starter", ... }, { "code":"business", ... },
    { "code":"professional", ... }, { "code":"enterprise", ... }
] }
```
Порядок массива = порядок отображения. `Cache-Control: public, max-age=300`.

### `GET /lk/profile` · `PATCH /lk/profile` — профиль + реквизиты
```
GET /lk/profile   (cookie)
→ 200 {
    "user":    { "id","email","name","phone","role","auth_provider":"password"|"google" },
    "company": { "company_name","company_inn","company_kpp","company_address" }   // null если не задано
  }

PATCH /lk/profile   (cookie)  body любые из:
  { "name"?, "phone"?, "company_name"?, "company_inn"?, "company_kpp"?, "company_address"? }
→ 200 { тот же объект, что GET }
errors: 400 NOTHING_TO_UPDATE · 403 FORBIDDEN (не-owner меняет company_*) · 404 USER_NOT_FOUND · 401
```
`auth_provider="google"` → в UI блок «Пароль» скрыть/задизейблить (у Google-аккаунтов пароля нет).

### `GET /lk/token/full` — полный JWT для .epf (только owner)
```
GET /lk/token/full   (cookie; role=owner)
→ 200 { "token":"eyJ...полный JWT...", "valid_until": 1737590400 }   // unix seconds | null
errors: 403 FORBIDDEN (не owner) · 404 TOKEN_NOT_FOUND (нет активной лицензии) · 401
```
Каждый вызов пишется в `audit_log` (`token_revealed`). `GET /lk/token` (masked) остаётся для обычного показа.

### `POST /lk/integrations/:id/pause` · `/resume` — пауза интеграции (owner/manager)
```
POST /lk/integrations/:id/pause   → 200 { "integration_id":"MP_001", "status":"paused", "paused":true }
POST /lk/integrations/:id/resume  → 200 { "integration_id":"MP_001", "status":"active", "paused":false }
errors: 404 INTEGRATION_NOT_FOUND · 403 FORBIDDEN · 401
```
`pause` останавливает polling (`adapter_state.is_active=false`), конфиг сохраняется (это НЕ удаление).

**Обогащённый `GET /lk/integrations`** (обновлён — теперь отдаёт больше полей):
```
→ 200 [{ "integration_id":"MP_001", "adapter_type":"ozon", "display_name":"Основной Ozon"|null,
         "status":"active"|"paused"|"error", "paused":false, "error_count":0,
         "last_sync_at":"2026-07-20T10:00:00Z"|null, "created_at":"..." }]
```
`status`: `paused` (пользователь поставил на паузу) · `error` (`error_count>=5`, авто-стоп F5) · иначе `active`.
Поля `contractor_name`/`warehouse_name`/`requests_this_month` (из C7 ответа) — **пока не отдаются**
(отдельный бэклог), проектируйте карточку с их опциональностью.

### `GET /lk/dashboard/activity` — временной ряд для графика
```
GET /lk/dashboard/activity?range=7d|30d   (cookie; по умолчанию 7d)
→ 200 { "range":"7d", "points":[ { "date":"2026-07-20", "ok":120, "error":3, "total":123 }, ... ] }
```
Всегда ровно `range` точек (пропущенные дни = нули), по возрастанию даты. Источник — `audit_log`
(ok/error по типу действия). Для ленты последних событий используйте `GET /lk/logs?limit=N` (§5.5).

---

## 9c. Реализовано (второй пакет, 2026-07-26) — команда, пароль, usage, admin, версии .epf

Ещё один пакет из бэклога `answers_from_server.md`, реализован и покрыт тестами (lk-api 42, admin 32).

### A2 — `POST /lk/profile/password` (смена пароля)
```
POST /lk/profile/password   (cookie)  body { "current_password", "new_password" }
→ 200 { "ok": true }
errors: 400 MISSING_FIELDS · 400 WEAK_PASSWORD (мин. 8) · 401 INVALID_CURRENT_PASSWORD ·
        409 GOOGLE_ACCOUNT (у google-аккаунта нет пароля — вход через OAuth/magic-link) · 404 · 401
```
Смена email — **пока не реализована** (нужен token+email flow, остаётся в бэклоге).

### J28 — n8n usage в `GET /lk/dashboard` (счётчик больше не заглушка)
Ответ дашборда дополнен реальным usage из `platform.usage_counters`:
```
GET /lk/dashboard → 200 { ...прежние поля...,
  "executions_this_month": 1234,           // теперь реальное число (было 0)
  "n8n_usage": { "used":1234, "limit":30000, "is_limit_hit":false, "period":"2026-07" }
}
```

### A3 — Команда (пользователи tenant). Инфраструктура приглашений — на `platform.users` (миграция 007)
```
GET    /lk/users                 (cookie) → 200 { users:[{id,email,name,role,auth_provider,
                                                   status:"active"|"invited",invitation_expires_at,created_at}] }
POST   /lk/users/invite          (owner)  body {email, role:"manager"|"user"}
       → 201 { invite_id, email, role, status:"invited", token, invite_url, expires_at }
       errors: 400 INVALID_ROLE/MISSING_EMAIL · 402 USERS_LIMIT_REACHED (+limit) · 409 USER_EXISTS · 403
POST   /lk/users/accept          (публичный, по токену) body {token, name, password}
       → 200 { user_id, tenant_id, role } + ставит cookie lk_session
       errors: 400 MISSING_FIELDS/WEAK_PASSWORD · 404 INVITE_INVALID · 410 INVITE_EXPIRED
PATCH  /lk/users/:id/role         (owner)  body {role} → 200 {id,role}
       errors: 400 INVALID_ROLE · 404 USER_NOT_FOUND · 409 LAST_OWNER
DELETE /lk/users/:id              (owner)  → 200 {ok:true}
       errors: 404 USER_NOT_FOUND · 409 LAST_OWNER · 409 CANNOT_DELETE_SELF
```
Лимит `users_per_company` берётся из тарифа (§3). `token`/`invite_url` возвращаются пригласившему —
можно скопировать ссылку; также уходит письмо (если настроен SMTP). Токен хранится как SHA-256 хеш.
`accept` через ссылку вида `${LK_BASE_URL}/lk/invite/accept?token=...` — **сайту нужна страница
`/lk/invite/accept`**, которая примет `token`, соберёт форму (имя+пароль) и вызовет `POST /lk/users/accept`.

### I23 — `GET /lk/epf/versions?config=` (список версий / «что нового»)
```
GET /lk/epf/versions?config=ut11   (cookie)
→ 200 { "config":"ut11", "versions":[
    { "version":"1.2.0", "release_notes":"...", "sha256":"...", "file_size":1048576,
      "force_update":false, "released_at":"...", "is_active":true } ] }
errors: 400 INVALID_CONFIG (+allowed[])
```
`config` ∈ `ut11|unf|ka|bp`, отсортировано по `released_at` DESC, без deprecated.

### H19 — `GET /admin/stats` (сводный админ-дашборд, admin-сессия)
```
GET /admin/stats
→ 200 {
  "tenants":  { "total":8, "by_status":{"active":7,"blocked":1}, "by_plan":{"trial":3,"business":5,...} },
  "revenue":  { "month_confirmed":12000, "year_confirmed":95000 },   // ₽, payments.status='confirmed'
  "integrations": { "active_total":6, "by_adapter":{"ozon":4,"wb":2} }
}
```

### H21 — `GET /admin/integrations` (кросс-тенантный обзор, admin-сессия)
```
GET /admin/integrations?tenant_id=&adapter_type=&status=active|paused|error|deleted&page=&limit=
→ 200 { "integrations":[{ tenant_id, company_name, integration_id, adapter_type, display_name,
        status:"active"|"paused"|"error"|"deleted", last_used_at, error_count }], "count" }
```

> **C6 (`POST /lk/integrations` — создание интеграции) сознательно НЕ реализован** в этом пакете:
> таблица `marketplace.adapter_configs` имеет `encrypted_config NOT NULL` и жёсткий CHECK на
> `adapter_type` (10 типов), который в проде рассинхронизирован с фактическими 33 адаптерами (пишет
> bridge). Создание «пустой» интеграции требует согласованного изменения схемы (nullable
> `encrypted_config` + релаксация/расширение CHECK, скоординированно с bridge). **Нужно решение по схеме.**
> Пока интеграции создаются через `POST /lk/integrations/:id/credentials` (id задаёт клиент) или
> `/api/v1/projects` (Мастер в .epf).

---

## 10. Открытые вопросы к backend (согласовать до реализации сайта)

1. **Публичная регистрация email+пароль.** Нет `POST /lk/auth/register`. Нужен ли self-serve signup
   без Google? Если да — новый серверный эндпоинт. *(ещё открыт)*
2. ✅ **РЕШЕНО.** Прайс и названия планов — единый источник `config/plans.js`, публичный `GET /lk/plans`
   (см. §9b). Добавлен 5-й тариф **business** (2 490 ₽). Названия согласованы со спекой F3.
3. ✅ **РЕШЕНО.** Полный JWT — `GET /lk/token/full` (owner-only, аудируется; см. §9b).
4. **`verify` интеграции по cookie.** Реальная проверка ключей сейчас только под Bearer JWT
   (`/api/v1/integrations/:id/verify`). Нужна ли cookie-версия для ЛК? *(ещё открыт)*
5. ✅ **РЕШЕНО.** `executions_this_month` в `/lk/dashboard` теперь реальный (+ объект `n8n_usage`,
   §9c). График активности — `GET /lk/dashboard/activity` (§9b).
6. **CORS-origin.** Подтвердить, что lk-api/admin разрешают origin `https://corebridge.ru` с
   `credentials: include`. *(ещё открыт — инфраструктурное)*
7. **Прод-статус n8n-роутов.** F6.7 / F6.7-A задеплоены; подтвердить, что `/lk/n8n/*` и `/admin/n8n/*`
   смонтированы за Nginx на проде именно по этим внешним путям. *(ещё открыт)*

> Прочий крупный бэклог (профиль-пароль/email, команда+invite, сессии-листинг, API-ключи cb_*,
> тикеты поддержки, уведомления, admin stats/admins/integrations, публичный contact/register) —
> в файле `answers_from_server.md`. В этой итерации закрыты: **business-тариф, `/lk/plans`,
> `/lk/profile`, `/lk/token/full`, pause/resume + обогащённый список интеграций, `/lk/dashboard/activity`**.
