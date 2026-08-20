#!/usr/bin/env python3
"""Отправка в рабочего бота. Отдельным скриптом — чтобы слать что угодно
из любого прогона и из шелла.

    ./notify_telegram.py "текст"
    ./notify_telegram.py --file ../content/drafts/2026-08-21-ostatki.md
    ./notify_telegram.py --file report.md --title "Сводка за вторник"
    cat x.md | ./notify_telegram.py -

Черновики постов уходят сюда же: публикуешь их ты, руками. Агент ничего
никуда не публикует — ни в канал, ни на площадки.
"""

from __future__ import annotations

import argparse
import html
import re
import sys
from pathlib import Path

import mktlib as m


def md_to_tg(text: str) -> str:
    """Markdown → тот куцый HTML, который понимает Telegram.

    Полноценный парсер здесь лишний: черновики пишутся простой разметкой,
    а неподдержанный тег телеграм отбивает ошибкой на всё сообщение.
    """
    text = html.escape(text)
    text = re.sub(r"^#{1,6}\s*(.+)$", r"<b>\1</b>", text, flags=re.M)
    text = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", text, flags=re.S)
    text = re.sub(r"(?<![\w*])\*([^*\n]+)\*(?![\w*])", r"<i>\1</i>", text)
    text = re.sub(r"`([^`\n]+)`", r"<code>\1</code>", text)
    text = re.sub(r"^---+$", "—", text, flags=re.M)
    return text


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("text", nargs="?", help="текст сообщения или - для stdin")
    ap.add_argument("--file", type=Path)
    ap.add_argument("--title")
    ap.add_argument("--raw", action="store_true", help="не переводить markdown")
    ap.add_argument("--silent", action="store_true", help="без звука")
    args = ap.parse_args()

    if args.file:
        body = args.file.read_text(encoding="utf-8")
    elif args.text == "-":
        body = sys.stdin.read()
    elif args.text:
        body = args.text
    else:
        ap.error("нужен текст, --file или -")

    payload = body if args.raw else md_to_tg(body)
    if args.title:
        payload = f"<b>{html.escape(args.title)}</b>\n\n{payload}"

    sys.exit(0 if m.telegram(payload, silent=args.silent) else 1)


if __name__ == "__main__":
    main()
