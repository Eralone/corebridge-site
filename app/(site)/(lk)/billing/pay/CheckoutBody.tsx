'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ApiError } from '@/lib/api/client';
import { changePlan, getDashboard, getPlans, getProfile, previewPlanChange, startPayment } from '@/lib/api/lk';
import type { Dashboard, Plan, PlanChangePreview, Profile } from '@/lib/contracts/lk';
import { formatAmount, isPlanChange } from '@/lib/billing/payment';
import type { BillingFlags } from '@/lib/billing/flags';
import { isCompanyPayer, payerCompanyName } from '@/lib/billing/payer';
import { InvoiceRequest } from '@/components/billing/InvoiceRequest';
import { PAYMENT_ID_KEY } from '@/lib/billing/session';

type Period = 'monthly' | 'yearly';

/**
 * Оформление оплаты. Единственное место сайта, которое зовёт
 * `POST /lk/billing/pay`: страницы тарифов и биллинга только приводят сюда
 * со своими параметрами (`?plan=…&period=…&promo=…`).
 *
 * Почему один вход, а не кнопка на каждой странице: у платежа есть выбор
 * периода, промо и (в будущем) автоплатёж, а ещё разбор семи кодов ошибок.
 * Три копии этого разъехались бы, а расхождение здесь стоит денег.
 *
 * 🔴 Подпись платежа (`SignatureValue`) считает сервер и отдаёт готовой.
 * В коде сайта нет и не должно быть ни MD5, ни `Password1` — иначе любой
 * посетитель выпишет себе «Профессионал» за 1 ₽ (F20 §4). Здесь мы только
 * переходим по `payment_url`, который пришёл с сервера.
 *
 * ── Две ветки, а не одна ────────────────────────────────────────────────────
 * Покупка и продление идут через `POST /lk/billing/pay`. Переход на **другой**
 * тариф при живой оплаченной подписке — через `POST /lk/billing/change-plan`
 * (F20 P3-2): оплаченная стоимость сохраняется, апгрейд оплачивается доплатой
 * за оставшиеся дни, даунгрейд бесплатен и отодвигает дату окончания.
 * Какая ветка нужна, решает сервер — сайт только спрашивает расчёт и рисует
 * ответ. Арифметику здесь не повторяем: между расчётом и подтверждением
 * проходит время, и второе число разошлось бы с показанным.
 */
