#!/usr/bin/env bash
# Обёртка для cron. Две части, и они намеренно разделены:
#
#   collect  — сбор данных и сторож. Обычные скрипты, никакой языковой модели.
#              Работают всегда: не зависят ни от лимитов, ни от сети к API.
#   agent    — прогон Claude Code по промту из prompts/. Может не отработать,
#              и это не должно ломать сбор.
#
# Использование:
#   ./run.sh collect          сбор за вчера + сторож
#   ./run.sh watch            только сторож (каждые 15 минут)
#   ./run.sh digest           утренняя сводка в Telegram
#   ./run.sh agent 10_daily_metrics
#
set -uo pipefail

cd "$(dirname "$0")"
ROOT="$(cd .. && pwd)"
LOGDIR="$ROOT/logs"
mkdir -p "$LOGDIR"
STAMP="$(date +%Y-%m-%d)"
LOG="$LOGDIR/$STAMP.log"

log() { printf '%s %s\n' "$(date +%H:%M:%S)" "$*" | tee -a "$LOG"; }

case "${1:-collect}" in
  collect)
    log "── сбор данных"
    python3 ingest_nginx.py            >>"$LOG" 2>&1 || log "ingest_nginx: ошибка"
    python3 ingest_tracker.py          >>"$LOG" 2>&1 || log "ingest_tracker: ошибка"
    python3 daily_export.py            >>"$LOG" 2>&1 || log "daily_export: ошибка"
    # Вебмастер отвечает не каждый день и требует токена — его отказ не критичен
    if grep -q '^YA_WEBMASTER_TOKEN=.\+' "$ROOT/.env" 2>/dev/null; then
      python3 fetch_webmaster.py --days 7 >>"$LOG" 2>&1 || log "webmaster: ошибка"
    else
      log "webmaster: токена нет, пропускаю"
    fi
    python3 watchdog.py                >>"$LOG" 2>&1 || log "watchdog: ошибка"
    log "── сбор закончен"
    ;;

  watch)
    python3 watchdog.py >>"$LOG" 2>&1 || log "watchdog: ошибка"
    ;;

  digest)
    shift
    python3 digest.py "$@" >>"$LOG" 2>&1 || log "digest: ошибка"
    ;;

  agent)
    PROMPT="${2:?нужно имя промта, например 10_daily_metrics}"
    FILE="$ROOT/prompts/$PROMPT.md"
    [ -f "$FILE" ] || { log "нет промта $FILE"; exit 1; }

    if ! command -v claude >/dev/null 2>&1; then
      log "claude CLI не установлен — прогон агента пропущен."
      log "Ставится один раз: npm i -g @anthropic-ai/claude-code && claude login"
      exit 0
    fi

    log "── прогон агента: $PROMPT"
    cd "$ROOT"
    claude -p "$(cat "$FILE")" \
      --output-format json \
      --permission-mode acceptEdits \
      >"$LOGDIR/$STAMP-$PROMPT.json" 2>>"$LOG" \
      || log "agent $PROMPT: завершился с ошибкой"
    # расход по прогону — его смотрит человек раз в неделю (README, «Контроль»)
    python3 - "$LOGDIR/$STAMP-$PROMPT.json" <<'PY' >>"$LOG" 2>&1 || true
import json, sys
d = json.load(open(sys.argv[1]))
print(f"стоимость прогона: ${d.get('total_cost_usd', '?')}, "
      f"ходов: {d.get('num_turns', '?')}")
PY
    log "── агент закончил"
    ;;

  *)
    echo "неизвестная команда: $1" >&2
    exit 2
    ;;
esac
