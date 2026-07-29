'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ApiError } from '@/lib/api/client';
import { getDashboard, getPayments, getPlans, getProfile, sendContact, startPayment } from '@/lib/api/lk';
import type { Dashboard, Payment, Plan, Profile } from '@/lib/contracts/lk';
import { Popup } from '@/components/Popup';

/**
 * Биллинг и тариф. Отличия от design-source/billing.html:
 *
 * · ⚠️ ссылки **«Чек» и «УПД» убраны**: сервер документов не отдаёт, а УПД
 *   у ИП на УСН и не выдаётся. Убрана и «Скачать все →» по той же причине;
 * · ⚠️ прогресс-бар **«Операций X / Y» показывает только лимит**: фактического
 *   счётчика операций на сервере нет (ждёт промт S10), выдумывать число нельзя;
 * · срок действия: признак бессрочности — `valid_until === null`, а не
 *   `days_left` (на пробном тарифе сервер отдаёт `0` при бессрочной лицензии);
 * · цены, лимиты и промо — только из `GET /lk/plans`, ничего не зашито;
 * · оплата ждёт merchant ID Robokassa: кнопка объясняет состояние, а не ведёт
 *   в ошибку. Заглушка на `payment_url: null` останется и после подключения —
 *   на случай сбоя платёжки;
 * · «Запросить счёт» шлёт реальную заявку через `POST /lk/contact`.
 */

const RUB = (v: number) => `${v.toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ₽`;

