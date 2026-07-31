# Промт для локального claude-code в `corebridge-server` — пакет S1: auth-механики для сайта

> Передать целиком локальному claude-code в репозитории `corebridge-server`.
> Составлено сайтом 2026-07-26, сверено с фактическим `docs/API_ENDPOINTS.md` (282 маршрута).
>
> **Решение продукта (Дмитрий, 2026-07-26):** основной способ регистрации и входа — **email + пароль**.
> Регистрация через Google / Apple ID и другие иностранные сервисы **не используется** — это
> ограничение для РФ. Вместо Google социальный вход — **Яндекс ID**.

## Контекст: что уже есть, а чего нет

В `lk-api` (порт 3000, внешний префикс `/lk/*`) сейчас есть:

```
POST /lk/auth/login          POST /lk/auth/logout
POST /lk/auth/magic-link     GET  /lk/auth/magic-link/verify
GET  /lk/auth/google         GET  /lk/auth/google/callback     ← заменяем на Яндекс ID
GET  /lk/auth/session
POST /lk/profile/password    (смена пароля изнутри сессии — есть)
```

Нет ни одного маршрута для: публичной регистрации, сброса забытого пароля, подтверждения email,
входа через Яндекс ID.

**Критично:** сейчас self-serve регистрация возможна **только** через Google OAuth
(`findOrCreateGoogleUser` авто-создаёт tenant `plan=trial` + user `role=owner`). После этого пакета
единственным путём для новых пользователей станет `POST /lk/auth/register`, поэтому он блокирует
запуск сайта.

---

## Часть 1. `POST /lk/auth/register` — публичная регистрация email + пароль

```
POST /lk/auth/register            (без сессии; rate-limit по IP)
body { "email", "password", "company_name"?, "name"? }
→ 201 {
    "user_id", "tenant_id", "email",
    "email_verified": false,
    "verification_sent": true
  }
  + ставит cookie lk_session (пользователь сразу попадает в ЛК)
errors:
  400 MISSING_FIELDS
  400 WEAK_PASSWORD        { min_length: 8 }   — те же правила, что в POST /lk/profile/password
  400 INVALID_EMAIL
  409 EMAIL_EXISTS
  429 TOO_MANY_REQUESTS                        — как у /lk/auth/login (5 / 15 мин на IP)
```

Поведение: создать `platform.tenants` (plan=`trial`, активный) + `platform.users` (role=`owner`,
`auth_provider='password'`, `password_hash` = bcrypt), выдать trial-лицензию тем же путём, что
`POST /admin/tenants/:id/grant-trial` (чтобы JWT и `valid_until` появились сразу), записать в
`audit_log`, отправить письмо подтверждения (часть 2).

Требования продукта из `pricing.html`: «Пробный тариф **бессрочный** — активируется при первой
авторизации и не имеет срока действия», «карта при регистрации не требуется». Сейчас `grant-trial`
выдаёт лицензию на **14 дней**. **Нужно решение:** trial бессрочный (`valid_until = null`) или
всё-таки ограниченный? Дизайн обещает бессрочный, а дашборд при этом показывает `days_left` —
если `valid_until = null`, сайту надо знать, что показывать вместо счётчика.

Решения, которые надо принять на твоей стороне:
- **Пускать в ЛК до подтверждения email?** Просьба сайта: **пускать**. Иначе после регистрации
  экран «проверьте почту» — тупик; `verify-email.html` в дизайне именно про подтверждение, а не
  про блокировку доступа. Неподтверждённый email помечаем флагом и показываем баннер.
- `company_name` — обязательное? В дизайне поле есть, но не помечено обязательным.

---

## Часть 2. Подтверждение email

```
GET /lk/auth/verify-email?token=<token>     (без сессии)
→ 200 { "email", "verified": true }
errors: 400 MISSING_TOKEN · 404 TOKEN_INVALID · 410 TOKEN_EXPIRED · 409 ALREADY_VERIFIED

POST /lk/auth/verify-email/resend    (cookie lk_session)
→ 202 { "sent": true }
errors: 401 · 409 ALREADY_VERIFIED · 429 TOO_MANY_REQUESTS
```

