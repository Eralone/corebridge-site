'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ApiError } from '@/lib/api/client';
import { activateWorkflow, getDashboard, getWorkflowCatalog, getWorkflowExecutions } from '@/lib/api/lk';
import type { Dashboard, WorkflowExecution, WorkflowTemplate } from '@/lib/contracts/lk';
import { timeAgo } from '@/components/lk/events';

/**
 * n8n-воркфлоу. **Макета нет вовсе:** в design-source пункт меню «n8n-воркфлоу»
 * ведёт на публичную страницу n8n.html, то есть экран ЛК просто не рисовали.
 * Собран по образцу соседних экранов — те же .chart-card, .icard, .badge,
 * чтобы не выбиваться из системы.
 *
 * Источники: `GET /lk/workflows/catalog`, `GET /lk/workflows/executions`,
 * `POST /lk/workflows/activate`. Лимит запусков — из `GET /lk/dashboard`
 * (`n8n_usage`), отдельного счётчика операций на сервере пока нет.
 */
export function WorkflowsBody() {
  const [catalog, setCatalog] = useState<WorkflowTemplate[] | null>(null);
  const [runs, setRuns] = useState<WorkflowExecution[] | null>(null);
  const [usage, setUsage] = useState<Dashboard['n8n_usage'] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    Promise.all([getWorkflowCatalog(), getWorkflowExecutions(10), getDashboard()])
      .then(([c, e, d]) => {
        setCatalog(c);
        setRuns(e);
        setUsage(d.n8n_usage);
      })
      .catch(() => setFailed(true));
  }, []);

  const limitHit = usage?.is_limit_hit === true;
  const noPlan = usage != null && usage.limit === 0;

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
      {usage && (
        <div className="chart-card mb-20">
          <div className="chart-head" style={{ marginBottom: 12 }}>
            <h3>Запуски в этом месяце</h3>
            <span className="text-muted" style={{ fontSize: 13 }}>
              {noPlan
                ? 'на пробном тарифе n8n недоступен'
                : `${usage.used.toLocaleString('ru-RU')} из ${usage.limit.toLocaleString('ru-RU')}`}
            </span>
          </div>
          {!noPlan && (
            <div
              style={{
                height: 8,
                borderRadius: 4,
                background: 'var(--bg-alt)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${Math.min(100, usage.limit ? (usage.used / usage.limit) * 100 : 0)}%`,
                  height: '100%',
                  background: limitHit ? 'var(--danger)' : 'var(--blue-500)',
                }}
              />
            </div>
          )}
          {limitHit && (
            <p className="text-muted" style={{ fontSize: 13, marginBottom: 0, marginTop: 10 }}>
              Лимит запусков исчерпан — сценарии не выполняются до следующего месяца.{' '}
              <Link href="/billing">Сменить тариф</Link>
            </p>
          )}
          {noPlan && (
            <p className="text-muted" style={{ fontSize: 13, marginBottom: 0 }}>
              Сценарии n8n входят в платные тарифы. <Link href="/billing">Посмотреть тарифы</Link>
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
          {catalog.map((t) => (
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
              {t.category && (
                <div className="row gap-8">
                  <span className="badge badge-neutral">{t.category}</span>
                </div>
              )}
              <div className="icard-footer">
                <button
                  className="btn btn-primary btn-sm"
                  style={{ flex: 1 }}
                  disabled={busy === t.template_id || noPlan}
                  onClick={async () => {
                    setBusy(t.template_id);
                    setNote(null);
                    try {
                      await activateWorkflow(t.template_id);
                      setNote(`Сценарий «${t.name}» включён.`);
                      setRuns(await getWorkflowExecutions(10));
                    } catch (e) {
                      setNote(
                        e instanceof ApiError && e.code === 'NO_ACTIVE_SUBSCRIPTION'
                          ? 'Сценарии n8n доступны на платных тарифах.'
                          : e instanceof ApiError && e.status === 403
                            ? 'Включать сценарии может владелец или менеджер.'
                            : 'Не удалось включить сценарий. Попробуйте позже.',
                      );
                    } finally {
                      setBusy(null);
                    }
                  }}
                >
                  {busy === t.template_id ? 'Включаем…' : 'Включить'}
                </button>
              </div>
            </article>
          ))}
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
            {runs.map((r) => (
              <div className="event" key={r.execution_id}>
                <div className={`event-dot ${r.status === 'success' ? 'ok' : r.status === 'error' ? 'err' : 'info'}`}>
                  {r.status === 'success' ? '✓' : r.status === 'error' ? '✕' : '…'}
                </div>
                <div>
                  <div className="event-text">{r.workflow_name || r.workflow_id}</div>
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
