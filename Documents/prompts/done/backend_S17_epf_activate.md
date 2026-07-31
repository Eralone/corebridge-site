# S17 — Публикация .epf падает на активации: вызов не совпадает с сигнатурой функции

**Приоритет:** 🔴 выкладка не проходит. Файл и запись в БД появляются, активация падает,
эндпоинт отвечает 500 — CI останавливается на первой же конфигурации.
**Объём:** одна строка.

Найдено 2026-07-31, после того как заработало монтирование тома (S16). Ошибка
сменилась с `ENOENT` на:

```
POST /api/v1/epf/publish → 500
{"error":"function platform.activate_epf_version(unknown, unknown) does not exist"}
```

## Причина

Функция в базе принимает **идентификатор строки**:

```sql
CREATE OR REPLACE FUNCTION platform.activate_epf_version(p_version_id uuid)
  RETURNS platform.epf_versions
```

А вызывают её двумя строками — `server/services/epf/epf_version.service.js:87`:

```js
async activate(config, version) {
  await db.query('SELECT platform.activate_epf_version($1, $2)', [config, version]);
```

Перегрузки `(text, text)` в схеме нет, поэтому Postgres отвергает вызов.

Забавно, что нужный идентификатор уже есть под рукой и его выбрасывают —
`server/routes/public/epf_publish.routes.js:103`:

```js
await epfVersion.register(config, version, sha256, filePath, fileSize, null);  // возвращает id
await epfVersion.activate(config, version);                                    // и он теряется
```

`register()` заканчивается `RETURNING id` и этот id возвращает.

## Как чинить

Самое прямое — довести id до вызова:

```js
// epf_publish.routes.js
const versionId = await epfVersion.register(config, version, sha256, filePath, fileSize, null);
await epfVersion.activate(config, version, versionId);

// epf_version.service.js
async activate(config, version, versionId) {
  await db.query('SELECT platform.activate_epf_version($1)', [versionId]);
  …
}
```

Если менять сигнатуру `activate()` не хочется, второй вариант — искать id внутри неё:

```js
const { rows } = await db.query(
  'SELECT id FROM platform.epf_versions WHERE config = $1 AND version = $2', [config, version]);
await db.query('SELECT platform.activate_epf_version($1)', [rows[0].id]);
```

⚠️ **Перегрузку `(text, text)` в базе я заводить не стал.** Она бы «починила»
симптом, но оставила в схеме объект, о котором ваши миграции не знают, — и
следующий, кто полезет разбираться, потратил бы на это день. Ошибка в коде,
чинить лучше там.

⚠️ Тест `server/tests/epf_cdn.test.js:209` закрепляет **неверное** поведение:
он называется «activate() calls platform.activate_epf_version(config, version)»
и проверяет вызов с двумя аргументами на моке. Поэтому дефект и не всплыл —
мок не знает сигнатуры настоящей функции. Тест надо поправить вместе с кодом,
иначе он будет держать баг.

## Состояние прода сейчас

Публикация **успевает записать файл и строку**, падает только активация. То есть
после каждой попытки на проде остаётся неактивная версия:

```
config | version | is_active | file_size
ut11   | v1.0.0  | t         |   1361372   ← активировал вручную, см. ниже
unf    | 0.0.1   | t         |       732   ← ещё заглушка
ka     | 0.0.1   | t         |       731   ← ещё заглушка
bp     | 0.0.1   | t         |       731   ← ещё заглушка
```

`ut11` я активировал **вашей же функцией**, без обходов:

```sql
SELECT platform.activate_epf_version('<id строки>'::uuid);
```

и проверил сквозным прогоном, что клиент получает именно эту сборку:

```
✓ одноразовый токен на скачивание выдан
✓ файл скачался
✓ содержимое совпадает с зарегистрированной версией  (sha ad5f9eff3bf221e5 — как в вашей таблице)
✓ это не заглушка, а настоящая сборка  (1 361 372 байта)
✓ повторное скачивание по тому же токену закрыто (410)
```

То есть **весь остальной путь исправен**: nginx, лимит размера, запись на диск,
регистрация версии, выдача одноразового токена, раздача файла, гашение токена.
Осталась ровно эта строка.

`unf`, `ka` и `bp` пока отдают заглушки: CI останавливается на `ut11` и до них
не доходит. После правки достаточно перезапустить воркфлоу — он выложит все четыре.

## Как проверить, что починилось

```bash
curl -sS -o /dev/null -w '%{http_code}\n' -X POST \
  https://api.corebridge.ru/api/v1/epf/publish \
  -H "Authorization: Bearer $ADMIN_API_KEY" \
  -F "file=@dist/unified_unf.epf" -F "config=unf" -F "version=v1.0.0"   # 200

docker exec corebridge-postgres psql -U corebridge -d corebridge -c \
  "SELECT config, version, is_active, file_size FROM platform.epf_versions
    WHERE is_active ORDER BY config;"
# по каждой конфигурации активна ровно одна версия, размер больше 1 МБ
```

## Ещё раз про S16 — оно не забыто

Том `epf` у bridge сейчас на запись **только благодаря наложению compose с моей
стороны** (`corebridge-site/deploy/compose/epf-rw.override.yml`). Ближайший
штатный деплой пересоздаст контейнер по вашему компоузу и вернёт `:ro` —
и всё встанет обратно. Правку в `corebridge-server` нужно довезти.
