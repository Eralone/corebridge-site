#!/bin/bash
# Фаза 2 удаления аккаунтов (S8 §3.3): физическая чистка тенантов,
# у которых истёк 30-дневный срок в статусе pending_deletion.
#
# Почему не так, как предлагал сервер:
#   docker exec corebridge-admin node scripts/purge-deleted-tenants.js
# Скрипт-обёртка лежит только на хосте (/opt/corebridge/scripts/), в Docker-образ
# admin он не попал, а на хосте нет его зависимостей (dotenv, services/admin/src/...).
# Зато сам сервис в образе есть и экспортирует purgeExpired() — вызываем его напрямую.
# Если обёртку когда-нибудь добавят в образ, можно вернуться к варианту сервера.
#
# Источник файла: corebridge-site/deploy/cron/corebridge-purge.sh
# Устанавливается в /usr/local/bin/, запускается из /etc/cron.d/corebridge-purge

set -uo pipefail

CONTAINER="corebridge-admin"
SERVICE="/app/src/services/admin/privacy_admin.service"
LOG="/var/log/corebridge-purge.log"
TS="$(date -Is)"

log() { echo "$TS $*" >>"$LOG"; }

if ! docker inspect -f '{{.State.Running}}' "$CONTAINER" 2>/dev/null | grep -q true; then
  log "SKIP контейнер $CONTAINER не запущен"
  exit 0
fi

OUT="$(docker exec "$CONTAINER" node -e "
require('$SERVICE')
  .purgeExpired()
  .then(r => { console.log(JSON.stringify(r)); process.exit(0); })
  .catch(e => { console.error(e && e.message ? e.message : String(e)); process.exit(1); });
" 2>&1)"
RC=$?

if [ $RC -eq 0 ]; then
  log "OK $OUT"
else
  log "FAIL rc=$RC $OUT"
fi

exit $RC
