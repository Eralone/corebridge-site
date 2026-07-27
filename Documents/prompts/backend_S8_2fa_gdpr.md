# Промт для `corebridge-server` — пакет S8: 2FA для ЛК, экспорт данных и удаление аккаунта

> Передать локальному claude-code в репозитории `corebridge-server`.
> Составлено сайтом 2026-07-27 по решениям Дмитрия того же дня.
> Сверено с `docs/API_ENDPOINTS.md` и `site_S1_S7_RESPONSE.md`.

## Зачем это нужно (контекст с сайта)

Три вещи, которые дизайн `settings.html` показывает как работающие, а на сервере их нет:

1. **Двухфакторная аутентификация пользователя ЛК.** В макете стоит тумблер «Двухфакторная:
   Включено через SMS» в положении «включено». Фактически у пользователей ЛК 2FA нет вообще —
   TOTP реализован только для admin-аккаунтов (`platform.admin_users`), SMS-провайдера в системе
   нет. Сайт сейчас вынужден этот блок убирать.
2. **Экспорт данных** и **удаление аккаунта** — пункты меню в макете есть, эндпоинтов нет.
   При этом `privacy.html` §7 публично обещает пользователю «право на переносимость данных»
   и «право быть забытым» с рассмотрением запроса в 30 дней. То есть обещание в юридическом
   документе не закрыто ничем.

**Решения Дмитрия (2026-07-27):**
- 2FA — **через Telegram**, бот для пользователей уже настроен (`@CoreBridgeRu_bot`,
  Support_Corebridge). SMS не используем.
- Экспорт данных и удаление профиля — **пользователь отправляет запрос**, а сами механики
  выполняет администратор **в админ-панели**.

---

## Часть 1. 2FA для пользователей ЛК

### Решение: только Telegram. SMS и TOTP не делаем

Дмитрий (2026-07-27): «просто меняется интеграция, с выдуманной SMS на уже реализованную с
Telegram, не думаю что СМС понадобится нам в дальнейшем».

Я предлагал добавить ещё и TOTP (код для него уже есть в `admin_auth.service.js`, и он не зависит
от доступности внешнего сервиса) — **решение принято в пользу Telegram-only**, дальше не обсуждаем.
Переиспользуем уже работающий флоу привязки чата из S4. SMS-канал не реализуем никогда — из
`GET /lk/notifications/settings` его тоже стоит убрать, а не держать с `available: false`
(см. Часть 5).

Принятый компромисс, чтобы ты понимал границы: второй фактор в Telegram проходит любой, кто
получил доступ к Telegram-аккаунту пользователя. Recovery-коды это частично компенсируют, и они
обязательны — см. ниже.

### Контракт

```
GET  /lk/2fa/status                      (cookie)
→ 200 { "enabled": false,
         "method": null | "telegram",
         "telegram_linked": true|false,      // из notification_settings, тот же chat_id
         "can_enable": true|false }          // = telegram_linked

POST /lk/2fa/enable                      (cookie)  → 202 { "sent": true }
     // 6-значный код уходит в привязанный чат через @CoreBridgeRu_bot
     errors: 409 TELEGRAM_NOT_LINKED  — сначала привязать через POST /lk/notifications/telegram/link
             409 ALREADY_ENABLED

POST /lk/2fa/confirm                     (cookie)  body { "code" }
→ 200 { "enabled": true, "recovery_codes": ["....", ...] }   // показываются ОДИН раз
     errors: 400 INVALID_CODE · 410 CODE_EXPIRED · 429 TOO_MANY_ATTEMPTS

DELETE /lk/2fa                           (cookie)  body { "password" }
→ 200 { "enabled": false }
     errors: 401 INVALID_PASSWORD
```

Изменение во входе:

```
POST /lk/auth/login  { email, password }
→ 200 { "twofactor_required": true, "method": "telegram", "challenge_id": "..." }
  (cookie lk_session НЕ ставится; код уже отправлен в Telegram)

POST /lk/auth/login/2fa  { "challenge_id", "code" }
→ 200 { user_id, role, tenant_id } + Set-Cookie: lk_session
errors: 400 INVALID_CODE · 410 CHALLENGE_EXPIRED (TTL 5 мин) · 429 TOO_MANY_ATTEMPTS (5 попыток)

POST /lk/auth/login/2fa/resend  { "challenge_id" }
→ 202 { "sent": true } ; errors: 429 (не чаще 1 раза в 60 с)
```

