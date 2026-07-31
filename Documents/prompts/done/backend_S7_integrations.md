# Промт для `corebridge-server` — пакет S7: проверка ключей и OAuth-переподключение из ЛК

> Приоритет: низкий (этап Э3 — `integrations-app.html`; UI деградирует мягко без этого пакета).
> Составлено сайтом 2026-07-26, сверено с `docs/API_ENDPOINTS.md`.

## Контекст

По cookie-сессии сайт уже умеет всё основное: `GET /lk/integrations` (обогащённый —
`display_name/status/paused/error_count/last_sync_at`), `POST /lk/integrations/:id/credentials`,
`pause`/`resume`, `DELETE`. Не хватает двух вещей, которые есть в дизайне карточки интеграции.

## 1. Cookie-версия «Проверить ключи»

Реальная проверка живости ключей сейчас только под Bearer JWT:
`POST /api/v1/integrations/:integration_id/verify` (bridge). Из ЛК по cookie её вызвать нельзя.

```
POST /lk/integrations/:id/verify        (cookie lk_session; owner/manager)
→ 200 { "ok": true,  "status": 200, "detail": "Ключи валидны" }
→ 200 { "ok": false, "status": 401, "detail": "Ozon вернул 401: неверный Client-Id" }
errors: 404 INTEGRATION_NOT_FOUND · 403 FORBIDDEN · 401 · 502 ADAPTER_UNAVAILABLE
```

Проще всего — тонкий cookie-прокси к уже существующей bridge-логике (внутренний вызов с
`X-Service-Token`, не гоняя JWT через браузер). Ответ `ok:false` — это **не** HTTP-ошибка:
`200` с `ok:false`, чтобы сайт показал причину в карточке, а не общий сбой.

## 2. OAuth-переподключение («Обновить токен» при статусе `error`)

Для адаптеров с OAuth токен истекает, и карточка в дизайне показывает `Error · 401` с кнопкой
«Обновить токен». Флоу переподключения из ЛК нет.

```
GET /lk/integrations/:id/oauth/start                (cookie; owner/manager)
→ 302 на провайдера; state привязан к tenant_id + integration_id, Redis, TTL 10 мин

GET /lk/integrations/:id/oauth/callback?code=&state=
→ сервер обменивает код, перезаписывает credentials в vault (AES-256-GCM, F7),
  сбрасывает error_count, → 302 назад в ЛК на страницу интеграций
errors: 400 INVALID_STATE · 404 INTEGRATION_NOT_FOUND · 502 PROVIDER_UNAVAILABLE
```

Адаптеры, которым это нужно (по `CREDENTIAL_TYPE_MAP = oAuth2Api`):
`ym`, `bitrix24`, `amocrm`, `megaplan`, `sbis_crm`, `neaktor`.

Сайту нужно знать, **для каких адаптеров показывать кнопку**. Просьба: добавить в ответ
`GET /lk/integrations` признак на уровне записи:

```
[{ ..., "auth_kind": "api_key" | "oauth2", "needs_reauth": true|false }]
```

`needs_reauth: true` — когда `auth_kind='oauth2'` и статус `error` с 401/403. Тогда сайт не
хардкодит список адаптеров, а просто рисует кнопку по флагу. Это самая полезная часть пакета —
если делать что-то одно, сделай флаги.

## 3. Чего сайт НЕ просит

- `POST /lk/integrations` (создание интеграции из ЛК) — **не нужен**. По решению
  `implementation_strategy.md` §8.1 интеграции создаются только в .epf; кнопка «+ Добавить
  интеграцию» на сайте ведёт на страницу `.epf`, модалка каталога «Подключить» убрана.
  Заблокированное решение по схеме `adapter_configs` (nullable `encrypted_config` + релаксация
  CHECK на `adapter_type`) для сайта разблокировать **не требуется**.
- `contractor_name` / `warehouse_name` / `requests_this_month` — сайт верстает карточку с
  опциональностью этих полей и показывает «—». Отдельного счётчика заводить не надо, если дорого.

## Definition of Done

- [ ] `auth_kind` и `needs_reauth` добавлены в `GET /lk/integrations` (минимальный полезный объём)
- [ ] `POST /lk/integrations/:id/verify` по cookie, с семантикой `200 + ok:false`
- [ ] OAuth start/callback для 6 перечисленных адаптеров — или явное решение отложить
- [ ] Финальные схемы присланы сайту
