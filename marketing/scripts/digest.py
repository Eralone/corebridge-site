#!/usr/bin/env python3
"""Утренняя сводка в Telegram. Считается по данным, без языковой модели.

Смысл разделения: цифры должны приходить каждый день независимо от того,
отработал ли прогон агента. Модель добавляет к ним объяснение и решения,
но сводка не должна зависеть от её доступности.

    ./digest.py               # за вчера, отправить
    ./digest.py --dry-run     # напечатать
    ./digest.py --week        # итоги недели вместо суток
"""

from __future__ import annotations

import argparse
import json
from datetime import date, timedelta

import mktlib as m


def load_day(d: date) -> dict | None:
    path = m.DATA / f"{d.isoformat()}.json"
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else None


def arrow(delta: int | None) -> str:
    if delta is None:
        return ""
    if delta > 15:
        return f" ↑{delta}%"
    if delta < -15:
        return f" ↓{abs(delta)}%"
    return f" ({delta:+d}%)"


def day_digest(d: date) -> str:
    data = load_day(d)
    if not data:
        return f"За {d} среза нет — daily_export.py не отработал."

    t, f = data["traffic"], data["funnel"]
    lines = [
        f"<b>Сводка за {d:%d.%m}</b>",
        f"визитов {t['visits']}{arrow(t['delta_pct'])} · просмотров {t['pageviews']} · "
        f"регистраций {f['signups']} · заявок {f['contact_requests']} · оплат {f['payments']}",
    ]

    src = [s for s in t["sources"] if s["source"] != "direct"][:4]
    if src:
        lines.append("источники: " + ", ".join(f"{s['source']} {s['visitors']}" for s in src))
    else:
        lines.append("источников кроме прямых заходов нет")

    pages = t["landing_pages"][:5]
    if pages:
        lines.append("страницы: " + ", ".join(f"{p['page']} {p['visitors']}" for p in pages))

    crawl = data.get("crawlers", {})
    if crawl:
        lines.append("роботы: " + ", ".join(f"{k} {v}" for k, v in crawl.items()))

    errs = [e for e in data.get("errors", []) if int(e["status"]) >= 500]
    if errs:
        lines.append("⚠️ 5xx: " + ", ".join(f"{e['status']}×{e['n']}" for e in errs))

    return "\n".join(lines)


def week_digest(end: date) -> str:
    days = [end - timedelta(days=i) for i in range(7)]
    cur = [load_day(d) for d in days]
    prev = [load_day(d - timedelta(days=7)) for d in days]

    def total(rows, path):
        out = 0
        for r in rows:
            if not r:
                continue
            v = r
            for key in path:
                v = (v or {}).get(key)
            out += v or 0
        return out

    parts = [f"<b>Неделя по {end:%d.%m}</b>"]
    for label, path in (("визиты", ("traffic", "visits")),
                        ("регистрации", ("funnel", "signups")),
                        ("заявки", ("funnel", "contact_requests")),
                        ("оплаты", ("funnel", "payments"))):
        now, was = total(cur, path), total(prev, path)
        delta = f" (было {was})" if was else ""
        parts.append(f"{label}: {now}{delta}")
    missing = sum(1 for r in cur if r is None)
    if missing:
        parts.append(f"⚠️ нет срезов за {missing} дн. из 7")
    return "\n".join(parts)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--week", action="store_true")
    ap.add_argument("day", nargs="?", default=m.yesterday().isoformat())
    args = ap.parse_args()

    d = date.fromisoformat(args.day)
    text = week_digest(d) if args.week else day_digest(d)
    print(text)
    if not args.dry_run:
        m.telegram(text, silent=True)


if __name__ == "__main__":
    main()
