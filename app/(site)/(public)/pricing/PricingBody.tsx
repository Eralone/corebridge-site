'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ApiError } from '@/lib/api/client';
import { getDashboard, getPlans, startPayment } from '@/lib/api/lk';
import type { Dashboard, Plan } from '@/lib/contracts/lk';

type Period = 'monthly' | 'yearly';

/**
 * Тарифы. Перенос design-source/pricing.html.
 *
 * Всё содержимое — из `GET /lk/plans`: цены, лимиты, признаки, промо. В макете
 * они были зашиты и уже расходились с каноном, а прайс меняется чаще вёрстки.
 *
 * Отличия от эталона:
 *
 * · **пустая последняя строка таблицы сравнения не переносится** — это артефакт
 *   редактирования макета (`<td>\n</td>` шесть раз);
 * · **кнопки оплаты знают, вошёл ли человек.** В макете `data-robokassa` открывал
 *   попап-заглушку. Здесь: без сессии ведём на регистрацию (оплачивать нечего,
 *   тенанта ещё нет), с сессией — реальный `POST /lk/billing/pay`;
 * · **отметка «Текущий»** ставится по фактическому тарифу из `GET /lk/dashboard`,
 *   а не на пробном жёстко, как в макете. Наличие сессии приходит с сервера
 *   (cookie httpOnly), чтобы гость не получал заведомый 401 в консоли;
 * · **четыре ответа в FAQ переписаны** — в макете они обещали механики, которых
 *   на сервере нет. Каждый помечен рядом с текстом.
 */