Токен: одноразовый, TTL ~24 ч, в БД хранить SHA-256 хеш — **переиспользуй подход из инвайтов
команды** (миграция 007), там это уже сделано правильно.

Флаг подтверждения добавить в ответ `GET /lk/profile`, чтобы сайт показал баннер:

```
GET /lk/profile → user: { ..., "email_verified": true|false }
```

---

## Часть 3. Сброс забытого пароля

```
POST /lk/auth/password/reset-request      (без сессии; rate-limit по IP и по email)
body { "email" }
→ 202 { "sent": true }     // ВСЕГДА 202, даже если email не существует — без user enumeration,
                           // как уже сделано в POST /lk/auth/magic-link
errors: 400 INVALID_EMAIL · 429 TOO_MANY_REQUESTS

POST /lk/auth/password/reset        (без сессии)
body { "token", "new_password" }
→ 200 { "ok": true, "email" }        + желательно сразу ставить cookie lk_session
errors: 400 MISSING_FIELDS · 400 WEAK_PASSWORD { min_length: 8 } ·
        404 TOKEN_INVALID · 410 TOKEN_EXPIRED
```

Токен сброса: одноразовый, TTL 60 мин, SHA-256 хеш в БД. После успешного сброса —
**инвалидировать все существующие сессии пользователя** в Redis DB=1 и записать `password_reset`
в `audit_log`.

Для аккаунтов без пароля (`auth_provider != 'password'`, `password_hash` = placeholder) — тоже
вернуть 202, но в письме объяснить, каким способом человек входит, и дать ссылку на этот способ.

---

## Часть 4. Яндекс ID вместо Google OAuth

Заменить социальный вход. Яндекс OAuth — стандартный authorization code flow:

| Шаг | Endpoint Яндекса |
|---|---|
| authorize | `https://oauth.yandex.ru/authorize?response_type=code&client_id=<id>&redirect_uri=<uri>&state=<state>` |
| обмен кода на токен | `POST https://oauth.yandex.ru/token` (`grant_type=authorization_code`, `code`, `client_id`, `client_secret`) |
| профиль пользователя | `GET https://login.yandex.ru/info?format=json` c `Authorization: OAuth <access_token>` → `{ id, default_email, emails[], real_name, display_name, login }` |

Нужно реализовать, зеркально существующему Google-флоу:

```
GET /lk/auth/yandex             → 302 на oauth.yandex.ru/authorize (state в Redis, TTL 10 мин)
GET /lk/auth/yandex/callback?code=&state=
    → обмен кода, получение профиля, findOrCreateYandexUser(email, name)
    → ставит cookie lk_session → 302 в ЛК
errors: 400 INVALID_STATE · 502 YANDEX_UNAVAILABLE · 403 TENANT_BLOCKED
```

Детали:
- `findOrCreateYandexUser` — по аналогии с `findOrCreateGoogleUser`: если пользователя с таким
  email нет, создать tenant (`plan=trial`) + user (`role=owner`, `auth_provider='yandex'`).
  Если email уже есть с `auth_provider='password'` — **не создавать второй аккаунт**, а привязать
  Яндекс-вход к существующему (email уже подтверждён Яндексом → выставить `email_verified=true`).
- `auth_provider` должен принимать значение `'yandex'` (проверь CHECK-констрейнт / enum, если есть).
- `GET /lk/profile` уже отдаёт `auth_provider` — сайт по нему решает, показывать ли блок «Пароль».
- Новые переменные окружения: `YANDEX_CLIENT_ID`, `YANDEX_CLIENT_SECRET`,
  `YANDEX_REDIRECT_URI=https://corebridge.ru/lk/auth/yandex/callback`.
  Приложение в https://oauth.yandex.ru/client/new регистрирует Дмитрий вручную; нужные права —
  «Доступ к email адресу» (`login:email`) и «Доступ к имени, фамилии» (`login:info`).
  **Сообщи, какие именно scope нужны твоей реализации** — передам Дмитрию для регистрации приложения.

### Что делать с существующим Google OAuth — нужно решение

`/lk/auth/google` **не удалять сразу**: если по нему уже зарегистрированы живые аккаунты
(`auth_provider='google'`), их владельцы иначе потеряют доступ — у них `password_hash` = placeholder,
войти по паролю они не смогут.

