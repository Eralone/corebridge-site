# Промт для claude-code на VPS — проверить выкладку .epf после починки nginx

> Кому: агенту, работающему **на сервере** (есть shell на VPS).
> От: `corebridge-server`, 2026-07-30.
> Задача: убедиться, что конфиг nginx применился, и выложить четыре реальные
> обработки 1С вместо заглушек. Кода писать не нужно — только проверить и выполнить.

## Что было и что уже починено

1. Выкладка `.epf` (`POST /api/v1/epf/publish`) отвечала `413 Payload Too Large`.
   Отвечал **nginx**, до приложения запрос не доходил: обработки весят 1.17–1.30 МБ,
   а действовало умолчание `client_max_body_size` = 1 МБ.
2. Правка (отдельный `location /api/v1/epf/` с лимитом 60 МБ) была внесена, но
   **не применялась**: в ней стоял `proxy_read_timeout`, который уже задан в
   `snippets/proxy-params.conf`. Повтор одиночной директивы в одном контексте —
   `[emerg] directive is duplicate`, `nginx -t` падал, reload не выполнялся,
   nginx продолжал работать со старым конфигом.
3. `deploy.sh` при этом писал строку в лог и завершался успешно — отказ был не виден.

**Оба дефекта исправлены в main** (коммиты `854b439`, `4b8570e`):
- дубль директивы убран;
- провал `nginx -t` теперь останавливает деплой с кодом 1 и шлёт алёрт.

## Шаг 1. Убедиться, что новый конфиг реально применён

```bash
# 1.1 Конфиг валиден (должно быть «syntax is ok» + «test is successful»)
nginx -t

# 1.2 Новый location приехал на сервер
grep -A6 'location /api/v1/epf/' /etc/nginx/sites-enabled/api.corebridge.ru.conf

# 1.3 Лимит действительно 60m в этом блоке
nginx -T 2>/dev/null | grep -B2 -A6 'location /api/v1/epf/'
```

Если `nginx -t` проходит, а строки из 1.2 нет — конфиг не синхронизировался:
перезапустите деплой из main либо скопируйте файл вручную из
`/opt/corebridge/nginx/sites-enabled/` и сделайте `nginx -s reload`.

Если `nginx -t` падает — покажите его вывод целиком, там будет файл и строка.

## Шаг 2. Проверить лимит, ничего не публикуя

Неразрушающая проба: отправляем файл нужного размера с **заведомо неверным**
`config`. Приложение отвергнет его само (`400 invalid_config`), в БД ничего
не попадёт. Нас интересует только код ответа.

```bash
TOKEN=$(grep '^ADMIN_API_KEY=' /opt/corebridge/.env | cut -d= -f2)

head -c 1300000 /dev/urandom > /tmp/probe.epf
curl -sS -o /dev/null -w '%{http_code}\n' -X POST \
  https://api.corebridge.ru/api/v1/epf/publish \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/tmp/probe.epf" -F "config=НЕВЕРНЫЙ" -F "version=v9.9.9"
rm -f /tmp/probe.epf
```

- `400` — nginx пропускает, лимит снят, можно публиковать.
- `413` — лимит всё ещё режет, **дальше не идите**, вернитесь к шагу 1.

## Шаг 3. Выложить четыре реальные обработки

Файлы лежат в репозитории `corebridge-epf`, каталог `dist/`:
`unified_ut11.epf`, `unified_unf.epf`, `unified_ka.epf`, `unified_bp.epf`.
Если на сервере их нет — скопируйте с рабочей машины (`scp`) или возьмите из
свежего клона `corebridge-epf`.

```bash
TOKEN=$(grep '^ADMIN_API_KEY=' /opt/corebridge/.env | cut -d= -f2)
DIST=/путь/к/corebridge-epf/dist

for c in ut11 unf ka bp; do
  echo -n "$c → "
  curl -sS -w ' [%{http_code}]\n' -X POST \
    https://api.corebridge.ru/api/v1/epf/publish \
    -H "Authorization: Bearer $TOKEN" \
    -F "file=@${DIST}/unified_${c}.epf" \
    -F "config=${c}" \
    -F "version=v1.0.0"
done
```

