# CoreBridge Server — полный реестр API-эндпоинтов

> **Единый перечень всех HTTP-маршрутов сервера**, сгенерирован из кода (источник истины —
> route-файлы). Внешние пути указаны с учётом префиксов монтирования и Nginx.
> Всего **282 маршрута** в 5 сервисах. Актуально на 2026-07-26.
>
> ⚙️ **Как перегенерировать:** маршруты берутся из `services/*/src/**/*.routes.js` и `server/routes/**`.
> Скрипт-сканер — в истории коммита этого файла (grep `router.<method>(...)` + карта префиксов).

## Где ещё искать (тематические срезы)

| Что нужно | Где |
|---|---|
| **Эндпоинты для сайта** (ЛК, биллинг, профиль, команда, admin) | [`docs/next-prompts/site_server_integration_reference.md`](next-prompts/site_server_integration_reference.md) — §9 карта + §9b/§9c контракты |
| **Интеграции 1С ↔ маркетплейсы** (.epf, механики 1–12) | [`docs/epf-docs/marketplace_integration_registry.md`](epf-docs/marketplace_integration_registry.md) |
| **Интеграции 1С ↔ Сайт** (7 сервисов) | [`docs/epf-docs/site_integration_registry.md`](epf-docs/site_integration_registry.md) |
| **Группы CRM/Доставка/Оплата/CDP/Соцсети/Аналитика/Иное** | `docs/epf-docs/API по категориям/{Группа}/Реализованы/` |
| Этот файл | **все** маршруты без исключения (включая internal/webhooks) |

## Авторизация по сервисам

| Сервис | Порт | Внешний префикс | Авторизация |
|---|---|---|---|
| bridge | 3001 | `/api/v1/*` | Bearer JWT (.epf); `/api/v1/webhooks/*` — HMAC/IP |
| lk-api | 3000 | `/lk/*` | Cookie `lk_session` (публичные: `/lk/plans`, `/lk/auth/*`, `/lk/users/accept`) |
| license-service | 3002 | `/api/v1/license/*` | Bearer JWT; `/internal/v1/*` — X-Service-Token |
| admin | 3003 | `/admin/*` | Cookie `admin_session_id` + 2FA + IP-whitelist |
| shared `server/` | — | `/lk/n8n/*`, `/cdn/epf/*`, … | Bearer JWT / токен / internal |

> `/internal/v1/*` закрыты снаружи через Nginx `deny all` — только Docker-сеть.
> `:integration_id`, `:id`, `:order_id` и т.п. — path-параметры.

---

## bridge (3001) — внешне `/api/v1/*`; `/internal/v1/*` закрыт Nginx

**`index.js`**

- `GET   ` `/health`

**`routes/external/analytics-ext.routes.js`**

- `POST  ` `/api/v1/analytics/:integration_id/datasets`
- `DELETE` `/api/v1/analytics/:integration_id/datasets/:dataset/rows`
- `POST  ` `/api/v1/analytics/:integration_id/datasets/:dataset/rows`
- `POST  ` `/api/v1/test/analytics/simulate`

**`routes/external/bitrix.routes.js`**

- `GET   ` `/api/v1/bitrix/:integration_id/delivery-methods`
- `GET   ` `/api/v1/bitrix/:integration_id/orders/:order_id`
- `GET   ` `/api/v1/bitrix/:integration_id/price-types`
- `GET   ` `/api/v1/bitrix/:integration_id/stores`

**`routes/external/cdp-ext.routes.js`**

- `GET   ` `/api/v1/cdp/:integration_id/catalog`
- `POST  ` `/api/v1/cdp/:integration_id/catalog`
- `GET   ` `/api/v1/cdp/:integration_id/catalog/mapping`
- `POST  ` `/api/v1/cdp/:integration_id/contacts`
- `GET   ` `/api/v1/cdp/:integration_id/contacts`
- `POST  ` `/api/v1/cdp/:integration_id/events`
- `POST  ` `/api/v1/cdp/:integration_id/prices`
- `GET   ` `/api/v1/cdp/:integration_id/prices`
- `POST  ` `/api/v1/cdp/:integration_id/stock`
- `GET   ` `/api/v1/cdp/:integration_id/stocks`
- `POST  ` `/api/v1/test/cdp/simulate`

