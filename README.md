# corebridge-site

Сайт и Личный кабинет **CoreBridge** — `corebridge.ru`. Next.js (App Router) + TypeScript.
Backend живёт отдельно в `/opt/corebridge` (репозиторий `corebridge-server`) и **вручную не правится**:
там настроен автодеплой с локального ПК, любые ручные изменения затираются. Нужны правки бэкенда →
готовится промт в `Documents/prompts/` для передачи локальному claude-code.

## Цель

Работающий сайт `corebridge.ru`, визуально **1:1** с готовым дизайном (40 файлов в `design-source/`),
с живым бэкендом: авторизация, тарифы, оплаты, JWT для .epf, интеграции, n8n, админка.

---

## Топология (принято 2026-07-26)

**Single-origin на том же VPS** — сайт и API за одним nginx, CORS не нужен, cookie `lk_session`
остаётся same-origin, бэкенд менять не требуется.

```
corebridge.ru        ─┬─ /lk/*      → 127.0.0.1:3000  (corebridge-lk-api,   Docker)
                      ├─ /api/v1/*  → 127.0.0.1:3001  (corebridge-bridge,   Docker)
                      └─ /          → 127.0.0.1:3005  (next start, systemd) ← этот репозиторий

admin.corebridge.ru  ─┬─ /admin/*   → 127.0.0.1:3003  (corebridge-admin,    Docker)
                      └─ /          → 127.0.0.1:3005  (next start, route group (admin))

api.corebridge.ru    ─── как было, не трогаем (работает, сертификат валиден)
```

- `NEXT_PUBLIC_API_BASE=''` — пути к API такие же, как в контракте, без префикса.
- Порт **3005**, потому что 3000 занят контейнером `corebridge-lk-api`.
- nginx — **на хосте** под systemd (`/etc/nginx`), не в Docker. Docker-вариант в
  `/opt/corebridge/nginx/` не используется. Копии наших vhost-конфигов — в `deploy/`.

## Стек

| Слой | Решение | Почему |
|---|---|---|
| Фреймворк | Next.js 14 App Router + TypeScript | по арх-доке |
| Стили | **готовый `site.css` как есть**, без Tailwind и без shadcn/ui | дизайн уже готов на чистом CSS с токенами; Tailwind preflight ломает попиксельное совпадение (`implementation_strategy.md` §3) |
| Шрифты | Inter (400–800) + JetBrains Mono | из `site.css` |
| Данные | `fetch` + SWR, `credentials: 'include'` | cookie-сессия |
| Типы API | `lib/contracts/*.ts` локально | git-submodule `contracts` **не заводим** — дублировал бы существующие механики сервера (решение Дмитрия) |
| Тесты | Vitest (контрактные/unit) + Playwright (e2e) + MSW (моки) | разработка через тесты |
| Процесс | systemd-юнит `corebridge-site.service` | как и остальная платформа |

---

## Состояние на 2026-07-28

| Что | Статус |
|---|---|
| Документы прочитаны, gap-анализ, промты бэкенду S1–S7 | ✅ |
| **Бэкенд: пакеты S1–S7 реализованы и на проде** | ✅ `server_ask/site_S1_S7_RESPONSE.md` |
| DNS `corebridge.ru`/`www`/`admin` → `77.90.61.5` | ✅ |
| Сертификат `corebridge.ru` + `www` (до 24.10.2026) | ✅ |
| nginx vhost `corebridge.ru`: `/lk/*` → 3000, `/` → 3005, `/internal/` → 403 | ✅ |
| Почта: Postfix + OpenDKIM, SPF/DKIM/DMARC/PTR | ✅ |
| Яндекс ID: приложение зарегистрировано, `YANDEX_*` в `.env` | ✅ |
| Telegram-бот `@CoreBridgeRu_bot`, вебхук зарегистрирован | ✅ |
| Приём почты: postfix virtual-домен → пересылка на Gmail, проверен с внешнего адреса | ✅ ждёт MX-записи |
| **Исходники дизайна в `design-source/`** | ✅ **27 страниц + 8 assets** |
| Разбор дизайна: `design_findings.md` (70 КБ), `legal_corrections.md` | ✅ |
| Промты бэкенду S1–S9 | ✅ **все реализованы и проверены на проде** |
| Миграции 022–024 применены | ✅ сверено по `platform.schema_migrations` |
| Приём почты: MX + сквозной тест до Gmail | ✅ |
| cron фазы 2 удаления аккаунтов | ✅ `/etc/cron.d/corebridge-purge`, 03:30 UTC |
| **Каркас Next.js пересобран под E0** | ✅ 26 маршрутов, Tailwind/shadcn/src удалены |
| **`https://corebridge.ru` открывается** | ✅ systemd `corebridge-site.service`, порт 3005 |
| `lib/contracts` + `lib/api` по фактическому API | ✅ |
| Спеки P01–P11 и механики MC1–MC14 | 🔄 скачан P01 |
| Компоненты `Sidebar`/`Topbar`/`Popup` из `shell.js` | ⬜ |
| `middleware.ts` (guard ЛК, разводка субдоменов) | ⬜ |
| Vitest + Playwright + MSW | ⬜ |
| vhost `admin.corebridge.ru` | ⬜ |
| Перенос вёрстки 1:1 (Э1–Э8) | ⬜ |

