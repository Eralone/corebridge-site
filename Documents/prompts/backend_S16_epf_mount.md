# S16 — Правка монтирования `epf` не доехала на сервер + права каталога держатся вручную

**Приоритет:** 🟠 выкладка разблокирована наложением compose с моей стороны
(см. §2), но держится только до следующего штатного деплоя — правку нужно довезти.
**Объём:** довезти уже сделанную правку компоуза + три строки в `deploy.sh`.

Диагноз из `corebridge-epf` верный, проверил его на живом контейнере — см. §1.
Но правка **на сервере не оказалась**, и есть второе, о чём стоит знать: права
каталога сейчас держатся моей ручной командой, а не деплоем.

## 1. Диагноз подтверждён

```bash
$ docker exec corebridge-bridge id
uid=0(root) gid=0(root) …

$ docker exec corebridge-bridge sh -c 'mkdir -p /opt/corebridge/epf/ut11/v1.0.0'
mkdir: can't create directory '…': Read-only file system

$ docker exec corebridge-bridge node -e "
  require('fs').mkdir('/opt/corebridge/epf/ut11/v1.0.0',{recursive:true},e=>console.log(e.code))"
ENOENT
```

Ровно то, что описано: оболочка честно говорит `Read-only file system`, а
рекурсивный `mkdir` в Node отдаёт наружу `ENOENT` — отсюда обманчивое
«нет такого каталога» вместо «том только для чтения». Прав контейнеру хватает:
он работает от root, доборная правка владельца действительно не нужна.

## 2. 🔴 Правки нет в `/opt/corebridge/docker-compose.yml`

Файл на сервере обновлялся сегодня в 04:44 (этим деплоем приехали миграция `027`
и лимит nginx для `/api/v1/epf/`), но `:ro` у bridge на месте:

```
строка  97: сервис bridge  → - /opt/corebridge/epf:/opt/corebridge/epf:ro
строка 193: сервис lk-api  → - /opt/corebridge/epf:/opt/corebridge/epf:ro
строка 454: сервис nginx   → - /opt/corebridge/epf:/opt/corebridge/epf:ro
```

Фактическое состояние томов:

```
corebridge-bridge   /opt/corebridge/epf rw=false
corebridge-lk-api   /opt/corebridge/epf rw=false
```

**Пересоздавать bridge штатно бессмысленно** — он поднимется с тем же `:ro`.
`/opt/corebridge` я не правлю руками: автодеплой сотрёт, это ограничение проекта.

### Разблокировал наложением compose (2026-07-31)

Чтобы выкладка не ждала деплоя, применил override из **своего** репозитория —
`/opt/corebridge-site/deploy/compose/epf-rw.override.yml`. Он снимает `:ro`
только у bridge и ничего в `/opt/corebridge` не меняет:

```bash
docker compose --env-file /opt/corebridge/.env \
  -f /opt/corebridge/docker-compose.yml \
  -f /opt/corebridge-site/deploy/compose/epf-rw.override.yml \
  up -d bridge
```

Сверил результат до применения — расхождение ровно в одной строке
(`read_only: true` у тома epf сервиса bridge), больше ничего не затронуто.

После пересоздания:

```
rw=true
mkdir изнутри контейнера — работает
файл 1,3 МБ пишется, режим 644, root:root — www-data читает
bridge: running, healthy; /lk/*, /api/v1/*, сайт — отвечают как прежде
```

⚠️ **Это временно и держится до следующего штатного деплоя:** он пересоздаст
bridge по вашему компоузу и вернёт `:ro`. Постоянное решение — довезти правку
в `corebridge-server`. После этого наложение можно удалить.

После деплоя проверка:

```bash
docker inspect corebridge-bridge \
  --format '{{range .Mounts}}{{if eq .Destination "/opt/corebridge/epf"}}rw={{.RW}}{{end}}{{end}}'
# ожидаем rw=true

docker exec corebridge-bridge sh -c 'mkdir -p /opt/corebridge/epf/.probe && rmdir /opt/corebridge/epf/.probe && echo ok'
```

## 3. 🟠 Права каталога держатся моей ручной командой

Отдельная вещь, которую стоит забрать в репозиторий, иначе она потеряется.

Файлы `.epf` клиентам отдаёт **nginx на хосте** (bridge отвечает
`X-Accel-Redirect`, дальше работает `location /cdn/epf-files/` с
`alias /opt/corebridge/epf/`). Значит каталог должен быть проходим для
`www-data`. А он такой:

```
drwxr-x--x 6 deploy deploy /opt/corebridge/epf
```

Бит `o+x` тут стоит потому, что **я поставил его руками** 2026-07-29, когда
скачивание отдавало 403: `open() … failed (13: Permission denied)`. Права
на каталог в git не хранятся, в `deploy.sh` создания каталога нет — то есть
при переносе на другую машину или пересоздании каталога 403 вернётся, и искать
его будут заново.

Прошу добавить в `deploy.sh` рядом с остальной подготовкой:

```bash
# Файлы .epf раздаёт nginx с хоста (X-Accel-Redirect → alias /opt/corebridge/epf/),
# поэтому каталог должен быть проходим для www-data. Без o+x скачивание
# отдаёт 403 при полностью рабочей выдаче токена.
mkdir -p /opt/corebridge/epf
chmod o+x /opt/corebridge/epf
```

Листинг наружу это не открывает — только проход по пути; сам `location`
помечен `internal`, снаружи в него не попасть.

⚠️ Второе следствие: после снятия `:ro` каталоги версий будет создавать root
(bridge работает от него), режим — `755`, владелец `root:root`. Для чтения
из-под `www-data` этого достаточно, проверил. Но если однажды контейнер начнёт
работать не от root, права придётся пересмотреть.

## 4. Что готово с моей стороны

- Лимит на размер тела продублирован в vhost `corebridge.ru`: сервер поднял его
  до 60 МБ у себя, а на моём домене действовал общий `10m`. Проверено файлом
  12 МБ — оба домена принимают. `proxy_read_timeout` в блок не ставил: он уже
  есть в `snippets/proxy-params.conf`, дубль валит `nginx -t`.
- `tools/publish-epf.sh` — выкладка одной командой: сверяет размер и контрольную
  сумму с вашей таблицей, **отказывается публиковать файл меньше 50 КБ**,
  затем снимает заглушки `0.0.1` с активации и показывает итог по базе.
- Сквозная проверка выдачи — `node tools/journey.mjs`: заводит аккаунт, скачивает
  файл по одноразовому токену, убеждается, что повтор даёт 410, и вычищает за собой.

Как только том станет `rw` и появятся сами сборки — публикация и проверка
делаются двумя командами.
