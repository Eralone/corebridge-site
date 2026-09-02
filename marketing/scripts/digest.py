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


def stale_reminder() -> str:
    """Напоминание, если разбора давно не было.

    Прогонов модели по расписанию нет — их запускает человек в сессии
    командой /mkt-*. Данные копятся сами, но без разбора они так и останутся
    файлами. Одна строка в сводке лучше, чем молчание на две недели.
    """
    reports = list((m.ROOT / "reports").glob("*.md"))
    if not reports:
        return "\n⚠️ Разбора не было ни разу. В сессии: /mkt-daily"

    # Дата берётся из времени файла, а не из имени: недельные отчёты называются
    # 2026-W35-weekly.md, и разбор имени на них молча падал — напоминание
    # переставало приходить именно тогда, когда отчёты начинали появляться.
    stamp = date.fromtimestamp(max(p.stat().st_mtime for p in reports))
    days = (date.today() - stamp).days
    if days >= 3:
        return f"\n⚠️ Последний разбор {stamp:%d.%m}, {days} дн. назад. В сессии: /mkt-daily"
    return ""


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


# Цели по переходам в месяц: (последний день периода, прямые, непрямые).
# Заданы Дмитрием 2026-08-20, см. CLAUDE.md раздел 3. Даты — конец квартала.
GOALS = [
    (date(2026, 9, 30), 300, 50),
    (date(2026, 12, 31), 1000, 200),
]


def month_progress() -> str:
    """Где мы относительно цели месяца.

    Прямые и непрямые считаются раздельно: прямые растут сами и работу
    не показывают, смотреть надо на непрямые (CLAUDE.md, раздел 3).
    """
    today = date.today()
    start = today.replace(day=1).isoformat()
    conn = m.db()

    def count(extra: str = "") -> int:
        return conn.execute(
            "SELECT count(DISTINCT visitor_id || day) c FROM events "
            "WHERE day >= ? AND is_bot = 0 AND event = 'pageview' AND origin = 'nginx' "
            + extra, (start,)
        ).fetchone()["c"]

    direct = count("AND source IN ('direct', 'internal')")
    indirect = count("AND source NOT IN ('direct', 'internal', 'referrer-spam')")

    goal = next((g for g in GOALS if today <= g[0]), GOALS[-1])
    _, goal_direct, goal_indirect = goal

    # доля прошедшего месяца — чтобы «12 из 50» читалось как «отстаём» или «идём
    # с опережением», а не как загадка в начале месяца
    import calendar
    share = today.day / calendar.monthrange(today.year, today.month)[1]
    pace = "с опережением" if indirect >= goal_indirect * share else "отстаём"

    return (f"\nс начала месяца: прямых {direct} из {goal_direct}, "
            f"<b>непрямых {indirect} из {goal_indirect}</b> — {pace}")


def publications() -> str:
    """Опубликованное и что оно принесло.

    Две цифры рядом, потому что порознь они обманывают: 500 открытий без
    переходов означает «текст читают, но ссылка не работает», а 20 открытий
    без переходов означает «площадка не показала», и это разные выводы.
    """
    path = m.DATA / "platforms.json"
    if not path.exists():
        return ""
    data = json.loads(path.read_text(encoding="utf-8"))
    if not data:
        return ""

    conn = m.db()
    lines = []
    for url, rec in data.items():
        daily = rec.get("daily") or {}
        if not daily:
            continue
        last = daily[max(daily)]
        campaign = rec.get("campaign") or "—"
        clicks = conn.execute(
            "SELECT count(DISTINCT visitor_id) c FROM events "
            "WHERE utm_campaign = ? AND is_bot = 0 AND origin = 'nginx'", (campaign,)
        ).fetchone()["c"]
        lines.append(f"{campaign} ({rec.get('platform')}): "
                     f"открытий {last.get('hits', '?')}, переходов {clicks}")
    return "\nпубликации: " + " · ".join(lines) if lines else ""


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
    text = ((week_digest(d) if args.week else day_digest(d))
            + publications() + month_progress() + stale_reminder())
    print(text)
    if not args.dry_run:
        m.telegram(text, silent=True)


if __name__ == "__main__":
    main()
