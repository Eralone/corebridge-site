#!/usr/bin/env python3
"""Логи nginx → data/events.db.

Запускать раньше остальных скриптов: ротация держит 14 суток, всё, что старше,
пропадает безвозвратно. Повторный запуск безопасен — строки развёрнуты
в `dedupe_key`, а он UNIQUE.

Визитом считается запрос к странице сайта от живого человека. Робота отсекают
три проверки подряд, и каждая следующая ловит то, что пропустила предыдущая:
UA, загрузка `assets/site.css`, поведение (`mktlib.mark_bots`). Третья решающая —
проверено 24.08 на своих данных: Googlebot ходит под мобильным Chrome и грузит
стили, а безголовый Chrome выполняет даже наш JavaScript.

    ./ingest_nginx.py            # последние 2 суток
    ./ingest_nginx.py --days 14  # всё, что осталось в ротации
"""

from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timezone

import mktlib as m

SALT_NAME = "ip_salt"


def get_salt(conn) -> str:
    """Соль для хеша IP. Постоянная — иначе один и тот же посетитель в разные
    дни считался бы разными людьми. Лежит в своей БД, наружу не уходит."""
    row = conn.execute("SELECT value FROM ingest_state WHERE name=?", (SALT_NAME,)).fetchone()
    if row:
        return row["value"]
    import secrets

    salt = secrets.token_hex(16)
    conn.execute(
        "INSERT INTO ingest_state (name, value, updated_at) VALUES (?,?,?)",
        (SALT_NAME, salt, datetime.now(timezone.utc).isoformat()),
    )
    conn.commit()
    return salt


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=2)
    args = ap.parse_args()

    rows = m.read_nginx(days=args.days)
    conn = m.db()
    salt = get_salt(conn)

    # IP, которые в этот день скачали site.css — то есть точно рисовали страницу
    browsers: set[tuple[str, str]] = set()
    for r in rows:
        if "assets/site.css" in r["path"] and not r["is_bot"]:
            browsers.add((r["ts"].date().isoformat(), r["ip"]))

    added = 0
    for r in rows:
        if not m.is_site_request(r) or r["method"] not in ("GET", "POST"):
            continue

        day = r["ts"].date().isoformat()
        visitor = hashlib.sha256(f"{salt}{r['ip']}{r['ua']}".encode()).hexdigest()[:16]
        utm = m.parse_utm(r["path"])

        # Проверка «качал ли этот IP site.css» отсеивает роботов, но заодно
        # теряет живых: у вернувшегося посетителя стили лежат в кеше браузера,
        # и второй раз он их не запрашивает. Обнаружено 02.09 — первый переход
        # с VC (Firefox, реферер vc.ru) был записан в роботы именно так.
        #
        # Поэтому для запросов с меткой или с внешним реферером эта проверка
        # не применяется: там источник известен, и решать должны UA и поведение
        # (`mark_bots`), а не наличие запроса за стилями. Ровно эти запросы
        # и составляют главную метрику, ошибаться в них дороже всего.
        external = bool(utm["utm_source"]) or (
            r["referrer"] not in ("", "-")
            and "corebridge.ru" not in r["referrer"]
        )
        bot = r["is_bot"] or (not external and (day, r["ip"]) not in browsers)

        key = hashlib.sha256(
            f"{r['ts'].isoformat()}{r['ip']}{r['path']}{r['status']}".encode()
        ).hexdigest()[:24]

        try:
            conn.execute(
                """INSERT INTO events
                   (ts, day, event, visitor_id, url, referrer, source,
                    utm_source, utm_medium, utm_campaign, utm_content, utm_term,
                    status, is_bot, origin, meta, dedupe_key)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (
                    r["ts"].astimezone(timezone.utc).isoformat(),
                    day,
                    "pageview",
                    visitor,
                    r["path"][:500],
                    (r["referrer"] or "")[:300],
                    m.classify_source(r["referrer"], utm["utm_source"]),
                    utm["utm_source"], utm["utm_medium"], utm["utm_campaign"],
                    utm["utm_content"], utm["utm_term"],
                    r["status"],
                    1 if bot else 0,
                    "nginx",
                    json.dumps({"ua": r["ua"][:200]}, ensure_ascii=False),
                    key,
                ),
            )
            added += 1
        except Exception as e:  # noqa: BLE001 — дубль строки лога, это норма
            if "UNIQUE" not in str(e):
                raise

    # first_touch: первый по времени источник для каждого visitor_id
    conn.execute(
        """UPDATE events SET first_touch = (
               SELECT e2.source FROM events e2
               WHERE e2.visitor_id = events.visitor_id AND e2.source <> 'internal'
               ORDER BY e2.ts LIMIT 1)
           WHERE first_touch IS NULL"""
    )
    # отсев роботов по поведению — после вставки, на всей накопленной истории
    m.mark_bots(conn)

    conn.execute(
        "INSERT OR REPLACE INTO ingest_state VALUES ('last_ingest', ?, ?)",
        (datetime.now(timezone.utc).isoformat(), datetime.now(timezone.utc).isoformat()),
    )
    conn.commit()

    total = conn.execute("SELECT count(*) c FROM events").fetchone()["c"]
    humans = conn.execute("SELECT count(*) c FROM events WHERE is_bot=0").fetchone()["c"]
    print(f"добавлено {added}, всего {total} событий, из них живых {humans}")


if __name__ == "__main__":
    main()
