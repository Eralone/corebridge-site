#!/usr/bin/env python3
"""Просмотры опубликованных статей на площадках → data/platforms.json.

Зачем: без этой цифры вердикт по H-003 вынести нельзя. Ноль переходов
означает разное в зависимости от того, было у статьи 50 просмотров или 5000.
В первом случае площадка не дала показов и проверяется её алгоритм,
во втором текст читают, но по ссылке не идут, и проверяется текст.

В карточке гипотезы было записано, что просмотры сообщает человек. Оказалось,
их отдаёт сама страница: VC.ru кладёт счётчики в разметку (`counters.views`
и `counters.hits`). Спрашивать человека там, где цифру можно взять самому,
незачем.

`views` — сколько раз статью показали в лентах и открыли, `hits` — открытия
самой страницы. Смотреть надо на `hits`: именно из них берутся переходы.

Список публикаций — `data/publications.json`. Дописывается при каждой новой
статье, вручную или прогоном контента.

    ./fetch_platform_stats.py
"""

from __future__ import annotations

import json
import re
import urllib.error
import urllib.request
from datetime import date, datetime

import mktlib as m

PUBS = m.DATA / "publications.json"
OUT = m.DATA / "platforms.json"

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/128.0 Safari/537.36")


def fetch_vc(url: str) -> dict:
    """Счётчики статьи на VC.ru. Разметка может измениться в любой день,
    поэтому отсутствие цифр — не ошибка, а пустой результат."""
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=25) as r:
        html = r.read().decode("utf-8", "replace")

    out = {}
    block = re.search(r'"counters":\{[^}]*"views":\s*(\d+),\s*"hits":\s*(\d+)', html)
    if block:
        out["views"], out["hits"] = int(block.group(1)), int(block.group(2))
    for name, pat in (("comments", r'"comments":\s*(\d+)'),
                      ("favorites", r'"favorites":\s*(\d+)')):
        found = re.search(r'"counters":\{[^}]*' + pat, html)
        if found:
            out[name] = int(found.group(1))
    return out


FETCHERS = {"vc": fetch_vc}


def main() -> None:
    if not PUBS.exists():
        print("нет data/publications.json — публикаций ещё не было")
        return

    pubs = json.loads(PUBS.read_text(encoding="utf-8"))
    history = json.loads(OUT.read_text(encoding="utf-8")) if OUT.exists() else {}
    today = date.today().isoformat()

    for pub in pubs:
        fetcher = FETCHERS.get(pub.get("platform"))
        if not fetcher:
            print(f"нет сборщика для площадки {pub.get('platform')}, пропускаю")
            continue
        try:
            stats = fetcher(pub["url"])
        except (urllib.error.URLError, TimeoutError) as e:
            print(f"{pub['url']}: не открылась ({e})")
            continue
        if not stats:
            print(f"{pub['url']}: счётчиков в разметке нет — проверить формат")
            continue

        key = pub["url"]
        history.setdefault(key, {"platform": pub["platform"],
                                 "campaign": pub.get("campaign"),
                                 "published": pub.get("published"),
                                 "daily": {}})
        history[key]["daily"][today] = stats
        print(f"{pub.get('campaign') or key}: показов {stats.get('views')}, "
              f"открытий {stats.get('hits')}, комментариев {stats.get('comments')}")

    OUT.write_text(json.dumps(history, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"записано {OUT.relative_to(m.ROOT)} ({datetime.now():%H:%M})")


if __name__ == "__main__":
    main()
