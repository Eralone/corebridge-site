#!/usr/bin/env python3
"""Яндекс.Вебмастер → data/search/YYYY-MM-DD.json.

Единственная внешняя зависимость всей системы. Без него мы не видим, по каким
запросам сайт вообще показывается — а на этапе, где трафика почти нет, это
главный источник смысла: показы появляются раньше кликов.

Нужен OAuth-токен, инструкция — reports/bootstrap.md, шаг 3. Токен в .env,
в репозиторий не едет.

    ./fetch_webmaster.py             # вчера
    ./fetch_webmaster.py --days 28   # диапазон, для недельного разбора
    ./fetch_webmaster.py --setup     # показать user_id и host_id по токену
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, timedelta

import mktlib as m

API = "https://api.webmaster.yandex.net/v4"


def call(path: str, params: dict | None = None) -> dict:
    token = m.ENV.get("YA_WEBMASTER_TOKEN")
    if not token:
        sys.exit("в .env нет YA_WEBMASTER_TOKEN — см. reports/bootstrap.md, шаг 3")
    url = f"{API}{path}"
    if params:
        url += "?" + urllib.parse.urlencode(params, doseq=True)
    req = urllib.request.Request(url, headers={"Authorization": f"OAuth {token}"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        sys.exit(f"Вебмастер {e.code}: {e.read().decode('utf-8', 'replace')[:400]}")


def setup() -> None:
    """Печатает user_id и host_id — их надо один раз положить в .env."""
    uid = call("/user")["user_id"]
    print(f"YA_WEBMASTER_USER_ID={uid}")
    for h in call(f"/user/{uid}/hosts")["hosts"]:
        mark = "  ← это наш" if "corebridge.ru" in h["ascii_host_url"] else ""
        print(f"YA_WEBMASTER_HOST_ID={h['host_id']}   {h['ascii_host_url']} "
              f"[{h['verified'] and 'подтверждён' or 'НЕ подтверждён'}]{mark}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=1)
    ap.add_argument("--setup", action="store_true")
    args = ap.parse_args()

    if args.setup:
        setup()
        return

    uid, host = m.ENV.get("YA_WEBMASTER_USER_ID"), m.ENV.get("YA_WEBMASTER_HOST_ID")
    if not uid or not host:
        sys.exit("в .env нет YA_WEBMASTER_USER_ID / HOST_ID — запусти --setup")

    to = m.yesterday()
    frm = to - timedelta(days=args.days - 1)
    base = f"/user/{uid}/hosts/{host}"
    common = {"date_from": frm.isoformat(), "date_to": to.isoformat()}

    # Запросы: показы, клики, позиция. TOTAL_SHOWS — сортировка по показам,
    # потому что кликов у нас пока может не быть вовсе.
    queries = call(f"{base}/search-queries/popular", {
        **common,
        "order_by": "TOTAL_SHOWS",
        "query_indicator": ["TOTAL_SHOWS", "TOTAL_CLICKS", "AVG_SHOW_POSITION",
                            "AVG_CLICK_POSITION"],
        "limit": 500,
    })

    # Страницы в поиске: сколько наших страниц Яндекс реально держит в индексе
    try:
        indexing = call(f"{base}/search-urls/in-search/history", common)
    except SystemExit:
        indexing = {}

    payload = {
        "date_from": frm.isoformat(),
        "date_to": to.isoformat(),
        "queries": queries.get("queries", []),
        "queries_count": queries.get("count"),
        "in_search_history": indexing.get("history", []),
    }
    m.write_json(m.DATA / "search" / f"{to.isoformat()}.json", payload)

    qs = payload["queries"]
    shows = sum(q.get("indicators", {}).get("TOTAL_SHOWS", 0) or 0 for q in qs)
    clicks = sum(q.get("indicators", {}).get("TOTAL_CLICKS", 0) or 0 for q in qs)
    print(f"{frm}..{to}: запросов {len(qs)}, показов {shows}, кликов {clicks}")
    for q in sorted(qs, key=lambda x: -(x.get("indicators", {}).get("TOTAL_SHOWS") or 0))[:10]:
        i = q.get("indicators", {})
        print(f"  {i.get('TOTAL_SHOWS', 0):>5} показов  поз. "
              f"{i.get('AVG_SHOW_POSITION', 0):>5}  {q.get('query_text', '')[:60]}")


if __name__ == "__main__":
    main()
