#!/bin/bash
# Фаза 2 удаления аккаунтов (S8 §3.3): физическая чистка тенантов,
# у которых истёк 30-дневный срок в статусе pending_deletion.
#
# Вызывает скрипт, который ездит внутри образа admin. Раньше здесь был прямой
# вызов purgeExpired() через `node -e`: обёртки сервера (`scripts/purge-deleted-tenants.js`)
# в образе не было, а на хосте не было её зависимостей. С пакетом S15 сервер
# положил рабочий скрипт в образ — переключились на него.
#
# ⚠️ Почему это важнее, чем кажется. Прежний вызов возвращал ноль, даже если
# часть тенантов вычистить не удалось: в лог шло `OK`, и дефект S15 месяц был
# невидим — ночная чистка «успешно» падала на каждом аккаунте с записями
# в журнале. Новый скрипт возвращает `failed` и завершается с кодом 1 при любой
# неудаче, поэтому cron и мониторинг её заметят.
#
# Источник файла: corebridge-site/deploy/cron/corebridge-purge.sh
# Устанавливается в /usr/local/bin/, запускается из /etc/cron.d/corebridge-purge
#
# Сухой прогон, ничего не удаляя:
#   docker exec corebridge-admin node src/scripts/purge_expired.js --dry-run

set -uo pipefail

CONTAINER="corebridge-admin"
SCRIPT="src/scripts/purge_expired.js"
LOG="/var/log/corebridge-purge.log"
TS="$(date -Is)"

log() { echo "$TS $*" >>"$LOG"; }

if ! docker inspect -f '{{.State.Running}}' "$CONTAINER" 2>/dev/null | grep -q true; then
  log "SKIP контейнер $CONTAINER не запущен"
  exit 0
fi

OUT="$(docker exec "$CONTAINER" node "$SCRIPT" 2>&1)"
RC=$?

if [ $RC -eq 0 ]; then
  log "OK $OUT"
else
  # ненулевой код — были неудачные тенанты либо скрипт не отработал.
  # Не глушим: пусть cron пришлёт письмо, а мониторинг увидит код возврата.
  log "FAIL rc=$RC $OUT"
fi

exit $RC
