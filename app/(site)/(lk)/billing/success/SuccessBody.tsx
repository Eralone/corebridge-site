'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ApiError } from '@/lib/api/client';
import { getPaymentState, getPayments, getPlans } from '@/lib/api/lk';
import type { PaymentState, PaymentStatus } from '@/lib/contracts/lk';
import { formatAmount, knownStatus, methodLabel, statusHint, statusLabel } from '@/lib/billing/payment';
import { PAYMENT_ID_KEY } from '@/lib/billing/session';

/**
 * Возврат с формы Robokassa.
 *
 * 🔴 **Сам по себе этот возврат ничего не подтверждает.** SuccessURL
 * подделывается тривиально: достаточно открыть адрес руками. Единственный
 * авторитет оплаты — уведомление ResultURL, которое Robokassa шлёт напрямую
 * на API. Поэтому страница не пишет «оплачено» по факту прихода, а спрашивает
 * `GET /lk/billing/:public_id` и показывает то, что ответил сервер (F20 §3).
 *
 * Расписание опроса — оттуда же: первые 30 секунд каждые 2 с, дальше каждые 5 с,
 * стоп через 3 минуты. Уведомление обычно приходит за секунды, но при сбое сети
 * у Robokassa может задержаться, и «крутилка навсегда» — плохой ответ.
 */

const FAST_MS = 2_000;
const SLOW_MS = 5_000;
const FAST_UNTIL_MS = 30_000;
const GIVE_UP_MS = 180_000;

/** Ждать больше нечего: сервер сказал окончательное слово */
const FINAL: PaymentStatus[] = ['paid', 'failed', 'expired', 'refunded', 'mismatch'];