### Открытые зависимости

1. **Robokassa ждёт готовый сайт целиком.** Дмитрий (2026-07-28): merchant ID не выдадут, пока
   сайт не реализован полностью — кроме оплат и поддержки. Одних юридических документов
   недостаточно. Поэтому биллинг (Э4) — **последний** этап, а не второй.
2. ✅ **Закрыто.** MX добавлен, приём почты работает: письмо на `info@corebridge.ru` дошло до
   Gmail (`status=sent 250 2.0.0 OK`), подтверждено. `mailto:` у Энтерпрайза всё равно заменяю
   на форму `POST /lk/contact` с `source: "pricing"` — заявка получает номер `REQ-NNNN` и не
   теряется, даже если почта ляжет.
3. **Диспетчер уведомлений F17 + миграция 023 на прод не раскатаны.** Настройки уведомлений
   сохраняются, но события пока не рассылаются. Подписи в UI формулировать нейтрально.
4. **Админка: IP динамический.** В `.env` два адреса (`109.194.102.43`, `188.130.154.24`),
   но в `api.corebridge.ru.conf` в `location /admin/` разрешён только второй. Тот файл —
   симлинк в `/opt/corebridge`, править нельзя → в своём vhost `admin.corebridge.ru`
   пропишу оба адреса. При смене IP доступ отвалится, это ожидаемо.

## История: состояние на 2026-07-26

| Что | Статус |
|---|---|
| Документы проекта прочитаны | ✅ |
| Карта расхождений дизайн↔сервер | ✅ `Documents/gap_analysis.md` |
| Инструкция ручных настроек для Дмитрия | ✅ `Documents/manual_setup.md` |
| Исходники дизайна скачаны в `design-source/` | 🔄 в процессе (`assets/site.css`, `assets/shell.js` — есть) |
| Каркас Next.js пересобран под E0 | ⬜ |
| nginx vhost + systemd + certbot | ⬜ **заблокировано DNS** (`manual_setup.md` §1) |

### Блокеры

1. **DNS.** `corebridge.ru` указывает на Vercel (`216.198.79.1`), а не на VPS (`77.90.61.5`).
   Пока не переключено — vhost поднять и сертификат выпустить нельзя.
   → Дмитрий, `Documents/manual_setup.md` §1.
2. **Google OAuth redirect URI** под `corebridge.ru` не зарегистрирован → `manual_setup.md` §2.

---

## План работ

Порядок мой, не по `E0_scaffold_handoff.md` буквально: там предполагалось, что почти всё живёт на
моках, а по факту **бóльшая часть API ЛК уже реальная** (см. `gap_analysis.md` §A). Поэтому идём
«сразу на real, мок только там, где эндпоинта нет».