Обязательно:
- **Recovery-коды** (8–10 одноразовых, показываются один раз при включении). При Telegram-only
  это единственный путь восстановления: потерял доступ к Telegram — иначе восстанавливать придётся
  тебе руками через БД. Хранить как SHA-256 хеши, как инвайты в 007.
- Код: 6 цифр, TTL 5 мин, одноразовый, в Redis, rate-limit на переотправку.
- **Отвязка Telegram при включённой 2FA должна быть запрещена** — `DELETE /lk/notifications/telegram`
  вернуть `409 TELEGRAM_REQUIRED_FOR_2FA`. Иначе пользователь отвяжет чат и потеряет вход.
  Это важно, легко пропустить.
- Вход через **Яндекс ID** второй фактор **не запрашивает** (провайдер уже подтвердил личность) —
  подтверди, что согласен, иначе получится, что 2FA обходится соцвходом.
- **Сброс пароля не должен гасить 2FA.** После `POST /lk/auth/password/reset` при включённой 2FA
  сессию ставить **только после** прохождения второго фактора. Сейчас `reset` ставит cookie сразу
  (S1 §1.3) — это надо поправить, иначе сброс пароля станет обходом второго фактора.

---

## Часть 2. Запрос экспорта данных и удаления аккаунта (сторона пользователя)

Решение: пользователь **отправляет запрос**, выполняет администратор. То есть от сервера нужен
приём и хранение запроса + уведомление администратору.

```
POST /lk/privacy/request              (cookie lk_session)
body { "type": "export" | "deletion", "comment"? }
→ 202 { "request_id", "ref": "PRV-0001", "type", "status": "received", "created_at" }
errors: 409 REQUEST_ALREADY_PENDING (уже есть незакрытый запрос того же типа) · 401

GET  /lk/privacy/requests             (cookie)
→ 200 { "requests": [{ id, ref, type, status: "received"|"in_progress"|"done"|"rejected",
                        created_at, resolved_at, admin_comment }] }
```

- Хранить в `platform.privacy_requests`, `ref` из последовательности (как `contact_requests` в S3),
  формат `PRV-NNNN`.
- При создании — письмо администратору на `SALES_NOTIFY_EMAIL` (или отдельный `PRIVACY_NOTIFY_EMAIL`)
  + дублирование в Telegram админам, как в S3.
- Пользователю — подтверждение на его email с номером обращения и сроком **30 календарных дней**
  (этот срок публично обещан в `privacy.html` §7, его надо соблюдать).
- Запрос на удаление **не удаляет ничего сам** — только фиксирует обращение.

Сайт покажет в `/settings` два пункта, статус последнего запроса и номер обращения.

---

## Часть 3. Исполнение в админ-панели (сторона администратора)

Здесь и происходит собственно работа.

```
GET   /admin/privacy/requests?status=&type=&page=&limit=     (admin-сессия)
→ 200 { requests:[{ id, ref, type, status, comment, created_at, resolved_at, admin_comment,
                    user_id, user_email, tenant_id, company_name }], count }

PATCH /admin/privacy/requests/:id                            (admin)
body { "status": "in_progress"|"done"|"rejected", "admin_comment"? }
→ 200 { id, status }
```

### 3.1. Экспорт данных тенанта

```
POST /admin/tenants/:id/export                               (admin)
→ 200 { "download_url", "expires_in": 600, "size_bytes", "sha256" }
```

Собрать в один архив (JSON + опционально CSV) всё, что относится к тенанту:
`tenants`, `users` (**без `password_hash` и без TOTP-секретов**), `licenses` (JWT маскировать),
`payments`, `adapter_configs` (**без `encrypted_config`** — это чужие ключи доступа, отдавать их
в выгрузке нельзя), `audit_log`, `notification_settings`, `usage_counters`,
`privacy_requests`.

Отдавать по одноразовой ссылке с TTL, как уже сделано для `.epf`
(`X-Accel-Redirect`, `/cdn/`) — не гонять архив через приложение. Факт выгрузки писать в
`audit_log` (`admin_tenant_export`, actor `admin:<email>`).

