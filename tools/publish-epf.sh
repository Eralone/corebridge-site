#!/bin/bash
# Выкладка реальных сборок .epf на прод — по инструкции сервера
# (Documents/server_ask/server_verify_epf_publish.md), шаги 2–5 одной командой.
#
#   tools/publish-epf.sh /путь/к/corebridge-epf/dist [версия]
#
# Версия по умолчанию v1.0.0 — тот же формат, что у автовыкладки из CI.
# Другой формат создал бы на диске второй каталог для той же версии.
#
# Файлы .epf в этом репозитории не лежат и лежать не должны: они собираются
# в corebridge-epf. Скрипт только выкладывает то, что ему дали, и проверяет,
# что выложилось именно оно.
#
# ⚠️ Перед публикацией сверяет размер и контрольную сумму с таблицей сервера.
# Это защита от повторения истории с заглушками: в июле на прод уехали
# 731-байтовые текстовые файлы, и клиенты «скачивали» их как обработки 1С.

set -uo pipefail

DIST="${1:-}"
VERSION="${2:-v1.0.0}"
CONFIGS=(ut11 unf ka bp)

# Размеры и первые 16 символов sha256 из §3.4 ответа сервера
declare -A EXPECT_SIZE=( [ut11]=1361372 [unf]=1343502 [ka]=1349596 [bp]=1226312 )
declare -A EXPECT_SHA=(
  [ut11]=ad5f9eff3bf221e5 [unf]=a158d4b851a7bbc9
  [ka]=7cd2dc320e89e0d4  [bp]=b08ec00db270dc6e
)

if [ -z "$DIST" ] || [ ! -d "$DIST" ]; then
  echo "Укажите каталог dist из corebridge-epf:"
  echo "  tools/publish-epf.sh /путь/к/corebridge-epf/dist [версия]"
  exit 2
fi

TOKEN="$(sudo grep '^ADMIN_API_KEY=' /opt/corebridge/.env | cut -d= -f2)"
if [ -z "$TOKEN" ]; then echo "Не нашёл ADMIN_API_KEY в /opt/corebridge/.env"; exit 2; fi

fail=0

echo "── 1. Сверка файлов с тем, что сервер собрал и проверил ──"
for c in "${CONFIGS[@]}"; do
  f="$DIST/unified_${c}.epf"
  if [ ! -f "$f" ]; then echo "  ✗ $c — файла нет: $f"; fail=1; continue; fi
  size=$(stat -c%s "$f")
  sha=$(sha256sum "$f" | cut -c1-16)
  if [ "$size" -lt 51200 ]; then
    echo "  ✗ $c — файл меньше 50 КБ ($size б). Это заглушка, публиковать нельзя."
    fail=1
  elif [ "$size" != "${EXPECT_SIZE[$c]}" ] || [ "$sha" != "${EXPECT_SHA[$c]}" ]; then
    echo "  ! $c — расходится с таблицей сервера: $size б / $sha"
    echo "      ожидалось: ${EXPECT_SIZE[$c]} б / ${EXPECT_SHA[$c]}"
    echo "      это не обязательно ошибка — сборка могла обновиться. Убедитесь сами."
  else
    echo "  ✓ $c — $size б, $sha"
  fi
done
[ $fail -eq 1 ] && { echo; echo "Публикация не начиналась."; exit 1; }

echo
echo "── 2. Проба лимита nginx (ничего не публикуем) ──"
probe=$(mktemp); head -c 1300000 /dev/urandom > "$probe"
code=$(curl -sS -o /dev/null -w '%{http_code}' -X POST \
  https://api.corebridge.ru/api/v1/epf/publish \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@$probe" -F "config=НЕВЕРНЫЙ" -F "version=v9.9.9")
rm -f "$probe"
if [ "$code" = "413" ]; then
  echo "  ✗ 413 — nginx всё ещё режет по размеру. Дальше идти нельзя."
  exit 1
fi
echo "  ✓ $code — файл проходит до приложения"

echo
echo "── 3. Публикация ──"
for c in "${CONFIGS[@]}"; do
  printf '  %-5s → ' "$c"
  curl -sS -w ' [%{http_code}]\n' -X POST \
    https://api.corebridge.ru/api/v1/epf/publish \
    -H "Authorization: Bearer $TOKEN" \
    -F "file=@$DIST/unified_${c}.epf" \
    -F "config=${c}" \
    -F "version=${VERSION}"
done

echo
echo "── 4. Что записалось в базу ──"
docker exec corebridge-postgres psql -U corebridge -d corebridge -c \
  "SELECT config, version, is_active, file_size, left(sha256,16) AS sha
     FROM platform.epf_versions ORDER BY config, released_at DESC;"

echo "── 5. Снимаем заглушки 0.0.1 с активации (записи остаются в истории) ──"
docker exec corebridge-postgres psql -U corebridge -d corebridge -c \
  "UPDATE platform.epf_versions SET is_active = FALSE, is_deprecated = TRUE
    WHERE version = '0.0.1';"
docker exec corebridge-postgres psql -U corebridge -d corebridge -c \
  "SELECT config, count(*) FILTER (WHERE is_active) AS активных
     FROM platform.epf_versions GROUP BY config ORDER BY config;"

echo
echo "Дальше — сквозная проверка выдачи с живой сессией:"
echo "  CB_SESSION=<cookie> node tools/journey.mjs"
echo "Она скачает файл через одноразовый токен и убедится, что токен гаснет."