> **Порядок пересмотрен 2026-07-28 (актуальный).** Уточнение Дмитрия: Robokassa требует не просто
> юридических документов, а **готового сайта целиком** — кроме оплат и поддержки. То есть merchant
> ID выдадут в конце, а не после публикации оферты.
>
> Следствия:
> - **Оплаты (Э4) уходят в конец.** Прайс-страницу собираем сразу — она читает `GET /lk/plans`
>   и нужна для «готового сайта»; не работает только само действие «Оплатить».
> - **Юр. страницы больше не приоритет №2** — делаем их в общем порядке со статикой (Э8).
> - Идём по экранам, у которых API уже полностью реальный: auth → дашборд и epf → интеграции →
>   настройки → админка → статика. Биллинг и поддержка — последними.
>
> Предыдущая версия порядка (юр. страницы вторыми ради Robokassa) — отменена.

### Э0 — Каркас и запуск сервера ← в основном сделан

1. Догрузить `design-source/` (40 файлов: 28 HTML + assets + спеки в `Documents/design/`).
2. Пересобрать каркас: убрать `src/`, Tailwind, shadcn; поднять `app/` с группами
   `(site)/(public)`, `(site)/(auth)`, `(site)/(lk)`, `(admin)`.
3. `public/assets/` ← копия `design-source/assets/` **как есть**; шрифты; `app/layout.tsx`.
4. `components/`: `<Sidebar>`, `<Topbar>`, `<AdminSidebar>`, `<AdminTopbar>`, `<Popup>`,
   `<PublicHeader>`, `<PublicFooter>` — перенос из `shell.js`/`popup.js` с идентичной разметкой.
5. `lib/api/` + `lib/contracts/` + `lib/mocks/` (MSW), переключатель `NEXT_PUBLIC_API_SOURCE`.
6. `middleware.ts`: разводка `admin.corebridge.ru` ↔ `corebridge.ru`, guard ЛК по
   `GET /lk/auth/session`.
7. Заглушки всех экранов по своим путям + smoke-тесты (Vitest + Playwright).
8. `deploy/`: `corebridge-site.service`, `nginx/corebridge.ru.conf`, `nginx/admin.corebridge.ru.conf`.
9. Поднять `next start` на 3005, проверить локально через `curl`.
10. **Коммит + push в GitHub.**
11. После переключения DNS: vhost + `certbot` → сайт открывается по HTTPS.

### Э1 — Auth

**Решение 2026-07-26:** основной вход — **email + пароль**; социальный вход — **Яндекс ID**.
Google удалён и на сервере (`/lk/auth/google*` → 404), и с сайта.

Всё ✅ real: `POST /lk/auth/login` · `POST /lk/auth/register` · `POST /lk/auth/magic-link` ·
`GET /lk/auth/yandex` · `POST /lk/auth/password/reset-request` · `POST /lk/auth/password/reset` ·
`GET /lk/auth/verify-email` · `POST /lk/auth/verify-email/resend`.

Плюс **новая страница `/lk/invite/accept`** (эндпоинт `POST /lk/users/accept` real) и
**кнопка magic-link, которой нет в дизайне** (см. `design_findings.md`).
Guard ЛК, обработка `TENANT_BLOCKED` 403 и `TOO_MANY_REQUESTS` 429.
Редирект после OAuth/magic-link — сервер ведёт на **`/dashboard`**.

### Э2 — Dashboard + epf

Всё ✅ real: `GET /lk/dashboard` (+`n8n_usage`), `GET /lk/dashboard/activity?range=7d|30d`,
`GET /lk/logs`; epf — `GET /lk/token/full` (owner), `POST /lk/token/refresh` (обработать `402
NO_ACTIVE_SUBSCRIPTION`), `GET /lk/epf/download?config=`, `GET /lk/epf/versions?config=`.
Карточки конфигураций: **УТ 11 / УНФ / КА-ERP / БП 3.0**, `config ∈ ut11|unf|ka|bp` (§8.3).

### Э3 — Интеграции

`GET /lk/integrations` (обогащённый), credentials, pause/resume, delete — ✅ real.
Кнопка «+ Добавить интеграцию» → `epf.html`, модалку каталога «Подключить» убрать (§8.1).
`POST /lk/integrations/:id/verify` ✅ real — невалидные ключи это `200 + ok:false`, не HTTP-ошибка.
Кнопка «Обновить токен» — по флагу `needs_reauth`; действие берётся из `reauth_action`
(сейчас всегда `"credentials_form"` → открывать форму ввода ключей, **не** редирект к провайдеру).
Поля `contractor_name`/`warehouse_name`/`requests_this_month` — верстать опционально, показывать «—».

