#!/usr/bin/env python3
"""Показать чаты, из которых боту писали, и проверить доставку.

Нужен один раз при настройке. Телеграм не даёт боту написать первым: пока
человек не отправил боту хотя бы одно сообщение, отправка отвечает
`chat not found` — сколько бы правильным ни был chat_id.

    1. Открыть @CoreBridge_ru_bot и нажать «Начать» (/start)
    2. ./tg_chat_id.py            — покажет id чата
    3. ./tg_chat_id.py --test     — отправит проверочное сообщение
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.request

import mktlib as m


def api(method: str) -> dict:
    token = m.ENV.get("TG_BOT_TOKEN")
    if not token:
        sys.exit("в .env нет TG_BOT_TOKEN")
    with urllib.request.urlopen(
        f"https://api.telegram.org/bot{token}/{method}", timeout=20
    ) as r:
        return json.load(r)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--test", action="store_true")
    args = ap.parse_args()

    me = api("getMe")
    if not me.get("ok"):
        sys.exit(f"токен не принят: {me}")
    print(f"бот: @{me['result']['username']} ({me['result']['first_name']})")

    updates = api("getUpdates").get("result", [])
    if not updates:
        print("\nботу ещё никто не писал.")
        print("Открой @%s, нажми «Начать» и запусти скрипт снова."
              % me["result"]["username"])
    else:
        seen = {}
        for u in updates:
            msg = u.get("message") or u.get("channel_post") or {}
            chat = msg.get("chat")
            if chat:
                seen[chat["id"]] = chat
        print("\nчаты, из которых писали:")
        for cid, chat in seen.items():
            name = chat.get("title") or " ".join(
                filter(None, [chat.get("first_name"), chat.get("last_name")])
            )
            print(f"  {cid}  {chat.get('type')}  {name}")
        print(f"\nтекущий TG_CHAT_ID в .env: {m.ENV.get('TG_CHAT_ID') or '(пусто)'}")

    if args.test:
        ok = m.telegram("Проверка связи: бот отчётов corebridge.ru на месте.")
        print("\nотправка:", "дошла" if ok else "не прошла")
        sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
