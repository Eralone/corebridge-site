# Промт для `corebridge-server` — пакет S9: добор эндпоинтов для админ-панели

> Передать локальному claude-code в репозитории `corebridge-server`.
> Составлено сайтом 2026-07-27 после вычитки всех четырёх макетов админки
> (`admin.html`, `admin-users.html`, `admin-integrations.html`, `admin-support.html`).
> Сверено с `docs/API_ENDPOINTS.md` и `site_S1_S7_RESPONSE.md`.
>
> Приоритет: средний. Это **добор**, а не блокер — админка соберётся и без S9, просто три блока
> будут пустыми. Не бросай ради этого S8.

## Что уже есть и переделывать не надо

`GET /admin/stats`, `GET /admin/users`, `GET /admin/integrations`, `GET /admin/tenants` (+`block`,
`unblock`, `issue-token`, `tokens`, `grant-trial`, `set-plan`), `GET /admin/payments` (+`refund`),
`/admin/queues/*`, `/admin/dlq/*`, `/admin/epf/*`, весь `/admin/n8n/*`, `/admin/auth/*`.

Этого хватает примерно на 85 % макетов. Ниже — то, чего нет.

---

## 1. `GET /admin/health` — статус сервисов платформы

Блок «Статус сервисов платформы» на `admin.html`: 6 плиток с состоянием и uptime.
Мониторинг у нас есть (Prometheus + Grafana + cAdvisor + node-exporter), но **HTTP-API для
админки поверх него нет**, и сайту неоткуда взять эти данные.

```
GET /admin/health                        (admin-сессия)
→ 200 {
  "checked_at": "2026-07-27T09:14:03.221Z",
  "services": [
    { "key": "lk-api",          "title": "Personal API",     "status": "ok"|"degraded"|"down",
      "detail": "p95 86ms",     "latency_ms": 86 },
    { "key": "bridge",          "title": "Bridge Service",    "status": "ok", "detail": "…" },
    { "key": "license-service", "title": "License Service",   "status": "ok", "detail": "…" },
    { "key": "postgres",        "title": "PostgreSQL",        "status": "ok", "detail": "0 lag" },
    { "key": "redis",           "title": "Redis",             "status": "ok", "detail": "12.4К ключей" },
    { "key": "n8n",             "title": "n8n",               "status": "ok", "detail": "238 активных" },
    { "key": "smtp",            "title": "Почта",             "status": "ok", "detail": "релей отвечает" }
  ]
}
```

- Достаточно опросить `/health` каждого сервиса + `SELECT 1` в Postgres + `PING` в Redis.
  **Не тащи это из Prometheus** — там придётся считать uptime за период, а сайту нужно «сейчас».
- Кешировать 10–15 с, чтобы дашборд не долбил сервисы на каждое открытие.
- Плитку «ЮKassa» из макета игнорируй: у нас Robokassa, и она ещё не настроена. Добавишь, когда
  появится — по ключу `payments`.
- **Uptime-процентов не надо.** В макете стоит «100 %», но это требует истории; сайт покажет
  просто `status`. Если когда-нибудь заведёшь историческую доступность — добавим отдельным полем.

---

## 2. `GET /admin/audit` — кросс-тенантный журнал

Блок «Audit log · последние действия admin» на `admin.html`. Таблица `platform.audit_log` есть и
наполняется (в S6/S8 мы туда пишем `admin_set_plan`, `admin_tenant_export` и т. д.), но
кросс-тенантного эндпоинта **нет**: `GET /lk/logs` отдаёт только свой тенант.

```
GET /admin/audit?actor=&action=&tenant_id=&from=&to=&page=&limit=      (admin-сессия)
→ 200 {
  "entries": [{
    "id", "created_at",
    "action": "admin_set_plan",
    "actor": "admin:d.korolev@corebridge.ru",
    "tenant_id", "company_name",
    "entity_type", "entity_id",
    "new_value": { … }            // как хранится в audit_log
  }],
  "count": 1284, "page": 1, "limit": 50
}
```

