'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ApiError } from '@/lib/api/client';
import {
  activateWorkflow,
  getDashboard,
  getIntegrations,
  getWorkflowCatalog,
  getWorkflowExecutions,
} from '@/lib/api/lk';
import type { Dashboard, Integration, WorkflowExecution, WorkflowTemplate } from '@/lib/contracts/lk';
import { timeAgo } from '@/components/lk/events';
import { adapterInfo } from '@/lib/adapters';
import { useUser } from '@/lib/user-context';

/**
 * n8n-воркфлоу. **Макета нет вовсе:** в design-source пункт меню «n8n-воркфлоу»
 * ведёт на публичную страницу n8n.html, то есть экран ЛК просто не рисовали.
 * Собран по образцу соседних экранов — те же .chart-card, .icard, .badge,
 * чтобы не выбиваться из системы.
 *
 * Источники: `GET /lk/workflows/catalog`, `GET /lk/workflows/executions`,
 * `POST /lk/workflows/activate`, `GET /lk/integrations`, `GET /lk/dashboard`.
 *
 * Лимит запусков снова берётся из `dashboard.n8n_usage`: сервер (пакет S10) починил
 * его так, что лимит отражает тариф с первого дня. Обход через каталог тарифов снят.
 * Лимит **мягкий** — на 100 % приходит предупреждение, обмен не останавливается.
 */
