# CoreBridge — Реестр API внешних сервисов

> **Назначение:** Полный перечень всех API-вызовов между CoreBridge Server и внешними сервисами. Используется для реализации механик, написания тестов и документирования интеграций.
> **Источники:** `CLAUDE.md v2.5` · `CLAUDE(server).md` · `README_server_.md` · официальная документация сервисов
> **Формат каждого вызова:** направление · метод · URL · заголовки · тело запроса · ожидаемый ответ · наш эндпоинт

**Условные обозначения:**
- `→` Исходящий: CoreBridge → Сервис
- `←` Входящий: Сервис → CoreBridge (webhook / polling)
- `[CB]` наш эндпоинт на стороне CoreBridge Server
- `[SVC]` эндпоинт внешнего сервиса

---

## Содержание

1. [Ozon](#1-ozon)
2. [Wildberries](#2-wildberries)
3. [Яндекс Маркет](#3-яндекс-маркет)
4. [ЮKassa](#4-юkassa)
5. [СБП](#5-сбп)
6. [Тинькофф T-Bank](#6-тинькофф-t-bank)
7. [Сбер SberPay](#7-сбер-sberpay)
8. [СДЭК](#8-сдэк)
9. [Почта России](#9-почта-России)
10. [ЯМ Доставка](#10-ям-доставка)
11. [Битрикс24](#11-битрикс24)
12. [AmoCRM](#12-amocrm)
13. [Мегаплан](#13-мегаплан)
14. [СБИС CRM](#14-сбис-crm)
15. [Neaktor](#15-neaktor)
16. [MindBox](#16-mindbox)
17. [SendPulse](#17-sendpulse)
18. [МойСклад](#18-мойсклад)
19. [Telegram](#19-telegram)
20. [WhatsApp WABA](#20-whatsapp-waba)
21. [VK](#21-vk)
22. [Viber](#22-viber)
23. [Одноклассники](#23-одноклассники)
24. [Google Sheets](#24-google-sheets)
25. [Power BI](#25-power-bi)
26. [Roistat](#26-roistat)

---

## 1. Ozon

**Base URL:** `https://api-seller.ozon.ru`
**Документация:** `https://docs.ozon.ru/api/seller/`
**Авторизация:** два заголовка на каждый запрос: `Client-Id: {client_id}` и `Api-Key: {api_key}`
**n8n credential type:** `httpHeaderAuth`
**Тип связи:** Polling (adapter-ozon, cron 60 сек) + Webhook от Ozon на `/api/v1/webhooks/{integration_id}`

### Механики: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11

---

### 1.1 Механика 1 — Заказы FBS (получение)

**Направление:** → (CoreBridge polling Ozon)
**[CB]** `marketplace.events` ← результат нормализации
**[SVC]** `POST https://api-seller.ozon.ru/v3/posting/fbs/unfulfilled/list`

**Заголовки запроса:**
```
Content-Type: application/json
Client-Id: {client_id}
Api-Key: {api_key}
```

**Тело запроса:**
```json
{
  "dir": "ASC",
  "filter": {
    "cutoff_from": "{ISO8601}",
    "cutoff_to": "{ISO8601}",
    "delivery_schema": ["fbs"],
    "provider_id": [],
    "status": "",
    "warehouse_id": []
  },
  "limit": 100,
  "offset": 0,
  "with": {
    "analytics_data": true,
    "barcodes": true,
    "financial_data": true,
    "translit": false
  }
}
```

**Ожидаемый ответ (200):**
```json
{
  "result": {
    "count": 1,
    "postings": [
      {
        "posting_number": "80755985-0029-1",
        "order_id": 693974131,
        "order_number": "80755985-0029",
        "status": "awaiting_packaging",
        "substatus": "posting_acceptance_waiting",
        "created_at": "2021-11-25T09:02:35.469Z",
        "in_process_at": "2021-11-25T09:02:35.469Z",
        "products": [
          {
            "sku": 150583609,
            "name": "Наименование товара",
            "quantity": 1,
            "offer_id": "ART-001",
            "price": "1500.00",
            "digital_codes": [],
            "currency_code": "RUB"
          }
        ],
        "addressee": {
          "name": "Иван Иванов",
          "phone": "+79001234567"
        },
        "barcodes": {
          "upper_barcode": "ABCstring1234",
          "lower_barcode": "ABCstring5678"
        },
        "analytics_data": {
          "date": "2021-11-25",
          "region": "Москва",
          "city": "Москва",
          "delivery_type": "PVZ",
          "is_premium": false,
          "payment_type_group_name": "Карты оплаты",
          "warehouse_id": 15570510180000,
          "warehouse_name": "Москва Колпакова",
          "is_legal": false
        },
        "financial_data": {
          "products": [
            {
              "commission_amount": 75.0,
              "commission_percent": 5,
              "payout": 1425.0,
              "product_id": 150583609,
              "old_price": 0.0,
              "total_discount_value": 0.0,
              "total_discount_percent": 0.0,
              "actions": [],
              "picking": null,
              "quantity": 1,
              "client_price": "1500.00",
              "item_services": {
                "marketplace_service_item_fulfillment": -75.0,
                "marketplace_service_item_pickup": 0.0,
                "marketplace_service_item_dropoff_pvz": 0.0,
                "marketplace_service_item_dropoff_sc": 0.0,
                "marketplace_service_item_dropoff_ff": 0.0,
                "marketplace_service_item_direct_flow_trans": 0.0,
                "marketplace_service_item_return_flow_trans": 0.0,
                "marketplace_service_item_delivery_to_customer": 0.0,
                "marketplace_service_item_return_not_deliv_to_customer": 0.0,
                "marketplace_service_item_return_part_goods_customer": 0.0,
                "marketplace_service_item_return_after_deliv_to_customer": 0.0
              }
            }
          ],
          "posting_services": {
            "marketplace_service_item_fulfillment": -75.0,
            "marketplace_service_item_pickup": 0.0
          }
        },
        "is_express": false,
        "requirements": {
          "products_requiring_gtd": ["150583609"],
          "products_requiring_country": [],
          "products_requiring_mandatory_mark": ["150583609"]
        }
      }
    ]
  }
}
```

**Поля для маппинга в нормализатор:**

| Поле Ozon | Поле нормализованного события |
|---|---|
| `posting_number` | `order_id` |
| `order_number` | `order_number` |
| `status` | `status` → маппинг в `event_type` |
| `products[].sku` | `items[].sku` |
| `products[].offer_id` | `items[].offer_id` |
| `products[].quantity` | `items[].qty` |
| `products[].price` | `items[].price` |
| `addressee.name` | `customer.name` |
| `addressee.phone` | `customer.phone` |
| `analytics_data.warehouse_id` | `warehouse_id` |
| `requirements.products_requiring_gtd` | `gtd_required_skus[]` |
| `requirements.products_requiring_mandatory_mark` | `marking_required_skus[]` |

**Маппинг статусов Ozon → event_type:**

| Статус Ozon | event_type |
|---|---|
| `awaiting_packaging` | `order_new` |
| `awaiting_deliver` | `order_confirmed` |
| `delivering` | `order_confirmed` |
| `cancelled` | `order_cancelled` |
| `cancelled_from_pending` | `order_cancelled` |

---

### 1.2 Механика 1 — Заказы FBO (получение)

**[SVC]** `POST https://api-seller.ozon.ru/v2/posting/fbo/list`

**Тело запроса:**
```json
{
  "dir": "ASC",
  "filter": {
    "since": "{ISO8601}",
    "to": "{ISO8601}",
    "status": ""
  },
  "limit": 100,
  "offset": 0,
  "translit": false,
  "with": {
    "analytics_data": true,
    "financial_data": true
  }
}
```

**Ответ:** Аналогичен FBS, поле `posting_number` используется как `order_id`.

---

### 1.3 Механика 2 — Подтверждение отгрузки

**Направление:** → (CoreBridge → Ozon)
**[CB]** Триггер: событие `order_confirmed` в воркфлоу n8n
**[SVC]** `POST https://api-seller.ozon.ru/v2/posting/fbs/ship`

**Заголовки:** `Content-Type: application/json` · `Client-Id` · `Api-Key`

**Тело запроса:**
```json
{
  "packages": [
    {
      "products": [
        {
          "product_id": 185479016,
          "quantity": 1
        }
      ]
    }
  ],
  "posting_number": "80755985-0029-1",
  "with": {
    "additional_data": true
  }
}
```

**Ожидаемый ответ (200):**
```json
{
  "result": ["80755985-0029-1"]
}
```

---

### 1.4 Механика 3 — Выгрузка остатков

**Направление:** → (CoreBridge → Ozon)
**[CB]** `POST /api/v1/data/marketplace` → адаптер отправляет в Ozon
**[SVC]** `POST https://api-seller.ozon.ru/v1/product/import/stocks`

**Тело запроса:**
```json
{
  "stocks": [
    {
      "offer_id": "ART-001",
      "stock": 150,
      "warehouse_id": 22142605386000
    },
    {
      "offer_id": "ART-002",
      "stock": 0,
      "warehouse_id": 22142605386000
    }
  ]
}
```
> Лимит: 100 SKU за запрос. Batch: несколько запросов если товаров больше.

**Ожидаемый ответ (200):**
```json
{
  "result": {
    "task_id": 172549811
  }
}
```

**Получение складов (предварительно):**
**[SVC]** `POST https://api-seller.ozon.ru/v1/warehouse/list`
```json
{}
```
Ответ: `{ "result": [{ "warehouse_id": 22142605386000, "name": "Склад Москва", "is_rfbs": false }] }`

---

### 1.5 Механика 4 — Выгрузка цен

**[CB]** `POST /api/v1/data/marketplace` (type=prices)
**[SVC]** `POST https://api-seller.ozon.ru/v1/product/import/prices`

**Тело запроса:**
```json
{
  "prices": [
    {
      "auto_action_enabled": "UNKNOWN",
      "currency_code": "RUB",
      "min_price": "0",
      "offer_id": "ART-001",
      "old_price": "3500",
      "price": "2990",
      "price_strategy_enabled": "UNKNOWN"
    }
  ]
}
```
> Лимит: 1000 SKU за запрос.

**Ответ (200):**
```json
{
  "result": [
    {
      "offer_id": "ART-001",
      "updated": true,
      "errors": []
    }
  ]
}
```

---

### 1.6 Механика 5 — FBM поставки (получение)

**[SVC]** `POST https://api-seller.ozon.ru/v1/supply-order/list`

**Тело запроса:**
```json
{
  "filter": {
    "states": ["SUPPLY_ORDER_STATE_WAIT_FOR_PACKAGING"]
  },
  "paging": {
    "from_supply_order_id": 0,
    "limit": 50
  }
}
```

**Ответ (200):**
```json
{
  "supply_orders": [
    {
      "supply_order_id": 12345,
      "supply_order_number": "ORD-12345",
      "state": "SUPPLY_ORDER_STATE_WAIT_FOR_PACKAGING",
      "created_at": "2026-04-26T10:00:00Z",
      "items": [
        {
          "sku": 150583609,
          "quantity": 10
        }
      ],
      "warehouse": {
        "warehouse_id": 22142605386000,
        "name": "Москва Колпакова"
      }
    }
  ],
  "paging": {
    "last_supply_order_id": 12345
  }
}
```

---

### 1.7 Механика 6 — Финансовый отчёт

**[SVC]** `POST https://api-seller.ozon.ru/v1/finance/realization`

**Тело запроса:**
```json
{
  "month": 4,
  "year": 2026
}
```

**Ответ (200):**
```json
{
  "result": {
    "header": {
      "doc_date": "2026-04-30",
      "num": "ОФ-123456",
      "payer_name": "ООО Ромашка",
      "payer_inn": "7700000000",
      "payer_kpp": "770001001",
      "rcv_name": "ООО Интернет Решения",
      "rcv_inn": "7704217370"
    },
    "rows": [
      {
        "row_number": 1,
        "posting_number": "80755985-0029-1",
        "order_date": "2026-04-10",
        "operation_date": "2026-04-15",
        "operation_type": "OperationAgentDelivered",
        "delivery_schema": "fbs",
        "offer_id": "ART-001",
        "sku": 150583609,
        "item_name": "Наименование товара",
        "quantity": 1,
        "price": 1500.0,
        "commission_amount": 75.0,
        "commission_percent": 5.0,
        "payout": 1425.0,
        "services": {}
      }
    ],
    "totals": {
      "items_count": 1,
      "total_price": 1500.0,
      "total_commission_amount": 75.0,
      "total_payout": 1425.0
    }
  }
}
```

---

### 1.8 Механика 8 — Резервы (снепшот)

**[SVC]** `POST https://api-seller.ozon.ru/v2/product/info/stocks`

**Тело запроса:**
```json
{
  "filter": {
    "offer_id": [],
    "product_id": [],
    "visibility": "ALL"
  },
  "last_id": "",
  "limit": 1000
}
```

**Ответ (200):**
```json
{
  "result": {
    "items": [
      {
        "product_id": 150583609,
        "offer_id": "ART-001",
        "stocks": [
          {
            "present": 100,
            "reserved": 15,
            "type": "fbs",
            "warehouse_id": 22142605386000,
            "warehouse_name": "Москва Колпакова"
          }
        ]
      }
    ],
    "last_id": "abc123",
    "total": 1
  }
}
```

> Поле `reserved` — количество, зарезервированное под заказы FBS. Используется для документа `РезервированиеЗапасов` в 1С.

---

### 1.9 Механика 9 — Передача ГТД

**[CB]** `POST /api/v1/gtd/orders/{id}/customs`
**[SVC]** `POST https://api-seller.ozon.ru/v2/posting/fbs/product/country/set`

**Тело запроса:**
```json
{
  "posting_number": "80755985-0029-1",
  "product_id": 150583609,
  "country_iso_code": "CN"
}
```

**[SVC]** `POST https://api-seller.ozon.ru/v2/posting/fbs/product/exemplar/set` (для ГТД)

**Тело запроса:**
```json
{
  "posting_number": "80755985-0029-1",
  "products": [
    {
      "exemplars": [
        {
          "gtd": "10702070/271017/0051361",
          "is_gtd_absent": false,
          "mandatory_mark": "",
          "rnpt": ""
        }
      ],
      "product_id": 150583609
    }
  ]
}
```

**Ответ (200):** `{ "result": true }`

---

### 1.10 Механика 10 — Каталог (загрузка с Ozon)

**[SVC]** `POST https://api-seller.ozon.ru/v2/product/list`

**Тело запроса:**
```json
{
  "filter": {
    "offer_id": [],
    "product_id": [],
    "visibility": "ALL"
  },
  "last_id": "",
  "limit": 1000
}
```

**Ответ:** список `{ product_id, offer_id, name, sku }`

**Получение карточки товара:**
**[SVC]** `POST https://api-seller.ozon.ru/v2/product/info`
```json
{ "offer_id": "ART-001", "product_id": 150583609, "sku": 0 }
```

**Выгрузка товара на Ozon:**
**[SVC]** `POST https://api-seller.ozon.ru/v3/product/import`
```json
{
  "items": [
    {
      "attributes": [
        { "complex_id": 0, "id": 9048, "values": [{ "dictionary_value_id": 971082183, "value": "Наименование товара" }] }
      ],
      "barcode": "8765765757",
      "description_category_id": 17028776,
      "color_image": "",
      "complex_attributes": [],
      "currency_code": "RUB",
      "depth": 10,
      "dimension_unit": "mm",
      "height": 250,
      "images": ["https://example.com/image.jpg"],
      "images360": [],
      "name": "Наименование товара",
      "offer_id": "ART-001",
      "old_price": "3500",
      "pdf_list": [],
      "price": "2990",
      "primary_image": "https://example.com/image.jpg",
      "vat": "0.1",
      "weight": 200,
      "weight_unit": "g",
      "width": 150
    }
  ]
}
```

---

### 1.11 Механика 11 — Этикетки

**[CB]** `GET /api/v1/labels/templates?adapter=ozon&type=fbs`
**[SVC]** `POST https://api-seller.ozon.ru/v2/posting/fbs/package-label`

**Тело запроса:**
```json
{
  "posting_number": ["80755985-0029-1"]
}
```

**Ответ:** PDF-файл (бинарный, `Content-Type: application/pdf`)

---

### 1.12 Webhook от Ozon → CoreBridge

**[CB]** `POST /api/v1/webhooks/{integration_id}` (F9)
**Верификация:** `yukassa.js` аналог — проверка по заголовку `X-Ozon-Signature` (HMAC-SHA256)

**Типы событий Ozon:**
```json
{
  "message_type": "TYPE_NEW_POSTING",
  "posting_number": "80755985-0029-1",
  "seller_id": 1234567,
  "reason": {}
}
```

| `message_type` | Нормализованный `event_type` |
|---|---|
| `TYPE_NEW_POSTING` | `order_new` |
| `TYPE_POSTING_CANCELLED` | `order_cancelled` |
| `TYPE_PRICE_INDEX_CHANGED` | (игнорируется) |

---

## 2. Wildberries

**Base URL:** `https://suppliers-api.wildberries.ru`
**Документация:** `https://openapi.wildberries.ru/`
**Авторизация:** `Authorization: Bearer {api_key}`
**n8n credential type:** `httpHeaderAuth`
**Тип связи:** Polling (adapter-wb, cron 60 сек)

### Механики: 1, 2, 3, 4, 5, 6, 7, 10, 11

---

### 2.1 Механика 1 — Получение новых заказов FBS

**[SVC]** `GET https://suppliers-api.wildberries.ru/api/v3/orders/new`

**Заголовки:** `Authorization: Bearer {api_key}`

**Ответ (200):**
```json
{
  "orders": [
    {
      "id": 12345678,
      "rid": "c9b45a3f-e1d2-4a5b-8c6d-7e8f9a0b1c2d",
      "createdAt": "2026-04-26T10:00:00Z",
      "warehouseId": 123456,
      "supplyId": "",
      "offices": ["Москва"],
      "skus": ["2038353095469"],
      "price": 295000,
      "convertedPrice": 295000,
      "currencyCode": 643,
      "convertedCurrencyCode": 643,
      "orderUid": "c9b45a3f_1234567890",
      "article": "ART-001",
      "colorCode": "",
      "subject": "Футболки",
      "category": "Одежда",
      "brandName": "BrandName",
      "isZeroOrder": false,
      "isLargeCargo": false
    }
  ]
}
```

> `price` в копейках (295000 = 2950.00 ₽). Нормализатор делит на 100.

**Маппинг полей WB → нормализованное событие:**

| Поле WB | Нормализованное поле |
|---|---|
| `id` | `order_id` |
| `orderUid` | `order_number` |
| `article` | `items[0].sku` / `offer_id` |
| `skus[0]` | `items[0].barcode` |
| `price / 100` | `items[0].price` |
| `warehouseId` | `warehouse_id` |
| `createdAt` | `created_at` |

---

### 2.2 Механика 1 — Получение информации о заказах (детально)

**[SVC]** `GET https://suppliers-api.wildberries.ru/api/v3/orders?limit=1000&next=0`

**Параметры:**
| Параметр | Тип | Описание |
|---|---|---|
| `limit` | integer | Макс. кол-во (до 1000) |
| `next` | integer | Cursor для пагинации |
| `dateFrom` | integer | Unix timestamp начала периода |
| `orderUIDs` | string | Список `orderUid` через запятую (опц.) |

**Ответ (200):**
```json
{
  "next": 13833711,
  "orders": [
    {
      "address": {
        "fullAddress": "Москва, ул. Ленина, 1",
        "province": "Москва",
        "area": "Центральный",
        "city": "Москва",
        "street": "ул. Ленина",
        "home": "1",
        "flat": "5",
        "entrance": "1",
        "longitude": 37.6173,
        "latitude": 55.7558
      },
      "deliveryType": "dbs",
      "id": 12345678,
      "rid": "c9b45a3f-e1d2-4a5b-8c6d-7e8f9a0b1c2d",
      "createdAt": "2026-04-26T10:00:00Z",
      "price": 295000,
      "article": "ART-001",
      "status": "new",
      "warehouseId": 123456,
      "nmId": 1234567,
      "chrtId": 9876543,
      "skus": ["2038353095469"],
      "user": {
        "fio": "Иван Иванов",
        "phone": "+79001234567"
      }
    }
  ]
}
```

---

### 2.3 Механика 2 — Подтверждение сборки / отгрузки

**[SVC]** `PATCH https://suppliers-api.wildberries.ru/api/v3/orders/{orderId}/status`

**Тело запроса:**
```json
{
  "status": "confirm"
}
```

> Допустимые значения `status`: `confirm` (подтвердить), `cancel` (отменить).

**Ответ (204):** без тела.

---

### 2.4 Механика 2 — Передача треков / актов

**[SVC]** `POST https://suppliers-api.wildberries.ru/api/v3/supplies/{supplyId}/barcode`

**Тело запроса:**
```json
{
  "type": "png"
}
```

**Ответ:** бинарный PNG штрих-код для сдачи товара в ПВЗ/склад.

---

### 2.5 Механика 3 — Выгрузка остатков

**[SVC]** `PUT https://suppliers-api.wildberries.ru/api/v3/stocks/{warehouseId}`

**Тело запроса:**
```json
{
  "stocks": [
    {
      "sku": "2038353095469",
      "amount": 150
    },
    {
      "sku": "2038353095470",
      "amount": 0
    }
  ]
}
```
> Лимит: 1000 SKU за запрос. Пустой список `stocks: []` — сброс всех остатков склада.

**Ответ (204):** без тела.

**Получение складов:**
**[SVC]** `GET https://suppliers-api.wildberries.ru/api/v3/warehouses`

**Ответ:**
```json
[
  {
    "id": 123456,
    "name": "Москва Колпакова",
    "address": "г. Москва, ул. Колпакова, 1",
    "workTime": "Пн-Пт 9:00-18:00",
    "deliveryDurationDays": 1,
    "selected": true,
    "boxTypeName": "Короба",
    "boxTypeId": 2
  }
]
```

---

### 2.6 Механика 4 — Выгрузка цен

**[SVC]** `POST https://discounts-prices-api.wildberries.ru/api/v2/upload/task`

**Тело запроса:**
```json
{
  "data": [
    {
      "nmID": 1234567,
      "price": 2990,
      "discount": 15
    }
  ]
}
```
> `nmID` — числовой ID номенклатуры WB (не offer_id). `price` в рублях (целое). `discount` — скидка в %.

**Ответ (200):**
```json
{
  "data": {
    "taskId": "task_abc123"
  },
  "error": false,
  "errorText": ""
}
```

**Проверка статуса задачи:**
**[SVC]** `GET https://discounts-prices-api.wildberries.ru/api/v2/history/tasks?uploadID={taskId}`

---

### 2.7 Механика 5 — FBM поставки

**Создание поставки:**
**[SVC]** `POST https://suppliers-api.wildberries.ru/api/v3/supplies`

**Тело запроса:**
```json
{
  "name": "Поставка CoreBridge 2026-04-26"
}
```

**Ответ:**
```json
{
  "id": "WB-GI-1234567"
}
```

**Добавление заказов в поставку:**
**[SVC]** `PATCH https://suppliers-api.wildberries.ru/api/v3/supplies/{supplyId}/orders`
```json
{
  "orderIds": [12345678, 12345679]
}
```

**Передача поставки на склад:**
**[SVC]** `PATCH https://suppliers-api.wildberries.ru/api/v3/supplies/{supplyId}/deliver`
**Тело:** пустой объект `{}`

---

### 2.8 Механика 6 — Финансовый отчёт

**[SVC]** `GET https://statistics-api.wildberries.ru/api/v1/supplier/reportDetailByPeriod`

**Параметры запроса:**
| Параметр | Тип | Описание |
|---|---|---|
| `dateFrom` | string | Дата начала `YYYY-MM-DD` |
| `dateTo` | string | Дата конца `YYYY-MM-DD` |
| `rrdid` | integer | ID строки для пагинации (0 — начало) |
| `limit` | integer | До 100000 строк |

**Заголовки:** `Authorization: Bearer {statistics_api_key}` ⚠️ Отдельный ключ статистики!

**Ответ (200):**
```json
[
  {
    "realizationreport_id": 1234567,
    "date_from": "2026-04-01",
    "date_to": "2026-04-30",
    "create_dt": "2026-05-01T00:00:00Z",
    "suppliercontract_code": null,
    "rrd_id": 1,
    "gi_id": 12345,
    "dlv_prc": 0,
    "fix_tariff_date_from": null,
    "subject_name": "Футболки",
    "nm_id": 1234567,
    "brand_name": "BrandName",
    "sa_name": "ART-001",
    "ts_name": "L",
    "barcode": "2038353095469",
    "doc_type_name": "Продажа",
    "quantity": 1,
    "retail_price": 2990.0,
    "retail_amount": 2990.0,
    "sale_percent": 0,
    "commission_percent": 5.0,
    "office_name": "Москва",
    "supplier_oper_name": "Продажа",
    "order_dt": "2026-04-10T00:00:00Z",
    "sale_dt": "2026-04-15T00:00:00Z",
    "rr_dt": "2026-05-01T00:00:00Z",
    "shk_id": 9876543,
    "retail_price_withdisc_rub": 2541.5,
    "delivery_amount": 0,
    "return_amount": 0,
    "delivery_rub": 0,
    "gi_box_type_name": "Монопаллет",
    "product_discount_for_report": 15.0,
    "supplier_promo": 0.0,
    "rid": 987654321,
    "ppvz_spp_prc": 15.0,
    "ppvz_kvw_prc_base": 8.0,
    "ppvz_kvw_prc": 8.0,
    "sup_rating_prc_up": 0.0,
    "is_kgvp_v2": 0,
    "ppvz_sales_commission": 203.32,
    "ppvz_for_pay": 2338.18,
    "ppvz_reward": 0.0,
    "acquiring_fee": 0.0,
    "acquiring_bank": "",
    "ppvz_vw": 203.32,
    "ppvz_vw_nds": 33.89,
    "ppvz_office_id": 321,
    "ppvz_office_name": "Москва Колпакова",
    "ppvz_supplier_id": 111222,
    "ppvz_supplier_name": "ООО Ромашка",
    "ppvz_inn": "7700000000",
    "declaration_number": "10702070/271017/0051361",
    "sticker_id": "abcde-12345",
    "site_country": "Россия",
    "penalty": 0.0,
    "additional_payment": 0.0,
    "rebill_logistic_cost": 0.0,
    "rebill_logistic_org": "",
    "kiz": "",
    "storage_fee": 0.0,
    "deduction": 0.0,
    "acceptance": 0.0,
    "srid": "c9b45a3f_1234567890"
  }
]
```

---

### 2.9 Механика 11 — Этикетки FBS

**[SVC]** `GET https://suppliers-api.wildberries.ru/api/v3/orders/stickers`

**Параметры запроса:** `type=svg|zplv|zplh|png`

**Тело запроса:**
```json
{
  "orders": [12345678, 12345679]
}
```

**Ответ (200):**
```json
{
  "stickers": [
    {
      "orderId": 12345678,
      "partA": 123,
      "partB": 456,
      "svgFile": "BASE64_ENCODED_SVG",
      "wbBarcode": "WB000012345678"
    }
  ]
}
```

---

## 3. Яндекс Маркет

**Base URL:** `https://api.partner.market.yandex.ru`
**Документация:** `https://yandex.ru/dev/market/partner-api/`
**Авторизация:** OAuth 2.0. Токен обновляется автоматически через `client_credentials`.
**n8n credential type:** `oAuth2Api`
**Тип связи:** Polling (adapter-ym, cron 60 сек) + Webhook от ЯМ

### Механики: 1, 2, 3, 4, 5, 6, 7, 10, 11

---

### 3.1 OAuth — Получение токена

**[SVC]** `POST https://oauth.yandex.ru/token`

**Тело (application/x-www-form-urlencoded):**
```
grant_type=client_credentials
&client_id={client_id}
&client_secret={client_secret}
```

**Ответ:**
```json
{
  "access_token": "AgAAA...",
  "expires_in": 31536000,
  "token_type": "bearer"
}
```

---

### 3.2 Механика 1 — Получение заказов

**[SVC]** `GET https://api.partner.market.yandex.ru/campaigns/{campaignId}/orders`

**Заголовки:** `Authorization: Bearer {access_token}`

**Параметры запроса:**
| Параметр | Тип | Описание |
|---|---|---|
| `status` | string | `PROCESSING`, `DELIVERY`, `CANCELLED` и др. |
| `supplierShipmentDateFrom` | string | `DD-MM-YYYY` |
| `supplierShipmentDateTo` | string | `DD-MM-YYYY` |
| `page` | integer | Номер страницы (с 1) |
| `pageSize` | integer | До 50 |

**Ответ (200):**
```json
{
  "status": "OK",
  "result": {
    "orders": [
      {
        "id": 12345678,
        "status": "PROCESSING",
        "substatus": "STARTED",
        "creationDate": "26-04-2026 10:00:00",
        "updatedAt": "26-04-2026 10:05:00",
        "currency": "RUR",
        "itemsTotal": 2990.0,
        "total": 2990.0,
        "deliveryTotal": 0.0,
        "subsidyTotal": 0.0,
        "totalWithSubsidy": 2990.0,
        "paymentType": "POSTPAID",
        "paymentMethod": "YANDEX",
        "fake": false,
        "items": [
          {
            "id": 1,
            "offerId": "ART-001",
            "offerName": "Наименование товара",
            "price": 2990.0,
            "buyerPrice": 2990.0,
            "buyerPriceBeforeDiscount": 3500.0,
            "count": 1,
            "vat": "VAT20",
            "shopSku": "ART-001",
            "requiredInstanceTypes": ["CIS"]
          }
        ],
        "delivery": {
          "type": "DELIVERY",
          "serviceName": "Яндекс.Доставка",
          "serviceId": 106,
          "price": 0.0,
          "shipments": [
            {
              "id": 12345,
              "shipmentDate": "2026-04-27",
              "weight": 1000,
              "width": 30,
              "height": 20,
              "depth": 15
            }
          ],
          "address": {
            "country": "Россия",
            "city": "Москва",
            "street": "ул. Ленина",
            "house": "1",
            "flat": "5",
            "entrance": "1",
            "floor": "3",
            "recipient": "Иван Иванов",
            "phone": "+79001234567",
            "gps": { "longitude": 37.6173, "latitude": 55.7558 }
          }
        },
        "notes": "",
        "taxSystem": "USN",
        "cancelRequested": false
      }
    ],
    "pager": {
      "total": 1,
      "from": 1,
      "to": 1,
      "currentPage": 1,
      "pagesCount": 1,
      "pageSize": 50
    }
  }
}
```

**Маппинг статусов ЯМ → event_type:**

| Статус ЯМ | Substatus | event_type |
|---|---|---|
| `PROCESSING` | `STARTED` | `order_new` |
| `PROCESSING` | `READY_TO_SHIP` | `order_confirmed` |
| `DELIVERY` | — | `order_confirmed` |
| `CANCELLED` | — | `order_cancelled` |
| `DELIVERED` | — | `order_delivered` |

---

### 3.3 Механика 2 — Подтверждение отгрузки

**[SVC]** `PUT https://api.partner.market.yandex.ru/campaigns/{campaignId}/orders/{orderId}/status`

**Тело запроса:**
```json
{
  "order": {
    "status": "PROCESSING",
    "substatus": "READY_TO_SHIP"
  }
}
```

**Ответ (200):**
```json
{
  "status": "OK",
  "result": {
    "id": 12345678,
    "status": "PROCESSING",
    "substatus": "READY_TO_SHIP",
    "updatedAt": "26-04-2026 10:10:00"
  }
}
```

---

### 3.4 Механика 3 — Выгрузка остатков

**[SVC]** `PUT https://api.partner.market.yandex.ru/campaigns/{campaignId}/offers/stocks`

**Тело запроса:**
```json
{
  "skus": [
    {
      "sku": "ART-001",
      "warehouseId": 12345,
      "items": [
        {
          "type": "FIT",
          "count": 150,
          "updatedAt": "2026-04-26T10:00:00+03:00"
        }
      ]
    }
  ]
}
```

**Ответ (200):**
```json
{
  "status": "OK",
  "result": {
    "skus": []
  }
}
```

---

### 3.5 Механика 4 — Выгрузка цен

**[SVC]** `POST https://api.partner.market.yandex.ru/campaigns/{campaignId}/offer-prices/updates`

**Тело запроса:**
```json
{
  "offers": [
    {
      "id": "ART-001",
      "price": {
        "value": 2990,
        "currencyId": "RUR",
        "discountBase": 3500
      }
    }
  ]
}
```

**Ответ (200):** `{ "status": "OK" }`

---

### 3.6 Механика 6 — Финансовый отчёт

**[SVC]** `GET https://api.partner.market.yandex.ru/campaigns/{campaignId}/stats/orders`

**Параметры запроса:**
| Параметр | Тип | Описание |
|---|---|---|
| `dateFrom` | string | `YYYY-MM-DD` |
| `dateTo` | string | `YYYY-MM-DD` |
| `page` | integer | Страница (с 1) |
| `pageSize` | integer | До 200 |

**Ответ (200):**
```json
{
  "status": "OK",
  "result": {
    "orders": [
      {
        "id": 12345678,
        "creationDate": "2026-04-10",
        "statusUpdateDate": "2026-04-15",
        "status": "DELIVERED",
        "partnerOrderId": "ART-ORDER-001",
        "currency": "RUR",
        "itemsTotal": 2990.0,
        "initialCost": 2990.0,
        "subsidies": [],
        "deliveryRegion": { "id": 213, "name": "Москва" },
        "items": [
          {
            "offerName": "Наименование товара",
            "marketSku": 987654321,
            "shopSku": "ART-001",
            "count": 1,
            "prices": [
              {
                "type": "BUYER",
                "costPerItem": 2990.0,
                "total": 2990.0
              }
            ],
            "commissions": [
              {
                "type": "FEE",
                "actual": 149.5
              }
            ]
          }
        ]
      }
    ],
    "pager": { "total": 1, "currentPage": 1, "pagesCount": 1, "pageSize": 200 }
  }
}
```

---

### 3.7 Механика 11 — Этикетки

**[SVC]** `POST https://api.partner.market.yandex.ru/campaigns/{campaignId}/orders/labels/generate`

**Тело запроса:**
```json
{
  "orderIds": [12345678],
  "format": "A4"
}
```

**Ответ:** PDF-файл (`Content-Type: application/pdf`)

---

---

# Оплата

---

## 4. ЮKassa

**Base URL:** `https://api.yookassa.ru/v3`
**Документация:** `https://yookassa.ru/developers/api`
**Авторизация:** HTTP Basic Auth: логин = `shopId`, пароль = `secretKey`
**n8n credential type:** `httpBasicAuth`
**Тип связи:** Webhook → CoreBridge (ЮKassa присылает уведомления на наш URL)

### Механики: 18 (Оплата)

---

### 4.1 Webhook от ЮKassa → CoreBridge

**[CB]** `POST /api/v1/webhooks/{integration_id}`
**Верификация:** HMAC-SHA256 по телу запроса, секрет из настроек ЛК ЮKassa
**Заголовок:** `Content-Type: application/json`

**Тело webhook — payment.succeeded:**
```json
{
  "type": "notification",
  "event": "payment.succeeded",
  "object": {
    "id": "22d6d597-000f-5000-9000-145f6df21d6f",
    "status": "succeeded",
    "amount": {
      "value": "2990.00",
      "currency": "RUB"
    },
    "income_amount": {
      "value": "2752.30",
      "currency": "RUB"
    },
    "description": "Заказ №12345",
    "recipient": {
      "account_id": "100500",
      "gateway_id": "1500002"
    },
    "payment_method": {
      "type": "bank_card",
      "id": "22d6d597-000f-5000-9000-145f6df21d6f",
      "saved": false,
      "card": {
        "first6": "555555",
        "last4": "4444",
        "expiry_month": "07",
        "expiry_year": "2027",
        "card_type": "MasterCard"
      },
      "title": "Bank card *4444"
    },
    "captured_at": "2026-04-26T10:10:00.519Z",
    "created_at": "2026-04-26T10:00:01.519Z",
    "test": false,
    "refunded_amount": {
      "value": "0.00",
      "currency": "RUB"
    },
    "paid": true,
    "refundable": true,
    "metadata": {
      "order_id": "ЗП-00123",
      "tenant_id": "tenant_abc123"
    },
    "authorization_details": {
      "rrn": "10000000000",
      "auth_code": "000000"
    }
  }
}
```

**Тело webhook — payment.canceled:**
```json
{
  "type": "notification",
  "event": "payment.canceled",
  "object": {
    "id": "22d6d597-000f-5000-9000-145f6df21d6f",
    "status": "canceled",
    "amount": { "value": "2990.00", "currency": "RUB" },
    "cancellation_details": {
      "party": "payment_network",
      "reason": "card_expired"
    },
    "created_at": "2026-04-26T10:00:01.519Z",
    "test": false,
    "paid": false,
    "refundable": false,
    "metadata": { "order_id": "ЗП-00123", "tenant_id": "tenant_abc123" }
  }
}
```

**Тело webhook — refund.succeeded:**
```json
{
  "type": "notification",
  "event": "refund.succeeded",
  "object": {
    "id": "refund_id_abc123",
    "payment_id": "22d6d597-000f-5000-9000-145f6df21d6f",
    "status": "succeeded",
    "amount": { "value": "2990.00", "currency": "RUB" },
    "description": "Возврат по заказу №12345",
    "created_at": "2026-04-26T11:00:00Z"
  }
}
```

**Маппинг событий ЮKassa → event_type:**

| event | event_type в CoreBridge |
|---|---|
| `payment.succeeded` | `payment_received` |
| `payment.canceled` | `payment_failed` |
| `refund.succeeded` + полная сумма | `refund_full` |
| `refund.succeeded` + частичная сумма | `refund_partial` |

---

### 4.2 Исходящий — Создание платежа (если нужен)

**[SVC]** `POST https://api.yookassa.ru/v3/payments`
**Заголовки:** `Idempotence-Key: {UUID}` · `Content-Type: application/json`

**Тело запроса:**
```json
{
  "amount": {
    "value": "2990.00",
    "currency": "RUB"
  },
  "capture": true,
  "confirmation": {
    "type": "redirect",
    "return_url": "https://corebridge.ru/payment/success"
  },
  "description": "Заказ №12345",
  "metadata": {
    "order_id": "ЗП-00123",
    "tenant_id": "tenant_abc123"
  }
}
```

---

## 5. СБП

**Base URL:** зависит от банка-эквайера (Тинькофф, Сбер, ВТБ и др.)
**Авторизация:** HMAC-SHA256 по телу запроса, ключ подписи из настроек
**n8n credential type:** `httpBasicAuth`
**Тип связи:** Webhook → CoreBridge

### Механики: 18 (Оплата)

---

### 5.1 Webhook от СБП → CoreBridge

**[CB]** `POST /api/v1/webhooks/{integration_id}`
**Верификация:** `sbp.js` — HMAC-SHA256, заголовок `X-Signature: sha256={hex}`

**Тело webhook (стандарт НСПК):**
```json
{
  "operationId": "oper_abc123def456",
  "operationType": "PAY",
  "operationState": "ACCEPTED",
  "amount": 299000,
  "currency": "RUB",
  "paymentPurpose": "Заказ №12345",
  "createdAt": "2026-04-26T10:00:00Z",
  "completedAt": "2026-04-26T10:00:05Z",
  "trxId": "trx_abc123",
  "merchantId": "merchant_id_123",
  "qrcId": "qrc_abc123",
  "additionalInfo": {
    "orderId": "ЗП-00123",
    "tenantId": "tenant_abc123"
  }
}
```

| `operationType` / `operationState` | event_type |
|---|---|
| `PAY` + `ACCEPTED` | `payment_received` |
| `PAY` + `REJECTED` | `payment_failed` |
| `REFUND` + `ACCEPTED` | `refund_full` / `refund_partial` |

> `amount` в копейках (299000 = 2990.00 ₽)

---

## 6. Тинькофф (T-Bank)

**Base URL:** `https://securepay.tinkoff.ru/v2`
**Документация:** `https://www.tinkoff.ru/kassa/develop/api/payments/`
**Авторизация:** Подпись SHA-256 по конкатенации всех параметров + `Password`
**n8n credential type:** `httpBasicAuth`
**Тип связи:** Webhook → CoreBridge

### Механики: 18 (Оплата)

---

### 6.1 Webhook от Тинькофф → CoreBridge

**[CB]** `POST /api/v1/webhooks/{integration_id}`

**Тело webhook:**
```json
{
  "TerminalKey": "TinkoffBankTest",
  "OrderId": "ЗП-00123",
  "Success": true,
  "Status": "CONFIRMED",
  "PaymentId": 2304882,
  "ErrorCode": "0",
  "Amount": 299000,
  "RebillId": null,
  "CardId": 335,
  "Pan": "430000******0777",
  "ExpDate": "0230",
  "Token": "sha256_signature_here"
}
```

| `Status` | event_type |
|---|---|
| `CONFIRMED` | `payment_received` |
| `REJECTED` | `payment_failed` |
| `REVERSED` | `refund_full` |
| `PARTIAL_REVERSED` | `refund_partial` |

> `Amount` в копейках.

---

### 6.2 Исходящий — Инициация платежа

**[SVC]** `POST https://securepay.tinkoff.ru/v2/Init`

**Тело запроса:**
```json
{
  "TerminalKey": "{terminal_key}",
  "Amount": 299000,
  "OrderId": "ЗП-00123",
  "Description": "Заказ №12345",
  "DATA": {
    "tenantId": "tenant_abc123"
  },
  "Receipt": {
    "Email": "buyer@example.ru",
    "Taxation": "usn_income",
    "Items": [
      {
        "Name": "Наименование товара",
        "Price": 299000,
        "Quantity": 1,
        "Amount": 299000,
        "Tax": "vat20",
        "PaymentMethod": "full_payment",
        "PaymentObject": "commodity"
      }
    ]
  },
  "Token": "{sha256_of_all_params_sorted}"
}
```

---

## 7. Сбер SberPay

**Base URL:** `https://securepayments.sberbank.ru/payment/rest`
**Документация:** `https://developer.sberbank.ru/doc/v1/acquiring-api`
**Авторизация:** `userName` + `password` (Basic Auth) или токен
**n8n credential type:** `httpBasicAuth`
**Тип связи:** Webhook → CoreBridge

### Механики: 18 (Оплата)

---

### 7.1 Webhook от Сбера → CoreBridge

**[CB]** `POST /api/v1/webhooks/{integration_id}`

**Параметры webhook (GET-параметры в URL или POST-тело):**
```
mdOrder=order_abc123&orderNumber=ЗП-00123&operation=deposited&status=1&checksum=sha256hash
```

| `operation` + `status` | event_type |
|---|---|
| `deposited` + `1` | `payment_received` |
| `declined` + `0` | `payment_failed` |
| `refunded` | `refund_full` / `refund_partial` |

---

### 7.2 Исходящий — Проверка статуса заказа

**[SVC]** `GET https://securepayments.sberbank.ru/payment/rest/getOrderStatusExtended.do`

**Параметры:**
```
userName={user}&password={pass}&orderId={mdOrder}&language=ru
```

**Ответ:**
```json
{
  "orderNumber": "ЗП-00123",
  "orderStatus": 2,
  "actionCode": 0,
  "actionCodeDescription": "",
  "amount": 299000,
  "currency": "643",
  "date": 1745654400000,
  "paymentAmountInfo": {
    "paymentState": "DEPOSITED",
    "approvedAmount": 299000,
    "depositedAmount": 299000,
    "refundedAmount": 0
  }
}
```

---

---

# Доставка

---

## 8. СДЭК

**Base URL:** `https://api.cdek.ru/v2`
**Документация:** `https://api-docs.cdek.ru/29923849.html`
**Авторизация:** OAuth 2.0 `client_credentials`, токен обновляется автоматически
**n8n credential type:** `httpBasicAuth`
**Тип связи:** Исходящие вызовы (мы → СДЭК) + Webhook (СДЭК → нам)

### Механики: 17 (Доставка)

---

### 8.1 Получение OAuth-токена

**[SVC]** `POST https://api.cdek.ru/v2/oauth/token`

**Тело (application/x-www-form-urlencoded):**
```
grant_type=client_credentials&client_id={account}&client_secret={password}
```

**Ответ:**
```json
{
  "access_token": "eyJhbGciOiJ...",
  "token_type": "bearer",
  "expires_in": 3600,
  "scope": "order:read order:write",
  "jti": "abc123"
}
```

---

### 8.2 Создание заявки на доставку

**[CB]** `POST /api/v1/delivery/{id}/create`
**[SVC]** `POST https://api.cdek.ru/v2/orders`

**Заголовки:** `Authorization: Bearer {access_token}` · `Content-Type: application/json`

**Тело запроса:**
```json
{
  "comment": "Заказ из CoreBridge",
  "number": "order_ref_uuid",
  "tariff_code": 136,
  "recipient": {
    "name": "Иван Иванов",
    "phones": [{ "number": "+79001234567" }],
    "email": "ivan@example.ru"
  },
  "from_location": {
    "code": 44,
    "address": "Москва, ул. Ленина, 1"
  },
  "to_location": {
    "code": 270,
    "address": "Новосибирск, ул. Мира, 5"
  },
  "packages": [
    {
      "number": "1",
      "comment": "Коробка 1",
      "height": 15,
      "items": [
        {
          "name": "Наименование товара",
          "ware_key": "ART-001",
          "marking": "",
          "payment": { "value": 0 },
          "cost": 2990,
          "weight": 200,
          "amount": 1
        }
      ],
      "length": 30,
      "weight": 200,
      "width": 20
    }
  ],
  "services": []
}
```

**Ожидаемый ответ (200):**
```json
{
  "entity": {
    "uuid": "cdek_order_uuid_abc123"
  },
  "requests": [
    {
      "request_uuid": "request_uuid_abc123",
      "type": "CREATE",
      "state": "ACCEPTED",
      "date_time": "2026-04-26T10:00:00+0300",
      "errors": [],
      "warnings": []
    }
  ]
}
```

---

### 8.3 Получение информации о заказе / трек-номера

**[CB]** `GET /api/v1/delivery/{id}/track/{track}`
**[SVC]** `GET https://api.cdek.ru/v2/orders/{uuid}`

**Ответ (200):**
```json
{
  "entity": {
    "uuid": "cdek_order_uuid_abc123",
    "number": "CDEK-123456789",
    "cdek_number": "1234567890",
    "status": {
      "code": "ACCEPTED",
      "name": "Принят",
      "date_time": "2026-04-26T10:00:00+0300"
    },
    "statuses": [
      {
        "code": "ACCEPTED",
        "name": "Принят",
        "date_time": "2026-04-26T10:00:00+0300",
        "city": "Москва"
      }
    ],
    "tariff_code": 136,
    "from_location": { "code": 44, "city": "Москва", "address": "ул. Ленина, 1" },
    "to_location": { "code": 270, "city": "Новосибирск", "address": "ул. Мира, 5" },
    "packages": [
      {
        "number": "1",
        "barcode": "1234567890ABC",
        "weight": 200
      }
    ]
  }
}
```

> `entity.cdek_number` — трек-номер для отслеживания.

---

### 8.4 Расчёт стоимости доставки

**[CB]** `POST /api/v1/delivery/{id}/calculate`
**[SVC]** `POST https://api.cdek.ru/v2/calculator/tariff`

**Тело запроса:**
```json
{
  "tariff_code": 136,
  "from_location": { "code": 44 },
  "to_location": { "code": 270 },
  "packages": [
    { "height": 15, "length": 30, "weight": 200, "width": 20 }
  ]
}
```

**Ответ:**
```json
{
  "tariff_codes": [
    {
      "tariff_code": 136,
      "tariff_name": "Посылка склад-склад",
      "tariff_description": "Для отправки посылок между складами",
      "delivery_mode": 1,
      "period_min": 2,
      "period_max": 4,
      "delivery_sum": 350.0,
      "weight_calc": 200,
      "services": [],
      "total_sum": 350.0,
      "currency": "RUB"
    }
  ]
}
```

---

### 8.5 Отмена заявки

**[CB]** `DELETE /api/v1/delivery/{id}/{order}/cancel`
**[SVC]** `POST https://api.cdek.ru/v2/orders/{uuid}/refusal`

**Тело:** `{}` (пустой объект)
**Ответ:** `{ "entity": { "uuid": "..." }, "requests": [{ "state": "ACCEPTED" }] }`

---

### 8.6 Webhook от СДЭК → CoreBridge

**[CB]** `POST /api/v1/webhooks/{integration_id}`
**Верификация:** `cdek.js` — `caller_id` в теле совпадает с account СДЭК

**Тело webhook:**
```json
{
  "type": "ORDER_STATUS",
  "date_time": "2026-04-26T12:00:00+0300",
  "uuid": "cdek_order_uuid_abc123",
  "attributes": {
    "cdek_number": "1234567890",
    "number": "order_ref_uuid",
    "status": {
      "code": "RECEIVED_AT_PICKUP_POINT",
      "name": "Принят на склад до востребования",
      "date_time": "2026-04-27T09:00:00+0300",
      "city": "Новосибирск"
    }
  },
  "caller_id": "account_uuid_cdek"
}
```

---

## 9. Почта России

**Base URL:** `https://otpravka-api.pochta.ru`
**Документация:** `https://otpravka.pochta.ru/specification`
**Авторизация:** `Authorization: AccessToken {token}` + `X-User-Authorization: Basic {base64(login:password)}`
**n8n credential type:** `httpBasicAuth`

### Механики: 17 (Доставка)

---

### 9.1 Создание заявки на доставку

**[SVC]** `PUT https://otpravka-api.pochta.ru/1.0/user/backlog`

**Заголовки:**
```
Authorization: AccessToken {token}
X-User-Authorization: Basic {base64}
Content-Type: application/json;charset=UTF-8
Accept: application/json;charset=UTF-8
```

**Тело запроса:**
```json
[
  {
    "address-type-to": "DEFAULT",
    "fragile": false,
    "given-name": "Иван",
    "house-to": "1",
    "index-to": "630001",
    "mail-category": "ORDINARY",
    "mail-direct": 643,
    "mail-type": "POSTAL_PARCEL",
    "manual-address-input": false,
    "mass": 200,
    "middle-name": "Иванович",
    "order-num": "ЗП-00123",
    "place-to": "Новосибирск",
    "postoffice-code": "630001",
    "region-to": "Новосибирская",
    "street-to": "ул. Мира",
    "surname": "Иванов",
    "tel-address": 79001234567,
    "with-order-of-notice": false,
    "with-simple-notice": false
  }
]
```

**Ответ (200):**
```json
{
  "result-ids": [123456789],
  "errors": []
}
```

---

### 9.2 Получение трек-номера

**[SVC]** `GET https://otpravka-api.pochta.ru/1.0/backlog/{id}`

**Ответ:** объект заказа с полем `barcode` — трек-номер Почты России.

---

### 9.3 Трекинг отправления

**[SVC]** `GET https://otpravka-api.pochta.ru/1.0/tracking/single/{barcode}`

**Ответ:**
```json
{
  "barcode": "RP123456789RU",
  "delivery-time": { "min-days": 3, "max-days": 7 },
  "operations": [
    {
      "description": "Принято в отделении связи",
      "operation-id": 1,
      "performed-on": { "str-value": "2026-04-26T10:00:00" }
    }
  ]
}
```

---

## 10. ЯМ Доставка

**Base URL:** `https://api.delivery.yandex.net`
**Авторизация:** OAuth Bearer (тот же токен, что и для ЯМ Partner API)
**n8n credential type:** `oAuth2Api`

### Механики: 17 (Доставка)

---

### 10.1 Создание заявки

**[SVC]** `PUT https://api.partner.market.yandex.ru/campaigns/{campaignId}/orders/{orderId}/delivery/shipments/{shipmentId}/boxes`

**Тело запроса:**
```json
{
  "boxes": [
    {
      "fulfilmentId": "box_001",
      "weight": 200,
      "width": 30,
      "height": 20,
      "depth": 15,
      "items": [
        { "id": 1, "count": 1 }
      ]
    }
  ]
}
```

**Ответ (200):** `{ "status": "OK" }`

---

---

# CRM

---

## 11. Битрикс24

**Base URL:** `https://{portal}.bitrix24.ru/rest`
**Документация:** `https://dev.1c-bitrix.ru/rest_help/`
**Авторизация:** OAuth 2.0 (`access_token` + `refresh_token`) или `webhook_url` (одна строка без OAuth)
**n8n credential type:** `oAuth2Api`
**Тип связи:** Webhook (Битрикс24 → CoreBridge) + Исходящие REST-вызовы

### Механики: 13, 14, 15, 16

---

### 11.1 Webhook от Битрикс24 → CoreBridge

**[CB]** `POST /api/v1/webhooks/{integration_id}`
**Верификация:** `bitrix24.js` — `application_token` в теле == токен из настроек

**Тело webhook (application/x-www-form-urlencoded):**
```
event=ONCRMDEALADD
&event_handler_id=1
&data[FIELDS][ID]=1234
&data[FIELDS][TITLE]=Новая сделка
&data[FIELDS][STAGE_ID]=NEW
&data[FIELDS][OPPORTUNITY]=5990.00
&data[FIELDS][CURRENCY_ID]=RUB
&data[FIELDS][CONTACT_ID]=567
&data[FIELDS][COMPANY_ID]=89
&data[FIELDS][ASSIGNED_BY_ID]=1
&data[FIELDS][UF_CRM_CONTACT_EMAIL]=ivan@example.ru
&auth[access_token]=token123
&auth[expires_in]=3600
&auth[domain]=myportal.bitrix24.ru
&auth[client_endpoint]=https://myportal.bitrix24.ru/rest/
&auth[application_token]=app_token_abc123
```

**Типы событий Битрикс24 → event_type:**

| Событие Б24 | event_type |
|---|---|
| `ONCRMDEALADD` | `crm_deal_new` |
| `ONCRMDEALUPDATE` | `crm_deal_updated` |
| `ONCRMDEALDEL` | `crm_deal_cancelled` |
| `ONCRMCONTACTADD` | `crm_contact_new` |
| `ONCRMCONTACTUPDATE` | `crm_contact_updated` |
| `ONCRMCOMPANYADD` | `crm_company_new` |

---

### 11.2 Исходящий — Получение сделки

**[SVC]** `GET https://{portal}.bitrix24.ru/rest/crm.deal.get?id={deal_id}&auth={access_token}`

**Ответ:**
```json
{
  "result": {
    "ID": "1234",
    "TITLE": "Новая сделка",
    "STAGE_ID": "NEW",
    "OPPORTUNITY": "5990.00",
    "CURRENCY_ID": "RUB",
    "CONTACT_ID": "567",
    "COMPANY_ID": "89",
    "DATE_CREATE": "2026-04-26T10:00:00+03:00",
    "DATE_MODIFY": "2026-04-26T10:05:00+03:00",
    "ASSIGNED_BY_ID": "1"
  }
}
```

---

### 11.3 Исходящий — Обновление стадии сделки

**[CB]** `POST /api/v1/crm/deals/{crm_deal_id}/status`
**[SVC]** `POST https://{portal}.bitrix24.ru/rest/crm.deal.update`

**Тело запроса (JSON):**
```json
{
  "auth": "{access_token}",
  "id": "1234",
  "fields": {
    "STAGE_ID": "WON"
  }
}
```

**Ответ:** `{ "result": true }`

---

### 11.4 Исходящий — Создание контрагента (контакт)

**[SVC]** `POST https://{portal}.bitrix24.ru/rest/crm.contact.add`

**Тело:**
```json
{
  "auth": "{access_token}",
  "fields": {
    "NAME": "Иван",
    "LAST_NAME": "Иванов",
    "EMAIL": [{ "VALUE": "ivan@example.ru", "VALUE_TYPE": "WORK" }],
    "PHONE": [{ "VALUE": "+79001234567", "VALUE_TYPE": "WORK" }],
    "UF_CRM_INN": "770000000000"
  }
}
```

---

### 11.5 Исходящий — Создание счёта

**[SVC]** `POST https://{portal}.bitrix24.ru/rest/crm.invoice.add`

**Тело:**
```json
{
  "auth": "{access_token}",
  "fields": {
    "INVOICE_PROPERTIES": {
      "COMPANY_NAME": "ООО Ромашка",
      "INN": "7700000000"
    },
    "ORDER_TOPIC": "Счёт СЧ-00123",
    "UF_DEAL_ID": "1234",
    "PRODUCT_ROWS": [
      {
        "PRODUCT_NAME": "Наименование товара",
        "PRICE": 2990.0,
        "QUANTITY": 1,
        "DISCOUNT_RATE": 0,
        "VAT_RATE": 20
      }
    ],
    "DATE_PAY_BEFORE": "2026-05-10T00:00:00",
    "PRICE": 2990.0,
    "CURRENCY_ID": "RUB",
    "PAYED": "N"
  }
}
```

---

### 11.6 Исходящий — Получение стадий воронки

**[CB]** `GET /api/v1/crm/{integration_id}/stages`
**[SVC]** `GET https://{portal}.bitrix24.ru/rest/crm.dealcategory.stage.list?auth={token}&id=0`

**Ответ:**
```json
{
  "result": [
    { "NAME": "Новая", "STATUS_ID": "NEW", "SORT": "10" },
    { "NAME": "В работе", "STATUS_ID": "PREPARATION", "SORT": "20" },
    { "NAME": "Выиграна", "STATUS_ID": "WON", "SORT": "30" },
    { "NAME": "Проиграна", "STATUS_ID": "LOSE", "SORT": "40" }
  ]
}
```

---

## 12. AmoCRM

**Base URL:** `https://{account}.amocrm.ru`
**Документация:** `https://www.amocrm.ru/developers/content/crm_platform/api-reference`
**Авторизация:** OAuth 2.0, `Authorization: Bearer {access_token}`
**n8n credential type:** `oAuth2Api`

### Механики: 13, 14, 15, 16

---

### 12.1 Webhook от AmoCRM → CoreBridge

**[CB]** `POST /api/v1/webhooks/{integration_id}`

**Тело webhook (JSON):**
```json
{
  "leads": {
    "add": [
      {
        "id": 1234,
        "name": "Новая сделка",
        "status_id": 142,
        "pipeline_id": 100,
        "price": 5990,
        "responsible_user_id": 504141,
        "created_at": 1745654400,
        "updated_at": 1745654460,
        "_links": { "self": { "href": "https://account.amocrm.ru/api/v4/leads/1234" } }
      }
    ],
    "update": [],
    "delete": []
  },
  "contacts": {
    "add": [],
    "update": []
  }
}
```

---

### 12.2 Исходящий — Обновление статуса сделки

**[SVC]** `PATCH https://{account}.amocrm.ru/api/v4/leads/{lead_id}`

**Тело:**
```json
{
  "status_id": 142,
  "pipeline_id": 100
}
```

---

### 12.3 Исходящий — Создание контакта

**[SVC]** `POST https://{account}.amocrm.ru/api/v4/contacts`

**Тело:**
```json
[
  {
    "name": "Иван Иванов",
    "custom_fields_values": [
      { "field_code": "PHONE", "values": [{ "value": "+79001234567", "enum_code": "WORK" }] },
      { "field_code": "EMAIL", "values": [{ "value": "ivan@example.ru", "enum_code": "WORK" }] }
    ]
  }
]
```

---

### 12.4 Исходящий — Получение списка стадий

**[CB]** `GET /api/v1/crm/{integration_id}/stages`
**[SVC]** `GET https://{account}.amocrm.ru/api/v4/leads/pipelines/{pipeline_id}/statuses`

**Ответ:**
```json
{
  "_embedded": {
    "statuses": [
      { "id": 142, "name": "Первичный контакт", "sort": 10, "is_editable": true, "color": "#99ccff" },
      { "id": 143, "name": "Переговоры", "sort": 20, "is_editable": true, "color": "#ffcc22" }
    ]
  }
}
```

---

## 13. Мегаплан

**Base URL:** `https://{account}.megaplan.ru/api/v3`
**Документация:** `https://help.megaplan.ru/API`
**Авторизация:** `Authorization: Bearer {access_token}` (OAuth 2.0)
**n8n credential type:** `oAuth2Api`

### Механики: 13, 14, 15, 16

---

### 13.1 Webhook от Мегаплан → CoreBridge

**[CB]** `POST /api/v1/webhooks/{integration_id}`

**Тело (JSON):**
```json
{
  "event": "deal.created",
  "data": {
    "id": "1000001",
    "name": "Новая сделка",
    "state": "open",
    "funnel_step": { "id": "100001", "name": "Первичный контакт" },
    "amount": 5990.0,
    "currency": "RUB",
    "responsible": { "id": "1000001", "name": "Иван Иванов" },
    "created_at": "2026-04-26T10:00:00Z"
  }
}
```

---

### 13.2 Исходящий — Обновление сделки

**[SVC]** `PATCH https://{account}.megaplan.ru/api/v3/deal/{deal_id}`

**Тело:**
```json
{
  "data": {
    "contentType": "Deal",
    "funnel_step": { "id": "100002" }
  }
}
```

---

## 14. СБИС CRM

**Base URL:** `https://online.sbis.ru/service/`
**Документация:** `https://sbis.ru/help/integration/api`
**Авторизация:** `X-SBISSessionID: {session_id}` (получается через `СБИС.АутентифицироватьПользователя`)
**n8n credential type:** `httpHeaderAuth`

### Механики: 13, 14, 15, 16

---

### 14.1 Получение сессии

**[SVC]** `POST https://online.sbis.ru/auth/service/`

**Тело:**
```json
{
  "jsonrpc": "2.0",
  "method": "СБИС.АутентифицироватьПользователя",
  "params": {
    "Логин": "{login}",
    "Пароль": "{password}"
  },
  "id": 1
}
```

**Ответ:**
```json
{
  "jsonrpc": "2.0",
  "result": "session_id_abc123",
  "id": 1
}
```

---

### 14.2 Webhook от СБИС → CoreBridge

**[CB]** `POST /api/v1/webhooks/{integration_id}`

**Тело (JSON-RPC нотификация):**
```json
{
  "jsonrpc": "2.0",
  "method": "СБИС.ОповеститьОСобытии",
  "params": {
    "Событие": "СозданиеСделки",
    "Объект": {
      "Идентификатор": "1234",
      "Название": "Новая сделка",
      "Этап": "Новая",
      "Сумма": 5990.0,
      "Контрагент": { "Наименование": "ООО Ромашка", "ИНН": "7700000000" }
    }
  }
}
```

---

## 15. Neaktor

**Base URL:** `https://api.neaktor.com`
**Документация:** `https://api.neaktor.com/swagger`
**Авторизация:** `Authorization: Bearer {api_key}`
**n8n credential type:** `httpHeaderAuth`

### Механики: 13, 14, 15, 16

---

### 15.1 Webhook от Neaktor → CoreBridge

**[CB]** `POST /api/v1/webhooks/{integration_id}`

**Тело (JSON):**
```json
{
  "event": "task.created",
  "taskId": "task_abc123",
  "taskName": "Новая заявка",
  "processId": "process_001",
  "statusId": "status_new",
  "statusName": "Новая",
  "fields": {
    "contact_name": "Иван Иванов",
    "contact_phone": "+79001234567",
    "amount": 5990.0
  },
  "createdAt": "2026-04-26T10:00:00Z"
}
```

---

---

# CDP / Маркетинг

---

## 16. MindBox

**Base URL:** `https://api.mindbox.ru`
**Документация:** `https://developers.mindbox.ru/`
**Авторизация:** `Authorization: Mindbox secretKey="{secret_key}"`
**n8n credential type:** `httpHeaderAuth`
**Тип связи:** Исходящие вызовы (мы → MindBox)

### Механики: 19 (CDP)

---

### 16.1 Регистрация события (заказ, оплата, отгрузка)

**[CB]** `POST /api/v1/marketing/events`
**[SVC]** `POST https://api.mindbox.ru/v3/operations/async`

**Параметры запроса:** `endpointId={endpoint_id}&operation={operation_name}`

**Заголовки:**
```
Authorization: Mindbox secretKey="{secret_key}"
Content-Type: application/json
Accept: application/json
```

**Тело запроса (создание заказа):**
```json
{
  "customer": {
    "email": "ivan@example.ru",
    "mobilePhone": "+79001234567",
    "ids": {
      "externalCustomerId": "1c-contractor-uuid"
    }
  },
  "order": {
    "ids": {
      "externalOrderId": "ЗП-00123",
      "webSiteOrderId": "12345"
    },
    "totalPrice": 5990.0,
    "deliveryCost": 0.0,
    "discountTotal": 0.0,
    "discountDescription": "",
    "status": "Paid",
    "statusDescription": "Оплачен",
    "lines": [
      {
        "basePricePerItem": 5990.0,
        "discountedPricePerItem": 5990.0,
        "quantity": 1,
        "lineId": "line_001",
        "product": {
          "ids": { "externalId": "ART-001" },
          "sku": { "ids": { "externalId": "ART-001-L" } }
        }
      }
    ],
    "payments": [
      {
        "type": "Online",
        "amount": 5990.0,
        "transactionId": "payment_uuid"
      }
    ]
  }
}
```

**Ожидаемый ответ (200):**
```json
{
  "status": "Success",
  "executionDateTimeUtc": "2026-04-26T10:00:00"
}
```

---

### 16.2 Синхронизация контакта

**[CB]** `POST /api/v1/marketing/contacts/batch`
**[SVC]** `POST https://api.mindbox.ru/v3/operations/async?endpointId={endpoint}&operation=Website.SetCustomer`

**Тело запроса:**
```json
{
  "customer": {
    "email": "ivan@example.ru",
    "mobilePhone": "+79001234567",
    "firstName": "Иван",
    "lastName": "Иванов",
    "ids": {
      "externalCustomerId": "1c-contractor-uuid"
    },
    "customFields": {
      "inn": "770000000000"
    },
    "subscriptions": [
      {
        "brand": "MainBrand",
        "pointOfContact": "Email",
        "isSubscribed": true
      }
    ]
  }
}
```

---

### 16.3 Проверка баланса бонусов

**[CB]** `GET /api/v1/marketing/bonus?customer_id={id}` (таймаут 3 сек)
**[SVC]** `POST https://api.mindbox.ru/v3/operations/sync?endpointId={endpoint}&operation=Website.GetCustomerInfo`

**Тело:**
```json
{
  "customer": {
    "ids": { "externalCustomerId": "1c-contractor-uuid" }
  }
}
```

**Ответ:**
```json
{
  "status": "Success",
  "customer": {
    "processingStatus": "Found",
    "email": "ivan@example.ru",
    "balances": [
      {
        "balanceType": { "ids": { "externalId": "Main" } },
        "available": 350.0,
        "blocked": 0.0
      }
    ]
  }
}
```

---

## 17. SendPulse

**Base URL:** `https://api.sendpulse.com`
**Документация:** `https://sendpulse.com/ru/integrations/api`
**Авторизация:** OAuth 2.0 `client_credentials`
**n8n credential type:** `apiKeyAuth`

### Механики: 19 (CDP)

---

### 17.1 Получение токена

**[SVC]** `POST https://api.sendpulse.com/oauth/access_token`

**Тело:**
```json
{
  "grant_type": "client_credentials",
  "client_id": "{api_user_id}",
  "client_secret": "{api_secret}"
}
```

**Ответ:**
```json
{
  "access_token": "token_abc123",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

---

### 17.2 Добавление контакта в список

**[CB]** `POST /api/v1/marketing/contacts/batch`
**[SVC]** `POST https://api.sendpulse.com/addressbooks/{address_book_id}/emails`

**Заголовки:** `Authorization: Bearer {access_token}`

**Тело запроса:**
```json
{
  "emails": [
    {
      "email": "ivan@example.ru",
      "variables": {
        "name": "Иван",
        "phone": "+79001234567",
        "externalId": "1c-contractor-uuid"
      }
    }
  ]
}
```

**Ответ:** `{ "result": true }`

---

### 17.3 Отправка транзакционного письма

**[SVC]** `POST https://api.sendpulse.com/smtp/emails`

**Тело:**
```json
{
  "email": {
    "html": "<h1>Ваш заказ №12345 оплачен</h1>",
    "text": "Ваш заказ №12345 оплачен",
    "subject": "Заказ оплачен",
    "from": { "name": "CoreBridge", "email": "noreply@corebridge.ru" },
    "to": [{ "name": "Иван Иванов", "email": "ivan@example.ru" }]
  }
}
```

---

### 17.4 Отправка push-события (automation)

**[CB]** `POST /api/v1/marketing/events`
**[SVC]** `POST https://api.sendpulse.com/events/name/{event_name}`

**Тело:**
```json
{
  "email": "ivan@example.ru",
  "phone": "+79001234567",
  "variables": {
    "order_id": "ЗП-00123",
    "amount": 5990.0,
    "status": "shipped"
  }
}
```

---

## 18. МойСклад

**Base URL:** `https://api.moysklad.ru/api/remap/1.2`
**Документация:** `https://dev.moysklad.ru/doc/api/remap/1.2/`
**Авторизация:** `Authorization: Bearer {access_token}` (токен из ЛК МойСклад)
**n8n credential type:** `httpHeaderAuth`

### Механики: 3 (остатки), 4 (цены), 10 (каталог), 19 (CDP/Маркетинг), 21 (Аналитика)

---

### 18.1 Получение товаров (каталог)

**[SVC]** `GET https://api.moysklad.ru/api/remap/1.2/entity/product`

**Параметры:** `limit=100&offset=0&expand=uom,supplier`

**Ответ:**
```json
{
  "meta": { "href": "...", "limit": 100, "offset": 0, "size": 500 },
  "rows": [
    {
      "id": "product-uuid-123",
      "name": "Наименование товара",
      "code": "ART-001",
      "externalCode": "EXT-001",
      "article": "ART-001",
      "price": 299000,
      "salePrices": [
        {
          "value": 299000,
          "priceType": { "name": "Цена продажи" }
        }
      ],
      "uom": { "name": "шт" },
      "weight": 0.2,
      "volume": 0.003
    }
  ]
}
```

> `price` в копейках (299000 = 2990.00 ₽).

---

### 18.2 Получение остатков

**[SVC]** `GET https://api.moysklad.ru/api/remap/1.2/report/stock/all`

**Параметры:** `limit=1000&offset=0`

**Ответ:**
```json
{
  "rows": [
    {
      "meta": { "href": "..." },
      "name": "Наименование товара",
      "code": "ART-001",
      "article": "ART-001",
      "uom": { "name": "шт" },
      "quantity": 150.0,
      "reserve": 5.0,
      "inTransit": 0.0,
      "available": 145.0,
      "stock": 150.0
    }
  ]
}
```

---

### 18.3 Обновление цены

**[SVC]** `POST https://api.moysklad.ru/api/remap/1.2/entity/product/{product_id}`

**Тело:**
```json
{
  "salePrices": [
    {
      "value": 299000,
      "currency": { "meta": { "href": "https://api.moysklad.ru/api/remap/1.2/entity/currency/rub_uuid", "type": "currency" } },
      "priceType": { "meta": { "href": "https://api.moysklad.ru/api/remap/1.2/context/companysettings/pricetype/price_type_uuid", "type": "pricetype" } }
    }
  ]
}
```

---

---

# Уведомления

---

## 19. Telegram

**Base URL:** `https://api.telegram.org/bot{token}`
**Документация:** `https://core.telegram.org/bots/api`
**Авторизация:** токен в URL (часть пути)
**n8n credential type:** `httpHeaderAuth`
**Тип связи:** Только исходящие (CoreBridge → Telegram)

### Механики: 20 (Уведомления)

---

### 19.1 Отправка сообщения

**[CB]** `POST /api/v1/notify/{id}/send`
**[SVC]** `POST https://api.telegram.org/bot{token}/sendMessage`

**Тело запроса:**
```json
{
  "chat_id": "@channel_name",
  "text": "🆕 Новый заказ #12345\n💰 Сумма: 5 990 ₽\n👤 Иван Иванов",
  "parse_mode": "HTML",
  "disable_notification": false
}
```

**Ответ (200):**
```json
{
  "ok": true,
  "result": {
    "message_id": 123,
    "chat": { "id": -1001234567890, "title": "Orders", "type": "channel" },
    "date": 1745654400,
    "text": "🆕 Новый заказ #12345..."
  }
}
```

---

### 19.2 Пакетная отправка

**[CB]** `POST /api/v1/notify/{id}/send/batch`
**[SVC]** Несколько последовательных `sendMessage` (до 50 за вызов батч-эндпоинта, 30 msg/sec лимит Telegram)

---

### 19.3 Проверка токена / статуса канала

**[CB]** `GET /api/v1/notify/{id}/status`
**[SVC]** `GET https://api.telegram.org/bot{token}/getMe`

**Ответ:** `{ "ok": true, "result": { "id": 12345, "is_bot": true, "username": "my_bot" } }`

---

## 20. WhatsApp WABA

**Base URL:** `https://waba.360dialog.io/v1` (или Cloud API Meta: `https://graph.facebook.com/v18.0`)
**Документация:** `https://docs.360dialog.com/`
**Авторизация:** `D360-API-KEY: {api_key}` или `Authorization: Bearer {access_token}` (Meta)
**n8n credential type:** `httpHeaderAuth`

### Механики: 20 (Уведомления)

---

### 20.1 Отправка шаблонного сообщения

**[CB]** `POST /api/v1/notify/{id}/send`
**[SVC]** `POST https://waba.360dialog.io/v1/messages`

**Тело запроса:**
```json
{
  "to": "79001234567",
  "type": "template",
  "template": {
    "namespace": "your_namespace",
    "name": "order_notification",
    "language": {
      "policy": "deterministic",
      "code": "ru"
    },
    "components": [
      {
        "type": "body",
        "parameters": [
          { "type": "text", "text": "12345" },
          { "type": "text", "text": "5990" }
        ]
      }
    ]
  }
}
```

**Ответ (200):**
```json
{
  "messages": [
    {
      "id": "gBEGkYiEB1VXAglK1ZEqA1YKPrU",
      "message_status": "accepted"
    }
  ]
}
```

> ⚠️ WhatsApp разрешает только заранее одобренные шаблоны (`template.name`). Список шаблонов — `GET /api/v1/notify/templates`.

---

### 20.2 Получение списка шаблонов

**[CB]** `GET /api/v1/notify/templates`
**[SVC]** `GET https://waba.360dialog.io/v1/configs/templates`

**Ответ:** список одобренных шаблонов с полями `name`, `status`, `components`.

---

## 21. VK

**Base URL:** `https://api.vk.com/method`
**Документация:** `https://dev.vk.com/reference`
**Авторизация:** `access_token` в параметрах запроса
**n8n credential type:** `httpHeaderAuth`

### Механики: 20 (Уведомления)

---

### 21.1 Отправка сообщения в сообщество / пользователю

**[CB]** `POST /api/v1/notify/{id}/send`
**[SVC]** `POST https://api.vk.com/method/messages.send`

**Тело (application/x-www-form-urlencoded):**
```
user_id=123456789
&random_id={random_int}
&message=Новый заказ №12345 на сумму 5990 ₽
&access_token={token}
&v=5.131
```

**Ответ:**
```json
{
  "response": 4561
}
```
> `response` — ID отправленного сообщения.

---

### 21.2 Отправка уведомления через VK Notify (Business API)

**[SVC]** `POST https://api.vk.com/method/notifications.sendMessage`

**Тело:**
```
user_ids=123456789
&message=Ваш заказ №12345 отправлен
&access_token={notify_token}
&v=5.131
```

---

## 22. Viber

**Base URL:** `https://chatapi.viber.com/pa`
**Документация:** `https://developers.viber.com/docs/api/rest-bot-api/`
**Авторизация:** `X-Viber-Auth-Token: {auth_token}`
**n8n credential type:** `httpHeaderAuth`

### Механики: 20 (Уведомления)

---

### 22.1 Отправка сообщения

**[SVC]** `POST https://chatapi.viber.com/pa/send_message`

**Тело:**
```json
{
  "auth_token": "{auth_token}",
  "receiver": "01234567890A=",
  "min_api_version": 1,
  "sender": {
    "name": "CoreBridge",
    "avatar": "https://corebridge.ru/logo.png"
  },
  "tracking_data": "tracking_data",
  "type": "text",
  "text": "Новый заказ №12345 на сумму 5 990 ₽"
}
```

**Ответ (200):**
```json
{
  "status": 0,
  "status_message": "ok",
  "message_token": 4912661846655238145,
  "chat_hostname": "SN-CHAT-05_"
}
```

---

## 23. Одноклассники

**Base URL:** `https://api.ok.ru/fb.do`
**Документация:** `https://apiok.ru/dev/methods/rest`
**Авторизация:** `sig` — подпись MD5 параметров + `application_secret_key`
**n8n credential type:** `httpHeaderAuth`

### Механики: 20 (Уведомления)

---

### 23.1 Отправка уведомления

**[SVC]** `POST https://api.ok.ru/fb.do`

**Параметры (POST-форма):**
```
application_key={app_key}
&method=notifications.sendSimple
&uid={user_id}
&message=Ваш заказ №12345 отправлен
&access_token={user_token}
&format=json
&sig={md5_signature}
```

---

---

# Аналитика

---

## 24. Google Sheets

**Base URL:** `https://sheets.googleapis.com/v4`
**Документация:** `https://developers.google.com/sheets/api`
**Авторизация:** OAuth 2.0 Service Account или `access_token`
**n8n credential type:** `oAuth2Api`

### Механики: 21 (Аналитика)

---

### 24.1 Очистка листа перед записью

**[SVC]** `POST https://sheets.googleapis.com/v4/spreadsheets/{spreadsheetId}/values/{range}:clear`

**Заголовки:** `Authorization: Bearer {access_token}`
**Тело:** `{}`

---

### 24.2 Запись данных (batch)

**[CB]** `POST /api/v1/analytics/{id}/export`
**[SVC]** `PUT https://sheets.googleapis.com/v4/spreadsheets/{spreadsheetId}/values/{range}`

**Параметры запроса:** `valueInputOption=USER_ENTERED`

**Тело запроса:**
```json
{
  "range": "Продажи!A1:F10001",
  "majorDimension": "ROWS",
  "values": [
    ["Дата", "Артикул", "Название", "Кол-во", "Выручка", "Склад"],
    ["2026-04-01", "ART-001", "Товар А", "10", "29900", "WH-01"],
    ["2026-04-01", "ART-002", "Товар Б", "5", "14950", "WH-01"]
  ]
}
```

**Ответ (200):**
```json
{
  "spreadsheetId": "spreadsheet_id_abc",
  "updatedRange": "Продажи!A1:F3",
  "updatedRows": 3,
  "updatedColumns": 6,
  "updatedCells": 18
}
```

> Лимит: до 5 000 строк за вызов (чанкование в `МодульАналитики`).

---

### 24.3 Создание нового листа

**[SVC]** `POST https://sheets.googleapis.com/v4/spreadsheets/{spreadsheetId}:batchUpdate`

**Тело:**
```json
{
  "requests": [
    {
      "addSheet": {
        "properties": {
          "title": "Продажи_2026-04",
          "index": 0
        }
      }
    }
  ]
}
```

---

## 25. Power BI

**Base URL:** `https://api.powerbi.com/v1.0/myorg`
**Документация:** `https://learn.microsoft.com/ru-ru/rest/api/power-bi/`
**Авторизация:** Azure AD OAuth 2.0, `Authorization: Bearer {access_token}`
**n8n credential type:** `oAuth2Api`

### Механики: 21 (Аналитика)

---

### 25.1 Получение токена Azure AD

**[SVC]** `POST https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token`

**Тело (form-urlencoded):**
```
grant_type=client_credentials
&client_id={app_id}
&client_secret={client_secret}
&scope=https://analysis.windows.net/powerbi/api/.default
```

---

### 25.2 Добавление строк в датасет (Streaming Dataset)

**[CB]** `POST /api/v1/analytics/{id}/export`
**[SVC]** `POST https://api.powerbi.com/v1.0/myorg/datasets/{datasetId}/tables/{tableName}/rows`

**Тело запроса:**
```json
{
  "rows": [
    {
      "Date": "2026-04-01",
      "SKU": "ART-001",
      "ProductName": "Товар А",
      "Quantity": 10,
      "Revenue": 29900.0,
      "Warehouse": "WH-01"
    }
  ]
}
```

**Ответ (200):** пустое тело, статус `200 OK`.

---

### 25.3 Очистка таблицы перед загрузкой

**[SVC]** `DELETE https://api.powerbi.com/v1.0/myorg/datasets/{datasetId}/tables/{tableName}/rows`

**Ответ:** `200 OK`

---

## 26. Roistat

**Base URL:** `https://cloud.roistat.com/api`
**Документация:** `https://roistat.com/ru/help/api`
**Авторизация:** `Api-Key: {api_key}` в заголовке
**n8n credential type:** `httpHeaderAuth`

### Механики: 21 (Аналитика)

---

### 26.1 Создание / обновление заказа в Roistat

**[CB]** `POST /api/v1/analytics/{id}/export`
**[SVC]** `POST https://cloud.roistat.com/api/site/v1/project/orders/create`

**Заголовки:** `Api-Key: {api_key}` · `Content-Type: application/json`

**Тело запроса:**
```json
{
  "number": "ЗП-00123",
  "name": "Иван Иванов",
  "email": "ivan@example.ru",
  "phone": "+79001234567",
  "sum": 5990.0,
  "currency": "RUB",
  "date": "2026-04-26 10:00:00",
  "status": "success",
  "goods": [
    {
      "id": "ART-001",
      "name": "Товар А",
      "price": 5990.0,
      "quantity": 1,
      "currency": "RUB"
    }
  ],
  "marketing_data": {
    "roistat": "{roistat_visit_id}"
  }
}
```

**Ответ (200):**
```json
{
  "status": "ok",
  "data": {
    "id": "roistat_order_id_123"
  }
}
```

---

### 26.2 Обновление статуса заказа

**[SVC]** `POST https://cloud.roistat.com/api/site/v1/project/orders/update`

**Тело:**
```json
{
  "number": "ЗП-00123",
  "status": "success"
}
```

**Статусы Roistat:** `inwork` (в работе), `success` (успех), `cancelled` (отмена), `declined` (отказ).

---

## Сводная таблица: сервис → механики → наши эндпоинты

| Сервис | Механики | Наши [CB] эндпоинты |
|---|---|---|
| Ozon | 1,2,3,4,5,6,7,8,9,10,11 | `GET /api/v1/events`, `POST /api/v1/events/{id}/ack`, `POST /api/v1/data/marketplace`, `POST /api/v1/gtd/*`, `GET /api/v1/reserves/snapshot`, `GET /api/v1/labels/templates` |
| Wildberries | 1,2,3,4,5,6,7,10,11 | `GET /api/v1/events`, `POST /api/v1/events/{id}/ack`, `POST /api/v1/data/marketplace` |
| Яндекс Маркет | 1,2,3,4,5,6,7,10,11 | `GET /api/v1/events`, `POST /api/v1/events/{id}/ack`, `POST /api/v1/data/marketplace` |
| ЮKassa | 18 | `POST /api/v1/webhooks/{id}` |
| СБП | 18 | `POST /api/v1/webhooks/{id}` |
| Тинькофф | 18 | `POST /api/v1/webhooks/{id}` |
| Сбер | 18 | `POST /api/v1/webhooks/{id}` |
| СДЭК | 17 | `POST /api/v1/delivery/{id}/create`, `GET /api/v1/delivery/{id}/track/{track}`, `POST /api/v1/delivery/{id}/calculate`, `DELETE /api/v1/delivery/{id}/{order}/cancel` |
| Почта России | 17 | `POST /api/v1/delivery/{id}/create`, `GET /api/v1/delivery/{id}/track/{track}` |
| ЯМ Доставка | 17 | `POST /api/v1/delivery/{id}/create` |
| Битрикс24 | 13,14,15,16 | `POST /api/v1/webhooks/{id}`, `POST /api/v1/crm/contractors/{id}/sync`, `POST /api/v1/crm/invoices`, `POST /api/v1/crm/deals/{id}/status`, `GET /api/v1/crm/{id}/stages` |
| AmoCRM | 13,14,15,16 | `POST /api/v1/webhooks/{id}`, `POST /api/v1/crm/contractors/{id}/sync`, `POST /api/v1/crm/deals/{id}/status`, `GET /api/v1/crm/{id}/stages` |
| Мегаплан | 13,14,15,16 | `POST /api/v1/webhooks/{id}`, `POST /api/v1/crm/deals/{id}/status` |
| СБИС CRM | 13,14,15,16 | `POST /api/v1/webhooks/{id}`, `POST /api/v1/crm/deals/{id}/status` |
| Neaktor | 13,14,15,16 | `POST /api/v1/webhooks/{id}`, `POST /api/v1/crm/deals/{id}/status` |
| MindBox | 19 | `POST /api/v1/marketing/events`, `POST /api/v1/marketing/contacts/batch`, `GET /api/v1/marketing/bonus` |
| SendPulse | 19 | `POST /api/v1/marketing/events`, `POST /api/v1/marketing/contacts/batch` |
| МойСклад | 3,4,10,19,21 | `POST /api/v1/data/marketplace`, `POST /api/v1/analytics/{id}/export` |
| Telegram | 20 | `POST /api/v1/notify/{id}/send`, `POST /api/v1/notify/{id}/send/batch`, `GET /api/v1/notify/{id}/status` |
| WhatsApp WABA | 20 | `POST /api/v1/notify/{id}/send`, `GET /api/v1/notify/templates` |
| VK | 20 | `POST /api/v1/notify/{id}/send` |
| Viber | 20 | `POST /api/v1/notify/{id}/send` |
| Одноклассники | 20 | `POST /api/v1/notify/{id}/send` |
| Google Sheets | 21 | `POST /api/v1/analytics/{id}/export` |
| Power BI | 21 | `POST /api/v1/analytics/{id}/export` |
| Roistat | 21 | `POST /api/v1/analytics/{id}/export` |

---

*Документ сгенерирован на основе `CLAUDE.md v2.5`, `CLAUDE(server).md`, `README_server_.md`, `MVP_Все_механики_в_конфигурациях_v4.xlsx` и официальной документации сервисов. При изменении API внешних сервисов — обновить соответствующий раздел и `n8n/templates/*.json`.*
