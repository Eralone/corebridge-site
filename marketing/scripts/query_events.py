#!/usr/bin/env python3
"""Обёртка для чтения. Единственный способ, которым агент трогает данные.

    ./query_events.py "SELECT day, count(*) FROM events WHERE is_bot=0 GROUP BY 1"
    ./query_events.py --pg "SELECT count(*) FROM platform.users"
    ./query_events.py --json "SELECT ..."

Пишущие запросы не проходят: в SQLite подключение открывается в режиме
read-only, в Postgres запрос отбивает проверка в mktlib.psql. Ограничение
намеренно жёсткое — эти же скрипты зовёт cron без человека рядом.
"""

from __future__ import annotations

import argparse
import json
import sqlite3
import sys

import mktlib as m


def sqlite_ro(sql: str) -> list[dict]:
    if not m.DB_PATH.exists():
        raise SystemExit("data/events.db ещё нет — сначала ./ingest_nginx.py")
    conn = sqlite3.connect(f"file:{m.DB_PATH}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    return [dict(r) for r in conn.execute(sql).fetchall()]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("sql")
    ap.add_argument("--pg", action="store_true", help="запрос в продуктовый Postgres")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    rows = m.psql(args.sql) if args.pg else sqlite_ro(args.sql)

    if args.json:
        json.dump(rows, sys.stdout, ensure_ascii=False, indent=2, default=str)
        print()
        return

    if not rows:
        print("(пусто)")
        return

    cols = list(rows[0].keys())
    widths = [max(len(c), *(len(str(r.get(c, ""))) for r in rows)) for c in cols]
    print(" | ".join(c.ljust(w) for c, w in zip(cols, widths)))
    print("-+-".join("-" * w for w in widths))
    for r in rows:
        print(" | ".join(str(r.get(c, "")).ljust(w) for c, w in zip(cols, widths)))
    print(f"\n{len(rows)} строк")


if __name__ == "__main__":
    main()