export function BillingBody() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [failed, setFailed] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);

  useEffect(() => {
    Promise.all([getDashboard(), getPlans(), getPayments(), getProfile()])
      .then(([d, p, pay, pr]) => {
        setData(d);
        setPlans(p.plans);
        setPayments(pay);
        setProfile(pr);
      })
      .catch(() => setFailed(true));
  }, []);

  const plan = plans?.find((p) => p.code === data?.plan);
  const promoPlan = plans?.find((p) => p.promo);

  async function pay(code: string, promo?: string) {
    setBusy(true);
    setNote(null);
    try {
      const r = await startPayment(code, 'monthly', promo);
      if (r.payment_url) {
        window.location.href = r.payment_url;
        return;
      }
      // payment_url: null — платёжка недоступна. Это состояние нужно и после
      // подключения Robokassa: шлюз может лежать
      setNote('Оплата сейчас недоступна. Мы уже знаем — напишите на info@corebridge.ru, поможем вручную.');
    } catch (e) {
      setNote(
        e instanceof ApiError && e.code === 'CUSTOM_PRICE_PLAN'
          ? 'Этот тариф оформляется по счёту — запросите его кнопкой ниже.'
          : e instanceof ApiError && e.code === 'PROMO_ALREADY_USED'
            ? 'Промо-период уже использован на этом аккаунте.'
            : 'Онлайн-оплата ещё подключается. Пока можем выставить счёт — кнопка «Запросить счёт».',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {failed && <div className="lk-error">Не удалось загрузить данные тарифа. Обновите страницу.</div>}
      {note && (
        <div className="lk-error" style={{ background: 'var(--blue-100)', color: 'var(--navy-700)' }}>
          {note}
        </div>
      )}

      <div className="page-head">
        <div>
          <h1>Биллинг и тариф</h1>
          <p className="text-muted">Тарифный план, лимиты и история платежей</p>
        </div>
        <Link href="/pricing" className="btn btn-primary">
          Сменить тариф
        </Link>
      </div>

      <div className="billing-grid">
        <div>
          {/* ── Текущий тариф ────────────────────────────────────────────── */}
          <div className="card">
            <div className="plan-head">
              <div>
                {plan?.is_trial && <div className="trial-ribbon">Пробный период</div>}
                <div className="plan-name">{plan?.title ?? data?.plan ?? '—'}</div>
                <div className="text-muted" style={{ fontSize: 13, marginTop: 4 }}>
                  {termLine(data)}
                </div>
              </div>
              <div className="text-right">
                <div className="plan-price">{plan ? priceLine(plan) : '—'}</div>
                <div className="text-faint" style={{ fontSize: 12 }}>
                  {plan?.is_trial ? 'пробный доступ' : 'в месяц'}
                </div>
              </div>
            </div>

            <h3>Лимиты тарифа</h3>
            {plan && data && (
              <>
                <Usage label="Интеграций" used={data.integrations_count} limit={plan.limits.projects} />
                <Usage
                  label="Запусков n8n"
                  used={data.n8n_usage.used}
                  limit={plan.limits.n8n_executions_month}
                  className="mt-16"
                />
                {/* ⚠️ Факта по операциям сервер не отдаёт — показываем только лимит */}
                <div className="usage-row mt-16">
                  <span>Операций в месяц</span>
                  <b>до {plan.limits.monthly_operations.toLocaleString('ru-RU')}</b>
                </div>
                <div className="usage-row mt-16">
                  <span>Пользователей</span>
                  <b>до {plan.limits.users_per_company}</b>
                </div>
              </>
            )}

            <div className="row gap-8" style={{ flexWrap: 'wrap', marginTop: 28 }}>
              {promoPlan?.promo && (
                <button
                  className="btn btn-primary"
                  disabled={busy}
                  onClick={() => pay(promoPlan.code, promoPlan.promo!.code)}
                >
                  {promoPlan.promo.cta_label || promoPlan.promo.label}
                </button>
              )}
              <Link href="/pricing" className="btn btn-outline">
                Все тарифы
              </Link>
            </div>
            <p className="text-muted" style={{ fontSize: 12, marginTop: 14, marginBottom: 0 }}>
              {/* про это Дмитрий просил написать прямо */}
              Автопродления нет: когда оплаченный период закончится, доступ просто прекратится —
              деньги повторно не спишутся.
            </p>
          </div>

          {/* ── История платежей ─────────────────────────────────────────── */}
          <div className="card mt-24" style={{ padding: 0 }}>
            <div
              className="row"
              style={{ justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px 16px' }}
            >
              <h3 style={{ margin: 0 }}>История платежей</h3>
              <span className="rk-tag">
                <span className="rk-dot" />
                Robokassa
              </span>
            </div>

            {payments === null ? (
              <div className="lk-empty">Загружаем…</div>
            ) : payments.length === 0 ? (
              <div className="lk-empty">
                <div className="ttl">Платежей ещё не было</div>
                Здесь появятся оплаты с датой, суммой и статусом.
              </div>
            ) : (
              <div className="pay-scroll">
                <table className="pay-history">
                  <thead>
                    <tr>
                      <th style={{ paddingLeft: 24 }}>Дата</th>
                      <th>Описание</th>
                      <th>Сумма</th>
                      <th style={{ paddingRight: 24 }}>Статус</th>
                      {/* колонки «Документы» нет: сервер чеков и УПД не отдаёт */}
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.id}>
                        <td style={{ paddingLeft: 24 }}>
                          {new Date(p.created_at).toLocaleDateString('ru-RU')}
                          <div className="doc">
                            {new Date(p.created_at).toLocaleTimeString('ru-RU', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                        </td>
                        <td>
                          <b>{plans?.find((x) => x.code === p.plan)?.title ?? p.plan}</b>
                          {p.period ? ` · ${p.period}` : ''}
                          {p.promo_code && <div className="doc">промо {p.promo_code}</div>}
                        </td>
                        <td className="amt">{RUB(p.amount)}</td>
                        <td style={{ paddingRight: 24 }}>
                          <span className={`ph-status ${statusClass(p.status)}`}>{statusLabel(p.status)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div
              style={{
                padding: '14px 24px',
                borderTop: '1px solid var(--border)',
                background: 'var(--bg-alt)',
                fontSize: 12,
                color: 'var(--text-muted)',
                borderRadius: '0 0 var(--radius) var(--radius)',
              }}
            >
              Платежи проходят через защищённый шлюз <b>Robokassa</b>. Чек по 54-ФЗ приходит на почту
              от платёжного оператора.
            </div>
          </div>
        </div>

        {/* ── Правая колонка ───────────────────────────────────────────── */}
        <div>
          <div className="card">
            <h3>Способ оплаты</h3>
            <div
              style={{
                display: 'flex',
                gap: 12,
                alignItems: 'center',
                padding: 14,
                background: 'var(--bg-alt)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                marginBottom: 14,
              }}
            >
              <div
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 10,
                  background: 'linear-gradient(135deg,#26A65B,#0E8B47)',
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: 22,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  letterSpacing: '-0.04em',
                }}
              >
                R
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--navy-900)' }}>Robokassa</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Карта · СБП · SberPay · Кошелёк</div>
              </div>
            </div>
            <div className="text-muted" style={{ fontSize: 12, lineHeight: 1.6 }}>
              Форма оплаты открывается в защищённом окне. Привязка карты не требуется — каждый платёж
              подтверждается отдельно.
            </div>

            <div className="mt-20" style={{ paddingTop: 16, borderTop: '1px solid var(--border)' }}>
              <b style={{ fontSize: 14 }}>Оплата по счёту для юрлиц</b>
              <p className="text-muted" style={{ fontSize: 13, margin: '6px 0 10px' }}>
                Выставим счёт на реквизиты вашей компании
              </p>
              <button className="btn btn-outline btn-block btn-sm" onClick={() => setInvoiceOpen(true)}>
                Запросить счёт
              </button>
            </div>
          </div>

          <div className="card mt-24">
            <h3>Реквизиты плательщика</h3>
            <div style={{ fontSize: 13, lineHeight: 1.7 }}>
              <div className="text-muted">Организация</div>
              <div>{profile?.company.company_name || 'Не заполнено'}</div>
              <div className="text-muted mt-8">ИНН</div>
              <div>{profile?.company.company_inn || 'Не заполнено'}</div>
            </div>
            <Link href="/settings" className="btn btn-ghost btn-sm mt-16">
              Заполнить в настройках
            </Link>
          </div>

          {promoPlan?.promo && (
            <div
              className="card mt-24"
              style={{
                background: 'linear-gradient(135deg, var(--navy-900), var(--navy-700))',
                color: '#fff',
                border: 'none',
              }}
            >
              <div style={{ fontSize: 12, opacity: 0.7, letterSpacing: '.08em', textTransform: 'uppercase' }}>
                Популярный выбор
              </div>
              <h3 style={{ color: '#fff', margin: '8px 0 10px' }}>Тариф «{promoPlan.title}»</h3>
              <p style={{ color: '#C9D5F2', fontSize: 13, marginBottom: 16 }}>
                До {promoPlan.limits.projects} интеграций,{' '}
                {promoPlan.limits.monthly_operations.toLocaleString('ru-RU')} операций в месяц
                {promoPlan.features.n8n_ui ? ', прямой доступ к n8n UI' : ''}. {promoPlan.promo.label}.
              </p>
              <button
                className="btn btn-primary btn-block"
                disabled={busy}
                onClick={() => pay(promoPlan.code, promoPlan.promo!.code)}
              >
                {promoPlan.promo.cta_label || 'Подключить'}
              </button>
            </div>
          )}

          <div className="card mt-24">
            <h3 style={{ marginBottom: 10 }}>Документы</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
              <DocLink href="/oferta">Договор-оферта</DocLink>
              <DocLink href="/privacy">Политика конфиденциальности</DocLink>
              <DocLink href="/terms">Условия использования</DocLink>
            </div>
          </div>
        </div>
      </div>

      {invoiceOpen && (
        <InvoiceRequest profile={profile} onClose={() => setInvoiceOpen(false)} onDone={setNote} />
      )}
    </>
  );
}

/**
 * Срок действия тарифа.
 * ⚠️ `days_left` не годится: на пробном сервер отдаёт `0` при бессрочной лицензии.
 */
function termLine(d: Dashboard | null): string {
  if (!d) return '';
  if (d.valid_until === null) return 'Бессрочный доступ — срок не ограничен';
  const date = new Date(d.valid_until * 1000);
  const left = Math.max(0, Math.ceil((date.getTime() - Date.now()) / 86_400_000));
  return `Действует до ${date.toLocaleDateString('ru-RU')} · осталось ${left} дн.`;
}

function priceLine(p: Plan): string {
  if (p.is_custom_price) return 'по запросу';
  if (!p.price.monthly) return '0 ₽';
  return `${p.price.monthly.toLocaleString('ru-RU')} ₽`;
}

function statusClass(s: string) {
  return s === 'confirmed' ? 'ok' : s === 'pending' ? 'pending' : 'fail';
}
function statusLabel(s: string) {
  return s === 'confirmed' ? 'Оплачено' : s === 'pending' ? 'В обработке' : 'Не прошёл';
}

function Usage({
  label,
  used,
  limit,
  className,
}: {
  label: string;
  used: number;
  limit: number;
  className?: string;
}) {
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  return (
    <>
      <div className={`usage-row ${className ?? ''}`}>
        <span>{label}</span>
        <b>
          {used.toLocaleString('ru-RU')} / {limit.toLocaleString('ru-RU')}
        </b>
      </div>
      <div className="usage-bar">
        <span style={{ width: `${pct}%` }} />
      </div>
    </>
  );
}

function DocLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      target="_blank"
      style={{
        color: 'var(--text)',
        textDecoration: 'none',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 10px',
        border: '1px solid var(--border)',
        borderRadius: 8,
      }}
    >
      {children}
      <span className="text-faint">↗</span>
    </Link>
  );
}

/** Запрос счёта. В макете это была заглушка-попап, здесь настоящая заявка */
function InvoiceRequest({
  profile,
  onClose,
  onDone,
}: {
  profile: Profile | null;
  onClose: () => void;
  onDone: (s: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [company, setCompany] = useState(profile?.company.company_name ?? '');
  const [inn, setInn] = useState(profile?.company.company_inn ?? '');

  return (
    <Popup open title="Счёт для юрлица" onClose={onClose} actions={[]}>
      <p className="text-muted" style={{ fontSize: 13.5, marginTop: 0 }}>
        Заявка уйдёт на info@corebridge.ru. Счёт и договор вышлем на {profile?.user.email ?? 'вашу почту'}.
      </p>
      {error && <div className="lk-error">{error}</div>}
      <div className="field">
        <label htmlFor="inv-company">Организация</label>
        <input id="inv-company" className="input" value={company} onChange={(e) => setCompany(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="inv-inn">ИНН</label>
        <input id="inv-inn" className="input" value={inn} onChange={(e) => setInn(e.target.value)} />
      </div>
      <div className="row gap-8" style={{ justifyContent: 'flex-end', marginTop: 20 }}>
        <button className="btn btn-outline" onClick={onClose} disabled={busy}>
          Отмена
        </button>
        <button
          className="btn btn-primary"
          disabled={busy || !company || !inn}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              const r = await sendContact({
                name: profile?.user.name || profile?.user.email || 'Клиент',
                email: profile?.user.email ?? '',
                message: `Запрос счёта для юрлица. Организация: ${company}. ИНН: ${inn}.`,
                source: 'billing',
              });
              onDone(`Заявка принята, номер ${r.ref}. Счёт вышлем в течение рабочего дня.`);
              onClose();
            } catch {
              setError('Не удалось отправить заявку. Напишите на info@corebridge.ru.');
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? 'Отправляем…' : 'Отправить запрос'}
        </button>
      </div>
    </Popup>
  );
}