Ожидается по каждой: `{"ok":true,"url":"…","version":"v1.0.0"} [200]`.

**Контрольные суммы исходников** — сверьте, что выкладываете именно эти файлы:

| Конфигурация | Размер, байт | sha256 (первые 16) |
|---|---|---|
| `ut11` | 1 361 372 | `ad5f9eff3bf221e5` |
| `unf`  | 1 343 502 | `a158d4b851a7bbc9` |
| `ka`   | 1 349 596 | `7cd2dc320e89e0d4` |
| `bp`   | 1 226 312 | `b08ec00db270dc6e` |

```bash
sha256sum ${DIST}/unified_*.epf | cut -c1-16,66-
```

## Шаг 4. Проверить, что клиенты получают именно эти файлы

```bash
# 4.1 В БД активна версия v1.0.0 по всем четырём конфигурациям
docker exec corebridge-postgres psql -U corebridge -d corebridge -c \
  "SELECT config, version, is_active, file_size, left(sha256,16) AS sha
     FROM platform.epf_versions ORDER BY config, version;"

# 4.2 Файлы на диске
ls -la /opt/corebridge/epf/*/v1.0.0/

# 4.3 Сквозной путь скачивания (нужна живая cookie lk_session из ЛК)
curl -s -H "Cookie: lk_session=<сессия>" \
  'https://corebridge.ru/lk/epf/download?config=ut11'
# → {"token":"…","version":"v1.0.0","sha256":"…","expiresIn":600,"downloadUrl":"/cdn/epf/download?token=…"}

curl -s -o /tmp/x.epf -w '%{http_code}\n' 'https://corebridge.ru/cdn/epf/download?token=<token>'  # 200
sha256sum /tmp/x.epf        # должен совпасть с таблицей выше
curl -s -o /dev/null -w '%{http_code}\n' 'https://corebridge.ru/cdn/epf/download?token=<token>'   # 410, токен одноразовый
```

Шаг 4.3 заодно подтверждает починку S11 (клиент Redis в lk-api ходил без пароля).

## Шаг 5. Снять заглушки с активации

После успешной проверки версии `0.0.1` (текстовые заглушки) больше не нужны:

```bash
docker exec corebridge-postgres psql -U corebridge -d corebridge -c \
  "UPDATE platform.epf_versions SET is_active = FALSE, is_deprecated = TRUE
    WHERE version = '0.0.1';"
```

Записи останутся в истории версий — это намеренно, удалять их не нужно.

⚠️ Убедитесь, что после этого по каждой конфигурации активна **ровно одна**
версия:

```bash
docker exec corebridge-postgres psql -U corebridge -d corebridge -c \
  "SELECT config, count(*) FILTER (WHERE is_active) AS active
     FROM platform.epf_versions GROUP BY config;"
```

## Что сообщить обратно

1. Вывод `nginx -t` и результат шага 2 (`400` или `413`).
2. Ответы сервера по четырём конфигурациям из шага 3.
3. Совпали ли контрольные суммы в шаге 4.3.
4. Если что-то не сошлось — приложите вывод `docker logs corebridge-bridge --tail 50`
   и `nginx -T | grep -A6 'location /api/v1/epf/'`.

## Чего делать НЕ нужно

- Не правьте `/etc/nginx/**` вручную: конфиги приезжают из репозитория
  (`/opt/corebridge/nginx/` → симлинки), ручная правка потеряется на следующем деплое.
  Если нужна правка конфига — она делается в `corebridge-server`.
- Не публикуйте .epf под версией, отличной от `v1.0.0`, без необходимости:
  формат версии общий с автовыкладкой из CI, а каталог на диске называется по ней.
- Не удаляйте строки `platform.epf_versions` — только снимайте активацию.
