# S13 — Админка: API недоступен снаружи + четыре эндпоинта отвечают 500

**Приоритет:** 🔴 первый пункт блокирует админ-панель целиком, остальные — отдельные экраны.
**Объём:** одна строка в `docker-compose.yml` + правки в четырёх SQL-запросах.
Логику менять не нужно нигде.

---

## 0. 🔴 Контейнер `admin` не опубликован на порт — весь `/admin/*` отдаёт 502

Nginx проксирует `/admin/` в `http://127.0.0.1:3003` — так и в вашем
`nginx/sites-enabled/api.corebridge.ru.conf`, и в vhost `admin.corebridge.ru`.
Но на хосте этого порта нет:

```bash
$ ss -ltn | grep -E '300[0-3]|5678'
LISTEN  127.0.0.1:3000   # lk-api
LISTEN  127.0.0.1:3001   # bridge
LISTEN  127.0.0.1:3002   # license-service
LISTEN  127.0.0.1:5678   # n8n
                         # ← 3003 отсутствует
```

Причина — в `docker-compose.yml` у сервиса `admin`:

```yaml
  admin:
    # No external ports — accessed only via Nginx /admin/
    env_file: .env
```

Комментарий описывает верный замысел, но `ports` при этом не задан вовсе, а nginx
живёт **на хосте**, а не в сети Docker, — достучаться до контейнера ему нечем.
Остальные четыре сервиса опубликованы на петлю именно для этого.

Проверяется в одну команду:

```bash
$ curl -s -o /dev/null -w '%{http_code}\n' https://admin.corebridge.ru/admin/auth/me
502
```

Причём с не-whitelisted адреса виден `403` от IP-фильтра, и 502 за ним не заметен —
поэтому проблема так долго и не всплывала.

**Что сделать.** По образцу остальных сервисов:

```yaml
  admin:
    ports:
      - '127.0.0.1:3003:3003'
```

Петлевой адрес обязателен: наружу порт выставлять нельзя, доступ должен идти
только через nginx с IP-whitelist.

⚠️ **Пока это не сделано, на сервере поднят временный проброс** —
`socat TCP-LISTEN:3003,bind=127.0.0.1,fork TCP:172.21.0.2:3003`. Он держится
до перезагрузки и до пересоздания контейнера (IP в сети Docker не закреплён).
Это костыль на время сборки админки, не решение: после правки compose его нужно снять.

---

## Четыре эндпоинта отвечают 500: SQL разошёлся со схемой БД

Найдено при сборке админ-интерфейса 2026-07-29. Проверял не по документации, а вызовом
сервисов напрямую в контейнере — `/admin/*` за IP-whitelist, снаружи не достучаться:

```bash
docker exec corebridge-admin node -e "
  const T=require('/app/src/services/admin/tenant_mgmt.service');
  T.listTenants({limit:2}).then(r=>console.log(r)).catch(e=>console.log('ERR',e.message));
"
```

Все четыре отказа — одного рода: запрос обращается к колонке или таблице, которых
в схеме нет. Тесты этого не поймали, потому что ходят по другому пути.

---

## 1. 🔴 `GET /admin/tenants` → `column "issued_at" does not exist`

`services/admin/tenant_mgmt.service.js`, `listTenants()`:

```js
LEFT JOIN LATERAL (
  SELECT plan, valid_until, is_active
  FROM platform.licenses
  WHERE tenant_id = t.id
  ORDER BY issued_at DESC          -- ← колонки нет
  LIMIT 1
) l ON true
```

В `platform.licenses` есть `created_at`, `updated_at`, `jwt_expires_at`, `invalidated_at` —
`issued_at` нет:

```bash
$ docker exec corebridge-postgres psql -U corebridge -d corebridge -c "\d platform.licenses"
 id | tenant_id | plan | valid_until | created_at | is_active | jwt_token
 invalidated_at | jti | is_trial | updated_at | jwt_expires_at
```

**Что сделать:** `ORDER BY created_at DESC`. Если по смыслу нужен именно момент выдачи —
завести колонку `issued_at` миграцией и заполнить из `created_at`, но проще первое.

## 2. 🔴 `GET /admin/tenants/:id/tokens` → та же колонка плюс несуществующий `details`

`getTenantTokenHistory()`:

```js
SELECT issued_at, valid_until, is_active,
       (details->>'issued_by_admin')::boolean AS issued_by_admin   -- ← колонки details нет
FROM platform.licenses
WHERE tenant_id = $1
ORDER BY issued_at DESC
```

Колонки `details` в `platform.licenses` нет вовсе, `issued_at` — см. выше.

**Что сделать:** отдавать `created_at`, `valid_until`, `is_active`, `invalidated_at`, `jti`.
Признак «выдан админом» взять неоткуда — либо завести `details jsonb`, либо определять
по `audit_log` (`action='admin_issue_token'`, `entity_id = tenant_id`). Второе точнее:
там уже пишется, кто именно выдал.

Экран «История JWT-токенов» в макете `admin-users.html` есть, и он полезен: по нему видно,
не выдавали ли тенанту токен руками. Сейчас блок пустой.

## 3. 🔴 `GET /admin/epf/versions` → `column "is_public" does not exist`

`services/admin/epf_release.service.js`, `listVersions()`:

```js
SELECT id, config, version, file_path, sha256_hash,
       is_active, is_deprecated, changelog, released_at,
       is_public, tenant_id                                  -- ← обеих колонок нет
FROM platform.epf_versions
```

