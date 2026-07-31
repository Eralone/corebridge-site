# S12 — Каталог n8n-воркфлоу не работает: шаблоны не доезжают до контейнера

**Приоритет:** 🟠 экран «n8n-воркфлоу» в ЛК показывает «Сценариев пока нет» всегда
и для всех, независимо от тарифа. Функция заявлена в тарифах, но недоступна.
**Объём:** одна строка в `docker-compose.yml` + метаданные в JSON-шаблонах.

Найдено прогоном платных тарифов на проде 2026-07-29. Четыре отдельные вещи, разберу по
одной. Первые две — почему каталог пуст, третья — что в нём окажется, когда он наполнится,
четвёртая — независимый баг в истории запусков.

---

## 1. 🔴 Шаблоны не смонтированы в контейнер

`src/services/lk/workflow_catalog.service.js`:

```js
const TEMPLATES_DIR = process.env.N8N_TEMPLATES_DIR
  || path.resolve(__dirname, '../../../../../n8n/templates');
```

Из `/app/src/services/lk/` пять уровней вверх — это корень `/`, то есть путь
разворачивается в **`/n8n/templates`**. Такого каталога в контейнере нет:

```bash
$ docker exec corebridge-lk-api ls /n8n/templates
ls: /n8n/templates: No such file or directory
$ docker exec corebridge-lk-api sh -c 'echo "$N8N_TEMPLATES_DIR"'
                                       # пусто, переменная не задана
```

Шаблоны при этом есть — на хосте, в `/opt/corebridge/n8n/templates` (17 файлов).
В `docker-compose.yml` у сервиса `lk-api` смонтирован только epf:

```yaml
    volumes:
      - /opt/corebridge/epf:/opt/corebridge/epf:ro
```

`getCatalog()` ловит ошибку `readdirSync` и молча возвращает `[]`. Поэтому
`GET /lk/workflows/catalog` отвечает пустым массивом всегда — не «шаблоны ещё не
опубликованы», а «сервис их физически не видит».

**Что сделать.** Добавить том и явную переменную, чтобы путь не зависел от вложенности
файла в дереве:

```yaml
  lk-api:
    environment:
      N8N_TEMPLATES_DIR: /opt/corebridge/n8n/templates
    volumes:
      - /opt/corebridge/epf:/opt/corebridge/epf:ro
      - /opt/corebridge/n8n/templates:/opt/corebridge/n8n/templates:ro
```

Заодно стоит убрать `path.resolve` с пятью `..` из умолчания — он верен только при
конкретной глубине файла и ломается от любого переноса.

И ещё: сейчас недоступность каталога неотличима от пустого каталога. Стоит писать
в лог, если `readdirSync` упал, — иначе следующий такой отказ снова будет невидим:

```js
} catch (err) {
  console.error(JSON.stringify({ level: 'error', event: 'templates_dir_unreadable',
    dir: TEMPLATES_DIR, msg: err.message }));
  return [];
}
```

---

## 2. 🟠 В шаблонах нет метаданных, по которым строится карточка

Сервис читает из JSON поля `template_id`, `name`, `description`, `required_integrations`,
`tags`. В файлах их нет — там лежит выгрузка воркфлоу из n8n как есть:

```bash
$ python3 -c "import json;d=json.load(open('/opt/corebridge/n8n/templates/marketplace_orders.json'));
              print({k:d.get(k) for k in ('template_id','name','description','required_integrations','tags')})"
{'template_id': None,
 'name': '{TENANT_ID}__{PROJECT_ID}__marketplace_orders',
 'description': None,
 'required_integrations': None,
 'tags': [{'name': '{TENANT_ID}'}, {'name': '{PROJECT_ID}'}, {'name': 'marketplace_orders'}]}
```

Если просто смонтировать том из пункта 1, в ЛК появятся карточки с названием
`{TENANT_ID}__{PROJECT_ID}__marketplace_orders`, без описания и с тегами-плейсхолдерами.
Это хуже, чем пустой каталог.

**Что сделать.** Добавить в каждый шаблон блок метаданных для витрины — он не мешает
импорту в n8n, лишние ключи n8n игнорирует:

```json
{
  "template_id": "marketplace_orders",
  "display_name": "Заказы с маркетплейсов",
  "description": "Собирает заказы Ozon, WB и Яндекс.Маркета и складывает их в 1С.",
  "required_integrations": ["ozon", "wb", "ym"],
  "catalog_tags": ["маркетплейсы", "заказы"],

  "name": "{TENANT_ID}__{PROJECT_ID}__marketplace_orders",
  "nodes": [ … ],
  "tags": [ … ]
}
```

Отдельные ключи (`display_name`, `catalog_tags`) нужны потому, что `name` и `tags` уже
заняты форматом n8n и трогать их нельзя — по ним идёт клонирование. В `getCatalog()`
отдавать `name: tpl.display_name || tpl.template_id` и `tags: tpl.catalog_tags || []`.

⚠️ `tags` сейчас отдаются наружу в том виде, в каком лежат в файле, — то есть массивом
**объектов** `{name}`, тогда как весь остальной API отдаёт плоские строки. На сайте я
нормализую это на своей стороне, чтобы экран не падал, но правильнее отдавать строки.

