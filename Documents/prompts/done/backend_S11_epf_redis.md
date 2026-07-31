# S11 — Скачивание .epf не работает: клиент Redis в lk-api ходит без пароля

**Приоритет:** 🔴 блокирует выдачу файла .epf всем пользователям.
**Объём:** одна строка. Кода писать почти не нужно.

## Что происходит

`GET /lk/epf/download?config=ut11` отвечает `500 {"error":"REDIS_ERROR"}`.
В логах `corebridge-lk-api`:

```json
{"level":"error","event":"epf_redis_error","msg":"NOAUTH Authentication required."}
{"level":"error","event":"epf_token_redis_error","msg":"NOAUTH Authentication required."}
```

## Причина

`src/services/lk/epf_download.service.js` поднимает **свой** клиент Redis, отдельный от
сессионного, и берёт адрес из `REDIS_URL`:

```js
const url = process.env.REDIS_URL || 'redis://redis:6379/0';
epfRedis = new Redis(url, { maxRetriesPerRequest: 3, lazyConnect: false });
```

А в окружении контейнера:

```
REDIS_PASSWORD=…
SESSION_REDIS_URL=redis://:…@redis:6379/1     ← с паролем, поэтому сессии работают
REDIS_URL=redis://redis:6379                  ← без пароля и без номера БД
```

Redis требует аутентификации, клиент её не проходит — запись одноразового токена
падает, и до выдачи файла дело не доходит никогда. Сессии при этом живы, потому что
`src/lib/redis.js` использует `SESSION_REDIS_URL`, где пароль есть.

Заодно в `REDIS_URL` не указана база. Токены .epf должны лежать в **DB=0** — оттуда их
читает bridge (`/cdn/epf/download`). Сейчас спасает только умолчание Redis.

## Что сделать

**Вариант 1 (предпочтительный) — поправить переменную окружения.** В `.env` платформы:

```
REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379/0
```

Проверить, что ту же переменную не используют другие сервисы с расчётом на другую базу.

**Вариант 2 — не полагаться на формат URL.** В `epf_download.service.js`:

```js
epfRedis = new Redis(url, {
  password: process.env.REDIS_PASSWORD,   // URL может прийти без учётных данных
  db: 0,                                  // токены читает bridge из DB=0
  maxRetriesPerRequest: 3,
  lazyConnect: false,
});
```

Вариант 2 надёжнее: он не ломается, если кто-то поправит `REDIS_URL` в другую сторону.
Хорошо бы сделать оба.

## Как проверить, что починилось

```bash
# 1. Токен выдаётся
curl -s -H "Cookie: lk_session=<сессия>" \
  'https://corebridge.ru/lk/epf/download?config=ut11'
# ожидаем: {"token":"…","version":"…","sha256":"…","expiresIn":600,"downloadUrl":"/cdn/epf/download?token=…"}

# 2. Файл отдаётся по этому адресу и токен одноразовый
curl -s -o /tmp/x.epf -w '%{http_code}\n' 'https://corebridge.ru/cdn/epf/download?token=<token>'   # 200
curl -s -o /dev/null -w '%{http_code}\n' 'https://corebridge.ru/cdn/epf/download?token=<token>'    # 410
```

## Что уже сделано на стороне сайта

- В `platform.epf_versions` заведены **временные заглушки** для всех четырёх конфигураций
  (`ut11`, `unf`, `ka`, `bp`), версия `0.0.1`, файлы лежат в
  `/opt/corebridge/epf/<config>/0.0.1/unified_<config>.epf`. Это **не рабочие обработки 1С**,
  а текстовые файлы-заглушки: нужны, чтобы сквозной путь можно было проверить до появления
  настоящих сборок. Каталог `epf/` в git не отслеживается — автодеплой их не затрёт.
  Подробности и порядок замены — `Documents/test_account.md` и `BACKLOG.md`.
- В vhost `corebridge.ru` добавлен маршрут `/cdn/` → bridge (3001): без него ссылка
  `downloadUrl` вела бы в никуда. Правка в нашем файле, бэкенда не касается.
- Экран `/epf` уже умеет обрабатывать `REDIS_ERROR` — показывает, что скачивание временно
  недоступно, а не молчит.