export function CheckoutBody({ flags }: { flags: BillingFlags }) {
  const q = useSearchParams();
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [me, setMe] = useState<Dashboard | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [failed, setFailed] = useState(false);

  const [code, setCode] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>(q.get('period') === 'yearly' ? 'yearly' : 'monthly');
  const [promo, setPromo] = useState(q.get('promo') ?? '');
  const [autopay, setAutopay] = useState(true);

  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [contactOpen, setContactOpen] = useState(false);

  /** Расчёт смены тарифа. null = обычная покупка или продление */
  const [preview, setPreview] = useState<PlanChangePreview | null>(null);
  /** Смена уже применена (даунгрейд или копеечный апгрейд) — платить нечего */
  const [applied, setApplied] = useState<{ plan: string; validUntil: number } | null>(null);

  useEffect(() => {
    Promise.all([getPlans(), getDashboard(), getProfile()])
      .then(([p, d, pr]) => {
        setPlans(p.plans);
        setMe(d);
        setProfile(pr);
      })
      .catch(() => setFailed(true));
  }, []);

  /** Тарифы, которые вообще можно оплатить: пробный бесплатен, энтерпрайз — по счёту */
  const payable = useMemo(
    () => (plans ?? []).filter((p) => !p.is_trial && !p.is_custom_price),
    [plans],
  );

  // Выбор из адреса, иначе текущий тариф, иначе промо-тариф, иначе первый платный.
  useEffect(() => {
    if (code !== null || payable.length === 0) return;
    const wanted = q.get('plan');
    const pick =
      payable.find((p) => p.code === wanted) ??
      payable.find((p) => p.code === me?.plan) ??
      payable.find((p) => p.promo) ??
      payable[0];
    setCode(pick.code);
  }, [code, payable, me, q]);

  const plan = payable.find((p) => p.code === code) ?? null;
  const hasYearly = plan?.price.yearly != null;
  const effectivePeriod: Period = hasYearly ? period : 'monthly';

  /**
   * Промо применимо, только если оно у выбранного тарифа и человек его ещё
   * не тратил. `once_per_tenant` сервер проверяет сам и отвечает 409 —
   * здесь мы лишь не обещаем того, чего не будет.
   */
  const promoOffer = plan?.promo ?? null;
  const promoApplies =
    promoOffer != null &&
    promo.trim().toLowerCase() === promoOffer.code.toLowerCase() &&
    effectivePeriod === 'monthly';

  const listPrice =
    effectivePeriod === 'yearly' ? (plan?.price.yearly ?? null) : (plan?.price.monthly ?? null);
  /** Показываем то, что посчитали сами; окончательную сумму подтверждает форма Robokassa */
  const dueNow = promoApplies ? promoOffer!.price : listPrice;

  /**
   * Это переход на другой тариф при живой оплаченной подписке — значит считать
   * должен сервер (`change-plan/preview`), а не форма покупки. У пробного
   * тарифа `valid_until === null`: остатка нет, это обычная первая покупка.
   */
  const planChange = isPlanChange(me?.plan, plan?.code, me?.valid_until);

  /** Плательщик-компания — по заполненному ИНН (см. lib/billing/payer.ts) */
  const company = isCompanyPayer(profile);
  const companyName = payerCompanyName(profile);

  /**
   * Спрашиваем расчёт при каждом изменении выбора. Эндпоинт ничего не меняет,
   * а отказ — не ошибка экрана: `SAME_PLAN` и `NO_PAID_REMAINDER` означают
   * ровно то, что переход считать не надо, работает обычная покупка.
   */
  useEffect(() => {
    if (!planChange || !plan) {
      setPreview(null);
      return;
    }
    let alive = true;
    previewPlanChange(plan.code, effectivePeriod)
      .then((r) => alive && setPreview(r))
      .catch(() => alive && setPreview(null));
    return () => {
      alive = false;
    };
  }, [planChange, plan, effectivePeriod]);

  /** Переход на другой тариф: доплата либо мгновенное применение */
  async function switchPlan() {
    if (!plan) return;
    setBusy(true);
    setNote(null);
    try {
      const r = await changePlan(plan.code, effectivePeriod);

      if (r.applied) {
        // даунгрейд и копеечный апгрейд: тариф уже сменён, платить нечего
        setApplied({ plan: r.target_plan_title, validUntil: r.valid_until ?? r.new_valid_until });
        setPreview(null);
        getDashboard().then(setMe).catch(() => {});
        return;
      }

      if (r.payment_url) {
        rememberPayment(r.payment_id);
        window.location.href = r.payment_url;
        return;
      }

      setNote(
        `${r.message ?? 'Оплата сейчас недоступна'}. Мы можем выставить счёт — кнопка «Оплата по счёту».`,
      );
    } catch (e) {
      setNote(errorText(e, () => setContactOpen(true)));
      if (e instanceof ApiError && e.code === 'CUSTOM_PRICE_PLAN') setContactOpen(true);
    } finally {
      setBusy(false);
    }
  }

  async function pay() {
    if (!plan) return;
    setBusy(true);
    setNote(null);
    try {
      const r = await startPayment(plan.code, effectivePeriod, {
        promo: promo.trim() || undefined,
        autopay: flags.autopay ? autopay : undefined,
      });

      if (r.payment_url) {
        rememberPayment(r.payment_id);
        window.location.href = r.payment_url;
        return;
      }

      // payment_url: null — платёжка не настроена. Ветка нужна и после
      // подключения Robokassa: шлюз может лежать.
      setNote(
        r.message
          ? `${r.message}. Мы можем выставить счёт — кнопка «Оплата по счёту».`
          : 'Оплата сейчас недоступна. Мы можем выставить счёт — кнопка «Оплата по счёту».',
      );
    } catch (e) {
      setNote(errorText(e, () => setContactOpen(true)));
      if (e instanceof ApiError && e.code === 'CUSTOM_PRICE_PLAN') setContactOpen(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {failed && <div className="lk-error">Не удалось загрузить тарифы. Обновите страницу.</div>}
      {note && <div className="lk-error">{note}</div>}

      <div className="page-head">
        <div>
          <h1>Оплата тарифа</h1>
          <p className="text-muted">Выберите тариф и период — дальше оплата на стороне Robokassa</p>
        </div>
        <Link href="/billing" className="btn btn-ghost">
          ← К биллингу
        </Link>
      </div>

      <div className="billing-grid">
        <div>
          <div className="card">
            <h3>Тариф</h3>
            {plans === null ? (
              <div className="lk-empty">Загружаем тарифы…</div>
            ) : payable.length === 0 ? (
              <div className="lk-empty">
                <div className="ttl">Тарифы не загрузились</div>
                Напишите на <a href="mailto:info@corebridge.ru">info@corebridge.ru</a> — оформим вручную.
              </div>
            ) : (
              <div className="pay-opts">
                {payable.map((p) => (
                  <label key={p.code} className={`pay-opt${p.code === code ? ' on' : ''}`}>
                    <input
                      type="radio"
                      name="plan"
                      checked={p.code === code}
                      onChange={() => setCode(p.code)}
                    />
                    <span className="po-body">
                      <span className="po-title">
                        {p.title}
                        {me?.plan === p.code && <span className="badge badge-neutral">текущий</span>}
                        {/* при смене тарифа промо не применяется (change-plan
                            его не принимает) — не показываем и плашку */}
                        {p.promo && !planChange && (
                          <span className="badge badge-accent">{p.promo.label}</span>
                        )}
                      </span>
                      <span className="po-sub">
                        {p.limits.projects} интеграций ·{' '}
                        {p.limits.monthly_operations.toLocaleString('ru-RU')} операций в месяц ·{' '}
                        до {p.limits.users_per_company} пользователей
                      </span>
                    </span>
                    <span className="po-price">
                      {formatAmount(p.price.monthly)}
                      <small>/мес</small>
                    </span>
                  </label>
                ))}
              </div>
            )}

            {plan && (
              <>
                <h3 style={{ marginTop: 28 }}>Период</h3>
                <div className="pay-opts">
                  <label className={`pay-opt${effectivePeriod === 'monthly' ? ' on' : ''}`}>
                    <input
                      type="radio"
                      name="period"
                      checked={effectivePeriod === 'monthly'}
                      onChange={() => setPeriod('monthly')}
                    />
                    <span className="po-body">
                      <span className="po-title">Месяц</span>
                      <span className="po-sub">Оплата за один месяц доступа</span>
                    </span>
                    <span className="po-price">{formatAmount(plan.price.monthly)}</span>
                  </label>

                  {hasYearly && (
                    <label className={`pay-opt${effectivePeriod === 'yearly' ? ' on' : ''}`}>
                      <input
                        type="radio"
                        name="period"
                        checked={effectivePeriod === 'yearly'}
                        onChange={() => setPeriod('yearly')}
                      />
                      <span className="po-body">
                        <span className="po-title">
                          Год
                          {plan.price.discount_percent ? (
                            <span className="badge badge-success">
                              −{plan.price.discount_percent}%
                            </span>
                          ) : null}
                        </span>
                        <span className="po-sub">
                          {plan.price.yearly_monthly
                            ? `${formatAmount(plan.price.yearly_monthly)} в месяц при оплате за год`
                            : 'Оплата сразу за 12 месяцев'}
                        </span>
                      </span>
                      <span className="po-price">{formatAmount(plan.price.yearly)}</span>
                    </label>
                  )}
                </div>

                {/* Промо к смене тарифа не применяется: change-plan его
                    не принимает, а поле рядом с расчётом обещало бы скидку,
                    которой не будет */}
                {promoOffer && !preview && (
                  <div className="field mt-24" style={{ maxWidth: 320 }}>
                    <label htmlFor="promo">Промо-код</label>
                    <input
                      id="promo"
                      className="input"
                      value={promo}
                      placeholder={promoOffer.code}
                      onChange={(e) => setPromo(e.target.value)}
                    />
                    <span className="hint">
                      {promoApplies
                        ? /* label уже содержит и срок, и цену — второй раз их
                             не повторяем, дописываем только что будет дальше */
                          `${promoOffer.label}. Дальше — ${formatAmount(plan.price.monthly)} в месяц.`
                        : effectivePeriod === 'yearly'
                          ? 'Промо действует только при помесячной оплате'
                          : `Для этого тарифа действует код ${promoOffer.code}`}
                    </span>
                  </div>
                )}

                {/* ⚠️ Автоплатёж скрыт до сигнала сервера: рекуррент Robokassa
                    на модерации, а планировщика списаний ещё нет (F20 §6, P2).
                    Вёрстка готова — включается флагом BILLING_AUTOPAY_ENABLED. */}
                {flags.autopay && !preview && (
                  <div
                    className="mt-24"
                    style={{
                      padding: 14,
                      border: '1px solid var(--border)',
                      borderRadius: 10,
                      background: 'var(--bg-alt)',
                    }}
                  >
                    <label className="field-row" style={{ alignItems: 'flex-start', gap: 10 }}>
                      <input
                        type="checkbox"
                        checked={autopay}
                        onChange={(e) => setAutopay(e.target.checked)}
                        style={{ marginTop: 3 }}
                      />
                      <span>
                        <b style={{ fontSize: 14 }}>Продлевать автоматически</b>
                        <span
                          className="text-muted"
                          style={{ display: 'block', fontSize: 12.5, marginTop: 4 }}
                        >
                          {formatAmount(listPrice)} каждый{' '}
                          {effectivePeriod === 'yearly' ? 'год' : 'месяц'}, списание за 3 дня
                          до конца оплаченного периода. Отключается в любой момент на этой
                          странице и в разделе «Биллинг» — доступ доработает до конца
                          оплаченного срока.
                        </span>
                      </span>
                    </label>
                  </div>
                )}

                {/* Смена тарифа: показываем расчёт сервера — сумму доплаты
                    либо новую дату окончания. Оплаченная стоимость больше
                    не сгорает (P3-2), но условия у апгрейда и даунгрейда
                    разные, и человек должен видеть их до подтверждения */}
                {preview && (
                  <div
                    className="mt-24"
                    style={{
                      padding: 14,
                      borderRadius: 10,
                      background: preview.kind === 'upgrade' ? 'var(--blue-100)' : 'var(--success-bg)',
                      color: 'var(--navy-900)',
                      fontSize: 13,
                      lineHeight: 1.6,
                    }}
                  >
                    <b>
                      Переход с «{preview.current_plan_title}» на «{preview.target_plan_title}»
                    </b>
                    <div style={{ marginTop: 6 }}>
                      {preview.kind === 'upgrade' ? (
                        <>
                          Оплаченные дни не пропадают: вы доплачиваете только разницу
                          за оставшиеся {Math.floor(preview.remaining_days)} дн. Дата окончания
                          не изменится — доступ до {formatDate(preview.new_valid_until)}.
                        </>
                      ) : preview.kind === 'downgrade' ? (
                        <>
                          Доплачивать нечего: оплаченный остаток
                          ({formatAmount(preview.remaining_value)}) переходит на новый тариф
                          и покупает больше дней — доступ продлится
                          до {formatDate(preview.new_valid_until)}.
                        </>
                      ) : (
                        <>
                          Доплата получилась меньше минимальной, поэтому переключим бесплатно.
                          Доступ остаётся до {formatDate(preview.new_valid_until)}.
                        </>
                      )}
                    </div>
                    {/* промо и автоплатёж к смене тарифа не применяются:
                        change-plan их не принимает, обещать их здесь нельзя */}
                    {preview.kind !== 'upgrade' && (
                      <div className="text-muted" style={{ fontSize: 12, marginTop: 6 }}>
                        Тариф сменится сразу, без оплаты.
                      </div>
                    )}
                  </div>
                )}

                {applied && (
                  <div
                    className="mt-24"
                    style={{
                      padding: 14,
                      borderRadius: 10,
                      background: 'var(--success-bg)',
                      color: 'var(--navy-900)',
                      fontSize: 13,
                      lineHeight: 1.6,
                    }}
                  >
                    <b>Тариф «{applied.plan}» подключён.</b> Доступ действует
                    до {formatDate(applied.validUntil)}. Платить ничего не нужно.
                    <div style={{ marginTop: 10 }}>
                      <Link href="/billing" className="btn btn-outline btn-sm">
                        К биллингу
                      </Link>
                    </div>
                  </div>
                )}

                <div className="pay-total mt-24">
                  <span>К оплате</span>
                  <b>{formatAmount(preview ? preview.amount_due : dueNow)}</b>
                </div>

                {flags.pay ? (
                  <button
                    className="btn btn-primary btn-block mt-16"
                    disabled={busy || !plan || applied != null}
                    onClick={preview ? switchPlan : pay}
                  >
                    {busy
                      ? 'Готовим переход…'
                      : preview && preview.amount_due === 0
                        ? `Перейти на «${preview.target_plan_title}» бесплатно`
                        : preview
                          ? `Доплатить ${formatAmount(preview.amount_due)} и перейти`
                          : `Перейти к оплате — ${formatAmount(dueNow)}`}
                  </button>
                ) : (
                  /* Кнопка спрятана осознанно, а не «ещё не сделали»: этап P1
                     сервера закрывает последние дыры (продление от valid_until,
                     сверка зависших платежей, письма), и до живого тестового
                     платежа владельца обещать оплату нельзя (F20 §6, §10). */
                  <div className="mt-16">
                    <div className="lk-empty" style={{ textAlign: 'left' }}>
                      <div className="ttl">Оплата картой скоро откроется</div>
                      {/* ⚠️ Здесь раньше было «счёт для юрлица» — единственный
                          видимый способ оплаты в этом состоянии, из-за чего
                          обычный человек решал, что система записала его
                          в компании. Сущность аккаунта на оплату не влияет:
                          картой платят и физлица, и компании. */}
                      Мы заканчиваем подключение платёжного шлюза — картой и через СБП
                      можно будет заплатить прямо здесь. Если оплату проводит компания
                      по безналу, счёт выставим уже сейчас.
                    </div>
                    <button
                      className="btn btn-primary btn-block mt-16"
                      onClick={() => setContactOpen(true)}
                    >
                      Запросить счёт
                    </button>
                  </div>
                )}

                {/* Про оферту пишем только там, где кнопка действительно
                    начинает оплату: под «Запросить счёт» это было бы неправдой */}
                <p className="text-muted" style={{ fontSize: 12, marginTop: 14, marginBottom: 0 }}>
                  {flags.pay ? (
                    <>
                      Нажимая кнопку, вы соглашаетесь с <Link href="/oferta">офертой</Link>.{' '}
                      {flags.autopay && autopay
                        ? 'Автопродление можно отключить в любой момент.'
                        : 'Автопродления нет: когда оплаченный период закончится, доступ прекратится — деньги повторно не спишутся.'}
                    </>
                  ) : (
                    <>
                      Счёт выставляется по <Link href="/oferta">оферте</Link>. Автопродления нет:
                      когда оплаченный период закончится, доступ прекратится — деньги повторно
                      не спишутся.
                    </>
                  )}
                </p>
              </>
            )}
          </div>
        </div>

        <div>
          <div className="card">
            <h3>Как проходит оплата</h3>
            <ol style={{ fontSize: 13.5, lineHeight: 1.7, paddingLeft: 18, margin: '0 0 14px' }}>
              <li>Вы переходите на защищённую форму Robokassa.</li>
              <li>Платите картой, через СБП или кошельком.</li>
              <li>Возвращаетесь к нам — тариф активируется после подтверждения от банка.</li>
            </ol>
            <div className="text-muted" style={{ fontSize: 12.5, lineHeight: 1.6 }}>
              {/* Это правда, и её стоит сказать вслух: Robokassa реквизиты карты
                  нам не передаёт, в схеме платежей их нет и быть не должно */}
              Мы не храним данные вашей карты — её номер вводится на стороне Robokassa
              и к нам не попадает. Способ оплаты не зависит от того, физлицо вы
              или компания.
            </div>
          </div>

          {/* Развязка по реквизитам, а не по «сущности аккаунта»: заполненный
              ИНН и есть заявление «плачу от компании». Ничего не отбираем —
              карта доступна и тем и другим, счёт лишь предлагается вдобавок */}
          <div className="card mt-24">
            <h3>Оплата по счёту</h3>
            {company ? (
              <>
                <p className="text-muted" style={{ fontSize: 13, margin: '6px 0 10px' }}>
                  Выставим счёт на {companyName ?? 'ваши реквизиты'} — оплата по безналу.
                  Картой при этом платить тоже можно, это быстрее.
                </p>
                <button
                  className="btn btn-outline btn-block btn-sm"
                  onClick={() => setContactOpen(true)}
                >
                  Запросить счёт
                </button>
              </>
            ) : (
              <>
                <p className="text-muted" style={{ fontSize: 13, margin: '6px 0 10px' }}>
                  Вы оплачиваете как физическое лицо — достаточно карты или СБП.
                  Если оплату проводит компания по безналу, выставим счёт на её реквизиты.
                </p>
                <button
                  className="btn btn-ghost btn-block btn-sm"
                  onClick={() => setContactOpen(true)}
                >
                  Нужен счёт для компании
                </button>
              </>
            )}
          </div>

          <div className="card mt-24">
            <h3>Нужен «Энтерпрайз»?</h3>
            <p className="text-muted" style={{ fontSize: 13, margin: '6px 0 10px' }}>
              Он оформляется по счёту: без лимитов, установка на своём сервере, SLA.
            </p>
            <button
              className="btn btn-ghost btn-block btn-sm"
              onClick={() => setContactOpen(true)}
            >
              Обсудить условия
            </button>
          </div>
        </div>
      </div>

      {contactOpen && (
        <InvoiceRequest
          profile={profile}
          title="Счёт на оплату"
          subject={`Запрос счёта. Тариф: ${plan?.title ?? '—'}, период: ${
            effectivePeriod === 'yearly' ? 'год' : 'месяц'
          }`}
          onClose={() => setContactOpen(false)}
          onDone={setNote}
        />
      )}
    </>
  );
}

/**
 * Идентификатор для страницы возврата. Robokassa вернёт свой `InvId`, а наружу
 * мы показываем только `public_id`, — полагаться на её параметры нельзя (F20 §3).
 * Приватный режим может запрещать хранилище: тогда страница успеха возьмёт
 * последний платёж из истории.
 */
/** epoch-секунды → «14.09.2026». Сервер отдаёт сроки именно в секундах */
function formatDate(epochSeconds: number): string {
  return new Date(epochSeconds * 1000).toLocaleDateString('ru-RU');
}

function rememberPayment(id: string | undefined) {
  try {
    if (id) sessionStorage.setItem(PAYMENT_ID_KEY, id);
  } catch {
    /* хранилище недоступно — не критично */
  }
}

/** Коды из F20 §2. Всё, чего нет в списке, — общая формулировка без домыслов */
function errorText(e: unknown, openContact: () => void): string {
  if (!(e instanceof ApiError)) {
    return 'Не удалось начать оплату. Проверьте соединение и попробуйте ещё раз.';
  }
  switch (e.code) {
    case 'CUSTOM_PRICE_PLAN':
      openContact();
      return 'Этот тариф оформляется по счёту — заполните короткую заявку, мы посчитаем.';
    case 'PROMO_ALREADY_USED':
      return 'Промо-период уже использован на этом аккаунте. Уберите код и оформите по обычной цене.';
    case 'PROMO_NOT_APPLICABLE':
      return 'Этот промо-код не подходит к выбранному тарифу или периоду.';
    case 'INVALID_PLAN':
    case 'INVALID_PERIOD':
    case 'MISSING_FIELDS':
      return 'Выбранный тариф или период больше не действует. Обновите страницу.';
    case 'TOO_MANY_REQUESTS':
      return 'Слишком много попыток оплаты подряд. Подождите несколько минут.';
    // ── Смена тарифа (P3-2) ───────────────────────────────────────────────
    case 'SAME_PLAN':
      return 'Это ваш текущий тариф — его можно продлить, а не сменить. Обновите страницу.';
    case 'NO_PAID_REMAINDER':
    case 'NO_ACTIVE_LICENSE':
      // остаток кончился, пока человек смотрел на расчёт
      return 'Оплаченного остатка больше нет — оформите тариф обычной оплатой. Обновите страницу.';
    case 'CANNOT_SWITCH_TO_TRIAL':
      return 'Вернуться на пробный тариф нельзя: он выдаётся один раз при регистрации.';
    case 'PRICE_UNAVAILABLE':
      return 'Этот тариф так не продаётся. Выберите другой период или напишите нам.';
    case 'LICENSE_ISSUE_FAILED':
      return 'Не удалось переключить тариф. Деньги не списаны — напишите на info@corebridge.ru.';
    case 'UNAUTHORIZED':
      return 'Сессия истекла. Войдите заново и повторите оплату.';
    case 'FORBIDDEN':
      return 'Оплатить тариф может только владелец аккаунта.';
    default:
      return 'Не удалось начать оплату. Напишите на info@corebridge.ru — оформим по счёту.';
  }
}
