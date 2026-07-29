'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '@/lib/api/client';
import { getPrivacyRequests, updatePrivacyRequest } from '@/lib/api/admin';
import type { AdminPrivacyRequest } from '@/lib/contracts/admin';
import { Blocked, TenantStatus, ts } from '@/components/admin/bits';

/**
 * Обращения по персональным данным: выгрузка данных и удаление аккаунта.
 * **Макета нет** — собрано по образцу `admin-users.html`.
 *
 * Что здесь важно понимать сотруднику и что вынесено в подписи на экране:
 *
 * · **выгрузка и удаление запускаются не отсюда.** `POST /admin/tenants/:id/export`
 *   и `/delete` — отдельные действия над тенантом; здесь ведётся сама очередь
 *   обращений и её статусы. Смешивать их в одну кнопку опасно: удаление тенанта
 *   необратимо через 30 дней, а обращение — просто заявка;
 * · **удаление двухфазное**: заявка → `pending_deletion` и `purge_at = +30 дней`
 *   → автоматическая чистка по расписанию. До `purge_at` отменяется.
 */
export function PrivacyBody() {
  const [rows, setRows] = useState<AdminPrivacyRequest[] | null>(null);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [failed, setFailed] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdminPrivacyRequest | null>(null);

  const load = useCallback(() => {
    setFailed(false);
    getPrivacyRequests({ status: status || undefined, type: type || undefined, limit: 100 })
      .then((r) => {
        setRows(r.requests);
        setTotal(r.count);
      })
      .catch(() => setFailed(true));
  }, [status, type]);

  useEffect(load, [load]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Обращения по персональным данным</h1>
          <p className="text-muted">
            Запросы на выгрузку и удаление. Закон отводит на ответ 30 дней — срок считается
            от даты обращения.
          </p>
        </div>
      </div>

      {note && (
        <div className="lk-error" style={{ background: 'var(--blue-100)', color: 'var(--navy-700)' }}>
          {note}
        </div>
      )}
      {failed && <Blocked what="очередь обращений" endpoint="GET /admin/privacy/requests" />}

      <div className="filter-bar">
        <div className="chip-set">
          {[
            ['', 'Все'],
            ['received', 'Новые'],
            ['in_progress', 'В работе'],
            ['done', 'Закрытые'],
            ['rejected', 'Отклонённые'],
          ].map(([code, label]) => (
            <button
              key={code}
              type="button"
              className={`chip${status === code ? ' active' : ''}`}
              onClick={() => setStatus(code)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="chip-set">
          {[
            ['', 'Любой тип'],
            ['export', 'Выгрузка'],
            ['deletion', 'Удаление'],
          ].map(([code, label]) => (
            <button
              key={code}
              type="button"
              className={`chip${type === code ? ' active' : ''}`}
              onClick={() => setType(code)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Номер</th>
              <th>Тип</th>
              <th>От кого</th>
              <th>Поступило</th>
              <th>Состояние</th>
              <th style={{ textAlign: 'right' }}>Действие</th>
            </tr>
          </thead>
          <tbody>
            {rows === null ? (
              <tr>
                <td colSpan={6}>Загружаем…</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6}>Обращений нет</td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{r.ref}</td>
                  <td>
                    <span className={`badge ${r.type === 'deletion' ? 'badge-danger' : 'badge-neutral'}`}>
                      {r.type === 'deletion' ? 'удаление' : 'выгрузка'}
                    </span>
                  </td>
                  <td className="email-cell">
                    <span className="ml">{r.user_email ?? '—'}</span>
                    <span className="id">{r.company_name ?? r.tenant_id}</span>
                  </td>
                  <td>
                    {ts(r.created_at)}
                    <div style={{ fontSize: 11, color: deadlineColor(r) }}>{deadline(r)}</div>
                  </td>
                  <td>
                    <span className={`badge ${stClass(r.status)}`}>{stLabel(r.status)}</span>
                    {r.tenant_status && r.tenant_status !== 'active' && (
                      <div style={{ marginTop: 4 }}>
                        <TenantStatus status={r.tenant_status} />
                      </div>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn btn-outline btn-sm" onClick={() => setEditing(r)}>
                      Открыть
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {rows && rows.length > 0 && (
        <div className="pager">
          <div className="text-muted" style={{ fontSize: 13 }}>
            Всего обращений: {total}
          </div>
        </div>
      )}

      {editing && (
        <RequestSheet
          request={editing}
          onClose={() => setEditing(null)}
          onDone={(msg) => {
            setNote(msg);
            setEditing(null);
            load();
          }}
        />
      )}
    </>
  );
}

function RequestSheet({
  request,
  onClose,
  onDone,
}: {
  request: AdminPrivacyRequest;
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const [status, setStatus] = useState(request.status);
  const [comment, setComment] = useState(request.admin_comment ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await updatePrivacyRequest(request.id, { status, admin_comment: comment.trim() || undefined });
      onDone(`Обращение ${request.ref}: состояние изменено на «${stLabel(status)}».`);
    } catch (e) {
      setError(
        e instanceof ApiError && e.code === 'INVALID_STATUS'
          ? 'Такого состояния нет.'
          : 'Не удалось сохранить.',
      );
      setBusy(false);
    }
  }

  return (
    <>
      <div className="sheet-overlay open" onClick={onClose} />
      <aside className="sheet open" aria-label="Обращение">
        <div className="sheet-head">
          <div>
            <h3>Обращение {request.ref}</h3>
            <div style={{ fontSize: 11, color: 'var(--text-faint)', fontFamily: 'var(--mono)' }}>
              {request.tenant_id}
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Закрыть">
            ✕
          </button>
        </div>
        <div className="sheet-body">
          <div className="sheet-section">
            <h5>Суть обращения</h5>
            <div className="kv-row">
              <span className="k">Тип</span>
              <span className="v">{request.type === 'deletion' ? 'удаление аккаунта' : 'выгрузка данных'}</span>
            </div>
            <div className="kv-row">
              <span className="k">От кого</span>
              <span className="v">{request.user_email ?? '—'}</span>
            </div>
            <div className="kv-row">
              <span className="k">Компания</span>
              <span className="v">{request.company_name ?? '—'}</span>
            </div>
            <div className="kv-row">
              <span className="k">Поступило</span>
              <span className="v">{ts(request.created_at)}</span>
            </div>
            <div className="kv-row">
              <span className="k">Ответить до</span>
              <span className="v" style={{ color: deadlineColor(request) }}>{deadline(request)}</span>
            </div>
            {request.comment && (
              <p className="text-muted" style={{ fontSize: 13, marginTop: 10 }}>
                «{request.comment}»
              </p>
            )}
          </div>

          {request.type === 'deletion' && (
            <div className="sheet-section">
              <h5>Как выполняется удаление</h5>
              <p className="text-muted" style={{ fontSize: 13, margin: 0, lineHeight: 1.6 }}>
                Запускается отдельным действием над тенантом, не из этой карточки. Аккаунт
                помечается на удаление, доступ закрывается сразу, данные вычищаются через
                30 дней по расписанию. До этого срока удаление отменяется. Платежи
                и журнал остаются: они хранятся по закону, а не по нашему решению.
              </p>
            </div>
          )}

          <div className="sheet-section">
            <h5>Обработка</h5>
            {error && <div className="lk-error">{error}</div>}
            <div className="field">
              <label htmlFor="pr-status">Состояние</label>
              <select
                id="pr-status"
                className="select"
                value={status}
                onChange={(e) => setStatus(e.target.value as AdminPrivacyRequest['status'])}
              >
                <option value="received">Новое</option>
                <option value="in_progress">В работе</option>
                <option value="done">Закрыто</option>
                <option value="rejected">Отклонено</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="pr-comment">Комментарий</label>
              <textarea
                id="pr-comment"
                className="textarea"
                rows={4}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Что сделано по обращению"
              />
              <span className="hint">Останется в карточке обращения и в журнале.</span>
            </div>
            <button className="btn btn-primary btn-sm" disabled={busy} onClick={save}>
              {busy ? 'Сохраняем…' : 'Сохранить'}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

/** 30 дней на ответ — срок из закона, считаем от даты обращения */
function daysLeft(r: AdminPrivacyRequest): number {
  const due = new Date(r.created_at).getTime() + 30 * 86_400_000;
  return Math.ceil((due - Date.now()) / 86_400_000);
}

function deadline(r: AdminPrivacyRequest): string {
  if (r.resolved_at) return `закрыто ${ts(r.resolved_at)}`;
  const d = daysLeft(r);
  if (d < 0) return `просрочено на ${Math.abs(d)} дн.`;
  return `осталось ${d} дн.`;
}

function deadlineColor(r: AdminPrivacyRequest): string {
  if (r.resolved_at) return 'var(--text-faint)';
  const d = daysLeft(r);
  if (d < 0) return 'var(--danger)';
  if (d <= 5) return 'var(--warning)';
  return 'var(--text-faint)';
}

function stClass(s: string) {
  if (s === 'done') return 'badge-success';
  if (s === 'in_progress') return 'badge-info';
  if (s === 'rejected') return 'badge-neutral';
  return 'badge-warning';
}
function stLabel(s: string) {
  if (s === 'done') return 'закрыто';
  if (s === 'in_progress') return 'в работе';
  if (s === 'rejected') return 'отклонено';
  if (s === 'received') return 'новое';
  return s;
}