### Э4 — Billing и оплата ← ПОСЛЕДНИМ, ждёт Robokassa

Эндпоинты готовы: `GET /lk/billing`, `POST /lk/billing/pay` ✅ real. Но `ROBOKASSA_*` в `.env`
пусты, и merchant ID выдадут только после готового сайта — поэтому этап **последний**.

До этого: страница биллинга показывает историю платежей и текущий тариф, а на любую попытку
оплаты — заглушку из `{ payment_url: null, message: "Платёжная система настраивается" }`.
Промо `first30` и `400 CUSTOM_PRICE_PLAN` для enterprise отрабатывают уже сейчас — проверки
плана идут **до** заглушки, коды ошибок настоящие.

**Прайс-страница (`pricing`) здесь не участвует** — она собирается в Э8 вместе со статикой,
читает `GET /lk/plans` и нужна для «готового сайта». Не работает только кнопка «Оплатить».

### Э5 — Settings

Профиль, пароль, команда, **уведомления, сессии** — всё ✅ real.
Уведомления: колонку SMS дизейблить (`sms.available: false`), Telegram — два состояния
(`available && !linked` → «Подключить», `linked` → чекбоксы + «Отвязать»), после открытия
deep-link опрашивать `GET /lk/notifications/telegram/status` раз в 2 с. Подписи формулировать
нейтрально — диспетчер F17 на прод пока не раскатан.
Смена email — 🟡 остаётся в бэклоге сервера. Блок API-ключей `cb_*` — **скрыт** (§8.5).
Ошибка смены пароля у Яндекс-аккаунта — код **`OAUTH_ACCOUNT`** (не `GOOGLE_ACCOUNT`).

### ⚠️ Коллизия путей в админке — решается в `middleware.ts`

Обнаружено 2026-07-28 при поднятии vhost. На `admin.corebridge.ru` путь `/admin/*`
**занят API** (nginx проксирует в `corebridge-admin:3003`), а Next.js по дереву
`app/(admin)/admin/` отдаёт UI по тому же `/admin`. Проверено:

```
/admin       → 301 Location: /admin/     (редирект Next.js)
/admin/      → 403                       (уже API, IP-whitelist)
```

То есть экран админки недостижим: браузер отбрасывает на путь API. Та же природа,
что у `/lk/*` на основном домене — префикс принадлежит бэкенду, не фронту.

**Решение (делать в Э0 вместе с `middleware.ts`):** на субдомене админки UI живёт в
корне, а не под `/admin`. Middleware переписывает входящие пути на внутренние роуты
Next.js, оставляя `/admin/*` бэкенду:

| Браузер | Внутренний роут Next.js |
|---|---|
| `admin.corebridge.ru/` | `app/(admin)/admin/page.tsx` |
| `admin.corebridge.ru/users` | `app/(admin)/admin/users/page.tsx` |
| `admin.corebridge.ru/integrations` | `app/(admin)/admin/integrations/page.tsx` |
| `admin.corebridge.ru/admin/*` | **не переписывается** — уходит в nginx → 3003 |

Так же middleware не даёт открыть админские роуты с основного домена и наоборот.

### Э7 — Admin (`admin.corebridge.ru`)

Всё ✅ real: `GET /admin/stats`, `GET /admin/integrations`, `GET /admin/users` (кросс-тенантно),
`POST /admin/tenants/:id/set-plan`, тенанты, платежи, n8n, очереди, DLQ, epf.
Логин: email + пароль + TOTP. Нужен vhost `admin.corebridge.ru` с IP-whitelist на оба адреса
Дмитрия. `last_login_at` у существующих пользователей `null`, пока не зайдут.

### Э8b — Остальная статика / SEO

`docs`, `integrations`, `n8n` (публичная), `sitemap` — SSG. Оставшиеся метатеги.

### Э6 — Support (ВНЕ MVP, последним)

Механика поддержки **не реализуется** (указание Дмитрия). Вёрстка сохраняется, тред/статусы/
вложения скрыты, активны FAQ + `mailto:info@corebridge.ru`. Тикет-API, ИИ-агент и ретрансляция
в админку — в бэклоге.

