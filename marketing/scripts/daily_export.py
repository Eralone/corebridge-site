#!/usr/bin/env python3
"""Суточный срез в data/YYYY-MM-DD.json.

Сводит три источника: свою базу событий (визиты), продуктовый Postgres
(регистрации, заявки, оплаты) и обход роботов из логов. Сравнение — с медианой
того же дня недели за 4 недели, как требует промт 10_daily_metrics.md.

    ./daily_export.py            # за вчера
    ./daily_export.py 2026-08-18
"""

from __future__ import annotations

import argparse
import statistics
from datetime import date, datetime, timedelta

import mktlib as m


def q(conn, sql: str, *params):
    return [dict(r) for r in conn.execute(sql, params).fetchall()]


def visits_for(conn, day: str) -> int:
    """Визит = уникальный visitor_id за сутки. Не «просмотр»: при нашем объёме
    важно число людей, а просмотры считаются отдельно."""
    return q(conn, "SELECT count(DISTINCT visitor_id) c FROM events "
                   "WHERE day=? AND is_bot=0 AND event='pageview' AND origin='nginx'",
             day)[0]["c"]


def build(day: date) -> dict:
    d = day.isoformat()
    conn = m.db()

    pageviews = q(conn, "SELECT count(*) c FROM events WHERE day=? AND is_bot=0 "
                        "AND event='pageview' AND status<400 AND origin='nginx'", d)[0]["c"]
    visits = visits_for(conn, d)

    sources = q(conn, """SELECT source, count(DISTINCT visitor_id) visitors
                         FROM events WHERE day=? AND is_bot=0 AND source<>'internal'
                           AND origin='nginx'
                         GROUP BY 1 ORDER BY 2 DESC""", d)

    landings = q(conn, """SELECT substr(url, 1, instr(url||'?','?')-1) page,
                                 count(DISTINCT visitor_id) visitors
                          FROM events WHERE day=? AND is_bot=0 AND event='pageview'
                                AND status<400 AND origin='nginx' 
                          GROUP BY 1 ORDER BY 2 DESC LIMIT 15""", d)

    errors = q(conn, """SELECT status, count(*) n,
                               group_concat(DISTINCT substr(url,1,80)) urls
                        FROM events WHERE day=? AND status>=400
                        GROUP BY 1 ORDER BY 2 DESC""", d)

    crawlers = q(conn, """SELECT json_extract(meta,'$.ua') ua, count(*) n
                          FROM events WHERE day=? AND is_bot=1
                          GROUP BY 1 ORDER BY 2 DESC LIMIT 10""", d)
    crawl = {}
    for row in crawlers:
        ua = (row["ua"] or "").lower()
        for name in ("googlebot", "yandexbot", "bingbot", "gptbot", "claudebot", "ahrefs"):
            if name in ua:
                crawl[name] = crawl.get(name, 0) + row["n"]

    # Свой счётчик считается отдельно, а не вместе с логами: один человек виден
    # обоим источникам, и объединение засчитало бы его дважды. Здесь эта цифра
    # нужна как признак качества — сколько визитов исполнили JavaScript.
    tracked = q(conn, "SELECT count(DISTINCT visitor_id) c FROM events "
                      "WHERE day=? AND is_bot=0 AND origin='tracker'", d)[0]["c"]

    # ── продуктовые события: источник правды — БД, а не наш трекер ──────────
    def one(sql: str, default=0):
        try:
            return int(m.psql(sql)[0]["n"])
        except Exception as e:  # noqa: BLE001
            print(f"psql недоступен ({e}); ставлю null")
            return None

    signups = one(f"SELECT count(*) n FROM platform.users WHERE created_at::date = '{d}'")
    contacts = one(f"SELECT count(*) n FROM platform.contact_requests WHERE created_at::date = '{d}'")
    payments = one(f"SELECT count(*) n FROM platform.payments "
                   f"WHERE created_at::date = '{d}' AND status = 'succeeded'")

    # ── норма: медиана того же дня недели за 4 предыдущие недели ────────────
    same_weekday = []
    for k in range(1, 5):
        prev = (day - timedelta(days=7 * k)).isoformat()
        v = visits_for(conn, prev)
        if v:
            same_weekday.append(v)
    norm = statistics.median(same_weekday) if same_weekday else None
    delta = round((visits - norm) / norm * 100) if norm else None

    return {
        "date": d,
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "traffic": {
            "visits": visits,
            "pageviews": pageviews,
            "norm_visits_median_4w": norm,
            "delta_pct": delta,
            "sources": sources,
            "tracker_visits": tracked,
            "landing_pages": landings,
        },
        "funnel": {
            "visits": visits,
            "signups": signups,
            "contact_requests": contacts,
            "payments": payments,
            "visit_to_signup_pct": round(signups / visits * 100, 1) if visits and signups is not None else None,
        },
        "errors": errors,
        "crawlers": crawl,
        "notes": [
            "визит = уникальный visitor_id за сутки по логам nginx",
            "робот отсекается по UA, по загрузке site.css и по поведению (mark_bots)",
            "tracker_visits — те же визиты глазами своего счётчика, для сверки, не для сложения",
            "регистрации, заявки и оплаты взяты из platform.*, а не из событий сайта",
        ],
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("day", nargs="?", default=m.yesterday().isoformat())
    args = ap.parse_args()
    day = date.fromisoformat(args.day)

    payload = build(day)
    m.write_json(m.DATA / f"{day.isoformat()}.json", payload)

    t, f = payload["traffic"], payload["funnel"]
    print(f"{day}: визитов {t['visits']} (норма {t['norm_visits_median_4w']}), "
          f"просмотров {t['pageviews']}, регистраций {f['signups']}, "
          f"заявок {f['contact_requests']}, оплат {f['payments']}")


if __name__ == "__main__":
    main()