### 3.2. Удаление аккаунта тенанта

```
POST /admin/tenants/:id/delete                               (admin)
body { "reason", "confirm_company_name" }     // защита от удаления не того тенанта
→ 200 { "tenant_id", "scheduled_purge_at", "status": "pending_deletion" }

POST /admin/tenants/:id/delete/cancel                        (admin)
→ 200 { "tenant_id", "status": "active" }
```

**Не удалять сразу.** Предлагаю двухфазно, и это согласовано с уже опубликованными документами:

- **Фаза 1 (сразу):** `tenants.status = 'pending_deletion'`, все сессии пользователей гасятся,
  лицензия инвалидируется, polling адаптеров останавливается, вход блокируется
  (как `TENANT_BLOCKED`). Данные ещё лежат.
- **Фаза 2 (через 30 дней, cron):** физическое удаление. Срок **30 дней** взят из уже
  опубликованных `terms.html` §8.3 («данные учётной записи хранятся 30 дней, после чего
  безвозвратно удаляются») и `privacy.html` §6.3 — не выбирай другой, иначе разойдётся с
  документами.

Что **нельзя** удалять вместе с тенантом: `platform.payments` и связанные фискальные данные —
по 402-ФЗ первичные документы хранятся 5 лет, и `privacy.html` §6.3 это уже обещает
(«данные об оплатах — 5 лет»). Их надо **анонимизировать** (обнулить персональные поля, оставить
суммы, даты, ИНН плательщика), а не удалять. То же с `audit_log`: записи оставить, actor
заменить на `deleted_user:<id>`.

`confirm_company_name` обязателен: админ должен вручную ввести название компании, иначе
удаление не выполняется. Слишком легко нажать не на той строке.

Всё — в `audit_log`: `admin_tenant_delete_scheduled`, `admin_tenant_delete_cancelled`,
`tenant_purged`.

---

## Часть 5. Убрать SMS-канал из уведомлений

Решение Дмитрия: SMS не понадобится и в дальнейшем. Сейчас `GET /lk/notifications/settings`
отдаёт `sms: { enabled, phone, available: false }` и ключ `sms` в каждой строке матрицы.

Просьба сайта: **убрать `sms` из ответа и из матрицы целиком**, а не держать с `available: false`.
Тогда сайт не рисует мёртвую колонку с подписью «Скоро», которая никогда не заполнится.
`PUT` должен игнорировать присланный `sms` (или отвечать `400 VALIDATION_ERROR`), чтобы старые
клиенты не ломались.

Если удалять из хранимого JSONB не хочется — достаточно перестать отдавать наружу.

## Часть 4. Мелочь по S3

`POST /lk/contact` принимает `source ∈ landing|pricing|contacts|for_business`. Сайту нужны ещё
два значения: **`billing`** (кнопка «Запросить счёт» для юрлиц на странице биллинга) и
**`epf`** (запрос помощи по установке). Добавь в перечисление, либо скажи, что валидация мягкая
и любое значение пройдёт.

---

## Definition of Done

- [ ] 2FA **только Telegram** (TOTP и SMS не делаем): enable / confirm / disable / вход в два шага
      / resend / recovery-коды, покрыто тестами
- [ ] `DELETE /lk/notifications/telegram` при включённой 2FA → `409 TELEGRAM_REQUIRED_FOR_2FA`
- [ ] Поправлено: `POST /lk/auth/password/reset` при включённой 2FA не ставит сессию до второго фактора
- [ ] Подтверждено поведение 2FA при входе через Яндекс ID
- [ ] `sms` убран из `GET/PUT /lk/notifications/settings`
- [ ] `POST /lk/privacy/request` + `GET /lk/privacy/requests`, письмо админу и пользователю
- [ ] `GET /admin/privacy/requests` + `PATCH /admin/privacy/requests/:id`
- [ ] `POST /admin/tenants/:id/export` — архив без секретов и без чужих API-ключей
- [ ] `POST /admin/tenants/:id/delete` (+`/cancel`) — двухфазно, 30 дней, платежи анонимизируются
      а не удаляются, `confirm_company_name` обязателен
- [ ] `source` в `/lk/contact` расширен на `billing` и `epf`
- [ ] Финальные схемы присланы в `corebridge-site/Documents/server_ask/`
