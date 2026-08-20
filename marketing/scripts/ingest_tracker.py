#!/usr/bin/env python3
"""JSONL своего счётчика → data/events.db.

Счётчик (`public/assets/mkt.js` → `app/m/e/route.ts`) складывает события
построчно в marketing/data/tracker/YYYY-MM-DD.jsonl. Здесь они сводятся в ту же
таблицу, куда пишет ingest_nginx.py, но с origin='tracker'.

Почему два источника, а не один: лог nginx видит все запросы, но не отличает
человека от человека; счётчик видит человека, но его режут блокировщики и
он молчит при Do Not Track. Пересечение считается по дню и пути — в отчётах
берётся то, что полнее, а расхождение между ними само по себе полезно:
оно показывает долю посетителей с блокировщиком.

    ./ingest_tracker.py
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone

import mktlib as m

TRACKER_DIR = m.DATA / "tracker"


def main() -> None:
    if not TRACKER_DIR.exists():
        print("папки data/tracker нет — счётчик ещё не выложен на прод")
        return

    conn = m.db()
    added = skipped = 0

    for path in sorted(TRACKER_DIR.glob("*.jsonl")):
        for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                row = json.loads(line)
            except json.JSONDecodeError:
                skipped += 1
                continue

            ts = row.get("ts") or datetime.now(timezone.utc).isoformat()
            utm = row.get("utm") or {}
            ua = (row.get("ua") or "")
            key = hashlib.sha256(
                f"{ts}{row.get('visitor_id')}{row.get('url')}{row.get('event')}".encode()
            ).hexdigest()[:24]

            try:
                conn.execute(
                    """INSERT INTO events
                       (ts, day, event, visitor_id, session_id, url, referrer, source,
                        utm_source, utm_medium, utm_campaign, utm_content, utm_term,
                        first_touch, is_bot, origin, meta, dedupe_key)
                       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                    (
                        ts, ts[:10], row.get("event"),
                        row.get("visitor_id"), row.get("session_id"),
                        row.get("url"), row.get("referrer"),
                        m.classify_source(row.get("referrer") or "", utm.get("utm_source")),
                        utm.get("utm_source"), utm.get("utm_medium"), utm.get("utm_campaign"),
                        utm.get("utm_content"), utm.get("utm_term"),
                        row.get("first_touch"),
                        1 if m.BOT_RE.search(ua) else 0,
                        "tracker",
                        json.dumps({"meta": row.get("meta"), "screen": row.get("screen"),
                                    "ua": ua[:200]}, ensure_ascii=False),
                        key,
                    ),
                )
                added += 1
            except Exception as e:  # noqa: BLE001
                if "UNIQUE" not in str(e):
                    raise

    conn.commit()
    print(f"счётчик: добавлено {added}, битых строк {skipped}")


if __name__ == "__main__":
    main()
