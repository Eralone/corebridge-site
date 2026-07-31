'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '@/lib/api/client';
import { deleteDlq, getAdminDlq, getQueueStats, reprocessDlq } from '@/lib/api/admin';
import type { AdminDlqEntry } from '@/lib/contracts/admin';
import { Blocked, ts } from '@/components/admin/bits';

type Stats = Awaited<ReturnType<typeof getQueueStats>>;

/**
 * Очереди событий и «мёртвые» события (DLQ). **Макета нет** — собрано по образцу
 * `admin-users.html`.
 *
 * Сводку по очередям сервер починил пакетом S13, переигрывание — пакетом S14.
 *
 * Переигрывание разведено по происхождению события, и сайту не нужно знать
 * список неповторяемых типов: сервер отвечает `409 NOT_REPLAYABLE` с машинным
 * кодом, если переигрывать нечем. Временный список `workspace_init_failed`
 * на нашей стороне снят — он был обходом на время, пока сервер отвечал 502
 * и «нельзя» нельзя было отличить от «сломалось».
 *
 * ⚠️ Удаление из очереди до S14 тоже не работало (писало в несуществующие
 * колонки), хотя по виду листинга казалось рабочим. Теперь запись удаляется,
 * а след остаётся в журнале.
 */
export function QueuesBody() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [statsFailed, setStatsFailed] = useState(false);
  const [rows, setRows] = useState<AdminDlqEntry[] | null>(null);
  const [dlqFailed, setDlqFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [open, setOpen] = useState<AdminDlqEntry | null>(null);

  const load = useCallback(() => {
    setDlqFailed(false);
    getAdminDlq({ limit: 100 })
      .then((r) => setRows(r.events))
      .catch(() => setDlqFailed(true));
  }, []);

  useEffect(() => {
    load();
    getQueueStats().then(setStats).catch(() => setStatsFailed(true));
  }, [load]);

  async function retry(e: AdminDlqEntry) {
    setBusy(e.id);
    setNote(null);
    try {
      const r = await reprocessDlq(e.id);
      // сервер сообщает, каким способом переиграл: это разные вещи для админа
      setNote(
        r.replay === 'tenant_init'
          ? 'Рабочее пространство тенанта переинициализировано.'
          : 'Событие доставлено заново.',
      );
      load();
    } catch (err) {
      /**
       * `NOT_REPLAYABLE` — это не сбой, а свойство события: переигрывать нечем.
       * Раньше сервер отвечал на такое 502, и админ шёл чинить здоровый n8n.
       * Остальные отказы показываем текстом сервера — он подсказывает, куда смотреть.
       */
      if (err instanceof ApiError && err.details?.code === 'NOT_REPLAYABLE') {
        setNote(
          'Это событие переиграть нечем: у него нет ни маршрута доставки, ни известного способа повтора. Разбирать по тексту ошибки.',
        );
      } else {
        const why = err instanceof ApiError && typeof err.details?.error === 'string'
          ? String(err.details.error).slice(0, 160)
          : null;
        setNote(why ? `Переобработка не прошла: ${why}` : 'Не удалось отправить событие заново.');
      }
    } finally {
      setBusy(null);
    }
  }

  async function drop(e: AdminDlqEntry) {
    setBusy(e.id);
    setNote(null);
    try {
      await deleteDlq(e.id);
      setNote('Событие удалено из очереди.');
      setOpen(null);
      load();
    } catch {
      setNote('Не удалось удалить событие.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Очереди</h1>
          <p className="text-muted">
            События, которые не удалось обработать после всех повторов. Отсюда их можно
            запустить заново или убрать.
          </p>
        </div>
      </div>

      {note && (
        <div className="lk-error" style={{ background: 'var(--blue-100)', color: 'var(--navy-700)' }}>
          {note}
        </div>
      )}
      {statsFailed && <Blocked what="сводка по очередям" endpoint="GET /admin/queues/stats" />}
      {dlqFailed && <Blocked what="список необработанных событий" endpoint="GET /admin/dlq" />}

      <div className="user-stats">
        <div className="ustat">
          <div className="lb">Ждут обработки</div>
          <div className="vl">{stats ? stats.total_pending : '—'}</div>
        </div>
        <div className="ustat danger">
          <div className="lb">В очереди ошибок</div>
          <div className="vl">{rows ? rows.length : stats ? stats.total_dlq : '—'}</div>
        </div>
        <div className="ustat">
          <div className="lb">Тенантов застряло</div>
          <div className="vl" style={{ color: 'var(--warning)' }}>
            {stats ? stats.stuck_tenants_count : '—'}
          </div>
        </div>
        <div className="ustat">
          <div className="lb">Тенантов в сводке</div>
          <div className="vl">{stats ? stats.tenants.length : '—'}</div>
        </div>
      </div>

      {stats && stats.tenants.length > 0 && (
        <div className="adm-table-card mb-24">
          <div className="h">
            <h3>По тенантам</h3>
          </div>
          <div className="adm-scroll">
            <table className="table compact">
              <thead>
                <tr>
                  <th>Тенант</th>
                  <th>Ждут</th>
                  <th>В ошибках</th>
                  <th>Самое старое</th>
                  <th>Состояние</th>
                </tr>
              </thead>
              <tbody>
                {stats.tenants.map((t) => (
                  <tr key={t.tenant_id}>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{t.tenant_id}</td>
                    <td>{t.pending_count}</td>
                    <td>{t.dlq_count}</td>
                    <td>{t.oldest_event_at ? ts(t.oldest_event_at) : '—'}</td>
                    <td>
                      {t.is_stuck ? (
                        <span className="badge badge-danger">
                          застряло на {Math.round(t.stuck_since_minutes / 60)} ч
                        </span>
                      ) : (
                        <span className="badge badge-success">в норме</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="adm-table-card">
        <div className="h">
          <h3>Необработанные события</h3>
          <button className="btn btn-outline btn-sm" onClick={load}>
            Обновить
          </button>
        </div>
        {rows === null ? (
          <div className="adm-empty">Загружаем…</div>
        ) : rows.length === 0 ? (
          <div className="adm-empty">
            <div className="ttl">Очередь пуста</div>
            Все события обработались — вмешательства не требуется.
          </div>
        ) : (
          <div className="adm-scroll">
            <table className="table compact">
              <thead>
                <tr>
                  <th>Событие</th>
                  <th>Тенант</th>
                  <th>Ошибка</th>
                  <th>Попыток</th>
                  <th>Когда</th>
                  <th style={{ textAlign: 'right' }}>Действия</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <b>{e.event_type ?? '—'}</b>
                      {e.adapter && (
                        <div style={{ fontSize: 11, color: 'var(--text-faint)', fontFamily: 'var(--mono)' }}>
                          {e.adapter}
                        </div>
                      )}
                    </td>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>{e.tenant_id ?? '—'}</td>
                    <td style={{ maxWidth: 320 }}>
                      <span style={{ color: 'var(--danger)', fontSize: 12 }}>{e.error ?? '—'}</span>
                    </td>
                    <td>{e.retry_count ?? 0}</td>
                    <td>{ts(e.created_at)}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button
                        className="btn btn-outline btn-sm"
                        disabled={busy === e.id}
                        onClick={() => retry(e)}
                      >
                        Повторить
                      </button>{' '}
                      <button className="btn btn-ghost btn-sm" onClick={() => setOpen(e)}>
                        Подробнее
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {open && (
        <>
          <div className="sheet-overlay open" onClick={() => setOpen(null)} />
          <aside className="sheet open" aria-label="Событие">
            <div className="sheet-head">
              <div>
                <h3>{open.event_type ?? 'Событие'}</h3>
                <div style={{ fontSize: 11, color: 'var(--text-faint)', fontFamily: 'var(--mono)' }}>{open.id}</div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setOpen(null)} aria-label="Закрыть">
                ✕
              </button>
            </div>
            <div className="sheet-body">
              <div className="sheet-section">
                <h5>Что произошло</h5>
                <div className="kv-row">
                  <span className="k">Тенант</span>
                  <span className="v" style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>
                    {open.tenant_id ?? '—'}
                  </span>
                </div>
                <div className="kv-row">
                  <span className="k">Попыток</span>
                  <span className="v">{open.retry_count ?? 0}</span>
                </div>
                <div className="kv-row">
                  <span className="k">Когда</span>
                  <span className="v">{ts(open.created_at)}</span>
                </div>
                <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 0 }}>{open.error ?? '—'}</p>
              </div>
              <div className="sheet-section">
                <h5>Содержимое</h5>
                <textarea
                  className="textarea"
                  style={{ fontFamily: 'var(--mono)', fontSize: 11, background: 'var(--bg-tinted)' }}
                  rows={12}
                  readOnly
                  value={JSON.stringify(open.payload ?? {}, null, 2)}
                />
              </div>
              <div className="row gap-12" style={{ marginTop: 20 }}>
                <button
                  className="btn btn-primary btn-sm"
                  disabled={busy === open.id}
                  onClick={() => retry(open)}
                >
                  Повторить
                </button>
                <button
                  className="btn btn-danger-outline btn-sm"
                  style={{ marginLeft: 'auto' }}
                  disabled={busy === open.id}
                  onClick={() => drop(open)}
                >
                  Удалить из очереди
                </button>
              </div>
            </div>
          </aside>
        </>
      )}
    </>
  );
}