**`routes/external/crm-ext.routes.js`**

- `POST  ` `/api/v1/crm/:integration_id/contractors`
- `GET   ` `/api/v1/crm/:integration_id/contractors`
- `GET   ` `/api/v1/crm/:integration_id/deals`
- `POST  ` `/api/v1/crm/:integration_id/deals`
- `GET   ` `/api/v1/crm/:integration_id/deals/:deal_id`
- `POST  ` `/api/v1/crm/:integration_id/deals/:deal_id/invoice`
- `POST  ` `/api/v1/crm/:integration_id/deals/:deal_id/set-status`
- `GET   ` `/api/v1/crm/:integration_id/pipeline-stages`
- `POST  ` `/api/v1/test/crm/simulate`

**`routes/external/crm.routes.js`**

- `POST  ` `/api/v1/crm/:integration_id/contractors/resync`
- `GET   ` `/api/v1/crm/:integration_id/stages`
- `POST  ` `/api/v1/crm/contractors/:crm_id/sync`
- `POST  ` `/api/v1/crm/deals/:crm_deal_id/status`
- `POST  ` `/api/v1/crm/deals/:event_id/ack`
- `POST  ` `/api/v1/crm/deals/status/retry`
- `POST  ` `/api/v1/crm/invoices`
- `POST  ` `/api/v1/crm/invoices/:event_id/ack`

**`routes/external/custom.routes.js`**

- `POST  ` `/api/v1/custom/events`

**`routes/external/data.routes.js`**

- `GET   ` `/api/v1/catalog`
- `GET   ` `/api/v1/catalog/attribute-values`
- `GET   ` `/api/v1/catalog/attributes`
- `GET   ` `/api/v1/catalog/categories`
- `GET   ` `/api/v1/catalog/import-status`
- `GET   ` `/api/v1/catalog/mapping`
- `GET   ` `/api/v1/catalog/product`
- `POST  ` `/api/v1/catalog/update`
- `POST  ` `/api/v1/config/validate`
- `POST  ` `/api/v1/data/marketplace`
- `GET   ` `/api/v1/data/marketplace`
- `GET   ` `/api/v1/prices/task-status`

**`routes/external/delivery-ext.routes.js`**

- `POST  ` `/api/v1/delivery/:integration_id/orders`
- `GET   ` `/api/v1/delivery/:integration_id/orders/:delivery_id`
- `POST  ` `/api/v1/delivery/:integration_id/orders/:delivery_id/cancel`
- `GET   ` `/api/v1/delivery/:integration_id/orders/:delivery_id/label`
- `GET   ` `/api/v1/delivery/:integration_id/pickup-points`
- `POST  ` `/api/v1/delivery/:integration_id/tariffs`
- `POST  ` `/api/v1/test/delivery/simulate`

**`routes/external/delivery.routes.js`**

- `DELETE` `/api/v1/delivery/:integration_id/:order_id/cancel`
- `POST  ` `/api/v1/delivery/:integration_id/calculate`
- `POST  ` `/api/v1/delivery/:integration_id/create`
- `GET   ` `/api/v1/delivery/:integration_id/track/:tracking_number`

**`routes/external/ecwid.routes.js`**

- `GET   ` `/api/v1/ecwid/:integration_id/order-statuses`
- `GET   ` `/api/v1/ecwid/:integration_id/orders/:order_id`

**`routes/external/events.routes.js`**

- `GET   ` `/api/v1/events`
- `POST  ` `/api/v1/events/:id/ack`
- `POST  ` `/api/v1/events/reprocess`
- `GET   ` `/api/v1/events/stream`
- `GET   ` `/api/v1/health`

**`routes/external/insales.routes.js`**

