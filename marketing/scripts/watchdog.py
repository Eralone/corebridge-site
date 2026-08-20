#!/usr/bin/env python3
"""Сторож: то, что должно работать даже когда никакой агент не запускался.

Языковая модель здесь не участвует намеренно. Сбор данных и сигнал «у нас
что-то сломалось или пришёл лид» обязаны переживать любой сбой прогона,
исчерпанный лимит и неудачный промт. Модель только объясняет цифры, но не
отвечает за то, дойдут ли они.

    ./watchdog.py            # проверить и отправить в Telegram
    ./watchdog.py --dry-run  # напечатать, ничего не отправляя

Ставится в cron каждые 15 минут. Повторных сообщений об одном и том же нет:
отправленное запоминается в data/watchdog_state.json.
"""

from __future__ import annotations

import argparse
import json
import socket
import ssl
import subprocess
import urllib.error
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import mktlib as m

STATE = m.DATA / "watchdog_state.json"
SITE = "https://corebridge.ru/"


def load_state() -> dict:
    if STATE.exists():
        return json.loads(STATE.read_text(encoding="utf-8"))
    return {}


def save_state(state: dict) -> None:
    m.DATA.mkdir(parents=True, exist_ok=True)
    STATE.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")


# ── Проверки ────────────────────────────────────────────────────────────────


def check_site_alive() -> list[str]:
    """Главная страница отвечает и отдаёт разметку, а не заглушку nginx."""
    try:
        req = urllib.request.Request(SITE, headers={"User-Agent": "corebridge-watchdog"})
        with urllib.request.urlopen(req, timeout=15) as r:
            body = r.read(4000).decode("utf-8", "replace")
            if r.status != 200:
                return [f"🔴 Сайт отвечает {r.status}"]
            if "CoreBridge" not in body:
                return ["🔴 Сайт отвечает 200, но в разметке нет слова CoreBridge"]
    except (urllib.error.URLError, socket.timeout, TimeoutError) as e:
        return [f"🔴 Сайт не открывается: {e}"]
    return []


def check_cert() -> list[str]:
    """Срок сертификата. Проверять надо: certbot обновляет молча, а падает громко."""
    try:
        ctx = ssl.create_default_context()
        with ctx.wrap_socket(socket.create_connection(("corebridge.ru", 443), timeout=10),
                             server_hostname="corebridge.ru") as s:
            expires = datetime.strptime(
                s.getpeercert()["notAfter"], "%b %d %H:%M:%S %Y %Z"
            ).replace(tzinfo=timezone.utc)
        left = (expires - datetime.now(timezone.utc)).days
        if left < 10:
            return [f"🔴 Сертификат corebridge.ru истекает через {left} дн."]
    except Exception as e:  # noqa: BLE001
        return [f"⚠️ Не проверить сертификат: {e}"]
    return []


def check_services() -> list[str]:
    """Наш systemd-юнит и контейнеры платформы."""
    out = []
    unit = subprocess.run(["systemctl", "is-active", "corebridge-site"],
                          capture_output=True, text=True)
    if unit.stdout.strip() != "active":
        out.append(f"🔴 corebridge-site.service: {unit.stdout.strip() or 'нет ответа'}")

    ps = subprocess.run(
        ["docker", "ps", "--format", "{{.Names}}\t{{.Status}}"],
        capture_output=True, text=True,
    )
    for line in ps.stdout.splitlines():
        name, _, status = line.partition("\t")
        if name in ("corebridge-lk-api", "corebridge-bridge", "corebridge-postgres") \
                and not status.startswith("Up"):
            out.append(f"🔴 {name}: {status}")
    return out


def check_errors(rows: list[dict]) -> list[str]:
    """5xx и всплеск 404 за последний час — по живым запросам, не по сканерам."""
    hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)
    recent = [r for r in rows if r["ts"] >= hour_ago and m.is_site_request(r)]

    fives = [r for r in recent if r["status"] >= 500]
    if fives:
        paths = ", ".join(sorted({r["path"][:60] for r in fives})[:5])
        return [f"🔴 {len(fives)} ответов 5xx за час: {paths}"]

    # 404 интересны только со ссылки с нашего же сайта — это битая ссылка,
    # которую мы сами и поставили. Сканеры круглосуточно щупают /.env, /wp-admin
    # и /_app; они тоже приходят под UA браузера, и по UA их не отличить.
    lost = [r for r in recent if r["status"] == 404 and "corebridge.ru" in r["referrer"]]
    if len(lost) >= 3:
        paths = ", ".join(sorted({r["path"][:60] for r in lost})[:5])
        return [f"⚠️ {len(lost)} переходов по битым ссылкам с самого сайта за час: {paths}"]
    return []


