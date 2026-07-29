'use client';

import { useCallback, useEffect, useState } from 'react';
import { getAdminPayments, getAdminStats } from '@/lib/api/admin';
import type { AdminPayment, AdminStats } from '@/lib/contracts/admin';
import { Blocked, planTitle, shortId, ts } from '@/components/admin/bits';

const PER_PAGE = 50;

/**
 * Платежи. **Макета нет** — экран собран по образцу `admin-users.html`:
 * та же сетка, `.ustat`, `.filter-bar`, `.table`, `.pager`.
 *
 * Возврат платежа (`POST /admin/payments/:id/refund`) на экран не выведен
 * сознательно: он дёргает внешнюю платёжку, а Robokassa ещё не подключена —
 * кнопка гарантированно вела бы в ошибку. Появится вместе с боевым merchant ID.
 */
export function PaymentsBody() {
  const [rows, setRows] = useState<AdminPayment[] | null>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    getAdminPayments({
      status: status || undefined,
      limit: PER_PAGE,
      offset: (page - 1) * PER_PAGE,
    })
      .then((r) => setRows(r.payments))
      .catch(() => setFailed(true));
  }, [status, page]);

  useEffect(load, [load]);
  useEffect(() => {
    getAdminStats().then(setStats).catch(() => undefined);
  }, []);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Платежи</h1>
          <p className="text-muted">
            Оплаты через Robokassa. Возвраты и чеки — на стороне платёжного оператора.
          </p>
        </div>
      </div>

      {failed && <Blocked what="история платежей" endpoint="GET /admin/payments" />}

      <div className="user-stats">
        <div className="ustat">
          <div className="lb">Выручка за месяц</div>
          <div className="vl">{stats ? rub(stats.revenue.month_confirmed) : '—'}</div>
        </div>
        <div className="ustat">
          <div className="lb">Выручка за год</div>
          <div className="vl">{stats ? rub(stats.revenue.year_confirmed) : '—'}</div>
        </div>
        <div className="ustat">
          <div className="lb">Показано платежей</div>
          <div className="vl">{rows ? rows.length : '—'}</div>
        </div>
        <div className="ustat">
          <div className="lb">В обработке</div>
          <div className="vl" style={{ color: 'var(--warning)' }}>
            {rows ? rows.filter((p) => p.status === 'pending').length : '—'}
          </div>
        </div>
      </div>

      <div className="filter-bar">
        <div className="chip-set">
          {[
            ['', 'Все'],
            ['confirmed', 'Оплаченные'],
            ['pending', 'В обработке'],
            ['failed', 'Не прошли'],
            ['refunded', 'Возвраты'],
          ].map(([code, label]) => (
            <button
              key={code}
              type="button"
              className={`chip${status === code ? ' active' : ''}`}
              onClick={() => {
                setPage(1);
                setStatus(code);
              }}
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
              <th>Клиент</th>
              <th>Тариф</th>
              <th>Сумма</th>
              <th>Создан</th>
              <th>Подтверждён</th>
              <th>Статус</th>
            </tr>
          </thead>
          <tbody>
            {rows === null ? (
              <tr>
                <td colSpan={6}>Загружаем…</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  {status ? 'Таких платежей нет' : 'Платежей ещё не было — Robokassa пока не подключена'}
                </td>
              </tr>
            ) : (
              rows.map((p) => (
                <tr key={p.id}>
                  <td className="email-cell">
                    <span className="ml">{p.tenant_email ?? p.company_name ?? '—'}</span>
                    <span className="id">{p.robokassa_inv_id ?? shortId(p.id)}</span>
                  </td>
                  <td>
                    <span className="badge badge-neutral">{planTitle(p.plan)}</span>
                    {p.period && <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>{p.period}</div>}
                  </td>
                  <td>
                    <b>{rub(p.amount)}</b>
                  </td>
                  <td>{ts(p.created_at)}</td>
                  <td>{p.confirmed_at ? ts(p.confirmed_at) : '—'}</td>
                  <td>
                    <span className={`badge ${payClass(p.status)}`}>{payLabel(p.status)}</span>
                    {p.status === 'confirmed' && p.plan_activated === false && (
                      /* платёж прошёл, а лицензия не перевыпустилась — это надо видеть */
                      <div style={{ fontSize: 11, color: 'var(--danger)' }}>тариф не активирован</div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="pager">
        <div className="text-muted" style={{ fontSize: 13 }}>
          Страница {page} · по {PER_PAGE} на страницу
        </div>
        <div className="pg">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>‹</button>
          <button className="cur">{page}</button>
          <button disabled={!rows || rows.length < PER_PAGE} onClick={() => setPage((p) => p + 1)}>›</button>
        </div>
      </div>
    </>
  );
}

const rub = (v: number) => `${Number(v).toLocaleString('ru-RU')} ₽`;

function payClass(s: string) {
  if (s === 'confirmed') return 'badge-success';
  if (s === 'pending') return 'badge-warning';
  if (s === 'refunded') return 'badge-neutral';
  return 'badge-danger';
}
function payLabel(s: string) {
  if (s === 'confirmed') return 'оплачен';
  if (s === 'pending') return 'в обработке';
  if (s === 'refunded') return 'возврат';
  if (s === 'failed') return 'не прошёл';
  return s;
}