- `limit` ≤ 200, дефолт 50; сортировка `created_at DESC`.
- Фильтр `actor` — по префиксу (`admin:` = только действия сотрудников, что и нужно макету).
- Значения `action` в макете нарисованы как `CHANGE_PLAN`, `ISSUE_TOKEN`, `BLOCK`, `RESET_LIMIT`,
  `UNBLOCK`. **Отдавай свои реальные значения** — сайт сам сделает подписи. Просто пришли список
  фактических `action`, которые бывают у `actor LIKE 'admin:%'`, чтобы я нарисовал бейджи и не
  придумывал.

---

## 3. `GET /admin/users` — три доработки

Экран `admin-users.html` почти целиком закрыт этим эндпоинтом, не хватает:

### 3.1. Сортировка

Блок «Недавние регистрации» на `admin.html` собрать нечем — параметра сортировки нет.

```
GET /admin/users?sort=created_at|last_login_at|email&order=asc|desc
```
Дефолт — `created_at desc`.

### 3.2. Два поля в ответе

```
"n8n_initialized": true|false,   // колонка «n8n: ✓ initialized / ✗ pending» в таблице
"company_inn": "7727823412"      // шит «Профиль тенанта» показывает ИНН
```

`tenants.n8n_initialized` **уже есть в БД** (миграция 005b), `company_inn` тоже — просто не
попали в SELECT.

### 3.3. Фильтр по истекающим

Плитка «Trial / истекает <3д» на `admin-users.html`.

```
GET /admin/users?expiring_within_days=3
```
Плюс, если дёшево, счётчик в `/admin/stats`:
```
"tenants": { …, "expiring_soon": 37 }     // valid_until в пределах 3 дней; бессрочные не считаем
```
Важно: у бессрочных (`valid_until = NULL`, trial после S1) в этот фильтр попадать **не должно**.

---

## 4. Чего сайт НЕ просит — не делай

- **`POST /admin/tenants`** («+ Создать тенант» в макете) — тенанты создаются регистрацией,
  кнопку убираю.
- **Экспорт CSV списка** (кнопки «Экспорт CSV» на `admin.html` и `admin-users.html`) — выгрузка
  одного тенанта уже есть в S8, списочный CSV не нужен, кнопки убираю.
- **«Перезапустить worker»** и **«Открыть n8n UI»** на `admin-integrations.html` — первого
  эндпоинта нет и не надо (перезапуск через docker, не из браузера), второе упирается в
  IP-whitelist `/n8n/` в nginx. Обе кнопки убираю.
- **Период в `/admin/stats`** (селектор «Сегодня / 7 дней / 30 дней / Год») — селектор убираю,
  показываю текущий срез. Если понадобится — попрошу отдельно.
- **`/admin/support/*`** — поддержка вне MVP по решению продукта. `admin-support.html` не собираю.
  В бэклоге.

---

## 5. Заодно: расхождение лимитов n8n в макете

В `admin-integrations.html` лимиты `n8n_executions_month` нарисованы как Старт **1 000**,
Бизнес **10 000**, Профессиональный **30 000**. Канон из `GET /lk/plans` (после S2):
trial 500, starter **500**, business 10 000, professional **20 000**, enterprise ∞.

Ничего делать не надо — сайт берёт числа из API. Пишу, чтобы ты не сверял макет с кодом и не
решил, что это баг сервера.

---

## Definition of Done

- [ ] `GET /admin/health` — реальный опрос сервисов, кеш 10–15 с, без uptime-процентов
- [ ] `GET /admin/audit` с фильтрами, `limit` ≤ 200, сортировка `created_at DESC`
- [ ] Прислан список фактических значений `action` для `actor LIKE 'admin:%'`
- [ ] `GET /admin/users`: `sort`/`order`, поля `n8n_initialized` и `company_inn`,
      фильтр `expiring_within_days` (бессрочные не попадают)
- [ ] Опционально: `tenants.expiring_soon` в `/admin/stats`
- [ ] Тесты на новые эндпоинты и фильтры
- [ ] Финальные схемы присланы в `corebridge-site/Documents/server_ask/`
