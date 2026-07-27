# Промт для `corebridge-server` — пакет S4: настройки уведомлений + привязка Telegram

> Приоритет: средний (этап Э5 — `settings.html`).
> Составлено сайтом 2026-07-26, сверено с `docs/API_ENDPOINTS.md`.

## Что уже есть

- `platform.tenants.notification_settings JSONB DEFAULT '{}'` — **хранилище готово**
- `platform.notification_log` — история отправок (миграция 018)
- `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` в `.env` — но это **системный** бот для алёртов
  платформы, не для пользователей

Эндпоинтов чтения/записи настроек нет.

## 1. Чтение и запись настроек

```
GET /lk/notifications/settings      (cookie lk_session)
→ 200 {
  "channels": {
    "email":    { "enabled": true,  "address": "d.korolev@example.ru" },
    "telegram": { "enabled": false, "chat_id_masked": null },
    "sms":      { "enabled": false, "phone": null, "available": false }
  },
  "matrix": {
    "integration_errors": { "email": true,  "telegram": true,  "sms": false },
    "limit_exceeded":     { "email": true,  "telegram": false, "sms": false },
    "reports":            { "email": false, "telegram": false, "sms": false },
    "news":               { "email": true,  "telegram": false, "sms": false }
  }
}

PUT /lk/notifications/settings      (cookie; тот же объект в body)
→ 200 { "saved": true }
errors: 400 VALIDATION_ERROR { fields[] } · 401
```

- Дефолт для новых событий — `email: true`, остальные `false`.
- `sms.available: false` — SMS-провайдера нет. Сайт по этому флагу дизейблит колонку SMS с
  подписью «Скоро», а не прячет её (решение продукта: матрицу верстаем целиком).
  **Не выдумывай SMS-отправку**, просто отдай флаг.
- `chat_id` наружу не отдавать в открытом виде — только маску.
- Ключи матрицы (`integration_errors`, `limit_exceeded`, `reports`, `news`) — предложение сайта.
  Если у тебя уже есть другой набор событий, пришли свой — сайт подстроит.

## 2. Привязка Telegram (deep-link flow)

Нужен **пользовательский** бот-обработчик (не системный алёрт-бот).

```
POST   /lk/notifications/telegram/link     (cookie)
→ 200 { "deep_link": "https://t.me/<BotName>?start=<nonce>", "expires_in": 600 }
// пользователь жмёт → бот получает /start <nonce> → сервер сохраняет chat_id в notification_settings

GET    /lk/notifications/telegram/status   (cookie)
→ 200 { "linked": true, "chat_id_masked": "…4821" }

DELETE /lk/notifications/telegram          (cookie)
→ 200 { "ok": true }
```

`nonce` — одноразовый, TTL 600 с, в Redis, привязан к `user_id` + `tenant_id`.

**Вопросы, на которые нужен твой ответ:**
- Использовать существующего бота (`TELEGRAM_BOT_TOKEN`) с добавлением обработчика `/start`,
  или регистрировать отдельного пользовательского бота? Второе чище (системные алёрты и
  пользовательские уведомления не смешиваются), но требует нового токена — тогда скажи, и
  Дмитрий зарегистрирует бота у @BotFather.
- Нужен ли polling/webhook-приёмник для бота — как сейчас устроена работа с Telegram на сервере?

## Definition of Done

- [ ] `GET` / `PUT /lk/notifications/settings` реализованы, покрыты тестами
- [ ] `sms.available: false` отдаётся честно, SMS не отправляется
- [ ] Telegram deep-link flow работает end-to-end (проверено вживую)
- [ ] Ответ по боту (существующий vs новый) и финальный набор ключей матрицы присланы сайту
