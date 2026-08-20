"""Общая обвязка маркетинговых скриптов.

Три источника данных, и ни один из них не требует записи в продуктовую БД:

1. nginx-логи `/var/log/nginx/access.log*` — визиты, источники, коды ответов.
   Читаются через `sudo -n`, потому что файл принадлежит www-data:adm.
2. Postgres `corebridge` — регистрации, заявки, оплаты. Только SELECT,
   через `docker exec corebridge-postgres psql`. Своего драйвера в системе нет
   (psycopg не установлен), и ставить его ради трёх запросов незачем.
3. `data/events.db` — SQLite со сведёнными событиями. Своя, отдельная от
   продукта база: маркетинговый учёт не имеет права влиять на работу платформы.

⚠️ Логи всех vhost'ов пишутся в один файл общим форматом `combined`, где нет
`$host`. Отделить corebridge.ru от admin.corebridge.ru можно только по пути
запроса — см. `is_site_request`. Как это чинится по-настоящему, написано
в `reports/bootstrap.md`, шаг «отдельный лог сайта».
"""

from __future__ import annotations

import json
import os
import re
import sqlite3
import subprocess
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
DB_PATH = DATA / "events.db"
NGINX_GLOB = "/var/log/nginx/access.log*"

# ── Конфигурация ────────────────────────────────────────────────────────────


def load_env() -> dict[str, str]:
    """Читает marketing/.env. Файл в .gitignore — токены в репозиторий не едут."""
    env: dict[str, str] = {}
    path = ROOT / ".env"
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            env[key.strip()] = value.strip().strip('"').strip("'")
    # переменные окружения важнее файла: так удобно подменять в разовом запуске
    env.update({k: v for k, v in os.environ.items() if k.startswith(("MKT_", "TG_", "YA_"))})
    return env


ENV = load_env()

# ── Postgres продукта: строго на чтение ─────────────────────────────────────

PG_CONTAINER = ENV.get("MKT_PG_CONTAINER", "corebridge-postgres")
PG_USER = ENV.get("MKT_PG_USER", "corebridge")
PG_DB = ENV.get("MKT_PG_DB", "corebridge")

_WRITE = re.compile(
    r"\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|copy)\b", re.I
)


def psql(sql: str) -> list[dict]:
    """SELECT в продуктовую БД. Всё, кроме SELECT и WITH, отбивается здесь же.

    Проверка стоит не «на всякий случай»: этот же модуль зовут прогоны по cron,
    где рядом нет человека, который заметит опечатку в запросе.
    """
    stripped = sql.strip().lstrip("(").lower()
    if not (stripped.startswith("select") or stripped.startswith("with")):
        raise ValueError(f"разрешён только SELECT, получено: {sql[:60]}")
    if _WRITE.search(re.sub(r"'[^']*'", "", sql)):
        raise ValueError("в запросе есть изменяющее данные слово")

    out = subprocess.run(
        [
            "docker", "exec", PG_CONTAINER,
            "psql", "-U", PG_USER, "-d", PG_DB,
            "-X", "-A", "-F", "\x1f", "--csv", "-c", sql,
        ],
        capture_output=True, text=True, timeout=60,
    )
    if out.returncode != 0:
        raise RuntimeError(f"psql: {out.stderr.strip()}")

    import csv, io
    rows = list(csv.DictReader(io.StringIO(out.stdout)))
    return rows


# ── nginx ───────────────────────────────────────────────────────────────────

LOG_RE = re.compile(
    r'^(?P<ip>\S+) \S+ \S+ \[(?P<ts>[^\]]+)\] "(?P<method>[A-Z]+) (?P<path>\S+) [^"]*" '
    r'(?P<status>\d{3}) (?P<bytes>\S+) "(?P<referrer>[^"]*)" "(?P<ua>[^"]*)"'
)

BOT_RE = re.compile(
    r"bot|crawl|spider|slurp|zgrab|masscan|curl|wget|python-requests|go-http|"
    r"headless|monitoring|uptime|scanner|facebookexternalhit|preview|fetch",
    re.I,
)

ASSET_RE = re.compile(r"\.(css|js|mjs|woff2?|ttf|png|jpe?g|svg|ico|webp|map|xml|txt)$", re.I)

# Пути, принадлежащие не сайту: API кабинета, API типа 1, выдача файлов, админка.
NOT_SITE_RE = re.compile(r"^/(lk|api|cdn|admin|internal|_next/(static|image))/")


