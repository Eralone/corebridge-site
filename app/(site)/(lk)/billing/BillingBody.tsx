'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ApiError } from '@/lib/api/client';
import { getDashboard, getPayments, getPlans, getProfile } from '@/lib/api/lk';
import type { Dashboard, Payment, Plan, Profile } from '@/lib/contracts/lk';
import type { BillingFlags } from '@/lib/billing/flags';
import {
  PERIOD_LABEL,
  formatAmount,
  knownStatus,
  methodLabel,
  statusClass,
  statusLabel,
} from '@/lib/billing/payment';
import { isCompanyPayer, payerCompanyName } from '@/lib/billing/payer';
import { InvoiceRequest } from '@/components/billing/InvoiceRequest';

/**
 * Биллинг и тариф. Отличия от design-source/billing.html:
 *
 * · ⚠️ ссылки **«Чек» и «УПД» убраны**: сервер документов не отдаёт, а УПД
 *   у ИП на УСН и не выдаётся. Убрана и «Скачать все →» по той же причине;
 * · прогресс-бар «Операций X / Y» показывает факт с 2026-07-29: сервер завёл
 *   счётчик по промту S10. Операция — событие, доставленное в сценарии; ретраи
 *   и недоехавшее не считаются. Лимит **мягкий**, обмен на нём не встаёт;
 * · срок действия: признак бессрочности — `valid_until === null`, а не
 *   `days_left` (на пробном тарифе сервер отдаёт `0` при бессрочной лицензии);
 * · цены, лимиты и промо — только из `GET /lk/plans`, ничего не зашито;
 * · «Запросить счёт» шлёт реальную заявку через `POST /lk/contact`.
 *
 * Оплата отсюда не начинается: кнопки ведут на `/billing/pay`, где живёт
 * единственный вызов `POST /lk/billing/pay`. Пока флаг `BILLING_PAY_ENABLED`
 * не снят, их не видно — ждём живого тестового платежа владельца
 * (см. `lib/billing/flags.ts`).
 */