- `GET   ` `/api/v1/insales/:integration_id/order-statuses`
- `GET   ` `/api/v1/insales/:integration_id/orders/:order_id`

**`routes/external/license.routes.js`**

- `GET   ` `/api/v1/license/check`

**`routes/external/marketplace.routes.js`**

- `POST  ` `/api/v1/fbm/shipments/:shipment_id/ship`
- `GET   ` `/api/v1/fbm/warehouses`
- `GET   ` `/api/v1/fbo/:integration_id/clusters`
- `GET   ` `/api/v1/fbo/:integration_id/draft/:draft_id`
- `POST  ` `/api/v1/fbo/:integration_id/draft/create`
- `GET   ` `/api/v1/fbo/:integration_id/supply-order/:id/bundle`
- `POST  ` `/api/v1/fbo/:integration_id/supply-order/create`
- `GET   ` `/api/v1/fbo/:integration_id/timeslots`
- `GET   ` `/api/v1/fbo/:integration_id/warehouses`
- `GET   ` `/api/v1/finance/reports`
- `POST  ` `/api/v1/gtd/orders/:order_id/customs`
- `GET   ` `/api/v1/gtd/orders/:order_id/status`
- `GET   ` `/api/v1/gtd/validate`
- `POST  ` `/api/v1/gtd/validate`
- `GET   ` `/api/v1/labels/order/:order_id`
- `GET   ` `/api/v1/labels/package/:package_id`
- `GET   ` `/api/v1/labels/templates`
- `POST  ` `/api/v1/orders/:integration_id/:posting_number/${action}`
- `POST  ` `/api/v1/orders/:integration_id/:posting_number/country/set`
- `POST  ` `/api/v1/orders/:integration_id/:posting_number/split`
- `POST  ` `/api/v1/orders/:integration_id/:posting_number/tracking`
- `GET   ` `/api/v1/orders/:integration_id/act/:act_id/barcode`
- `GET   ` `/api/v1/orders/:integration_id/act/:act_id/pdf`
- `GET   ` `/api/v1/orders/:integration_id/act/:act_id/status`
- `POST  ` `/api/v1/orders/:integration_id/act/create`
- `GET   ` `/api/v1/orders/:integration_id/country/list`
- `POST  ` `/api/v1/orders/:order_id/cancel`
- `POST  ` `/api/v1/orders/:order_id/marking`
- `GET   ` `/api/v1/orders/:order_id/marking-status`
- `POST  ` `/api/v1/orders/:order_id/pack`
- `POST  ` `/api/v1/orders/:order_id/packing-confirm`
- `POST  ` `/api/v1/orders/:order_id/ship`
- `GET   ` `/api/v1/reserves/snapshot`
- `POST  ` `/api/v1/reserves/sync-result`
- `POST  ` `/api/v1/test/reserve/simulate`
- `POST  ` `/api/v1/test/shipment/simulate`

**`routes/external/notify-ext.routes.js`**

- `POST  ` `/api/v1/notify/:integration_id/messages`
- `POST  ` `/api/v1/notify/:integration_id/messages-batch`
- `GET   ` `/api/v1/notify/:integration_id/messages/:message_id`
- `POST  ` `/api/v1/test/notify/simulate`

**`routes/external/notify.routes.js`**

- `POST  ` `/api/v1/analytics/:integration_id/export`
- `GET   ` `/api/v1/marketing/bonus`
- `POST  ` `/api/v1/marketing/contacts/batch`
- `POST  ` `/api/v1/marketing/events`
- `POST  ` `/api/v1/notify/:integration_id/send`
- `POST  ` `/api/v1/notify/:integration_id/send/batch`
- `GET   ` `/api/v1/notify/:integration_id/status`
- `POST  ` `/api/v1/notify/:integration_id/test`
- `GET   ` `/api/v1/notify/templates`

**`routes/external/opencart.routes.js`**

- `GET   ` `/api/v1/opencart/:integration_id/order-statuses`
- `GET   ` `/api/v1/opencart/:integration_id/orders/:order_id`

