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
    r"headless|monitoring|uptime|scanner|facebookexternalhit|preview|fetch|"
    # Googlebot ходит под этим мобильным UA без слова bot — узнаётся по модели
    r"Nexus 5X Build/MMB29P|libredtail|"
    # сборщики превью и сканеры сети, приходящие с меткой в ссылке
    r"Embed PHP|PHP library|CensysInspect|Expanse|InternetMeasurement",
    re.I,
)

ASSET_RE = re.compile(r"\.(css|js|mjs|woff2?|ttf|png|jpe?g|svg|ico|webp|map|xml|txt)$", re.I)

# Пути, принадлежащие не сайту: API кабинета, API типа 1, выдача файлов, админка
# и приём событий своего счётчика (`/m/e` — он же попадал в просмотры страниц
# и добавлял по визиту на каждый просмотр).
NOT_SITE_RE = re.compile(r"^/(lk|api|cdn|admin|internal|m|_next/(static|image))/")


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
    """Грубый фильтр по UA. Сам по себе ничего не доказывает — см. mark_bots."""
    return not row["is_bot"] and row["ua"].startswith("Mozilla/")


# ── Отсев роботов по поведению ──────────────────────────────────────────────
#
# Проверено 2026-08-24 на своих же данных: ни UA, ни загрузка site.css,
# ни даже исполнение JavaScript роботa не выдают.
#
#   · Googlebot ходит под UA мобильного Chrome и грузит стили;
#   · безголовый Chrome выполняет наш счётчик и присылает события —
#     семь страниц с одной секундой на всё и окном ровно 1280x720;
#   · счётчик поймал «iPhone» с окном 1920x1080, чего не бывает.
#
# Поэтому решает поведение, а не представление. Человек читает страницу
# десятки секунд; робот обходит сайт за секунды. Границы ниже подобраны
# по своим данным, а не взяты из общих соображений.

BOT_MIN_PAGES = 5          # меньше — не о чем судить
BOT_MAX_SEC_PER_PAGE = 8   # быстрее человек читать не может
BOT_PAGES_PER_DAY = 12     # столько страниц за сутки у нас открывает только обход


# Пути, которые запрашивают только сканеры уязвимостей.
PROBE_RE = re.compile(
    r"(^/\.)|wp-|/vendor/|\.git|phpmyadmin|xmlrpc|cgi-bin|actuator|ignition|"
    r"/debug|/graphql|administrator|/config\.json|credentials|\.php$|"
    r"/telescope|/server-status|not_exist|/SDK/",
    re.I,
)


# Те же пути в виде шаблонов LIKE для SQL. Один такой запрос выдаёт посетителя
# целиком: человек не набирает /vendor/ignition/execute-solution.
PROBE_LIKE = (
    "/wp-%", "/.env%", "/vendor/%", "/.git%", "/admin.php%", "/phpmyadmin%",
    "/xmlrpc.php%", "/cgi-bin/%", "/actuator%", "/_ignition%", "/config.json%",
    "/telescope%", "/.aws%", "/server-status%", "/SDK/%", "/%.php",
)


