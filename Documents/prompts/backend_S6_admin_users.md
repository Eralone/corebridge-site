# Промт для `corebridge-server` — пакет S6: кросс-тенантные пользователи и смена тарифа в админке

> Приоритет: средний (этап Э7 — `admin-users.html`).
> Составлено сайтом 2026-07-26, сверено с `docs/API_ENDPOINTS.md`.

## Что уже есть в админке

`/admin/tenants` (список **компаний**), `block`/`unblock`, `issue-token`, `tokens`, `grant-trial`,
`/admin/payments`, `/admin/stats`, `/admin/integrations`, `/admin/n8n/*`, `/admin/queues`,
`/admin/dlq`, `/admin/epf`.

## Чего нет

### 1. Кросс-тенантный список пользователей

Решение продукта (`implementation_strategy.md` §8.7): экран `admin-users.html` — это **все
пользователи системы**, с возможностью блокировки и смены тарифа. Эндпоинта «все пользователи
всех тенантов» нет; `platform.users` мультиюзерная, но выборки поверх неё в админке нет.

```
GET /admin/users?tenant_id=&role=&status=&plan=&q=&page=&limit=      (admin-сессия)
→ 200 {
  "users": [{
    "id", "email", "name", "phone", "role": "owner"|"manager"|"user",
    "auth_provider": "password"|"yandex",
    "status": "active"|"invited",
    "email_verified": true,
    "created_at", "last_login_at",
    "tenant_id", "company_name", "tenant_plan", "tenant_status": "active"|"blocked"
  }],
  "count": 42
}
```

- `q` — поиск по email / имени / названию компании.
- `limit` ≤ 200, как в `/admin/tenants`.
- Блокировка пользователя = блокировка его tenant-а (`POST /admin/tenants/:id/block`, уже есть) —
  **отдельной блокировки одного пользователя внутри компании не нужно**, если это дорого. Но если
  такое разграничение нужно продуктово, скажи — обсудим.

### 2. Прямая смена тарифа

Сейчас тариф меняется только через `grant-trial` (даёт trial) или `issue-token` (перевыпуск
текущего). Поставить конкретный план вручную нельзя. Рекомендация §7 референса:

```
POST /admin/tenants/:id/set-plan          (admin-сессия)
body { "plan": "trial"|"starter"|"business"|"professional"|"enterprise",
       "valid_until": "2027-01-01T00:00:00Z"|null,
       "reason": "ручной перевод по договору" }
→ 200 { "tenant_id", "plan", "valid_until", "jwt_reissued": true }
errors: 400 INVALID_PLAN · 404 TENANT_NOT_FOUND · 403
```

Внутри — переиспользовать `issueLicense` (не вводить второй путь выдачи лицензий): меняет `plan`
в `platform.tenants`, перевыпускает JWT с новыми `limits`/`features`, пишет в `audit_log`
(`admin_set_plan`, actor `admin:<email>`). `reason` — обязателен, идёт в аудит.

### 3. Сотрудники CoreBridge (`platform.admin_users`) — НЕ в этом пакете

CRUD для admin-аккаунтов (`/admin/admins`) не нужен: по решению §8.7 `admin-users.html` — про
пользователей клиентов, а не про сотрудников. Заведение админов остаётся ручным скриптом,
как сейчас. **Не делай.**

## Definition of Done

- [ ] `GET /admin/users` с фильтрами и пагинацией, покрыт тестами
- [ ] `POST /admin/tenants/:id/set-plan` через `issueLicense`, с аудитом и обязательным `reason`
- [ ] Решено: нужна ли блокировка отдельного пользователя (а не всего tenant-а)
- [ ] Финальные схемы присланы сайту