**`routes/external/ozon-ext.routes.js`**

- `GET   ` `/api/v1/analytics/competition`
- `GET   ` `/api/v1/analytics/sales`
- `GET   ` `/api/v1/analytics/traffic`
- `GET   ` `/api/v1/catalog/check-categories-allowed`
- `POST  ` `/api/v1/catalog/preview`
- `GET   ` `/api/v1/notifications/preferences`
- `POST  ` `/api/v1/notifications/preferences`
- `GET   ` `/api/v1/posting/:posting/customer-data`
- `GET   ` `/api/v1/promotions`
- `POST  ` `/api/v1/promotions/:action_id/activate`
- `GET   ` `/api/v1/promotions/:action_id/candidates`
- `POST  ` `/api/v1/promotions/:action_id/deactivate`
- `GET   ` `/api/v1/returns`
- `POST  ` `/api/v1/returns/:return_id/accept`
- `POST  ` `/api/v1/returns/:return_id/reject`
- `GET   ` `/api/v1/warehouses`

**`routes/external/payment-ext.routes.js`**

- `POST  ` `/api/v1/payments/:integration_id`
- `GET   ` `/api/v1/payments/:integration_id/:payment_id`
- `POST  ` `/api/v1/payments/:integration_id/:payment_id/refund`
- `POST  ` `/api/v1/test/payment/simulate`

**`routes/external/projects.routes.js`**

- `GET   ` `/api/v1/integrations`
- `POST  ` `/api/v1/integrations`
- `POST  ` `/api/v1/integrations/:integration_id/verify`
- `GET   ` `/api/v1/projects`
- `POST  ` `/api/v1/projects`
- `GET   ` `/api/v1/projects/:id`
- `POST  ` `/api/v1/test/orders/advance`
- `POST  ` `/api/v1/test/orders/pull`
- `POST  ` `/api/v1/test/orders/simulate`
- `POST  ` `/api/v1/test/orders/synthetic`

**`routes/external/site_rest.routes.js`**

- `GET   ` `/api/v1/site_rest/:integration_id/order-statuses`
- `GET   ` `/api/v1/site_rest/:integration_id/orders/:order_id`

**`routes/external/wb.routes.js`**

- `GET   ` `/api/v1/wb/:integration_id/fbw/coefficients`
- `GET   ` `/api/v1/wb/:integration_id/fbw/limits`
- `POST  ` `/api/v1/wb/:integration_id/fbw/supply-requests`
- `GET   ` `/api/v1/wb/:integration_id/fbw/supply-requests`
- `DELETE` `/api/v1/wb/:integration_id/fbw/supply-requests/:id`
- `GET   ` `/api/v1/wb/:integration_id/fbw/supply-requests/:id`
- `GET   ` `/api/v1/wb/:integration_id/fbw/tariffs`
- `POST  ` `/api/v1/wb/:integration_id/orders/status`
- `GET   ` `/api/v1/wb/:integration_id/supplies`
- `POST  ` `/api/v1/wb/:integration_id/supplies`
- `GET   ` `/api/v1/wb/:integration_id/supplies/:supply_id/barcode`
- `POST  ` `/api/v1/wb/:integration_id/supplies/:supply_id/deliver`
- `POST  ` `/api/v1/wb/:integration_id/supplies/:supply_id/orders`

**`routes/external/woocommerce.routes.js`**

- `GET   ` `/api/v1/woocommerce/:integration_id/orders/:order_id`
- `GET   ` `/api/v1/woocommerce/:integration_id/orders/:order_id/notes`
- `POST  ` `/api/v1/woocommerce/:integration_id/orders/:order_id/notes`

**`routes/external/ym.routes.js`**

