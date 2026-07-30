# S14 — Переобработка DLQ считает любое событие вебхуком и всегда падает на 502

**Приоритет:** 🟠 кнопка «Повторить» в админке не работает ни на одном событии,
которое сейчас лежит в очереди.
**Объём:** решить, что делать с событиями не-вебхучного происхождения, и развести пути.

Найдено сквозным прогоном 2026-07-30, уже после того как вы починили SQL по S13 §4.
Листинг и удаление работают, а вот переобработка падает — по другой причине.

## Что происходит

```bash
$ curl -s -X POST -H "Cookie: admin_session_id=…" \
    https://admin.corebridge.ru/admin/dlq/e3e390ab-…/reprocess
502 {"error":"n8n rejected: 404 {\"code\":404,\"message\":\"The requested webhook
     \\\"POST 8a7fd65d-…/unknown\\\" is not registered.\"}"}
```

## Причина

`services/admin/dlq_mgmt.service.js`, `reprocessEvent()`:

```js
const routing = payload._routing || {};
const routingTenantId = routing.tenant_id || event.tenant_id;
const eventType = routing.event_type || payload.event_type || 'unknown';

const n8nResp = await fetch(`${N8N_URL}/webhook/${routingTenantId}/${eventType}`, { … });
```

Метод исходит из того, что **каждая** запись в очереди — это входящий вебхук,
который достаточно отправить в n8n заново. Но всё, что сейчас в очереди, —
события другого рода:

```sql
select event_type, count(*) from platform.dead_letter_queue group by 1;
      event_type       | count
-----------------------+-------
 workspace_init_failed |     4
```

Их payload — `{"tenantId": "8a7fd65d-…"}`, без `_routing` и без `event_type`.
Значит `eventType` становится `'unknown'`, запрос уходит на несуществующий вебхук
`/{tenant}/unknown`, n8n отвечает 404, сервис превращает это в 502.

**Повторить такое событие через вебхук нельзя в принципе:** `workspace_init_failed`
— это не входящее сообщение, а внутренний сбой создания рабочего пространства n8n
(тот самый 409, который вы починили в S12 §5). Чинится он повторной инициализацией
тенанта, а не отправкой payload в вебхук.

## Что предлагаю сделать

**1. Развести пути по происхождению события.** У записи DLQ должен быть признак,
как её переигрывать. Варианты: колонка `source` / `replay_kind`, либо решение
по `event_type` через таблицу соответствий. Как минимум:

| Событие | Как переигрывать |
|---|---|
| входящий вебхук (`_routing` заполнен) | как сейчас — POST в `/webhook/{tenant}/{type}` |
| `workspace_init_failed` | повторный вызов инициализации тенанта (`/internal/v1/tenants/:id/activate`) |
| остальное без `_routing` | не переигрывать, вернуть `409 NOT_REPLAYABLE` с пояснением |

**2. Не превращать «нечего переигрывать» в 502.** 502 читается как «сломался
внешний сервис», и админ идёт чинить n8n, хотя n8n здоров. Для заведомо
непереигрываемых событий нужен свой код — например `409 NOT_REPLAYABLE`.

**3. Заодно про `reprocess-all`.** Он вызывает `reprocessEvent` в цикле и молча
складывает неудачи в `failed_ids`. Если событие непереигрываемое, оно будет
попадать туда при каждом запуске — стоит их пропускать явно, а не считать сбоем.

## Как проверить

```bash
# непереигрываемое событие — понятный отказ, а не 502
curl -s -o /dev/null -w '%{http_code}\n' -X POST -H "Cookie: admin_session_id=…" \
  https://admin.corebridge.ru/admin/dlq/<id workspace_init_failed>/reprocess   # ожидаем 409

# вебхучное событие переигрывается как прежде
curl -s -X POST -H "Cookie: admin_session_id=…" \
  https://admin.corebridge.ru/admin/dlq/<id с _routing>/reprocess              # ожидаем 200
```

## Что уже сделано на стороне сайта

- Кнопка «Повторить» заблокирована для `workspace_init_failed` с подсказкой,
  что это внутренний сбой, а не входящее событие. Показывать действие, которое
  гарантированно вернёт ошибку, — обман ожидания.
- Текст отказа сервера теперь выводится как есть, а не заменяется общей фразой
  «не удалось»: причина «webhook not registered» подсказывает, куда смотреть.
- После правки на сервере список `NOT_REPLAYABLE` в
  `app/(admin)/admin/queues/QueuesBody.tsx` нужно будет снять — он временный.