**Что считать за `required_integrations`.** В `activateWorkflow` проверка такая:

```js
WHERE tenant_id = $1 AND is_active = TRUE AND integration_id = ANY($2)
```

То есть сверяется с `marketplace.adapter_configs.integration_id`. Нужно, чтобы в шаблонах
лежали именно те коды, что попадают в `integration_id`, а не названия адаптеров. Если это
разные словари — сверку надо вести по `adapter_type`, иначе она не сработает никогда.

---

## 3. ℹ️ `integration_id` обязателен — это правильно, но нигде не описано

`POST /lk/workflows/activate` без `integration_id` отвечает `400 MISSING_FIELDS`.
В `API_ENDPOINTS.md` поле не упомянуто, и сайт его сначала не слал — каждое нажатие
«Включить» гарантированно возвращало ошибку. На стороне сайта уже исправлено: интеграция
выбирается в карточке сценария. Прошу дописать поле в реестр эндпоинтов как обязательное.

Заодно: `GET /lk/workflows/executions` принимает `?limit=`, но игнорирует его и отдаёт
всё, что нашёл. Либо поддержать, либо убрать из документации — сейчас сайт режет сам.

---

## 4. 🟠 Статус запуска всегда «success» — приоритет операторов

`workflow_catalog.service.js`, сборка ответа `getExecutions()`:

```js
status: exec.status || exec.finished ? 'success' : 'running',
```

`||` сильнее тернарного оператора, поэтому выражение читается как
`(exec.status || exec.finished) ? 'success' : 'running'`. Любой непустой `status` —
включая `'error'`, `'crashed'`, `'canceled'` — превращается в `'success'`.
Упавший сценарий показывается пользователю как успешный.

**Что сделать:**

```js
status: exec.status || (exec.finished ? 'success' : 'running'),
```

И передать `error`/`crashed` как есть — сайт уже умеет их отрисовать красным.

**Ещё одно, мелкое.** В этом же ответе поле называется `startedAt` — единственный camelCase
на весь API, везде остальное snake_case. Просьба переименовать в `started_at`; на сайте
сейчас стоит `startedAt` с пометкой, поменяю сразу после вас.

---

## 5. 🟠 Рабочее пространство n8n не создаётся при регистрации: `n8n API error: 409`

Всплыло на экране очередей админки. В `platform.dead_letter_queue` лежат события
`workspace_init_failed` — по одному на каждого зарегистрировавшегося тенанта:

```json
{"event_type":"workspace_init_failed",
 "payload":{"tenantId":"07584704-9800-44c0-bc4e-30bbeb513007"},
 "error":"n8n API error: 409","retry_count":3}
```

Три попытки, все с 409 (конфликт — сущность уже существует). В итоге
`platform.tenants.n8n_initialized` остаётся `false`, и у клиента нет ни одного
воркфлоу. То есть после оплаты «Профессионала» с доступом к n8n человек
получит пустой экран — и это не будет виден никому, кроме DLQ.

Прошу разобраться, что именно конфликтует: судя по коду `n8n_client`, тег или проект
с таким `tenant_id` уже создан к моменту повторной попытки. Если так, 409 нужно
трактовать как успех («уже создано») и выставлять `n8n_initialized = true`,
а не отправлять событие в мёртвую очередь.

Заодно: имеет смысл поднимать такое в `admin/health` или в уведомления —
сейчас единственный признак, что у клиента ничего не работает, лежит в DLQ.

## Как проверить, что починилось

```bash
# 1. Каталог не пуст и названия человекочитаемые
curl -s -H "Cookie: lk_session=<сессия>" https://corebridge.ru/lk/workflows/catalog | jq '.[0]'
# ожидаем: { "template_id": "marketplace_orders", "name": "Заказы с маркетплейсов",
#            "description": "…", "required_integrations": ["ozon", …], "tags": ["…"] }

# 2. Включение без integration_id по-прежнему 400, с ним — 200
curl -s -X POST -H "Cookie: lk_session=<сессия>" -H 'Content-Type: application/json' \
  -d '{"template_id":"marketplace_orders"}' https://corebridge.ru/lk/workflows/activate
# ожидаем: 400 MISSING_FIELDS

# 3. Упавший запуск отдаётся как error, а не success
curl -s -H "Cookie: lk_session=<сессия>" https://corebridge.ru/lk/workflows/executions | jq '.[].status'
```

## Что уже сделано на стороне сайта

- `POST /lk/workflows/activate` теперь шлёт `integration_id`; в карточке сценария есть
  выбор интеграции, а если подходящей нет — кнопка заблокирована с объяснением,
  а не даёт ошибку после нажатия.
- Каталог нормализуется на клиенте: `tags`-объекты разворачиваются в строки,
  плейсхолдеры `{TENANT_ID}__…` не показываются как название.
- Лимит запусков n8n на экранах ЛК берётся из `GET /lk/plans`, а **не** из
  `dashboard.n8n_usage.limit`. Причина — в промте S10: строки в `usage_counters` нет,
  пока не было ни одного запуска, и сервер отдаёт `limit: 0` даже на «Профессионале».
  Раньше сайт из-за этого писал оплатившему человеку «на пробном тарифе n8n недоступен».