- `GET   ` `/api/v1/ym/:integration_id/inbounds`
- `GET   ` `/api/v1/ym/:integration_id/inbounds/:id`
- `PUT   ` `/api/v1/ym/:integration_id/orders/:order_id/boxes`
- `POST  ` `/api/v1/ym/:integration_id/orders/:order_id/cancellation/accept`
- `POST  ` `/api/v1/ym/:integration_id/orders/:order_id/returns/:return_id/decision`
- `POST  ` `/api/v1/ym/:integration_id/orders/status-update`
- `POST  ` `/api/v1/ym/:integration_id/price-quarantine`
- `POST  ` `/api/v1/ym/:integration_id/price-quarantine/confirm`
- `GET   ` `/api/v1/ym/:integration_id/regions`
- `GET   ` `/api/v1/ym/:integration_id/shipments`
- `GET   ` `/api/v1/ym/:integration_id/shipments/:shipment_id/act`
- `PUT   ` `/api/v1/ym/:integration_id/shipments/:shipment_id/confirm`
- `PUT   ` `/api/v1/ym/:integration_id/shipments/:shipment_id/pallets`

**`routes/internal/events.routes.js`**

- `POST  ` `/internal/v1/dlq/reprocess/:id`
- `POST  ` `/internal/v1/events/publish`
- `GET   ` `/internal/v1/health`
- `GET   ` `/internal/v1/license/tenant-check`
- `GET   ` `/internal/v1/metrics`

## lk-api (3000) — ЛК, cookie `lk_session` (публичные: `/lk/plans`, `/lk/users/accept`, `/lk/auth/*`)

**`app.js`**

- `GET   ` `/health`

**`routes/lk/auth.routes.js`**

- `GET   ` `/lk/auth/google`
- `GET   ` `/lk/auth/google/callback`
- `POST  ` `/lk/auth/login`
- `POST  ` `/lk/auth/logout`
- `POST  ` `/lk/auth/magic-link`
- `GET   ` `/lk/auth/magic-link/verify`
- `GET   ` `/lk/auth/session`

**`routes/lk/billing.routes.js`**

- `GET   ` `/lk/billing`
- `POST  ` `/lk/billing/pay`

**`routes/lk/dashboard.routes.js`**

- `GET   ` `/lk/dashboard`
- `GET   ` `/lk/dashboard/activity`

**`routes/lk/epf.routes.js`**

- `GET   ` `/lk/epf/download`
- `GET   ` `/lk/epf/versions`

**`routes/lk/integrations.routes.js`**

- `GET   ` `/lk/integrations`
- `DELETE` `/lk/integrations/:id`
- `POST  ` `/lk/integrations/:id/credentials`
- `POST  ` `/lk/integrations/:id/pause`
- `POST  ` `/lk/integrations/:id/resume`

**`routes/lk/logs.routes.js`**

- `GET   ` `/lk/logs`

**`routes/lk/plans.routes.js`**

- `GET   ` `/lk/plans`

**`routes/lk/profile.routes.js`**

- `PATCH ` `/lk/profile`
- `GET   ` `/lk/profile`
- `POST  ` `/lk/profile/password`

**`routes/lk/token.routes.js`**

- `GET   ` `/lk/token`
- `GET   ` `/lk/token/full`
- `POST  ` `/lk/token/refresh`

**`routes/lk/users.routes.js`**

- `GET   ` `/lk/users`
- `DELETE` `/lk/users/:id`
- `PATCH ` `/lk/users/:id/role`
- `POST  ` `/lk/users/accept`
- `POST  ` `/lk/users/invite`

**`routes/lk/workflows.routes.js`**

- `POST  ` `/lk/workflows/activate`
- `GET   ` `/lk/workflows/catalog`
- `GET   ` `/lk/workflows/executions`

## license-service (3002)

**`index.js`**

- `GET   ` `/health`

**`payment-webhook.js`**

- `POST  ` `/api/v1/webhooks/payment/:integration_id`

**`routes/external.js`**

- `GET   ` `/api/v1/license/check`
- `POST  ` `/api/v1/license/refresh`

**`routes/internal.js`**

- `POST  ` `/internal/v1/license/invalidate`
- `POST  ` `/internal/v1/license/issue`
- `GET   ` `/internal/v1/license/tenant-check`

## admin (3003) — cookie `admin_session_id` + 2FA + IP-whitelist