def check_leads(state: dict) -> list[str]:
    """Новая заявка, регистрация или оплата. Ради этого всё и затевалось —
    сообщение должно прийти в течение 15 минут, а не в утренней сводке."""
    msgs = []
    # ⚠️ Персональные данные заявки (имя, email, телефон) в Telegram не уходят.
    # Мессенджер — третья сторона и зарубежный сервис; отправлять туда ПДн
    # клиента ради удобства нельзя. В сообщении только номер обращения, откуда
    # оно и суть вопроса, остальное — в админке по этому номеру.
    checks = [
        ("last_contact_id", "заявка с формы",
         "SELECT id::text, created_at::text, ref, coalesce(source,'—') source, "
         "left(message, 200) message FROM platform.contact_requests "
         "ORDER BY created_at DESC LIMIT 1"),
        ("last_user_id", "регистрация",
         "SELECT id::text, created_at::text FROM platform.users "
         "ORDER BY created_at DESC LIMIT 1"),
        ("last_payment_id", "оплата",
         "SELECT id::text, created_at::text, amount::text, plan "
         "FROM platform.payments WHERE status IN ('succeeded','confirmed','paid') "
         "ORDER BY created_at DESC LIMIT 1"),
    ]
    for key, label, sql in checks:
        try:
            rows = m.psql(sql)
        except Exception as e:  # noqa: BLE001
            msgs.append(f"⚠️ Не прочитать {label}: {e}")
            continue
        if not rows:
            continue
        row = rows[0]
        if state.get(key) in (None, row["id"]):
            state[key] = row["id"]  # первый запуск: запоминаем, не шумим
            continue
        state[key] = row["id"]
        detail = ""
        if label == "заявка с формы":
            detail = (f"\nобращение {row.get('ref')}, откуда: {row.get('source')}"
                      f"\n{row.get('message', '')}".rstrip())
        if label == "оплата":
            detail = f"\nтариф {row.get('plan')}, сумма {row.get('amount')}"
        msgs.append(f"🟢 Новое: {label} ({row['created_at'][:16]}){detail}")
    return msgs


def check_indexing(rows: list[dict], state: dict) -> list[str]:
    """Поисковые роботы перестали ходить — сайт выпадает из индекса.
    При нашем трафике это важнее просадки визитов: терять пока нечего,
    а вот пропасть из выдачи до её появления — можно."""
    day_ago = datetime.now(timezone.utc) - timedelta(days=1)
    hits = sum(1 for r in rows if r["ts"] >= day_ago
               and ("googlebot" in r["ua"].lower() or "yandexbot" in r["ua"].lower()))
    prev = state.get("crawler_hits_24h")
    state["crawler_hits_24h"] = hits
    if hits == 0 and (prev or 0) > 0:
        return ["⚠️ За сутки ни одного захода Googlebot или YandexBot"]
    return []


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    state = load_state()
    alerts: list[str] = []

    alerts += check_site_alive()
    alerts += check_services()
    alerts += check_cert()
    alerts += check_leads(state)

    try:
        rows = m.read_nginx(days=1)
        alerts += check_errors(rows)
        alerts += check_indexing(rows, state)
    except RuntimeError as e:
        alerts.append(f"⚠️ Логи nginx недоступны: {e}")

    # одно и то же не повторяем чаще раза в 6 часов
    now = datetime.now(timezone.utc)
    sent = state.setdefault("sent", {})
    fresh = []
    for a in alerts:
        key = a[:60]
        last = sent.get(key)
        if last and now - datetime.fromisoformat(last) < timedelta(hours=6):
            continue
        sent[key] = now.isoformat()
        fresh.append(a)
    state["sent"] = {k: v for k, v in sent.items()
                     if now - datetime.fromisoformat(v) < timedelta(days=3)}

    if fresh:
        text = "<b>corebridge.ru</b>\n" + "\n\n".join(fresh)
        print(text)
        if not args.dry_run:
            m.telegram(text)
    else:
        print(f"{now:%H:%M} — всё в порядке, сообщать нечего")

    if not args.dry_run:
        save_state(state)


if __name__ == "__main__":
    main()