def read_nginx(days: int = 2) -> list[dict]:
    """Разобранные строки лога за последние `days` суток, свежие логи + ротация."""
    since = datetime.now(timezone.utc) - timedelta(days=days)
    raw = subprocess.run(
        ["sudo", "-n", "bash", "-c", f"zcat -f {NGINX_GLOB} 2>/dev/null"],
        capture_output=True, text=True, timeout=300,
    )
    if raw.returncode != 0 and not raw.stdout:
        raise RuntimeError("не читаются логи nginx: нужен беспарольный sudo")

    rows = []
    for line in raw.stdout.splitlines():
        m = LOG_RE.match(line)
        if not m:
            continue
        try:
            ts = datetime.strptime(m["ts"], "%d/%b/%Y:%H:%M:%S %z")
        except ValueError:
            continue
        if ts < since:
            continue
        d = m.groupdict()
        d["ts"] = ts
        d["status"] = int(d["status"])
        d["is_bot"] = bool(BOT_RE.search(d["ua"])) or d["ua"] in ("-", "")
        d["is_asset"] = bool(ASSET_RE.search(d["path"].split("?")[0]))
        rows.append(d)
    return rows


def is_site_request(row: dict) -> bool:
    """Запрос к страницам сайта, а не к API, файлам и админке."""
    return not NOT_SITE_RE.match(row["path"]) and not row["is_asset"]


def is_human(row: dict) -> bool:
    """Живой браузер, а не робот.

    Признак «UA похож на браузер» слабый: Googlebot ходит под мобильным Chrome.
    Поэтому в суточном срезе визит засчитывается только тем IP, которые
    догрузили `assets/site.css` — робот за стилями не ходит. Здесь остаётся
    грубый фильтр по UA, он нужен для отсечения сканеров.
    """
    return not row["is_bot"] and row["ua"].startswith("Mozilla/")


# ── Своя база событий ───────────────────────────────────────────────────────


def db() -> sqlite3.Connection:
    DATA.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.executescript((ROOT / "scripts" / "schema.sql").read_text(encoding="utf-8"))
    return conn


UTM_KEYS = ("utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term")


def parse_utm(path: str) -> dict[str, str | None]:
    from urllib.parse import parse_qs, urlparse

    q = parse_qs(urlparse(path).query)
    return {k: (q[k][0][:120] if k in q else None) for k in UTM_KEYS}


def classify_source(referrer: str, utm_source: str | None) -> str:
    """Один источник строкой. Разметка utm важнее реферера — она наша."""
    if utm_source:
        return utm_source.lower()
    if not referrer or referrer == "-":
        return "direct"
    host = referrer.split("//", 1)[-1].split("/", 1)[0].lower().removeprefix("www.")
    if host.endswith("corebridge.ru"):
        return "internal"
    for engine, name in (
        ("yandex", "yandex-search"), ("google", "google-search"), ("bing", "bing-search"),
        ("duckduckgo", "ddg-search"), ("mail.ru", "mailru-search"),
    ):
        if engine in host:
            return name
    if any(s in host for s in ("t.me", "telegram")):
        return "telegram"
    if "vc.ru" in host:
        return "vc"
    if any(s in host for s in ("dzen.ru", "zen.yandex")):
        return "dzen"
    return host[:60]


# ── Telegram ────────────────────────────────────────────────────────────────


def telegram(text: str, silent: bool = False) -> bool:
    """Отправка в рабочего бота. Возвращает False, а не падает: сорванная
    отправка не должна валить прогон, который уже собрал данные."""
    token, chat = ENV.get("TG_BOT_TOKEN"), ENV.get("TG_CHAT_ID")
    if not token or not chat:
        print("telegram: не заданы TG_BOT_TOKEN / TG_CHAT_ID", file=sys.stderr)
        return False

    import urllib.error, urllib.parse, urllib.request

    # Телеграм режет сообщения длиннее 4096 символов — режем сами и по строкам
    chunks, buf = [], ""
    for line in text.splitlines(keepends=True):
        if len(buf) + len(line) > 3900:
            chunks.append(buf)
            buf = ""
        buf += line
    chunks.append(buf)

    ok = True
    for chunk in chunks:
        payload = urllib.parse.urlencode({
            "chat_id": chat,
            "text": chunk,
            "parse_mode": "HTML",
            "disable_web_page_preview": "true",
            "disable_notification": "true" if silent else "false",
        }).encode()
        try:
            req = urllib.request.Request(
                f"https://api.telegram.org/bot{token}/sendMessage", data=payload
            )
            with urllib.request.urlopen(req, timeout=20) as resp:
                ok = ok and json.load(resp).get("ok", False)
        except urllib.error.URLError as e:
            print(f"telegram: {e}", file=sys.stderr)
            ok = False
    return ok


# ── Мелочи ──────────────────────────────────────────────────────────────────


def yesterday() -> date:
    return date.today() - timedelta(days=1)


def write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2, default=str), encoding="utf-8")
    print(f"записано {path.relative_to(ROOT)}")