def mark_bots(conn) -> int:
    """Переставляет is_bot=1 тем, чьё поведение машинное. Возвращает число строк.

    ⚠️ Осознанный размен: настоящий человек, залпом открывший 12 страниц
    документации, будет посчитан роботом. При нынешнем объёме это одна потеря
    в месяц, а обратная ошибка — десятки роботов в метрике каждый день, и она
    хуже: по ней принимаются решения.
    """
    conn.execute(
        """
        WITH sessions AS (
            SELECT visitor_id, day,
                   count(DISTINCT url) pages,
                   (julianday(max(ts)) - julianday(min(ts))) * 86400 span
            FROM events
            WHERE is_bot = 0 AND event = 'pageview'
            GROUP BY 1, 2
        )
        UPDATE events SET is_bot = 1
        WHERE (visitor_id, day) IN (
            SELECT visitor_id, day FROM sessions
            WHERE pages >= :pages_day
               OR (pages >= :min_pages AND span / (pages - 1) < :sec_per_page)
        )
        """,
        {"pages_day": BOT_PAGES_PER_DAY, "min_pages": BOT_MIN_PAGES,
         "sec_per_page": BOT_MAX_SEC_PER_PAGE},
    )
    # Сканеры уязвимостей: помечаем посетителя целиком, а не отдельный запрос —
    # тот же адрес заодно открывает главную, и она попадала в визиты.
    conn.execute(
        "UPDATE events SET is_bot = 1 WHERE is_bot = 0 AND visitor_id IN ("
        "  SELECT DISTINCT visitor_id FROM events WHERE "
        + " OR ".join("url LIKE ?" for _ in PROBE_LIKE) + ")",
        PROBE_LIKE,
    )
    changed = conn.total_changes

    # Безголовый браузер не хранит cookie: он выполняет наш счётчик, но на каждой
    # странице получает новый visitor_id. Поэтому правило по числу страниц его
    # не видит — у него везде «одна страница». Выдаёт его залп: несколько
    # разных visitor_id с одинаковыми UA и окном в пределах пяти минут.
    conn.execute(
        """UPDATE events SET is_bot = 1
           WHERE origin = 'tracker' AND is_bot = 0
             AND (json_extract(meta,'$.ua'), json_extract(meta,'$.screen'),
                  substr(ts, 1, 15)) IN (
                 SELECT json_extract(meta,'$.ua'), json_extract(meta,'$.screen'),
                        substr(ts, 1, 15)
                 FROM events WHERE origin = 'tracker'
                 GROUP BY 1, 2, 3
                 HAVING count(DISTINCT visitor_id) >= 3)"""
    )

    # Невозможное окно: телефон с шириной от 1200 точек. Это подделка UA,
    # и видна она только в событиях своего счётчика.
    conn.execute(
        """UPDATE events SET is_bot = 1
           WHERE origin = 'tracker' AND is_bot = 0
             AND json_extract(meta, '$.ua') LIKE '%Mobile%'
             AND CAST(substr(json_extract(meta, '$.screen'), 1,
                      instr(json_extract(meta, '$.screen'), 'x') - 1) AS INTEGER) >= 1200"""
    )
    conn.commit()
    return changed


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


# Реферер-мусор: сканеры и «накрутчики», которые ставят свой домен в Referer,
# чтобы владелец сайта пришёл к ним в статистику. Настоящего перехода за этим
# нет, а в непрямые источники они попадают и завышают главную метрику.
# Список пополняется по факту, а не заранее: увидел новый в отчёте - дописал.
REFERRER_SPAM = {"dataindex.pro", "signaliks.ru", "semalt.com", "buttons-for-website.com"}

# Свой же сервер по IP: так ходят сканеры, подставляя в Referer адрес хоста.
OWN_IPS = {"77.90.61.5"}

_IP_RE = re.compile(r"^\d{1,3}(\.\d{1,3}){3}$")


def classify_source(referrer: str, utm_source: str | None) -> str:
    """Один источник строкой. Разметка utm важнее реферера — она наша."""
    if utm_source:
        return utm_source.lower()
    if not referrer or referrer == "-":
        return "direct"
    # порт отбрасываем: реферер вида http://corebridge.ru:80/ иначе не опознаётся
    # как свой и попадает в непрямые источники, завышая главную метрику
    host = referrer.split("//", 1)[-1].split("/", 1)[0].lower()
    host = host.split(":", 1)[0].removeprefix("www.")
    if host.endswith("corebridge.ru") or host in OWN_IPS:
        return "internal"
    # Голый IP в реферере: живой браузер так не приходит, это всегда сканер.
    if _IP_RE.match(host):
        return "internal"
    if host in REFERRER_SPAM:
        return "referrer-spam"
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
