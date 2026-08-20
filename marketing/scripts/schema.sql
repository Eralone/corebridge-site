-- Схема маркетингового учёта. SQLite, файл data/events.db.
--
-- Почему не таблица в продуктовой БД, как предполагал 00_bootstrap.md:
--   1. Продуктовый Postgres принадлежит бэкенду, который правится автодеплоем
--      с чужого ПК. Наша таблица там — лишний повод для конфликта миграций.
--   2. Регистрации, заявки и оплаты УЖЕ лежат в platform.users, contact_requests
--      и payments. Дублировать их событиями — заводить второй источник правды.
--      Мы их читаем SELECT-ом и не копируем.
--   3. Своей БД у сайта нет, а заводить её ради 5 визитов в сутки дорого.
--
-- Что здесь на самом деле хранится: обезличенные визиты со стороны сайта.
-- Персональных данных нет — ни email, ни телефона, ни платёжных реквизитов.
-- IP не пишется целиком: он хранится хешем (см. ingest_nginx.py), чтобы
-- считать уникальных посетителей, но не собирать сведения о конкретном лице.
--
-- Скрипты вызывают этот файл при каждом подключении, поэтому всё через
-- IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS events (
    id            INTEGER PRIMARY KEY,
    ts            TEXT NOT NULL,          -- ISO 8601, UTC
    day           TEXT NOT NULL,          -- YYYY-MM-DD, для группировок
    event         TEXT NOT NULL,          -- pageview | cta_click | form_submit | signup | payment
    visitor_id    TEXT,                   -- из cookie трекера, иначе хеш IP+UA
    session_id    TEXT,
    user_id       TEXT,                   -- если известен, иначе NULL
    url           TEXT,
    referrer      TEXT,
    source        TEXT,                   -- сведённый источник: yandex-search, telegram, direct
    utm_source    TEXT,
    utm_medium    TEXT,
    utm_campaign  TEXT,
    utm_content   TEXT,
    utm_term      TEXT,
    first_touch   TEXT,                   -- источник первого визита этого visitor_id
    status        INTEGER,                -- код ответа nginx, для pageview
    is_bot        INTEGER NOT NULL DEFAULT 0,
    origin        TEXT NOT NULL,          -- nginx | tracker | db
    meta          TEXT,                   -- JSON
    dedupe_key    TEXT UNIQUE             -- защита от повторного разбора логов
);

CREATE INDEX IF NOT EXISTS idx_events_day    ON events (day);
CREATE INDEX IF NOT EXISTS idx_events_event  ON events (event, day);
CREATE INDEX IF NOT EXISTS idx_events_vis    ON events (visitor_id);
CREATE INDEX IF NOT EXISTS idx_events_source ON events (source, day);

-- Отметка, до какого момента разобраны логи: чтобы не перечитывать всё каждый раз.
CREATE TABLE IF NOT EXISTS ingest_state (
    name      TEXT PRIMARY KEY,
    value     TEXT,
    updated_at TEXT
);
