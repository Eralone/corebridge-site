#!/usr/bin/env python3
"""Ручной ввод статистики площадки, которая не отдаёт её сама.

VC кладёт счётчики прямо в разметку страницы, и `fetch_platform_stats.py`
снимает их сам. Дзен на анонимный запрос отдаёт заглушку авторизации
(проверено 08.09), поэтому его просмотры называет человек, из кабинета автора.

    ./add_stat.py zakazy --platform dzen --views 1200 --hits 140
    ./add_stat.py zakazy --platform dzen --hits 140

`hits` - открытия статьи, из них берутся переходы; `views` - показы в лентах.
Если площадка даёт одну цифру, кладите её в `hits`: сравнение с VC идёт
именно по открытиям.
"""

from __future__ import annotations

import argparse
import json
from datetime import date

import mktlib as m

OUT = m.DATA / "platforms.json"
PUBS = m.DATA / "publications.json"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("campaign", help="метка публикации, например zakazy")
    ap.add_argument("--platform", default="dzen")
    ap.add_argument("--views", type=int)
    ap.add_argument("--hits", type=int)
    ap.add_argument("--comments", type=int)
    args = ap.parse_args()

    if args.views is None and args.hits is None:
        ap.error("нужно хотя бы одно из --views или --hits")

    pubs = json.loads(PUBS.read_text(encoding="utf-8")) if PUBS.exists() else []
    pub = next((p for p in pubs
                if p.get("campaign") == args.campaign and p.get("platform") == args.platform), None)
    if not pub:
        ap.error(f"в publications.json нет публикации {args.campaign} на площадке "
                 f"{args.platform} - сначала добавьте её туда")

    history = json.loads(OUT.read_text(encoding="utf-8")) if OUT.exists() else {}
    rec = history.setdefault(pub["url"], {
        "platform": args.platform, "campaign": args.campaign,
        "published": pub.get("published"), "daily": {},
    })
    stats = {k: v for k, v in (("views", args.views), ("hits", args.hits),
                               ("comments", args.comments)) if v is not None}
    stats["source"] = "вручную"
    rec["daily"][date.today().isoformat()] = stats

    OUT.write_text(json.dumps(history, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"{args.campaign} ({args.platform}): {stats}")


if __name__ == "__main__":
    main()
