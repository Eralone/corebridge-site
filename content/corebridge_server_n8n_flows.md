# CoreBridge Server — Взаимодействие сервер ↔ внешние сервисы через n8n

> **Источники:** `CLAUDE(server).md` · `README_server_.md`
> **Репозиторий:** `corebridge-server`
> **Стек:** Node.js · PostgreSQL · Redis · n8n · Docker

---

## Содержание

1. [Общая архитектура потоков данных](#1-общая-архитектура-потоков-данных)
2. [Маркетплейсы: Ozon / WB / Яндекс Маркет (polling-адаптеры)](#2-маркетплейсы-ozon--wb--яндекс-маркет-polling-адаптеры)
3. [Webhook-приёмник: платёжные системы и CRM](#3-webhook-приёмник-платёжные-системы-и-crm)
4. [n8n как шина обработки событий](#4-n8n-как-шина-обработки-событий)
5. [Шаблоны воркфлоу n8n по типам интеграций](#5-шаблоны-воркфлоу-n8n-по-типам-интеграций)
6. [Стандартный конверт payload (F2)](#6-стандартный-конверт-payload-f2)
7. [ACK-протокол двойного подтверждения](#7-ack-протокол-двойного-подтверждения)
8. [Изоляция тенантов в n8n](#8-изоляция-тенантов-в-n8n)
9. [Шифрование credentials (F7 + F6.3)](#9-шифрование-credentials-f7--f63)
10. [Лимиты выполнений (F6.5)](#10-лимиты-выполнений-f65)
11. [Bridge Service как диспетчер событий (F2)](#11-bridge-service-как-диспетчер-событий-f2)
12. [Таблица маршрутов Nginx → upstream](#12-таблица-маршрутов-nginx--upstream)
13. [Схема базы данных: ключевые таблицы](#13-схема-базы-данных-ключевые-таблицы)

---

## 1. Общая архитектура потоков данных

Данные приходят в систему двумя способами — **polling** (сервер сам опрашивает внешний сервис) и **webhook** (внешний сервис сам присылает событие). В обоих случаях финальная точка обработки — n8n.

```
┌──────────────────────────────────────────────────────────────────┐
│                    Внешние сервисы                               │
│  Ozon API  │  WB API  │  ЯМ API  │  ЮKassa  │  Битрикс24  │ ...│
└─────┬──────┴────┬─────┴───┬──────┴────┬──────┴──────┬──────────┘
      │ polling   │ polling │ polling   │ webhook      │ webhook
      ▼           ▼         ▼           ▼              ▼
┌─────────────────────────────────────────────────────────────────┐
│                 corebridge-server (VPS)                         │
│                                                                 │
│  ┌─────────────┐   ┌──────────────┐   ┌──────────────────────┐ │
│  │ mp-adapters │   │ bridge:3001  │   │ bridge:3001          │ │
│  │ (F5)        │   │ /api/v1/     │   │ /api/v1/webhooks/    │ │
│  │ ozon/wb/ym  │   │ events       │   │ (F9) ЮKassa/СБП/     │ │
│  │ cron 60s    │   │ (от .epf)    │   │ Битрикс24/СДЭК/ЯМ   │ │
│  └──────┬──────┘   └──────┬───────┘   └──────────┬───────────┘ │
│         │                 │                        │             │
│         ▼                 ▼                        ▼             │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │         marketplace.events (PostgreSQL)                  │   │
│  │   id │ tenant_id │ event_type │ payload │ status │ retry │   │
│  └─────────────────────────┬────────────────────────────────┘   │
│                             │                                    │
│                             ▼ Event Dispatcher (F2)              │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    n8n (порт 5678)                       │   │
│  │  POST http://n8n:5678/webhook/{tenant_id}/{product}/...  │   │
│  │                                                          │   │
│  │  marketplace_orders.json │ crm_deal_sync.json │ ...      │   │
│  └──────────────────────────────────────────────────────────┘   │
│                             │                                    │
│                             ▼ ACK "processed" → Internal API     │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  /internal/v1/events/ack  →  status='done'               │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ▼
              .epf (1С клиент) — polling GET /api/v1/events
```

**Два независимых входных потока:**

| Поток | Откуда | Механика | Сервис |
|---|---|---|---|
| **Polling** | Ozon API, WB API, ЯМ API | mp-adapters опрашивают маркетплейсы каждые 60 сек | `services/mp-adapters` (F5) |
| **Webhook** | ЮKassa, СБП, Тинькофф, Сбер, Битрикс24, СДЭК, ЯМ Доставка | Внешние сервисы сами присылают POST на `/api/v1/webhooks/{id}` | `bridge:3001/api/v1/webhooks` (F9) |

В обоих случаях нормализованное событие попадает в `marketplace.events`, откуда Event Dispatcher (F2) доставляет его в n8n через внутренний webhook.

---

## 2. Маркетплейсы: Ozon / WB / Яндекс Маркет (polling-адаптеры)

**Сервис:** `services/mp-adapters/` · **Механика:** F5

### Что делает адаптер

Три изолированных воркера (`adapter-ozon`, `adapter-wb`, `adapter-ym`) запускаются по cron каждые 60 секунд. Каждый воркер:

1. Получает список активных интеграций из `marketplace.adapter_configs` (`is_active=TRUE`)
2. Дешифрует API-ключ через `credential.service.js` (AES-256-GCM, F7)
3. Опрашивает API маркетплейса с cursor-pagination
4. Нормализует ответ через `normalizer.js` в стандартный конверт
5. Записывает события в `marketplace.events`
6. Advisory lock per `(tenant, integration)` — защита от параллельного запуска

### Откуда приходят данные (внешние API)

**Ozon API:**
```
GET https://api-seller.ozon.ru/v3/posting/fbs/unfulfilled/list
Authorization: Client-Id: {client_id}   Api-Key: {api_key}

Что получаем:
{
  "result": {
    "postings": [
      {
        "posting_number": "12345678-1234-1",
        "status": "awaiting_packaging",
        "in_process_at": "2026-04-26T10:00:00Z",
        "products": [
          { "sku": 123456, "name": "Товар А", "quantity": 2, "price": "1500" }
        ],
        "customer": { "name": "Иван Иванов", "phone": "+79001234567" },
        "delivery_method": { "warehouse_id": 987654 }
      }
    ]
  }
}
```

**Wildberries API:**
```
GET https://suppliers-api.wildberries.ru/api/v3/orders/new
Authorization: Bearer {api_key}

Что получаем:
{
  "orders": [
    {
      "id": 12345678,
      "createdAt": "2026-04-26T10:00:00Z",
      "warehouseId": 1234,
      "article": "ART-001",
      "skus": ["2038353095469"],
      "price": 150000,
      "currencyCode": "RUB"
    }
  ]
}
```

**Яндекс Маркет API (OAuth 2.0):**
```
GET https://api.partner.market.yandex.ru/campaigns/{campaignId}/orders
Authorization: Bearer {oauth_token}     (refresh через client_credentials)

Что получаем:
{
  "orders": [
    {
      "id": 12345678,
      "status": "PROCESSING",
      "creationDate": "26-04-2026 10:00:00",
      "items": [
        { "id": 1, "offerId": "ART-001", "count": 2, "price": 1500.0 }
      ],
      "buyer": { "id": "abc123" },
      "delivery": { "deliveryServiceId": 106 }
    }
  ]
}
```

### Нормализация: `normalizer.js`

Все три формата маркетплейсов приводятся к единой схеме до записи в БД:

```js
// normalizeOzonOrder(raw) → стандартный конверт
// normalizeWbOrder(raw)   → стандартный конверт
// normalizeYmOrder(raw)   → стандартный конверт
```

**Стандартный конверт после нормализации (пишется в `marketplace.events.payload`):**

```json
{
  "order_id": "12345678",
  "order_number": "12345678-1234-1",
  "status": "awaiting_packaging",
  "shipment_method": "FBS",
  "items": [
    {
      "sku": "ART-001",
      "name": "Товар А",
      "qty": 2,
      "price": 1500.00,
      "vat": "vat20"
    }
  ],
  "customer": {
    "name": "Иван Иванов",
    "phone": "+79001234567",
    "address": "Москва, ул. Ленина, 1"
  },
  "warehouse_id": "987654",
  "created_at": "2026-04-26T10:00:00Z"
}
```

### Маппинг статусов

| Внешний статус | Адаптер | Нормализованный event_type |
|---|---|---|
| `awaiting_packaging`, `PROCESSING` | ozon, ym | `order_new` |
| `awaiting_deliver`, `DELIVERY` | ozon, ym | `order_confirmed` |
| `cancelled`, `CANCELLED` | ozon, ym | `order_cancelled` |
| `new` (нет статусов WB) | wb | `order_new` |
| `confirm` | wb | `order_confirmed` |
| `cancel` | wb | `order_cancelled` |

### Обработка ошибок адаптера

```
error_count ≥ 5  →  is_active = FALSE  (порог автоматической деактивации)
HTTP 429         →  withBackoff() — exponential backoff
HTTP 5xx         →  callWithRetry() — retry с backoff
ECONNRESET       →  callWithRetry()
```

**Метрики Prometheus:** порты `3010` (ozon) / `3011` (wb) / `3012` (ym)

### Запись в `marketplace.events`

```sql
INSERT INTO marketplace.events
  (tenant_id, integration_id, adapter_type, event_type, payload, status)
VALUES
  ($1, $2, 'ozon', 'order_new', $3::jsonb, 'pending')
```

---

## 3. Webhook-приёмник: платёжные системы и CRM

**Маршрут:** `bridge:3001/api/v1/webhooks/{integration_id}` · **Механика:** F9

### Кто присылает webhook

| Сервис | Метод верификации | Формат подписи |
|---|---|---|
| ЮKassa | `yukassa.js` | HMAC-SHA256 по телу запроса |
| СБП | `sbp.js` | HMAC-SHA256 |
| Битрикс24 | `bitrix24.js` | `application_token` в теле |
| СДЭК | `cdek.js` | `caller_id` |
| Яндекс Маркет | `ym.js` | `Bearer` + `timingSafeEqual` |

> ⚠️ `express.raw()` монтируется **ДО** `express.json()` на `/api/v1/webhooks` — необходимо для HMAC-верификации сырого тела запроса.

### Пример: платёжный webhook от ЮKassa

**Приходит от ЮKassa:**
```http
POST /api/v1/webhooks/PAY_001
Content-Type: application/json
X-Yukassa-Signature: sha256=abc123...

{
  "type": "notification",
  "event": "payment.succeeded",
  "object": {
    "id": "payment_uuid",
    "status": "succeeded",
    "amount": { "value": "5990.00", "currency": "RUB" },
    "payment_method": { "type": "bank_card", "id": "card_uuid" },
    "paid": true,
    "created_at": "2026-04-26T10:00:00.000Z",
    "metadata": {
      "order_id": "ЗП-00123",
      "tenant_id": "tenant_abc123"
    }
  }
}
```

**После верификации и нормализации → запись в `marketplace.events`:**
```json
{
  "event_type": "payment_received",
  "payload": {
    "payment_id": "payment_uuid",
    "amount": 5990.00,
    "currency": "RUB",
    "order_id": "ЗП-00123",
    "gateway": "yukassa",
    "paid_at": "2026-04-26T10:00:00Z"
  }
}
```

### Пример: CRM webhook от Битрикс24

**Приходит от Битрикс24:**
```http
POST /api/v1/webhooks/CRM_001
Content-Type: application/x-www-form-urlencoded

event=ONCRMDEALADD&auth[application_token]=abc123&data[FIELDS][ID]=1234
&data[FIELDS][TITLE]=Новая сделка&data[FIELDS][STAGE_ID]=NEW
&data[FIELDS][UF_CRM_CONTACT_ID]=567
```

**После нормализации → `marketplace.events`:**
```json
{
  "event_type": "crm_deal_new",
  "payload": {
    "crm_deal_id": "B24-DEAL-1234",
    "title": "Новая сделка",
    "stage_id": "NEW",
    "contact_id": "567",
    "adapter": "bitrix24"
  }
}
```

### Идемпотентность (F9)

```sql
-- idempotency.js: INSERT-or-fail, код 23505 → { isDuplicate: true }
INSERT INTO platform.processed_webhooks (webhook_id, integration_id, received_at)
VALUES ($1, $2, NOW())
-- при дублировании: { isDuplicate: true }, HTTP 200 без повторной обработки
```

**Маршрут всегда возвращает HTTP 200** после верификации — независимо от состояния n8n.

### Диспатч в n8n после верификации

```js
// n8n-dispatcher.js
// MAX_RETRIES=3, backoff [1s, 2s, 4s]
// При исчерпании retry → INSERT в marketplace.dead_letter_queue
await dispatchToN8n(event);
```

---

## 4. n8n как шина обработки событий

**Роль n8n в архитектуре:** n8n — шина бизнес-логики. Bridge Service записывает нормализованные события в `marketplace.events`, Event Dispatcher доставляет их в n8n через внутренний HTTP-запрос, n8n исполняет воркфлоу и подтверждает обработку через Internal API.

### Event Dispatcher (F2)

```
Event Dispatcher (bridge) опрашивает marketplace.events WHERE status='pending'
        │
        ▼
POST http://n8n:5678/webhook/{tenant_id}/{product}/{event_type}
        │
        ├── HTTP 200 от n8n  →  status='received'
        │                    →  usageService.incrementExecution(tenantId)
        │
        └── HTTP 4xx/5xx     →  retry_count++
                             →  retry_count ≥ 3  →  INSERT dead_letter_queue
```

### Webhook-guard (F6.4)

Все входящие запросы от .epf клиентов к n8n проходят через `n8n_webhook_guard.js` — 6-шаговый алгоритм:

```
/webhook/:tenantId/:product/:eventType
        │
        ├── 1. X-Service-Token совпадает → bypass без JWT
        │
        ├── 2. Извлечь tenantId из URL
        │
        ├── 3. Проверить Authorization Bearer
        │      Нет → 401 missing_token
        │
        ├── 4. jwt.verify(algorithms: ['HS256'])
        │      Ошибка → 401 invalid_token   (alg:none невозможен)
        │
        ├── 5. jwt.tenant_id ≠ urlTenantId
        │      → 403 cross_tenant_blocked
        │      → INSERT audit_log (entity_type='cross_tenant_webhook')
        │
        └── 6. proxy_pass → n8n:5678/webhook/{tenantId}/{product}/{eventType}
```

**Маршрут прохода:**
```
.epf (клиент) → Nginx:443 → bridge:3001/webhook/:tenantId/:product/:eventType
             → n8n_webhook_guard.js → n8n:5678/webhook/...
```

---

## 5. Шаблоны воркфлоу n8n по типам интеграций

**Директория:** `n8n/templates/` · **Монтирование:** `./n8n/templates:/n8n/templates:ro` (read-only volume)

Каждый тип интеграции получает свой JSON-шаблон воркфлоу. При активации интеграции тенантом WorkflowProvisioner (F6.2) клонирует шаблон, заменяет плейсхолдеры, создаёт воркфлоу в n8n и активирует его.

### Реестр шаблонов

| Файл шаблона | Типы интеграции | Webhook-путь в n8n | Кол-во узлов |
|---|---|---|---|
| `marketplace_orders.json` | `ozon`, `wb`, `ym` | `/{TENANT_ID}/marketplace/:event_type` | 8 |
| `crm_deal_sync.json` | `bitrix24`, `amocrm`, `megaplan`, `sbis_crm`, `neaktor` | `/{TENANT_ID}/crm/:event_type` | 11 |
| `delivery_tracking.json` | `cdek`, `pochta`, `ym_delivery` | `/{TENANT_ID}/delivery/:event_type` | 7 |
| `payment_confirm.json` | `yukassa`, `sbp`, `tinkoff`, `sber` | `/{TENANT_ID}/payment/:event_type` | 8 |
| `marketing_event.json` | `mindbox`, `sendpulse` | `/{TENANT_ID}/marketing/:service_type/:event_type` | 8 |
| `custom_integration.json` | `other` | `/{TENANT_ID}/custom/{INTEGRATION_ID}` | 5 |
| `license_status.json` | `license_control` | `/{TENANT_ID}/license/status-changed` | 9 |

### Плейсхолдеры в шаблонах

| Плейсхолдер | Источник | Пример подстановки |
|---|---|---|
| `{TENANT_ID}` | `platform.tenants.id` | `tenant_abc123` |
| `{INTEGRATION_ID}` | `marketplace.adapter_configs.id` | `CRM_001` |
| `{TEMPLATE_TYPE}` | Имя файла без `.json` | `crm_deal_sync` |
| `{PRODUCT}` | URL-сегмент по типу | `crm`, `marketplace`, `payment` |
| `{EVENT_TYPE}` | Тип события или wildcard | `deal_new`, `+` |
| `{INTERNAL_API_URL}` | `process.env.INTERNAL_API_URL` | `http://lk-api:3000` |
| `{SERVICE_TOKEN}` | `process.env.INTERNAL_SERVICE_TOKEN` | `<секрет из .env>` |

### Структура узлов (общая для всех шаблонов)

```
[0] Webhook          — точка входа, path: /{TENANT_ID}/{product}/:event_type
        │
        ▼
[1] Code (Validate)  — валидация _routing: tenant_id, event_id, cross-tenant check
        │
        ▼
[2] HTTP Request     — ACK "received" → POST /internal/v1/events/ack
        │
        ▼
[3..N] Switch / IF / Set / HTTP Request  — бизнес-логика, специфичная для шаблона
        │
        ▼
[N+1] HTTP Request   — Final ACK "processed" → POST /internal/v1/events/ack
```

### Детали шаблона `marketplace_orders.json` (Ozon / WB / ЯМ)

Цепочка узлов для обработки заказа с маркетплейса:

```
[0] Webhook /marketplace/:event_type
        │
[1] Validate _routing (Code)
        │
[2] ACK "received"
        │
[3] Switch by event_type
        ├── order_new        → [4a] HTTP: POST /internal/v1/orders/create  → [5] Final ACK
        ├── order_confirmed  → [4b] HTTP: PUT  /internal/v1/orders/{id}/status
        └── order_cancelled  → [4c] HTTP: PUT  /internal/v1/orders/{id}/cancel
```

### Детали шаблона `crm_deal_sync.json` (Битрикс24 / AmoCRM / и др.)

```
[0] Webhook /crm/:event_type
        │
[1] Validate _routing
        │
[2] ACK "received"
        │
[3] Switch by event_type (11 ветвей)
        ├── crm_deal_new           → [4] HTTP: POST /internal/v1/crm/deal
        ├── crm_deal_updated       → [4] HTTP: PUT  /internal/v1/crm/deal/{id}
        ├── crm_deal_cancelled     → [4] HTTP: DELETE /internal/v1/crm/deal/{id}
        ├── crm_invoice_triggered  → [4] HTTP: POST /internal/v1/crm/invoice
        ├── crm_shipment_triggered → [4] HTTP: POST /internal/v1/crm/shipment
        └── ...
        │
[N+1] Final ACK "processed"
```

### Детали шаблона `payment_confirm.json` (ЮKassa / СБП / Тинькофф / Сбер)

```
[0] Webhook /payment/:event_type
        │
[1] Validate _routing
        │
[2] ACK "received"
        │
[3] Switch by event_type
        ├── payment_received  → [4] HTTP: POST /internal/v1/payments/confirm
        ├── refund_full       → [4] HTTP: POST /internal/v1/payments/refund
        ├── refund_partial    → [4] HTTP: POST /internal/v1/payments/refund?type=partial
        ├── payment_failed    → [4] HTTP: POST /internal/v1/payments/failed
        └── chargeback        → [4] HTTP: POST /internal/v1/payments/chargeback
        │
[N+1] Final ACK "processed"
```

### Детали шаблона `delivery_tracking.json` (СДЭК / Почта России / ЯМ Доставка)

```
[0] Webhook /delivery/:event_type
        │
[1] Validate _routing
        │
[2] ACK "received"
        │
[3] IF: event_type == "track_updated"
        ├── TRUE  → [4a] HTTP: PUT /internal/v1/delivery/{id}/status
        └── FALSE → [4b] HTTP: POST /internal/v1/delivery/new
        │
[N+1] Final ACK "processed"
```

### Детали шаблона `marketing_event.json` (MindBox / SendPulse)

```
[0] Webhook /marketing/:service_type/:event_type
        │
[1] Validate _routing
        │
[2] ACK "received"
        │
[3] Switch by service_type (mindbox | sendpulse)
        ├── mindbox   → [4] HTTP: POST {MINDBOX_API}/operations/sync — с credential httpHeaderAuth
        └── sendpulse → [4] HTTP: POST {SENDPULSE_API}/addressbooks  — с credential apiKeyAuth
        │
[N+1] Final ACK "processed"
```

---

## 6. Стандартный конверт payload (F2)

Каждое событие, которое Event Dispatcher отправляет из Bridge в n8n, завёрнуто в стандартный конверт:

```json
{
  "_routing": {
    "tenant_id":      "tenant_abc123",
    "integration_id": "CRM_001",
    "tab_key":        "crm",
    "event_type":     "deal_new",
    "event_id":       "evt_001821",
    "retry_count":    0,
    "timestamp":      "2026-03-25T15:42:00Z"
  },
  "payload": {
    // нормализованные данные от внешнего сервиса
    // (зависит от event_type, см. разделы 2 и 3)
  },
  "_meta": {
    "server_version": "1.3.2",
    "epf_version":    "1.3.1",
    "config":         "ut11"
  }
}
```

**Поля `_routing` используются воркфлоу узлом Code [1]** для cross-tenant проверки и извлечения `event_id` для ACK.

---

## 7. ACK-протокол двойного подтверждения

Каждый воркфлоу n8n подтверждает обработку события дважды — это позволяет Bridge точно знать, на каком этапе находится событие и когда повторить доставку.

```
Bridge Event Dispatcher                   n8n воркфлоу
        │
        │  POST /webhook/{tenantId}/marketplace/order_new
        │  Body: стандартный конверт
        │ ─────────────────────────────────────────────────────────────▶
        │
        │                                   [1] Validate _routing
        │                                   [2] ACK "received"
        │  POST /internal/v1/events/ack
        │  { "event_id": "evt_001821", "status": "received" }
        │ ◀─────────────────────────────────────────────────────────────
        │
        │  marketplace.events: status = 'received'
        │  (Bridge прекращает retry для этого события)
        │
        │                                   [3..N] Бизнес-логика
        │                                   (HTTP-запросы к Internal API)
        │
        │                                   [N+1] Final ACK "processed"
        │  POST /internal/v1/events/ack
        │  { "event_id": "evt_001821", "status": "processed" }
        │ ◀─────────────────────────────────────────────────────────────
        │
        │  marketplace.events: status = 'done'
```

**Internal ACK endpoint:**

```http
POST {INTERNAL_API_URL}/internal/v1/events/ack
X-Service-Token: {SERVICE_TOKEN}
Content-Type: application/json

{
  "event_id":  "evt_001821",
  "tenant_id": "tenant_abc123",
  "status":    "received" | "processed"
}
```

**Статусы события в `marketplace.events`:**

| Статус | Описание |
|---|---|
| `pending` | Новое, ждёт доставки в n8n |
| `received` | n8n получил и начал обрабатывать |
| `done` | n8n успешно завершил обработку |
| `failed` | retry_count ≥ 3, перемещено в `dead_letter_queue` |

**Если воркфлоу падает до Final ACK:** событие остаётся в статусе `received`, Bridge повторит доставку через retry-интервал.

---

## 8. Изоляция тенантов в n8n

### Один тег на тенанта (F6.1)

При первой выдаче лицензии тенанту автоматически создаётся изолированный тег в n8n:

```
LicenseService.issueLicense(tenantId)
        │
        └─ setImmediate (fire-and-forget):
           POST /internal/v1/tenants/{tenantId}/activate
           X-Service-Token: INTERNAL_SERVICE_TOKEN
                    │
                    ▼
           TenantWorkspaceService.initWorkspace(tenantId):
             1. n8nClient.listTags()     — поиск существующего тега
             2. n8nClient.createTag(tenantId) — создание если нет (retry 3x: 5s/15s/30s)
             3. UPDATE platform.tenants SET n8n_initialized=TRUE, n8n_tag_id='{tagId}'
```

Все воркфлоу тенанта помечаются этим тегом — гарантирует что тенант видит только свои исполнения.

**Клиентская фильтрация в `n8n_client.js`:** `getWorkflows` и `listCredentials` фильтруют ответы n8n по префиксу `{tenantId}__` — защита от cross-tenant утечки при ненадёжной серверной фильтрации n8n.

### Провижнинг воркфлоу (F6.2)

При активации интеграции тенантом в ЛК:

```
POST /lk/n8n/integrations/{id}/activate  (Bearer JWT)
        │
        ├─ ownershipCheck (integration_id, tenant_id)
        ├─ Проверить integration_type в jwt.enabled_modules
        ├─ 409 если n8n_workflow_id уже задан
        │
        ├─ F6.3: credentialVault.createCredential(tenantId, integId, credType, creds)
        │         → n8nClient.createCredential()  →  n8n хранит AES-256-GCM
        │         → UPDATE adapter_configs SET n8n_credential_id = '{id}'
        │
        └─ F6.2: workflowProvisioner.provision(tenantId, integId, integrationType):
              1. Ensure workspace initialized (F6.1)
              2. Idempotency check (n8n_workflow_id уже задан?)
              3. Определить шаблон по integrationType
              4. Прочитать JSON, заменить плейсхолдеры
              5. POST /workflows  — создать воркфлоу в n8n (без полей active и tags)
              6. PUT /workflows/{id}/tags  — привязать тег тенанта
              7. POST /workflows/{id}/activate
              8. UPDATE adapter_configs SET n8n_workflow_id = '{id}'
                 + INSERT audit_log — одна транзакция
```

**При ошибке provision:** rollback `deleteCredential(tenantId, n8nCredentialId)` → возврат 500/503.

---

## 9. Шифрование credentials (F7 + F6.3)

### Два уровня хранения ключей

**Уровень 1 — API-ключи в PostgreSQL (F7):**
- `marketplace.adapter_configs.encrypted_config` — тип `BYTEA` (не TEXT, не JSONB)
- Алгоритм: AES-256-GCM, `ADAPTER_ENCRYPTION_KEY` = ровно 32 байта
- Формат: `Buffer[IV(12 байт) | ciphertext | GCM Tag(16 байт)]`
- Дешифровка при poll: `credential.service.js` → передаётся адаптеру для HTTP-запроса к МП

**Уровень 2 — Credentials в n8n (F6.3):**
- n8n хранит credentials в своей БД, шифрует через `N8N_ENCRYPTION_KEY` (AES-256-GCM, настраивается один раз)
- Платформа **никогда** не хранит plaintext credentials в своей БД
- `listCredentials` явно удаляет поле `data` из ответа n8n — plaintext ключи не покидают n8n

### CREDENTIAL_TYPE_MAP (adapter_type → n8n credential type)

| Адаптеры | Тип credential в n8n |
|---|---|
| `ozon`, `wb`, `mindbox` | `httpHeaderAuth` |
| `ym`, `bitrix24`, `amocrm`, `megaplan` | `oAuth2Api` |
| `cdek`, `pochta`, `yukassa`, `sbp`, `tinkoff`, `sber` | `httpBasicAuth` |
| `sendpulse` | `apiKeyAuth` |
| `other` | `httpHeaderAuth` (fallback) |

### Ротация credentials

```js
vault.rotateCredential(tenantId, integrationId, newData)
  // 1. deleteCredential(oldId)
  // 2. createCredential(type, newData)
  // → { n8nCredentialId, rotatedAt, oldCredentialId }
```

---

## 10. Лимиты выполнений (F6.5)

`ExecutionLimitWatcher` — singleton-сервис, отслеживает количество n8n-выполнений каждого тенанта в текущем месяце.

### Лимиты по тарифам

| Тариф | `plan` | `n8n_executions_month` |
|---|---|---|
| Старт | `starter` | 500 |
| Бизнес | `business` | 5 000 |
| Профессиональный | `professional` | 20 000 |
| Корпоративный | `corporate` | 100 000 |
| Энтерпрайз | `enterprise` | 99 999 999 |

### Поток контроля лимита

```
Event Dispatcher получает HTTP 200 от n8n
        │
        └─ usageService.incrementExecution(tenantId)
                │
                ├── UPSERT platform.usage_counters (count+1, атомарно)
                │
                └── count >= limit_value AND is_limit_hit = FALSE ?
                        │
                        └─ blockTenant(tenantId):
                             1. UPDATE usage_counters SET is_limit_hit = TRUE
                             2. n8nClient.getWorkflows(tenantId)
                             3. deactivateWorkflow(id) для каждого активного
                             4. INSERT audit_log (event_type='n8n_limit_hit', actor='system')
```

### Автосброс: cron `'5 0 1 * *'` UTC (первое число месяца, 00:05)

```
1. SELECT DISTINCT tenant_id из usage_counters WHERE is_limit_hit = TRUE (BYPASSRLS)
2. UPDATE count=0, is_limit_hit=FALSE WHERE period = прошлый месяц
3. resetLimit() для каждого заблокированного тенанта:
     activateWorkflow(id) для воркфлоу с active=false
4. INSERT audit_log (event_type='n8n_limit_cron_reset', actor='cron', tenant_id=NULL)
```

### Ручной сброс (Admin API F6.7-A)

```http
POST /admin/n8n/tenants/{tenant_id}/reset-limit
Cookie: admin_session_id=...

→ внутри: POST /internal/v1/n8n/reset-limit/{tenantId}
           X-Service-Token: INTERNAL_SERVICE_TOKEN
```

Вызывается также при смене тарифа через F3 — воркфлоу реактивируются без ожидания 1-го числа.

---

## 11. Bridge Service как диспетчер событий (F2)

**Порт:** `3001` · **Файл:** `services/bridge/`

### Что делает Bridge

| Компонент | Назначение |
|---|---|
| JWT-middleware | Проверка `Authorization: Bearer` + кеш в Redis DB=0 |
| Event queue | `marketplace.events` — очередь входящих событий |
| Event Dispatcher | Polling `status='pending'` → POST к n8n → retry |
| Dead Letter Queue | `marketplace.dead_letter_queue` — события после 3 retry |
| Webhook receiver | `/api/v1/webhooks/{id}` — приём от внешних сервисов (F9) |
| `/api/v1/health` | `{status:"ok", postgres:"ok", redis:"ok", n8n:"ok", version}` |

### Redis в Bridge (DB=0)

```
jwt:{tenant_id}  — кеш JWT payload, invalidation при блокировке тенанта
```

При блокировке тенанта через Admin Panel: `SCAN/DEL jwt:{tenant_id}:*` в Redis DB=0 → все JWT немедленно инвалидируются.

### Метрики Prometheus (Bridge)

| Метрика | Описание |
|---|---|
| `httpRequestsTotal` | Счётчик HTTP запросов |
| `queueDepth` | Глубина очереди `marketplace.events` |
| `dlqSize` | Размер Dead Letter Queue |
| `eventProcessingLatency` | Задержка обработки события |
| `jwtVerifyErrorsTotal` | Ошибки верификации JWT |

---

## 12. Таблица маршрутов Nginx → upstream

**Файл:** `nginx/sites-enabled/api.corebridge.ru.conf`

| Location | Upstream | Rate limit | Примечание |
|---|---|---|---|
| `/api/v1/` | `bridge:3001` | `per_tenant` 10r/s | Основной путь .epf клиентов |
| `/api/v1/webhooks/` | `bridge:3001` | burst=100, без JWT | Входящие webhooks от сервисов |
| `/webhook/` | `bridge:3001` | — | n8n webhook guard (F6.4): JWT → n8n |
| `/lk/` | `lk-api:3000` | `per_ip` | ЛК пользователей |
| `/lk/n8n/` | `lk-api:3000` | — | Визуальный конструктор интеграций |
| `/api/v1/license/` | `license-service:3002` | `license_zone` 2r/s | Лицензии и тарифы |
| `/n8n/webhook/` | `n8n:5678` | burst=100 | Публичные webhook n8n (rewrite срезает /n8n/) |
| `/n8n/` | `n8n:5678` | IP whitelist | UI n8n (WebSocket, Accept-Encoding: "") |
| `/admin/` | `admin:3003` | IP whitelist | Admin Panel (2FA TOTP) |
| `/internal/` | — | `deny all` → 403 | Закрыт снаружи |
| `/monitoring/` | `grafana:3000` | geo-whitelist | Grafana дашборды |

---

## 13. Схема базы данных: ключевые таблицы

### `marketplace.events` — очередь событий

```sql
CREATE TABLE marketplace.events (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id       UUID NOT NULL REFERENCES platform.tenants(id),
  integration_id  VARCHAR(50) NOT NULL,   -- MP_001, CRM_001, ...
  adapter_type    VARCHAR(50),            -- ozon, wb, ym, yukassa, bitrix24, ...
  event_type      VARCHAR(100) NOT NULL,  -- order_new, payment_received, crm_deal_new, ...
  payload         JSONB NOT NULL,         -- нормализованные данные
  status          VARCHAR(20) DEFAULT 'pending',  -- pending | received | done | failed
  retry_count     INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  processed_at    TIMESTAMPTZ
);
```

### `marketplace.adapter_configs` — конфигурации интеграций

```sql
CREATE TABLE marketplace.adapter_configs (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id           UUID NOT NULL REFERENCES platform.tenants(id),
  integration_id      VARCHAR(50) NOT NULL,
  adapter_type        VARCHAR(50) NOT NULL,       -- ozon, wb, bitrix24, cdek, ...
  encrypted_config    BYTEA NOT NULL,             -- AES-256-GCM: IV(12) | ct | Tag(16)
  config_hash         VARCHAR(64),                -- SHA-256 для детектирования изменений
  is_active           BOOLEAN DEFAULT TRUE,
  error_count         INTEGER DEFAULT 0,          -- ≥5 → is_active=FALSE
  n8n_workflow_id     VARCHAR(100),               -- NULL = не провизионирован (F6.2)
  n8n_credential_id   VARCHAR(100)                -- NULL = не создан (F6.3)
);
```

### `platform.usage_counters` — лимиты выполнений n8n (F6.DB)

```sql
CREATE TABLE platform.usage_counters (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id       UUID NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
  counter_type    VARCHAR(50),   -- 'n8n_executions_month' | 'api_calls_day'
  period          VARCHAR(7),    -- 'YYYY-MM' или 'YYYY-MM-DD'
  count           INTEGER DEFAULT 0,
  limit_value     INTEGER,       -- лимит из JWT на момент создания периода
  is_limit_hit    BOOLEAN DEFAULT FALSE,
  last_updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, counter_type, period)
);
```

### `marketplace.dead_letter_queue` — необработанные события

```sql
-- События после 3 retry
-- Поля: tenant_id, event_type, payload, error, retry_count=3
-- Статус: 'pending' | 'reprocessed' | 'deleted' (физическое удаление запрещено)
```

### `platform.audit_log` — иммутабельный лог

```sql
-- INSERT only — триггер запрещает UPDATE/DELETE
-- actor: 'jwt.sub' | 'system' | 'cron' | 'admin:{email}'
-- action: 'n8n_workspace_created' | 'integration_activated' | 'n8n_limit_hit' | ...
```

### `platform.tenants` — тенанты (клиенты)

Ключевые поля для n8n-изоляции:

```sql
n8n_initialized         BOOLEAN NOT NULL DEFAULT FALSE
n8n_tag_id              VARCHAR(50)       -- ID тега в n8n API
n8n_workspace_created_at TIMESTAMPTZ
```

---

## Схема взаимодействия: полный цикл от заказа до ACK

```
1. Ozon выставил новый заказ
        │
        ▼
2. adapter-ozon (cron 60s)
   GET https://api-seller.ozon.ru/v3/posting/fbs/unfulfilled/list
   Authorization: Api-Key {дешифрованный из BYTEA}
        │
        ▼
3. normalizeOzonOrder(raw) → стандартный конверт
        │
        ▼
4. INSERT marketplace.events
   { tenant_id, integration_id='MP_001', event_type='order_new',
     payload={...нормализованный заказ...}, status='pending' }
        │
        ▼
5. Event Dispatcher (bridge, F2)
   SELECT * FROM marketplace.events WHERE status='pending'
        │
        ▼
6. POST http://n8n:5678/webhook/tenant_abc123/marketplace/order_new
   Body: { _routing: {...}, payload: {...}, _meta: {...} }
        │
        ▼
7. n8n воркфлоу marketplace_orders.json
   [1] Validate _routing (Code)
   [2] ACK "received"  → POST /internal/v1/events/ack  (status='received')
        │    marketplace.events.status = 'received'
        ▼
   [3] Switch: event_type == 'order_new'
   [4] HTTP: POST /internal/v1/orders/create
        │    (Bridge создаёт заказ во внутренней системе)
        ▼
   [5] Final ACK "processed"  → POST /internal/v1/events/ack  (status='processed')
        │
        ▼
8. marketplace.events.status = 'done'
        │
        ▼
9. usageService.incrementExecution(tenantId)
   UPSERT platform.usage_counters (count+1)
   if count >= limit → blockTenant()
        │
        ▼
10. .epf клиент получает событие через GET /api/v1/events (polling)
    и создаёт Документы.ЗаказПокупателя в 1С
    POST /api/v1/events/{id}/ack  →  status='success', doc_ref='uuid-1с'
```

---

*Документ сгенерирован на основе `CLAUDE(server).md` и `README_server_.md`. Актуален для версии `corebridge-server` Блок 2: F6.7-A ✅.*