export function SuccessBody() {
  const q = useSearchParams();
  const [state, setState] = useState<PaymentState | null>(null);
  const [missing, setMissing] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  /** Код тарифа → название: в ответе платежа лежит `professional`, а не «Профессионал» */
  const [titles, setTitles] = useState<Record<string, string>>({});
  const startedAt = useRef(Date.now());

  useEffect(() => {
    getPlans()
      .then((r) => setTitles(Object.fromEntries(r.plans.map((p) => [p.code, p.title]))))
      .catch(() => {
        /* название — украшение, код тарифа сам по себе понятен */
      });
  }, []);

  /**
   * Какой платёж показывать. Сначала свой сохранённый идентификатор, затем
   * `?payment_id=` — и только потом последний платёж из истории: человек мог
   * вернуться в другой вкладке или запретить хранилище.
   */
  const resolveId = useCallback(async (): Promise<string | null> => {
    const fromQuery = q.get('payment_id');
    if (fromQuery) return fromQuery;
    try {
      const saved = sessionStorage.getItem(PAYMENT_ID_KEY);
      if (saved) return saved;
    } catch {
      // хранилище недоступно — идём в историю
    }
    const history = await getPayments().catch(() => []);
    return history[0]?.public_id ?? null;
  }, [q]);

  /**
   * Статус платежа.
   *
   * `404 PAYMENT_NOT_FOUND` — платежа нет либо он чужого тенанта; спрашивать
   * дальше нечего, показываем «не найден». Временный обход через историю снят
   * 2026-08-06: эндпоинт выложен, и запасной путь только маскировал бы отказ.
   */
  const fetchState = useCallback(async (id: string): Promise<PaymentState | null> => {
    try {
      return await getPaymentState(id);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        setMissing(true);
        return null;
      }
      throw e;
    }
  }, []);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;

    (async () => {
      const id = await resolveId();
      if (!alive) return;
      if (!id) {
        setMissing(true);
        return;
      }

      const tick = async () => {
        if (!alive) return;
        let next: PaymentState | null = null;
        try {
          next = await fetchState(id);
          // null приходит только на 404: платежа нет, опрашивать нечего
          if (next === null) return;
        } catch {
          // сеть моргнула — не ломаем экран, повторим на следующем круге
        }
        if (!alive) return;

        if (next) {
          setState(next);
          if (FINAL.includes(knownStatus(next.status))) {
            // платёж дошёл до конца — идентификатор больше не нужен
            try {
              sessionStorage.removeItem(PAYMENT_ID_KEY);
            } catch {
              /* не критично */
            }
            return;
          }
        }

        const elapsed = Date.now() - startedAt.current;
        if (elapsed > GIVE_UP_MS) {
          setTimedOut(true);
          return;
        }
        timer = setTimeout(tick, elapsed < FAST_UNTIL_MS ? FAST_MS : SLOW_MS);
      };

      void tick();
    })();

    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [resolveId, fetchState]);

  const status = knownStatus(state?.status);
  const done = state != null && FINAL.includes(status);

  return (
    <div className="pay-result">
      <div className="card">
        {missing ? (
          <>
            <div className="pr-icon neutral">?</div>
            <h2>Платёж не найден</h2>
            <p className="text-muted">
              Мы не нашли платёж, к которому относится этот возврат. Если деньги списаны,
              операция появится в истории — она обновляется автоматически.
            </p>
            <div className="row gap-8" style={{ justifyContent: 'center' }}>
              <Link href="/billing" className="btn btn-primary">
                История платежей
              </Link>
            </div>
          </>
        ) : (
          <>
            <div className={`pr-icon ${iconClass(status, done)}`}>{icon(status, done)}</div>
            <h2>{done ? statusLabel(status) : 'Платёж обрабатывается'}</h2>
            <p className="text-muted">
              {timedOut && !done
                ? 'Обработка занимает больше обычного. Мы не потеряли платёж: как только банк подтвердит его, тариф активируется, а мы напишем на почту.'
                : statusHint(status)}
            </p>

            {state && (
              <dl className="pr-facts">
                <div>
                  <dt>Сумма</dt>
                  <dd>{formatAmount(state.amount)}</dd>
                </div>
                <div>
                  <dt>Тариф</dt>
                  <dd>
                    {titles[state.plan] ?? state.plan}
                    {state.period ? ` · ${state.period === 'yearly' ? 'год' : 'месяц'}` : ''}
                  </dd>
                </div>
                {methodLabel(state.payment_method) && (
                  <div>
                    <dt>Способ оплаты</dt>
                    <dd>{methodLabel(state.payment_method)}</dd>
                  </div>
                )}
                {state.paid_at && (
                  <div>
                    <dt>Оплачен</dt>
                    <dd>{new Date(state.paid_at).toLocaleString('ru-RU')}</dd>
                  </div>
                )}
                {state.failure_reason && (
                  <div>
                    <dt>Причина отказа</dt>
                    <dd>{state.failure_reason}</dd>
                  </div>
                )}
              </dl>
            )}

            {!done && !timedOut && <div className="pr-wait">Проверяем статус…</div>}

            <div className="row gap-8" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
              {status === 'paid' && (
                <Link href="/dashboard" className="btn btn-primary">
                  В кабинет
                </Link>
              )}
              {(status === 'failed' || status === 'expired') && (
                <Link href="/billing/pay" className="btn btn-primary">
                  Попробовать ещё раз
                </Link>
              )}
              {/* ⚠️ при `mismatch` кнопки повторной оплаты нет намеренно: сумма
                  не совпала с выставленной, платёж разбирается руками, и второй
                  платёж только добавит путаницы (F20 §3) */}
              <Link href="/billing" className="btn btn-outline">
                История платежей
              </Link>
            </div>

            {status === 'mismatch' && (
              <p className="text-muted" style={{ fontSize: 12.5, marginBottom: 0 }}>
                Мы уже видим этот платёж и свяжемся с вами. Если хотите ускорить —
                напишите на <a href="mailto:info@corebridge.ru">info@corebridge.ru</a>.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function iconClass(s: PaymentStatus, done: boolean) {
  if (!done) return 'wait';
  if (s === 'paid') return 'ok';
  if (s === 'refunded' || s === 'mismatch') return 'neutral';
  return 'fail';
}

function icon(s: PaymentStatus, done: boolean) {
  if (!done) return '⏳';
  if (s === 'paid') return '✓';
  if (s === 'refunded') return '↺';
  if (s === 'mismatch') return '!';
  return '×';
}
