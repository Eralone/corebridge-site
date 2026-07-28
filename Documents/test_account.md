# Тестовый аккаунт: что заведено и как вычистить

> **Обязательство перед Дмитрием (2026-07-28):** аккаунт заведён на проде с условием, что
> в конце тестирования он и все его данные **вычищаются из базы**. Пока чистка не выполнена,
> работа не закончена. Отметка о состоянии — в `BACKLOG.md`, раздел 0.

---

## 1. Что заведено

| Поле | Значение |
|---|---|
| Email | `qa-e2@corebridge.ru` |
| Пароль | `Qa-Test-2026-e2!` |
| Имя | QA Проверка |
| `tenant_id` | `07584704-9800-44c0-bc4e-30bbeb513007` |
| `user_id` | `da149c7e-5ef2-4c10-9488-8e3f8dcc9589` |
| Роль | `owner` · тариф `trial` · `auth_provider: password` |
| Заведён | 2026-07-28 21:27 UTC, через форму `/register` на проде |

Адрес намеренно на своём домене, но **вне списка алиасов** `deploy/mail/virtual`: письма
на него отбиваются на этапе SMTP и не засоряют ящик Дмитрия. Поэтому подтверждение почты
по настоящей ссылке из письма проверить нельзя — `email_verified` остаётся `false`.

**Как получить cookie сессии** (нужна инструментам самопроверки):

```bash
curl -s -i -X POST https://corebridge.ru/lk/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"qa-e2@corebridge.ru","password":"Qa-Test-2026-e2!"}' | grep -i set-cookie

CB_SESSION=<значение> npm run inspect -- lk
```

Срок жизни сессии — сутки (`expires_at` в ответе `/lk/auth/session`).

---

## 2. Как устроено удаление аккаунта на сервере

Две фазы, обе в `privacy_admin.service.js` внутри контейнера `corebridge-admin`
(`/app/src/services/admin/privacy_admin.service.js`; на хосте этого файла нет).

**Фаза 1 — `scheduleDeletion(tenantId, { reason, confirm_company_name }, adminId, adminEmail)`**

- `platform.tenants.status` → `pending_deletion`, `purge_at = NOW() + 30 дней`;
- лицензии помечаются `is_active = FALSE`, сессии гасятся, вход закрывается;
- отменяется через `cancelDeletion(tenantId, …)` — пока не наступил `purge_at`.

**Фаза 2 — `purgeTenant(tenantId)`** (её же по расписанию дёргает `purgeExpired()` из cron)

Удаляет: `user_recovery_codes`, `marketplace.adapter_errors_log`, `adapter_state`,
`adapter_configs`, `events`, `platform.usage_counters`, `licenses`, `users`.

**Не удаляет намеренно:**

- `platform.payments` — 402-ФЗ, хранение 5 лет;
- `platform.audit_log` — записи остаются, `actor` обезличивается
  (`lk_user:<id>` → `deleted_user:<id>`);
- **строку `platform.tenants`** — она остаётся «надгробием» со `status='purged'`,
  обнулёнными личными полями и адресом `purged+<id>@deleted.local`. Название и ИНН
  сохраняются, иначе платежи не соотнести с контрагентом.

Идемпотентна: повторный вызов для уже вычищенного тенанта ничего не делает.

---

## 3. Чистка тестового аккаунта

Штатная механика оставляет надгробие, а Дмитрий просил вычистить полностью. Поэтому
после штатных фаз удаляем и саму строку тенанта — это допустимо именно для тестовых
данных: платежей у аккаунта нет, соотносить нечего.

```bash
T=07584704-9800-44c0-bc4e-30bbeb513007

# Фаза 1 и 2 штатной механикой — заодно проверяем, что она работает
docker exec corebridge-admin node -e "
const s = require('/app/src/services/admin/privacy_admin.service');
s.scheduleDeletion('$T', { reason: 'тестовый аккаунт QA', confirm_company_name: null }, null, 'qa@corebridge.ru')
  .then(r => { console.log(JSON.stringify(r)); return s.purgeTenant('$T'); })
  .then(r => { console.log(JSON.stringify(r)); process.exit(0); })
  .catch(e => { console.error(e.message); process.exit(1); });
"

# Надгробие и остатки — уже напрямую
docker exec corebridge-postgres psql -U corebridge -d corebridge -v ON_ERROR_STOP=1 <<SQL
BEGIN;
DELETE FROM platform.audit_log        WHERE tenant_id = '$T';
DELETE FROM platform.privacy_requests WHERE tenant_id = '$T';
DELETE FROM platform.payments         WHERE tenant_id = '$T';
DELETE FROM platform.tenants          WHERE id = '$T';
COMMIT;
SQL
```

⚠️ `scheduleDeletion` требует подтверждения названием компании, если оно задано.
У тестового тенанта `company_name` пустое, поэтому передаём `null`.

**Проверка, что чисто.** До начала работ в базе было **ровно 4 тенанта**:

```
8a7fd65d-…-a2753da1f412  rls-test-a-1775740328006@example.com
3f8b617a-…-602051e36c0e  rls-test-b-1775740328123@example.com
d0eebc99-…-6bb9bd380001  EPF Test Professional
d0eebc99-…-6bb9bd380002  EPF Test Trial
```

После чистки:

```bash
docker exec corebridge-postgres psql -U corebridge -d corebridge -c "
  SELECT count(*) FROM platform.tenants;                          -- ожидаем 4
  SELECT count(*) FROM platform.users WHERE email LIKE '%qa-e2%'; -- ожидаем 0
  SELECT count(*) FROM platform.licenses  WHERE tenant_id = '$T'; -- ожидаем 0
  SELECT count(*) FROM platform.audit_log WHERE tenant_id = '$T'; -- ожидаем 0
"
```

Отдельно проверить, что сессия мертва:

```bash
curl -s -o /dev/null -w '%{http_code}\n' -H "Cookie: lk_session=<значение>" \
  https://corebridge.ru/lk/auth/session   # ожидаем 401
```

---

## 4. Что этот аккаунт уже помог найти

**Guard личного кабинета не пропускал внутрь даже с валидной сессией.** В `middleware.ts`
адрес проверки собирался как `new URL('/lk/auth/session', req.url)`, а `req.url` внутри
middleware равен `https://localhost:3005/…` — Next подставляет свой внутренний хост, но
со схемой `https`, хотя на 3005 слушает обычный `http`. Запрос падал на рукопожатии TLS,
управление уходило в `catch`, и человека с рабочей сессией уводило на форму входа.

Пока сессий не существовало, баг был невидим: тесты проверяли только отказ без cookie,
и он честно проходил. Исправлено: адрес задаётся явно (`LK_API_INTERNAL`, по умолчанию
`http://127.0.0.1:3000` — порт слушает только петлю), имя домена передаётся заголовком.