### Э9 — Сквозной прогон

Скриншоты каждой страницы, сверка с `design-source/`, прокликивание кнопок, e2e против реального
API, проверка cookie/SSL/субдоменов, прод-дымовой тест.

---

## Структура репозитория

```
app/                      Next.js App Router
  (site)/(public)/        /, pricing, docs, integrations, n8n, contacts, for-business, sitemap, legal
  (site)/(auth)/          login, register, forgot-password, reset-password, verify-email, invite/accept
  (site)/(lk)/            dashboard, integrations, epf, billing, settings, support  ← guard сессии
  (admin)/                admin.corebridge.ru ← guard admin-сессии
components/               Sidebar, Topbar, Popup, PublicHeader/Footer, RobokassaWidget
lib/api/                  тонкие fetch-обёртки (auth, lk, admin, public)
lib/contracts/            TS-типы эндпоинтов; `@tentative` = ещё нет на сервере
lib/mocks/                MSW-хендлеры
public/assets/            site.css, legal.css, robokassa.css — копия design-source/assets как есть
design-source/            ЭТАЛОН дизайна (28 HTML + assets). Только чтение, не править
deploy/                   systemd-юнит + nginx vhost'ы
tests/unit  tests/e2e     Vitest + Playwright
Documents/                см. ниже
```

## Documents/

| Файл | Что |
|---|---|
| `manual_setup.md` | **что делает Дмитрий руками** (DNS в sweb.ru, Google OAuth, Robokassa, IP админки) |
| `gap_analysis.md` | карта расхождений дизайн↔сервер, что real / mock / blocked |
| `questions_open.md` | открытые продуктовые вопросы |
| `server_ask/API_ENDPOINTS.md` | **источник истины** по маршрутам сервера (282 шт., из кода) |
| `server_ask/site_server_integration_reference.md` | контракты для сайта, §9b/§9c — финальные схемы |
| `server_ask/answers_from_server.md` | ответы сервера на 30 вопросов — **частично устарел**, сверять с `API_ENDPOINTS.md` |
| `design/` | визуальные спеки P01–P11, механики MC1–MC14, `action_plan.md`, `implementation_strategy.md`, `E0_scaffold_handoff.md` |
| `prompts/` | готовые промты для локального claude-code (правки бэкенда) — см. таблицу ниже |

### Промты бэкенду (`Documents/prompts/`)

| Промт | Что | Приоритет |
|---|---|---|
| `backend_S1_auth.md` | регистрация email+пароль, сброс пароля, verify-email, **Яндекс ID**, `LK_BASE_URL`, проверка отправки писем | 🔴 блокирует запуск |
| `backend_S2_plans.md` | каталог тарифов → канон `pricing.html`, промо, enterprise «по запросу» | 🔴 блокирует прайс/биллинг |
| `backend_S3_public_contact.md` | публичная форма заявок (без иностранных капч) | 🟠 Э4 |
| `backend_S4_notifications.md` | настройки уведомлений + привязка Telegram | 🟠 Э5 |
| `backend_S5_sessions.md` | «выйти на всех устройствах» + список сессий | 🟠 Э5 |
| `backend_S6_admin_users.md` | кросс-тенантные пользователи + `set-plan` | 🟠 Э7 |
| `backend_S7_integrations.md` | cookie-`verify` + OAuth-reauth интеграций | 🟢 Э3 |

## Разработка

```bash
npm install
npm run dev                  # localhost:3000 в dev
npm run build && npm start   # прод-сборка, порт 3005 (см. deploy/)
npm run test                 # Vitest
npm run test:e2e             # Playwright
```

## Правила

1. **`/opt/corebridge` не трогаем.** Нужны правки бэкенда → промт в `Documents/prompts/`.
2. **`design-source/` — эталон.** Вёрстка переносится 1:1, значения — из API.
3. **Прайс не хардкодим** — только `GET /lk/plans`.
4. **Источник истины по эндпоинтам** — `Documents/server_ask/API_ENDPOINTS.md`, не `answers_from_server.md`.
5. Этот README обновляется при каждом изменении состояния проекта.
