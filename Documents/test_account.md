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

## 4. Прогон пользовательских путей: как переключать роль и тариф

Аккаунт всё равно под удаление, поэтому его роль и тариф можно менять прямо в базе —
это дешевле, чем заводить четыре аккаунта.

```bash
U=da149c7e-5ef2-4c10-9488-8e3f8dcc9589
T=07584704-9800-44c0-bc4e-30bbeb513007

# роль: owner | manager | user
docker exec corebridge-postgres psql -U corebridge -d corebridge -q \
  -c "update platform.users set role='manager' where id='$U'"

# тариф: trial | starter | business | professional  (⚠️ именно starter, не start)
# у платного тарифа лицензия не бессрочная — иначе дашборд покажет «Бессрочно»
docker exec corebridge-postgres psql -U corebridge -d corebridge -q \
  -c "update platform.tenants  set plan='professional' where id='$T';
      update platform.licenses set plan='professional', is_trial=false,
             valid_until=now()+interval '30 days' where tenant_id='$T'"

# «без подписки»: погасить лицензию
docker exec corebridge-postgres psql -U corebridge -d corebridge -q \
  -c "update platform.licenses set is_active=false, invalidated_at=now() where tenant_id='$T'"
```

⚠️ **После смены роли обязательно перелогиниться.** Роль кэшируется в сессии Redis:
`GET /lk/auth/session` продолжает отдавать старую, и проверки прав идут по ней.
Новая сессия — новым `POST /lk/auth/login`, и `CB_SESSION` в инструментах тоже поменять.

**Вернуть исходное состояние** (или просто перейти к чистке из раздела 3):

```bash
docker exec corebridge-postgres psql -U corebridge -d corebridge -q \
  -c "update platform.users    set role='owner' where id='$U';
      update platform.tenants  set plan='trial' where id='$T';
      update platform.licenses set plan='trial', is_trial=true, valid_until=null,
             is_active=true, invalidated_at=null where tenant_id='$T'"
```

⚠️ **JWT в `licenses.jwt_token` при этом не перевыпускается.** `GET /lk/token/full` продолжит
отдавать токен со старым планом (`"plan":"trial"` на «Профессионале»). Это артефакт правки
в обход платёжного пути, а не баг: в жизни токен перевыпускается при оплате. Проверять
по токену смену тарифа бессмысленно — смотреть `/lk/dashboard`.

### Что проверено прогоном (2026-07-29)

**Роль `manager`**

| Путь | Поведение |
|---|---|
| `GET /lk/token/full` | `403 FORBIDDEN` |
| Экран `/epf` | «Полный токен доступен только владельцу аккаунта» |
| Настройки → Команда | форма приглашения скрыта |

**Роль `user` (только чтение)**

| Путь | Поведение |
|---|---|
| `GET /lk/token/full` | `403` |
| `POST /lk/users/invite` | `403 FORBIDDEN` |
| `POST /lk/workflows/activate` | `403 FORBIDDEN` |
| `GET /lk/dashboard`, `/lk/integrations`, `/lk/users` | `200` — чтение открыто |
| Настройки → Команда | ни формы приглашения, ни селекторов роли |

→ **Нашлось:** в «Моих интеграциях» и воркфлоу кнопки действий показывались всем.
Сервер их отклонял, но человек видел кнопку, которая гарантированно не сработает.
Исправлено: изменяющие действия скрыты или заблокированы при роли `user`.

**Без активной лицензии** (`is_active = false`)

| Путь | Поведение |
|---|---|
| `GET /lk/token/full` | `404 TOKEN_NOT_FOUND` |
| `GET /lk/dashboard`, `/lk/billing` | `200` — кабинет открыт |
| `GET /lk/epf/versions` | `200`, сборки видны |

→ **Нашлось:** экран `/epf` показывал общее «Не удалось получить токен. Обновите страницу»,
хотя это не сбой, а состояние аккаунта. Исправлено: «Активной лицензии нет… Оформите тариф».

**Платный тариф `professional`** (`valid_until` = +30 дней)

| Путь | Поведение |
|---|---|
| `GET /lk/dashboard` | `plan: professional`, `days_left: 30`, лимиты тарифа подтянулись |
| `GET /lk/billing` | `200`, история пуста — оплат не было |
| `POST /lk/token/refresh` | `402 NO_ACTIVE_SUBSCRIPTION` — нужен подтверждённый платёж |
| `GET /lk/token/full` | `200`, но в JWT остался `plan: trial` — см. предупреждение выше |
| `GET /lk/workflows/catalog` | `200`, **всегда пусто** — шаблоны не смонтированы в контейнер (промт S12) |

→ **Нашлось три вещи.** (1) `n8n_usage.limit` равен нулю на любом тарифе, пока не было
ни одного запуска: он читается из `usage_counters`, а строка создаётся лениво. Сайт
из-за этого писал оплатившему «на пробном тарифе n8n недоступен» — лимит теперь берётся
из `GET /lk/plans`. (2) На тарифе «Профессионал» биллинг звал «Попробовать» тот же самый
«Профессионал», дважды — а промо `once_per_tenant`, повторная оплата упёрлась бы
в `PROMO_ALREADY_USED`. Теперь там «Продлить на месяц». (3) `POST /lk/workflows/activate`
требует `integration_id`, а сайт его не слал — каждое нажатие «Включить» гарантированно
возвращало `400`. Исправлено, интеграция выбирается в карточке.

Состояние возвращено в исходное 2026-07-29: `owner` · `trial` · лицензия активна, бессрочная.

## 5. Что этот аккаунт уже помог найти

**Роль кэшируется в сессии и не обновляется до перелогина.** Меняешь роль в базе —
`GET /lk/profile` показывает новую (читает БД), а `GET /lk/auth/session` и все проверки
прав продолжают работать по старой, пока живёт сессия (до суток). То есть понижение
роли не отзывает полномочия сразу: разжалованный из владельцев сохраняет доступ
к `GET /lk/token/full` до конца своей сессии. Для сайта это не чинится — решать серверу,
если сочтём существенным.

**Guard личного кабинета не пропускал внутрь даже с валидной сессией.** В `middleware.ts`
адрес проверки собирался как `new URL('/lk/auth/session', req.url)`, а `req.url` внутри
middleware равен `https://localhost:3005/…` — Next подставляет свой внутренний хост, но
со схемой `https`, хотя на 3005 слушает обычный `http`. Запрос падал на рукопожатии TLS,
управление уходило в `catch`, и человека с рабочей сессией уводило на форму входа.

Пока сессий не существовало, баг был невидим: тесты проверяли только отказ без cookie,
и он честно проходил. Исправлено: адрес задаётся явно (`LK_API_INTERNAL`, по умолчанию
`http://127.0.0.1:3000` — порт слушает только петлю), имя домена передаётся заголовком.