Предложение сайта:
1. Кнопку «Войти через Google» с сайта **убрать** (сделаю на своей стороне).
2. Эндпоинты `/lk/auth/google*` оставить рабочими, но **запретить авто-регистрацию новых**
   tenant-ов через них: если пользователя нет — возвращать `403 REGISTRATION_VIA_GOOGLE_DISABLED`
   вместо создания. Вход существующих продолжает работать.
3. Существующим google-аккаунтам дать возможность задать пароль — через flow сброса пароля из части 3
   (он и так пришлёт письмо на подтверждённый email).

**Проверь и сообщи: сколько сейчас реальных пользователей с `auth_provider='google'`?**
Если ноль — можно смело удалять Google целиком, и это предпочтительнее.

---

## Часть 5. Обязательно к подтверждению (нужно сайту, а не только этому пакету)

### 5.1. `LK_BASE_URL` в `.env`

В `/opt/corebridge/.env` **нет** переменной `LK_BASE_URL` (и нет `DOMAIN`). При этом
`POST /lk/users/invite` уже возвращает `invite_url` вида `${LK_BASE_URL}/lk/invite/accept?token=...`,
а magic-link и OAuth делают 302 на `/lk/dashboard`.

Нужно:
- завести `LK_BASE_URL=https://corebridge.ru` — сайт будет жить на этом домене, топология
  **single-origin**: nginx на `corebridge.ru` проксирует `/lk/*` в lk-api, поэтому домен сайта и
  домен API совпадают, CORS не нужен;
- проверить, что **все** ссылки в письмах (magic-link, invite, verify-email, password-reset)
  собираются из этой переменной, а не из хардкода `api.corebridge.ru`;
- согласовать путь редиректа после `magic-link/verify` и после OAuth-колбэка. Сайт держит дашборд
  ЛК по пути **`/dashboard`**. Если сервер редиректит на `/lk/dashboard`, то либо ты меняешь
  редирект на `/dashboard`, либо я завожу у себя алиас `/lk/dashboard`. **Выбери один вариант и
  сообщи** — сейчас это расхождение сломает вход.

### 5.2. Отправка писем — работает ли реально?

В `.env` есть `EMAIL_SERVICE_URL` и `EMAIL_FROM`, но SMTP-конфигурации для lk-api я не нашёл —
только `GF_SMTP_*`, а это Grafana для алёртов платформы.

**Проверь и сообщи: реально ли уходят письма** magic-link и приглашений команды? Если нет — не
работает ни существующий magic-link, ни инвайты, ни весь этот пакет (подтверждение email и сброс
пароля целиком построены на письмах). Это блокер запуска.

---

## Что НЕ входит в этот пакет (не делай)

- Смена email из ЛК (`/lk/profile/email/request|confirm`) — отдельный пакет, низкий приоритет.
- Листинг сессий (`GET /lk/sessions`) — отдельный пакет S4, требует переработки хранения в Redis.
- Тикеты поддержки — вне MVP по решению продукта.

## Definition of Done

- [ ] `POST /lk/auth/register` — регистрация email + пароль, создаёт tenant+owner+trial-лицензию
- [ ] `GET /lk/auth/verify-email` + `POST /lk/auth/verify-email/resend`
- [ ] `POST /lk/auth/password/reset-request` + `POST /lk/auth/password/reset`
- [ ] `GET /lk/auth/yandex` + `GET /lk/auth/yandex/callback`, `auth_provider='yandex'` поддержан
- [ ] Google: авто-регистрация новых отключена, вход существующих сохранён (или Google удалён,
      если живых google-аккаунтов нет)
- [ ] `email_verified` добавлен в ответ `GET /lk/profile`
- [ ] `LK_BASE_URL` заведён, все письма и редиректы собираются из него
- [ ] Все эндпоинты покрыты тестами, включая перечисленные коды ошибок
- [ ] Даны ответы: срок trial (бессрочный или 14 дней), scope для приложения Яндекс ID,
      число живых google-аккаунтов, путь редиректа после OAuth/magic-link, реально ли уходят письма
- [ ] Финальные пути/схемы присланы в `corebridge-site/Documents/server_ask/` — обновлю
      `site_server_integration_reference.md` и `API_ENDPOINTS.md`