export function PricingBody({ hasSession }: { hasSession: boolean }) {
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [period, setPeriod] = useState<Period>('monthly');
  const [me, setMe] = useState<Dashboard | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    getPlans()
      .then((r) => setPlans(r.plans))
      .catch(() => setPlans([]));
    // за тарифом ходим только если сессия есть: у гостя это был бы заведомый 401
    if (hasSession) getDashboard().then(setMe).catch(() => setMe(null));
  }, [hasSession]);

  const discount = plans?.find((p) => p.price.discount_percent)?.price.discount_percent ?? null;

  async function pay(plan: Plan) {
    if (!me) return; // гостя ведём ссылкой на регистрацию, сюда он не попадёт
    setBusy(plan.code);
    setNote(null);
    try {
      const r = await startPayment(plan.code, period, plan.promo?.code);
      if (r.payment_url) {
        window.location.href = r.payment_url;
        return;
      }
      setNote(
        'Онлайн-оплата ещё подключается. Мы можем выставить счёт — напишите на info@corebridge.ru.',
      );
    } catch (e) {
      setNote(
        e instanceof ApiError && e.code === 'PROMO_ALREADY_USED'
          ? 'Промо-период уже использован на этом аккаунте. Оформите тариф по обычной цене.'
          : e instanceof ApiError && e.code === 'CUSTOM_PRICE_PLAN'
            ? 'Этот тариф оформляется по счёту — напишите на info@corebridge.ru.'
            : 'Онлайн-оплата ещё подключается. Напишите на info@corebridge.ru, оформим по счёту.',
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <section className="p-hero">
        <div className="container">
          <div className="p-crumbs">
            <Link href="/">Главная</Link> / Тарифы
          </div>
          <h1>Понятные тарифы, без сюрпризов</h1>
          <p>
            Начните с пробного — он активируется при регистрации автоматически.
            {discount ? ` Оплачивайте месяц или год со скидкой ${discount} %.` : ''} Поменять тариф
            можно в любой момент.
          </p>
          {discount && (
            <div className="toggle" role="tablist" aria-label="Период оплаты">
              <button
                type="button"
                role="tab"
                aria-selected={period === 'monthly'}
                className={period === 'monthly' ? 'on' : undefined}
                onClick={() => setPeriod('monthly')}
              >
                Помесячно
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={period === 'yearly'}
                className={period === 'yearly' ? 'on' : undefined}
                onClick={() => setPeriod('yearly')}
              >
                Ежегодно <span className="save">−{discount}%</span>
              </button>
            </div>
          )}
        </div>
      </section>

      <section className="plans">
        <div className="container">
          {note && (
            <div className="lk-error" style={{ maxWidth: 720, margin: '0 auto 20px' }}>
              {note}
            </div>
          )}

          {plans === null ? (
            <p className="text-center text-muted">Загружаем тарифы…</p>
          ) : plans.length === 0 ? (
            <p className="text-center text-muted">
              Не удалось загрузить тарифы. Напишите на{' '}
              <a href="mailto:info@corebridge.ru">info@corebridge.ru</a> — пришлём актуальные цены.
            </p>
          ) : (
            <div className="plan-grid">
              {plans.map((p) => (
                <PlanCard
                  key={p.code}
                  plan={p}
                  period={period}
                  isCurrent={me?.plan === p.code}
                  loggedIn={me !== null}
                  busy={busy === p.code}
                  onPay={() => pay(p)}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {plans && plans.length > 0 && <Comparison plans={plans} />}

      <section className="faq">
        <div className="container">
          <h2>Частые вопросы</h2>
          <div className="faq-list">
            {faq(plans).map((q, i) => (
              <details key={q.q} open={i === 0}>
                <summary>{q.q}</summary>
                <p>{q.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

function PlanCard({
  plan,
  period,
  isCurrent,
  loggedIn,
  busy,
  onPay,
}: {
  plan: Plan;
  period: Period;
  isCurrent: boolean;
  loggedIn: boolean;
  busy: boolean;
  onPay: () => void;
}) {
  const l = plan.limits;
  const highlight = plan.promo != null;
  const monthly = plan.price.monthly;
  const yearlyMonthly = plan.price.yearly_monthly;
  const shown = period === 'yearly' && yearlyMonthly ? yearlyMonthly : monthly;

  return (
    <div className={`plan${isCurrent ? ' current' : highlight ? ' highlight' : ''}`}>
      {isCurrent ? (
        <div className="tag t-cur">Активен</div>
      ) : highlight ? (
        <div className="tag t-pop">Популярный</div>
      ) : null}

      <h4>{plan.title}</h4>

      <div className={`pr${plan.is_custom_price ? ' pr-text' : ''}`}>
        {plan.is_custom_price ? (
          'По запросу'
        ) : (
          <>
            {(shown ?? 0).toLocaleString('ru-RU')} ₽
            {shown ? <small>/мес</small> : null}
            {/* при годовой оплате показываем зачёркнутую месячную — как в макете */}
            {period === 'yearly' && yearlyMonthly && monthly && yearlyMonthly < monthly && (
              <span className="old">{monthly.toLocaleString('ru-RU')} ₽</span>
            )}
          </>
        )}
      </div>

      <div className="pd">{description(plan)}</div>

      <ul>
        {plan.is_custom_price ? (
          <>
            <li>Без лимитов по интеграциям и операциям</li>
            <li>Установка на своём сервере</li>
            <li>Доступ к n8n-воркфлоу</li>
            <li>SLA и выделенная поддержка</li>
          </>
        ) : (
          <>
            <li>{l.projects === 1 ? '1 интеграция' : `До ${l.projects} интеграций`}</li>
            <li>
              {l.monthly_operations.toLocaleString('ru-RU')} операций в месяц
            </li>
            <li>
              {l.users_per_company === 1
                ? '1 пользователь'
                : `До ${l.users_per_company} пользователей`}
            </li>
            <li>Журнал за {l.log_retention_days} дней</li>
            {plan.marketing_features.telegram_support ? (
              <li>Поддержка в Telegram</li>
            ) : (
              <li className="muted">Поддержка по почте</li>
            )}
            {plan.features.n8n_ui ? (
              <li>
                <b>Прямой доступ к n8n UI</b>
              </li>
            ) : (
              <li className="muted">Свой интерфейс n8n недоступен</li>
            )}
          </>
        )}
      </ul>

      <PlanAction
        plan={plan}
        isCurrent={isCurrent}
        loggedIn={loggedIn}
        busy={busy}
        onPay={onPay}
      />
    </div>
  );
}

/**
 * Кнопка карточки. Четыре состояния, и это не украшательство: без сессии платить
 * нечем — тенанта ещё не существует, сервер ответит 401. Гостя ведём в регистрацию.
 */
function PlanAction({
  plan,
  isCurrent,
  loggedIn,
  busy,
  onPay,
}: {
  plan: Plan;
  isCurrent: boolean;
  loggedIn: boolean;
  busy: boolean;
  onPay: () => void;
}) {
  if (isCurrent) return <div className="cur-chip">Текущий тариф</div>;

  if (plan.is_custom_price) {
    return (
      <a
        href={`mailto:${plan.contact_email ?? 'info@corebridge.ru'}?subject=${encodeURIComponent('Тариф «Энтерпрайз»')}`}
        className="btn btn-outline btn-block"
      >
        Обсудить
      </a>
    );
  }

  if (plan.is_trial) {
    return (
      <Link href="/register" className="btn btn-outline btn-block">
        Начать бесплатно
      </Link>
    );
  }

  if (!loggedIn) {
    return (
      <Link
        href="/register"
        className={`btn btn-block ${plan.promo ? 'btn-primary' : 'btn-outline'}`}
      >
        {plan.promo?.cta_label || 'Выбрать'}
      </Link>
    );
  }

  return (
    <button
      className={`btn btn-block ${plan.promo ? 'btn-primary' : 'btn-outline'}`}
      disabled={busy}
      onClick={onPay}
    >
      {busy ? 'Открываем оплату…' : plan.promo?.cta_label || 'Оплатить'}
    </button>
  );
}

function description(p: Plan): string {
  if (p.is_trial) {
    return p.is_perpetual
      ? 'Без карты. Активируется при регистрации, срок не ограничен.'
      : 'Без карты. Активируется при регистрации.';
  }
  if (p.promo) {
    return `${p.promo.label}. Для тех, кому нужны собственные сценарии и автоматическая обработка передаваемых данных.`;
  }
  if (p.is_custom_price) return 'Для сетей, крупного бизнеса, установки на своём сервере.';
  if (p.limits.projects <= 3) return 'Для одного сервиса. Подходит к большинству интеграций.';
  return 'Универсальный тариф под ваши бизнес-процессы.';
}

/**
 * Таблица сравнения. Строки собираются из каталога, поэтому новый тариф или
 * изменённый лимит появляются здесь сами. В макете таблица была написана руками
 * и уже расходилась с ценами.
 */
function Comparison({ plans }: { plans: Plan[] }) {
  /**
   * «Без лимита» определяем по тарифу, а не по величине числа. Пороговое
   * значение здесь не работает: у «Энтерпрайза» заглушки 99 999 и 99 999 999,
   * а у «Профессионала» настоящие 100 000 операций — с порогом 99 999 он
   * получал «Без лимита» и выглядел равным старшему тарифу.
   */
  const num = (p: Plan, v: number) => (p.is_custom_price ? 'Без лимита' : v.toLocaleString('ru-RU'));
  const yes = <span className="check">✓</span>;
  const no = <span className="dash">−</span>;

  const rows: { label: string; cell: (p: Plan) => React.ReactNode }[] = [
    {
      label: 'Цена в месяц',
      cell: (p) =>
        p.is_custom_price ? 'По запросу' : `${(p.price.monthly ?? 0).toLocaleString('ru-RU')} ₽`,
    },
    { label: 'Количество интеграций', cell: (p) => num(p, p.limits.projects) },
    { label: 'Операций в месяц', cell: (p) => num(p, p.limits.monthly_operations) },
    { label: 'Запусков n8n в месяц', cell: (p) => num(p, p.limits.n8n_executions_month) },
    { label: 'Пользователей в компании', cell: (p) => num(p, p.limits.users_per_company) },
    { label: 'Хранение журнала, дней', cell: (p) => num(p, p.limits.log_retention_days) },
    /* все четыре конфигурации входят в любой тариф — сервер лимитов по ним не знает */
    { label: 'Все четыре конфигурации 1С', cell: () => yes },
    { label: 'Полный каталог сервисов', cell: () => yes },
    { label: 'Прямой доступ к n8n UI', cell: (p) => (p.features.n8n_ui ? yes : no) },
    {
      label: 'Поддержка в Telegram',
      cell: (p) => (p.marketing_features.telegram_support ? yes : no),
    },
    { label: 'Установка на своём сервере', cell: (p) => (p.marketing_features.on_premise ? yes : no) },
    { label: 'SLA', cell: (p) => (p.marketing_features.sla ? yes : no) },
  ];

  return (
    <section className="comp">
      <div className="container">
        <h2>Сравнение тарифов</h2>
        <div className="comp-tbl">
          <table>
            <thead>
              <tr>
                <th>Возможность</th>
                {plans.map((p) => (
                  <th key={p.code}>{p.title}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label}>
                  <td>{r.label}</td>
                  {plans.map((p) => (
                    <td key={p.code}>{r.cell(p)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

/**
 * Частые вопросы. Четыре ответа переписаны против макета — там были обещания,
 * которых сервер не выполняет. Пометки ⚠️ ниже объясняют каждую правку.
 */
function faq(plans: Plan[] | null): { q: string; a: string }[] {
  const trial = plans?.find((p) => p.is_trial);
  const pro = plans?.find((p) => p.features.n8n_ui && !p.is_custom_price);
  const discount = plans?.find((p) => p.price.discount_percent)?.price.discount_percent;

  return [
    {
      q: 'Что входит в пробный тариф?',
      a: trial
        ? `Пробный тариф ${trial.is_perpetual ? 'бессрочный — срок действия не ограничен' : 'активируется при регистрации'}. В него входит ${trial.limits.projects === 1 ? 'одна активная интеграция' : `до ${trial.limits.projects} интеграций`} и ${trial.limits.monthly_operations.toLocaleString('ru-RU')} операций в месяц. Этого хватит, чтобы настроить связку с одним сервисом и убедиться, что всё работает. Карта при регистрации не требуется.`
        : 'Пробный тариф активируется при регистрации автоматически, карта не требуется.',
    },
    {
      // ⚠️ в макете: «получение списка заказов, выгрузка остатков, создание чека».
      // Сервер определил операцию иначе (пакет S10): доставленное событие,
      // ретраи не считаются. Формулировка согласована с ним.
      q: 'Как считаются операции?',
      a: 'Операция — это одно событие обмена, доставленное в ваши сценарии: новые заказы, выгрузка остатков, подтверждение оплаты. Повторные попытки не считаются: если событие не доехало, мы не берём за него. Небольшому магазину с одним-двумя каналами обычно хватает нескольких тысяч операций в месяц.',
    },
    {
      // ⚠️ в макете: «доплачиваете разницу пропорционально оставшимся дням».
      // Пропорционального пересчёта на сервере нет. Плюс Дмитрий просил писать
      // прямо, что автопродления нет.
      q: 'Можно ли сменить тариф в середине месяца?',
      a: 'Да, перейти на тариф выше можно в любой момент — новые лимиты начинают действовать сразу после оплаты. Автопродления нет: когда оплаченный период закончится, доступ просто прекратится, деньги повторно не спишутся. Понижение тарифа оформляем со следующего периода — напишите нам.',
    },
    {
      // ⚠️ в макете: «после 100 % новые операции ставятся в очередь». Сервер
      // подтвердил (S10 §1.4): лимит мягкий, обработка не останавливается.
      q: 'Что будет при превышении лимита?',
      a: 'Мы предупредим на 80 % и 100 % лимита — письмом и в Telegram, если он подключён. Обмен при этом не остановится: лимит мягкий. Если превышение регулярное, имеет смысл перейти на тариф выше — так дешевле, чем расти за пределами плана.',
    },
    {
      q: 'Как оплатить?',
      a: `Физическим лицам — картой, через СБП или кошелёк, оплата идёт через защищённый шлюз Robokassa. Юридическим лицам выставляем счёт и договор на реквизиты организации: запросить счёт можно из личного кабинета или письмом на info@corebridge.ru.${discount ? ` Оплата возможна помесячно или на год со скидкой ${discount} %.` : ''}`,
    },
    {
      // ⚠️ в макете: «на Энтерпрайзе вы получаете доступ». По каталогу n8n_ui
      // включён и на «Профессионале» — на нём же висит промо, то есть макет
      // отговаривал от того тарифа, который продаёт.
      q: 'Что такое n8n-воркфлоу?',
      a: `Это конструктор собственных сценариев: «если заказ старше двух часов и оплачен — отправить в Telegram с пометкой». Готовые сценарии доступны на всех тарифах, а собственный интерфейс n8n внутри кабинета${pro ? ` — начиная с тарифа «${pro.title}»` : ' — на старших тарифах'}.`,
    },
  ];
}