**`admin-app.js`**

- `GET   ` `/health`

**`routes/admin/auth.routes.js`**

- `POST  ` `/admin/auth/login`
- `POST  ` `/admin/auth/logout`
- `GET   ` `/admin/auth/me`
- `POST  ` `/admin/auth/totp/verify`

**`routes/admin/billing.routes.js`**

- `GET   ` `/admin/payments`
- `POST  ` `/admin/payments/:id/refund`
- `POST  ` `/admin/tenants/:id/grant-trial`

**`routes/admin/dlq.routes.js`**

- `GET   ` `/admin/dlq`
- `POST  ` `/admin/dlq/:id/delete`
- `POST  ` `/admin/dlq/:id/reprocess`
- `POST  ` `/admin/dlq/reprocess-all`

**`routes/admin/epf.routes.js`**

- `POST  ` `/admin/epf/release`
- `POST  ` `/admin/epf/rollback`
- `GET   ` `/admin/epf/versions`

**`routes/admin/overview.routes.js`**

- `GET   ` `/admin/integrations`
- `GET   ` `/admin/stats`

**`routes/admin/queues.routes.js`**

- `POST  ` `/admin/queues/events/:id/force-process`
- `GET   ` `/admin/queues/stats`

**`routes/admin/tenants.routes.js`**

- `GET   ` `/admin/tenants`
- `POST  ` `/admin/tenants/:id/block`
- `POST  ` `/admin/tenants/:id/issue-token`
- `GET   ` `/admin/tenants/:id/tokens`
- `POST  ` `/admin/tenants/:id/unblock`

**`routes/admin_n8n.js`**

- `GET   ` `/admin/n8n/stats`
- `POST  ` `/admin/n8n/templates`
- `GET   ` `/admin/n8n/templates`
- `DELETE` `/admin/n8n/templates/:name`
- `POST  ` `/admin/n8n/tenants/:tenant_id/reset-limit`
- `GET   ` `/admin/n8n/tenants/:tenant_id/workflows`
- `PATCH ` `/admin/n8n/workflows/:n8n_workflow_id/activate`
- `PATCH ` `/admin/n8n/workflows/:n8n_workflow_id/deactivate`

## shared `server/` — n8n-конструктор, CDN, internal, webhooks (⚠ монтирование за прод-Nginx уточняется)

**`routes/admin/epf.admin.routes.js`**

- `POST  ` `/admin/epf/publish`
- `GET   ` `/admin/epf/publish/status`
- `POST  ` `/admin/epf/rollback`
- `GET   ` `/admin/epf/versions`

**`routes/cdn/epf_download.routes.js`**

- `GET   ` `/cdn/epf/download`

**`routes/internal/credentials.js`**

- `GET   ` `/internal/v1/credentials/:integration_id`

**`routes/internal/rotate.js`**

- `POST  ` `/internal/v1/rotate/:integration_id`

**`routes/internal_n8n_limit.js`**

- `POST  ` `/internal/v1/n8n/reset-limit/:tenantId`

**`routes/internal_tenants.js`**

- `POST  ` `/internal/v1/tenants/:id/activate`

**`routes/lk/credentials.js`**

- `POST  ` `/lk/integrations/:integration_id/credentials`

**`routes/lk_n8n.js`**

- `GET   ` `/lk/n8n/executions`
- `DELETE` `/lk/n8n/integrations/:integration_id`
- `POST  ` `/lk/n8n/integrations/:integration_id/activate`
- `GET   ` `/lk/n8n/templates`
- `GET   ` `/lk/n8n/usage`
- `GET   ` `/lk/n8n/workflows`

**`routes/public/epf.routes.js`**

- `GET   ` `/api/v1/epf/:config/version`

**`routes/public/epf_publish.routes.js`**

- `POST  ` `/api/v1/epf/publish`

**`routes/webhook_proxy.js`**

- `GET   ` `/health`

**`routes/webhooks.js`**

- `POST  ` `/api/v1/webhooks/:integration_id`