export function BillingBody({ flags }: { flags: BillingFlags }) {
  const [data, setData] = useState<Dashboard | null>(null);
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [failed, setFailed] = useState(false);
  const [paymentsError, setPaymentsError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [invoiceOpen, setInvoiceOpen] = useState(false);

  useEffect(() => {
    Promise.all([getDashboard(), getPlans(), getProfile()])
      .then(([d, p, pr]) => {
        setData(d);
        setPlans(p.plans);
        setProfile(pr);
      })
      .catch(() => setFailed(true));

    /**
     * ⚠️ История платежей — только для владельца, остальным ролям сервер
     * отвечает `403 FORBIDDEN`. В общем `Promise.all` этот отказ ронял всю
     * загрузку, и менеджер видел «не удалось загрузить данные тарифа» вместо
     * своего тарифа и лимитов, которые ему как раз доступны.
     */
    getPayments()
      .then(setPayments)
      .catch((e) =>
        setPaymentsError(
          e instanceof ApiError && e.status === 403
            ? 'История платежей видна только владельцу аккаунта.'
            : 'Не удалось загрузить историю платежей. Обновите страницу.',
        ),
      );
  }, []);

  /** Плательщик-компания — по заполненному ИНН (см. lib/billing/payer.ts) */
  const company = isCompanyPayer(profile);
  const companyName = payerCompanyName(profile);

  const plan = plans?.find((p) => p.code === data?.plan);
  const promoPlan = plans?.find((p) => p.promo);

  /**
   * Промо предлагаем, только если человеку есть что от него получить.
   * ⚠️ Найдено прогоном 2026-07-29: на тарифе «Профессионал» страница звала
   * «Попробовать» тот же самый «Профессионал» — и в карточке тарифа, и в баннере.
   * У промо `once_per_tenant`, так что оплата ещё и упёрлась бы в `PROMO_ALREADY_USED`.
   * Тому, кто уже на промо-тарифе, нужно продление, а не «попробовать».
   */
  const onPromoPlan = promoPlan != null && data?.plan === promoPlan.code;
  const showPromo = promoPlan?.promo != null && !onPromoPlan && !plan?.is_custom_price;
  /** Продление доступно на платном тарифе: у пробного срока нет, энтерпрайз — по счёту */
  const canRenew = plan != null && !plan.is_trial && !plan.is_custom_price;

  /** Адрес оформления: тариф и промо передаём параметрами, форму заполняет /billing/pay */
  const checkout = (code: string, promo?: string) =>
    `/billing/pay?plan=${encodeURIComponent(code)}&period=monthly${
      promo ? `&promo=${encodeURIComponent(promo)}` : ''
    }`;

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
                  limit={data.n8n_usage.limit || plan.limits.n8n_executions_month}
                  className="mt-16"
                />
                <Usage
                  label="Операций в месяц"
                  used={data.operations_usage?.used ?? 0}
                  limit={data.operations_usage?.limit ?? plan.limits.monthly_operations}
                  className="mt-16"
                />
                <div className="usage-row mt-16">
                  <span>Пользователей</span>
                  <b>до {plan.limits.users_per_company}</b>
                </div>
              </>
            )}

            {/* сервер уведомляет на 80 % и 100 %, но обмен не останавливает (S10 §1.4) */}
            <p className="text-muted" style={{ fontSize: 12, margin: '14px 0 0' }}>
              Лимиты мягкие: при их достижении мы предупредим, но обмен не остановим.
              Операция — это событие, доставленное в ваши сценарии; повторные попытки
              не считаются.
            </p>

            <div className="row gap-8" style={{ flexWrap: 'wrap', marginTop: 28 }}>
              {/* Кнопки оплаты появляются со снятием флага (F20 §6). Экран
                  оформления собран и работает и сейчас — см. /billing/pay. */}
              {flags.pay && showPromo && promoPlan?.promo ? (
                <Link href={checkout(promoPlan.code, promoPlan.promo.code)} className="btn btn-primary">
                  {promoPlan.promo.cta_label || promoPlan.promo.label}
                </Link>
              ) : flags.pay && canRenew ? (
                <Link href={checkout(plan!.code)} className="btn btn-primary">
                  Продлить на месяц
                </Link>
              ) : null}
              <Link href="/pricing" className="btn btn-outline">
                Все тарифы
              </Link>
              {!flags.pay && (
                <button className="btn btn-outline" onClick={() => setInvoiceOpen(true)}>
                  Запросить счёт
                </button>
              )}
            </div>
            <p className="text-muted" style={{ fontSize: 12, marginTop: 14, marginBottom: 0 }}>
              {/* про это Дмитрий просил написать прямо */}
              {flags.pay
                ? 'Автопродления нет: когда оплаченный период закончится, доступ просто прекратится — деньги повторно не спишутся. Мы предупредим письмом за 7, 3 и 1 день.'
                : 'Онлайн-оплата ещё подключается. Пока оформляем по счёту — заявка уходит на info@corebridge.ru, счёт выставим в течение рабочего дня.'}
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

            {paymentsError ? (
              <div className="lk-empty">
                <div className="ttl">История недоступна</div>
                {paymentsError}
              </div>
            ) : payments === null ? (
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
                      <th>Способ</th>
                      <th>Сумма</th>
                      <th style={{ paddingRight: 24 }}>Статус</th>
                      {/* колонки «Документы» нет: сервер чеков и УПД не отдаёт */}
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.public_id}>
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
                          {/* описание собирает сервер; своё название тарифа —
                              запасной вариант для строк старого формата */}
                          <b>
                            {p.description ??
                              plans?.find((x) => x.code === p.plan)?.title ??
                              p.plan}
                          </b>
                          {!p.description && p.period ? ` · ${PERIOD_LABEL[p.period] ?? p.period}` : ''}
                          {/* доплата за смену тарифа: без этой строки сумма
                              «1 240 ₽» выглядела бы платежом не по прайсу */}
                          {p.change_from_plan && (
                            <div className="doc">
                              переход с «
                              {plans?.find((x) => x.code === p.change_from_plan)?.title ??
                                p.change_from_plan}
                              »
                            </div>
                          )}
                          {p.is_recurring && <div className="doc">автоплатёж</div>}
                          {p.refunded_at && (
                            <div className="doc">
                              возврат {formatAmount(p.refund_amount)} ·{' '}
                              {new Date(p.refunded_at).toLocaleDateString('ru-RU')}
                            </div>
                          )}
                          {p.failure_reason && <div className="doc">{p.failure_reason}</div>}
                        </td>
                        {/* ⚠️ способ оплаты, а НЕ реквизиты: номеров карт платформа
                            не получает и не хранит — Robokassa их не передаёт */}
                        <td className="text-muted">{methodLabel(p.payment_method) ?? '—'}</td>
                        <td className="amt">{formatAmount(p.amount)}</td>
                        <td style={{ paddingRight: 24 }}>
                          {/* knownStatus: словарь ведёт сервер, седьмое значение
                              может приехать раньше правки здесь */}
                          <span className={`ph-status ${statusClass(knownStatus(p.status))}`}>
                            {statusLabel(knownStatus(p.status))}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="pay-note">
              <b>Мы не храним данные вашей карты.</b> Её номер вводится на стороне Robokassa
              и к нам не попадает — платформа получает только способ оплаты и сумму.
              Чек по 54-ФЗ приходит на почту от платёжного оператора.
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
              подтверждается отдельно. Способ оплаты один для всех: и физлицо, и компания
              платят картой или через СБП.
            </div>

            <div className="mt-20" style={{ paddingTop: 16, borderTop: '1px solid var(--border)' }}>
              <b style={{ fontSize: 14 }}>
                {company ? 'Счёт для бухгалтерии' : 'Нужен счёт для компании?'}
              </b>
              <p className="text-muted" style={{ fontSize: 13, margin: '6px 0 10px' }}>
                {company
                  ? `Выставим счёт на ${companyName ?? 'ваши реквизиты'} — оплата по безналу`
                  : 'Вы оплачиваете как физическое лицо. Счёт нужен, только если платит компания'}
              </p>
              <button
                className={`btn btn-block btn-sm ${company ? 'btn-outline' : 'btn-ghost'}`}
                onClick={() => setInvoiceOpen(true)}
              >
                Запросить счёт
              </button>
            </div>
          </div>

          {/* ⚠️ Раньше здесь у всех висело «Организация — Не заполнено», и человек,
              оплачивающий как физлицо, читал это как «аккаунт считается компанией,
              данные не введены». Реквизиты — не обязательный атрибут аккаунта,
              а условие выставления счёта: нет их — значит платит человек. */}
          <div className="card mt-24">
            <h3>Реквизиты плательщика</h3>
            {profile?.company.company_name || profile?.company.company_inn ? (
              <>
                <div style={{ fontSize: 13, lineHeight: 1.7 }}>
                  <div className="text-muted">Организация</div>
                  <div>{profile.company.company_name || '—'}</div>
                  <div className="text-muted mt-8">ИНН</div>
                  <div>{profile.company.company_inn || '—'}</div>
                </div>
                <Link href="/settings" className="btn btn-ghost btn-sm mt-16">
                  Изменить в настройках
                </Link>
              </>
            ) : (
              <>
                <div className="text-muted" style={{ fontSize: 13, lineHeight: 1.7 }}>
                  Вы оплачиваете как физическое лицо — реквизиты не нужны.
                  Заполните их, только если счёт оплачивает компания: тариф
                  и оплаченный срок от этого не меняются.
                </div>
                <Link href="/settings" className="btn btn-ghost btn-sm mt-16">
                  Указать реквизиты компании
                </Link>
              </>
            )}
          </div>

          {showPromo && promoPlan?.promo && (
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
              {flags.pay ? (
                <Link
                  href={checkout(promoPlan.code, promoPlan.promo.code)}
                  className="btn btn-primary btn-block"
                >
                  {promoPlan.promo.cta_label || 'Подключить'}
                </Link>
              ) : (
                <Link href="/pricing" className="btn btn-primary btn-block">
                  Посмотреть условия
                </Link>
              )}
            </div>
          )}

          {/* ── Как прекратить подписку ─────────────────────────────────
              Вопрос звучит как «где кнопка отмены», а ответ — что отменять
              нечего: автосписаний нет, подписка просто заканчивается. Раньше
              это было сказано одной строкой под кнопкой продления, и человек,
              искавший «Отменить подписку», её не находил. */}
          {plan && !plan.is_trial && (
            <div className="card mt-24">
              <h3>Как прекратить подписку</h3>
              <div className="text-muted" style={{ fontSize: 13, lineHeight: 1.65 }}>
                {flags.autopay ? (
                  <>
                    Отключите автопродление на странице оплаты — списаний больше не будет,
                    а оплаченный срок доработает до конца.
                  </>
                ) : (
                  <>
                    <b style={{ color: 'var(--navy-900)' }}>Ничего делать не нужно.</b>{' '}
                    Мы не храним привязанную карту и не списываем автоматически: когда
                    оплаченный период закончится
                    {data?.valid_until
                      ? ` (${new Date(data.valid_until * 1000).toLocaleDateString('ru-RU')})`
                      : ''}
                    , обмен просто остановится. Предупредим письмом за 7, 3 и 1 день.
                  </>
                )}
                <div className="mt-8">
                  Нужно платить меньше — перейдите на тариф дешевле: оплаченный остаток
                  не сгорит, он купит больше дней нового тарифа.
                </div>
                <div className="mt-8">
                  Данные при остановке остаются на месте. Если нужно удалить аккаунт
                  и всё, что с ним связано, — это в{' '}
                  <Link href="/settings">настройках, раздел «Данные и приватность»</Link>.
                </div>
              </div>
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
        <InvoiceRequest
          profile={profile}
          intro={
            company
              ? undefined
              : 'Счёт выставляем на компанию — укажите её название и ИНН. Тариф и оплаченный срок от этого не изменятся.'
          }
          onClose={() => setInvoiceOpen(false)}
          onDone={setNote}
        />
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