Фактические колонки `platform.epf_versions`: `id, config, version, file_path, sha256_hash,
changelog, released_at, is_active, is_deprecated, sha256, file_size, force_update,
release_notes`. Ни `is_public`, ни `tenant_id` нет — сборки .epf общие для всех тенантов,
таргетирования по тенантам в схеме не заложено.

**Что сделать:** убрать оба поля из выборки. Заодно стоит отдавать `file_size` и
`force_update` — они в таблице есть и на экране версий нужны (по `force_update` видно,
обязательное обновление или нет).

⚠️ Обратите внимание: в таблице **две** колонки хэша — `sha256_hash` и `sha256`. Сервис
читает первую, `GET /lk/epf/versions` (lk-api) отдаёт вторую. Одна из них лишняя; пока обе
заполняются, расхождение не проявляется, но это ловушка на будущее.

## 4. 🔴 `GET /admin/queues/stats` → `column d.status does not exist` + не та таблица

`services/admin/queue_monitor.service.js`, `getQueueStats()`:

```js
SELECT COUNT(*)::int
  FROM platform.dead_letter_queue d
 WHERE d.tenant_id = e.tenant_id AND d.status = 'pending'      -- ← колонки нет
```

Здесь две отдельные проблемы.

**Колонки `status` нет ни в одной из очередей.** В базе есть **две** таблицы
`dead_letter_queue` — в схемах `platform` и `marketplace`, с разным набором колонок:

| | `platform.dead_letter_queue` | `marketplace.dead_letter_queue` |
|---|---|---|
| счётчик попыток | `retry_count` | `attempt_count` |
| адаптер | `adapter` | — |
| RLS-политика | нет | есть |
| `status` | нет | нет |

Само попадание в DLQ и означает «не обработано» — отдельного статуса там не предполагалось.

**Разные сервисы читают разные таблицы.** `dlq_mgmt.service.js` работает с
`platform.dead_letter_queue` (и работает — проверил, отдаёт записи), а `queue_monitor` —
тоже с `platform`, но по несуществующей колонке. При этом события в DLQ, судя по данным,
кладёт marketplace-путь. Нужно решить, какая таблица настоящая, и свести к ней оба сервиса;
вторую — удалить миграцией, иначе рано или поздно разъедутся данные, а не только код.

**Что сделать:** убрать условие `d.status = 'pending'` (считать все строки DLQ) и
привести обе службы к одной таблице.

---

## 5. 🟠 Вход в админку: TOTP выключен, но код всё равно спрашивается

Не 500, но мешает собрать форму входа.

`POST /admin/auth/login` возвращает `{ requires_totp: false, step_token }`, когда у админа
`totp_enabled = false`. Сессия при этом выдаётся **только** на шаге 2, а маршрут
`POST /admin/auth/totp/verify` отвергает пустой код до всякой проверки:

```js
const { step_token, totp_code } = req.body || {};
if (!step_token || !totp_code) return res.status(401).json({ error: 'Unauthorized' });
```

Внутри `verifyTotp` при `totp_enabled = false` код не проверяется вовсе. То есть клиент
обязан прислать любую непустую строку, которую сервер выбросит. Сейчас сайт шлёт заглушку —
работает, но это фикция в протоколе.

**Что сделать (на выбор):** либо выдавать сессию сразу на шаге 1, когда TOTP выключен,
либо не требовать `totp_code`, когда он не нужен. Первое чище.

**Отдельно — вопрос к Дмитрию, не к серверу.** В `platform.admin_users` один аккаунт,
`admin@corebridge.ru`, и у него `totp_enabled = false`. Панель умеет менять тарифы,
блокировать тенантов и запускать удаление аккаунтов; вход в неё сейчас защищён
только паролем и IP-whitelist'ом. TOTP в коде реализован полностью — включить стоит
до передачи панели в работу.

---

## Как проверить, что починилось

```bash
docker exec corebridge-admin node -e "
const T=require('/app/src/services/admin/tenant_mgmt.service');
const E=require('/app/src/services/admin/epf_release.service');
const Q=require('/app/src/services/admin/queue_monitor.service');
(async()=>{
  for (const [n,f] of [
    ['TENANTS', ()=>T.listTenants({limit:2})],
    ['TOKENS',  ()=>T.getTenantTokenHistory('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380001')],
    ['EPF',     ()=>E.listVersions()],
    ['QUEUES',  ()=>Q.getQueueStats()],
  ]) { try { console.log(n, JSON.stringify(await f()).slice(0,200)); }
       catch(e){ console.log(n,'ERR',e.message); } }
  process.exit(0);
})();
"
```

Все четыре должны вернуть данные, ни одного `ERR`.

## Что уже сделано на стороне сайта

- Экраны админки собраны так, чтобы отказ этих четырёх эндпоинтов не ломал страницу:
  блок показывает, что именно недоступно и почему, вместо пустоты или белого экрана.
  После починки блоки заполнятся сами, править сайт не потребуется.
- Список тенантов на экране «Пользователи» собирается из `GET /admin/users` — он отдаёт
  пользователя вместе с тенантом и работает. `GET /admin/tenants` нужен для отдельного
  экрана тенантов, он пока помечен как недоступный.
- В модалку смены тарифа добавлено обязательное поле «Причина» — сервер требует `reason`,
  в макете этого поля не было.