export function WorkflowsBody() {
  // сервер отвечает 403 на activate для роли «только чтение» — не обещаем зря
  const canEdit = useUser()?.role !== 'user';
  const [catalog, setCatalog] = useState<WorkflowTemplate[] | null>(null);
  const [runs, setRuns] = useState<WorkflowExecution[] | null>(null);
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [bind, setBind] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    Promise.all([
      getWorkflowCatalog(),
      getWorkflowExecutions(),
      getDashboard(),
      getIntegrations(),
    ])
      .then(([c, e, d, i]) => {
        setCatalog(c);
        setRuns(e);
        setDash(d);
        setIntegrations(i.filter((x) => !x.paused));
      })
      .catch(() => setFailed(true));
  }, []);

  const usage = useMemo(() => {
    if (!dash?.n8n_usage) return null;
    const { used, limit, is_limit_hit } = dash.n8n_usage;
    return { used, limit, isHit: is_limit_hit || (limit > 0 && used >= limit) };
  }, [dash]);

  /**
   * Какие интеграции годятся для сценария. `required_integrations` — это
   * **поддерживаемые типы адаптеров** (S12 §3.3), сверяем с `adapter_type`,
   * а не с `integration_id`. Пустой список — подойдёт любая интеграция.
   */
  const fits = (t: WorkflowTemplate) =>
    t.required_integrations?.length
      ? integrations.filter((i) => t.required_integrations!.includes(i.adapter_type))
      : integrations;

  async function activate(t: WorkflowTemplate) {
    const options = fits(t);
    const integrationId = bind[t.template_id] ?? options[0]?.integration_id;
    if (!integrationId) return;

    setBusy(t.template_id);
    setNote(null);
    try {
      await activateWorkflow(t.template_id, integrationId);
      setNote(`Сценарий «${t.name}» включён.`);
      setRuns(await getWorkflowExecutions());
    } catch (e) {
      setNote(activateError(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      {failed && <div className="lk-error">Не удалось загрузить воркфлоу. Обновите страницу.</div>}
      {note && (
        <div className="lk-error" style={{ background: 'var(--blue-100)', color: 'var(--navy-700)' }}>
          {note}
        </div>
      )}

      <div className="page-head">
        <div>
          <h1>n8n-воркфлоу</h1>
          <p className="text-muted">
            Готовые сценарии автоматизации поверх ваших интеграций.{' '}
            <Link href="/n8n">Как это устроено</Link>
          </p>
        </div>
      </div>

      {/* Лимит тарифа: показываем всегда, чтобы включение не упиралось в молчаливый отказ */}
      {usage && usage.limit > 0 && (
        <div className="chart-card mb-20">
          <div className="chart-head" style={{ marginBottom: 12 }}>
            <h3>Запуски в этом месяце</h3>
            <span className="text-muted" style={{ fontSize: 13 }}>
              {usage.used.toLocaleString('ru-RU')} из {usage.limit.toLocaleString('ru-RU')}
            </span>
          </div>
          <div style={{ height: 8, borderRadius: 4, background: 'var(--bg-alt)', overflow: 'hidden' }}>
            <div
              style={{
                width: `${Math.min(100, (usage.used / usage.limit) * 100)}%`,
                height: '100%',
                background: usage.isHit ? 'var(--danger)' : 'var(--blue-500)',
              }}
            />
          </div>
          {usage.isHit && (
            <p className="text-muted" style={{ fontSize: 13, marginBottom: 0, marginTop: 10 }}>
              Лимит запусков по тарифу исчерпан. Сценарии продолжают работать, но лучше
              перейти на тариф выше — иначе к концу месяца упрётесь в него совсем.{' '}
              <Link href="/billing">Сменить тариф</Link>
            </p>
          )}
        </div>
      )}

      <div className="step-head" style={{ marginTop: 0 }}>
        <div className="n">1</div>
        <h3>Готовые сценарии</h3>
      </div>

      {catalog === null ? (
        <div className="lk-empty">Загружаем…</div>
      ) : catalog.length === 0 ? (
        <div className="lk-empty">
          <div className="ttl">Сценариев пока нет</div>
          Каталог готовых воркфлоу ещё не опубликован. Когда шаблоны появятся, их можно будет
          включить одной кнопкой.
        </div>
      ) : (
        <div className="int-cards">
          {catalog.map((t) => {
            const options = fits(t);
            const chosen = bind[t.template_id] ?? options[0]?.integration_id ?? '';
            const blocked = blockReason(canEdit, integrations.length, options.length);

            return (
              <article className="icard" key={t.template_id}>
                <div className="icard-head">
                  <div>
                    <h4>{t.name}</h4>
                    <div className="id">{t.template_id}</div>
                  </div>
                </div>
                {t.description && (
                  <p className="text-muted" style={{ fontSize: 13, margin: 0 }}>
                    {t.description}
                  </p>
                )}
                {t.tags && t.tags.length > 0 && (
                  <div className="row gap-8">
                    {t.tags.map((tag) => (
                      <span className="badge badge-neutral" key={tag}>
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Привязка обязательна: без integration_id сервер отвечает 400 */}
                {options.length > 1 && (
                  <div className="field" style={{ margin: 0 }}>
                    <label htmlFor={`bind-${t.template_id}`}>Интеграция</label>
                    <select
                      id={`bind-${t.template_id}`}
                      className="select"
                      value={chosen}
                      onChange={(ev) => setBind((b) => ({ ...b, [t.template_id]: ev.target.value }))}
                    >
                      {options.map((i) => (
                        <option value={i.integration_id} key={i.integration_id}>
                          {i.display_name || i.integration_id}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="icard-footer">
                  <button
                    className="btn btn-primary btn-sm"
                    style={{ flex: 1 }}
                    disabled={busy === t.template_id || blocked !== null}
                    title={blocked ?? undefined}
                    onClick={() => activate(t)}
                  >
                    {busy === t.template_id ? 'Включаем…' : 'Включить'}
                  </button>
                </div>
                {blocked && (
                  <p className="text-muted" style={{ fontSize: 13, margin: 0 }}>
                    {blocked}
                    {integrations.length === 0 && (
                      <>
                        {' '}
                        <Link href="/my-integrations">Подключить</Link>
                      </>
                    )}
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}

      <div className="step-head">
        <div className="n">2</div>
        <h3>Последние запуски</h3>
      </div>

      <div className="chart-card">
        {runs === null ? (
          <div className="lk-empty">Загружаем…</div>
        ) : runs.length === 0 ? (
          <div className="lk-empty">
            <div className="ttl">Запусков пока не было</div>
            Здесь появится история выполнения сценариев — с результатом и временем.
          </div>
        ) : (
          <div className="events-list">
            {runs.slice(0, 10).map((r) => (
              <div className="event" key={r.execution_id}>
                <div className={`event-dot ${r.status === 'success' ? 'ok' : r.status === 'error' ? 'err' : 'info'}`}>
                  {r.status === 'success' ? '✓' : r.status === 'error' ? '✕' : '…'}
                </div>
                <div>
                  <div className="event-text">{r.workflow_name || r.execution_id}</div>
                  <div className="event-time">
                    {timeAgo(r.started_at)}
                    {r.status === 'error' && ' · завершился ошибкой'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

/** Почему кнопка не сработает — говорим до нажатия, а не после отказа сервера */
function blockReason(canEdit: boolean, total: number, fitting: number): string | null {
  if (!canEdit) return 'Включать сценарии может владелец или менеджер';
  if (total === 0) return 'Сначала подключите интеграцию — сценарий работает поверх неё.';
  if (fitting === 0) return 'Нет подходящей интеграции: сценарий работает с другими сервисами.';
  return null;
}

/**
 * Коды сверены с ответом сервера по пакету S12. `NO_ACTIVE_SUBSCRIPTION` здесь
 * не бывает: тарифной проверки при включении нет. `MISSING_REQUIRED_INTEGRATION`
 * больше не возвращается — его заменили на два точных кода.
 */
function activateError(e: unknown): string {
  if (!(e instanceof ApiError)) return 'Не удалось включить сценарий. Попробуйте позже.';
  if (e.status === 403) return 'Включать сценарии может владелец или менеджер.';
  if (e.code === 'INTEGRATION_NOT_FOUND')
    return 'Выбранной интеграции больше нет — обновите страницу.';
  if (e.code === 'INTEGRATION_TYPE_NOT_SUPPORTED') {
    // сервер присылает, что именно подойдёт — грех не показать
    const supported = Array.isArray(e.details?.supported) ? (e.details.supported as string[]) : [];
    const names = supported.map((c) => adapterInfo(c).name).filter(Boolean);
    return names.length > 0
      ? `Этот сценарий работает с другими сервисами: ${names.join(', ')}.`
      : 'Этот сценарий не работает с выбранной интеграцией.';
  }
  if (e.code === 'TEMPLATE_NOT_FOUND') return 'Сценарий больше не публикуется.';
  if (e.code === 'N8N_CREATE_FAILED')
    return 'n8n сейчас недоступен, сценарий не включён. Попробуйте позже.';
  return 'Не удалось включить сценарий. Попробуйте позже.';
}
