'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getPlans } from '@/lib/api/lk';
import type { Plan } from '@/lib/contracts/lk';
import { ADAPTERS, CATEGORIES, NOT_A_SERVICE } from '@/lib/adapters';

/**
 * Лендинг. Перенос design-source/index.html.
 *
 * Отличия от эталона — все там, где макет обещал то, чего нет:
 *
 * · **`1С:ERP` заменён на `1С:БП`** в бейджах и в тексте про конфигурации.
 *   Сервер собирает `.epf` для `ut11|unf|ka|bp` — «Бухгалтерия предприятия 3.0»,
 *   а не ERP. Проверено запросом с `config=erp`: `INVALID_CONFIG` со списком;
 * · **тарифы и цены — из `GET /lk/plans`**, ничего не зашито. В макете стояли
 *   990 / 2 490 / 5 990 ₽ — совпадают с каноном, но брать их надо у сервера,
 *   иначе при смене прайса лендинг начнёт врать;
 * · **описание пробного тарифа исправлено.** В макете «до 5 операций в сутки,
 *   30 дней» — на сервере пробный **бессрочный**, 500 операций в месяц,
 *   1 интеграция. Лимиты берутся из каталога;
 * · «33 сервиса в 8 категориях» — считается по справочнику, а не написано
 *   руками: «Иное» и «нужен другой» в счёт сервисов не идут;
 * · ссылка на `about.html` из шапки убрана — такой страницы не существует
 *   (в эталоне пункт меню был вообще пустой, с одним переводом строки).
 *
 * Блок «основатель» из макета переношу: там нет ни выдуманных имён, ни отзывов
 * от третьих лиц — это слово владельца о своём продукте.
 */
export function LandingBody() {
  const [plans, setPlans] = useState<Plan[] | null>(null);

  useEffect(() => {
    // прайс публичный, сессия не нужна; молча падать нельзя — покажем заглушку
    getPlans()
      .then((r) => setPlans(r.plans))
      .catch(() => setPlans([]));
  }, []);

  const services = Object.entries(ADAPTERS).filter(([code]) => !NOT_A_SERVICE.has(code));

  return (
    <>
      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="hero">
        <div className="container">
          <div className="grid">
            <div>
              <div className="row gap-8 mb-20" style={{ flexWrap: 'wrap' }}>
                {/* ⚠️ было 1С:ERP — такой сборки у сервера нет, есть БП 3.0 */}
                {['1С:УТ', '1С:УНФ', '1С:КА', '1С:БП'].map((b) => (
                  <span className="badge" key={b}>
                    {b}
                  </span>
                ))}
              </div>
              <h1>
                No-code <em>сервисная интеграция</em> 1С
              </h1>
              <p className="lede">
                Один файл .epf подключает вашу 1С к {services.length} сервисам: маркетплейсам,
                сайтам, CRM, доставке, оплате и аналитике. Без программистов и без серверов.
              </p>
              <div className="cta-row">
                <Link href="/register" className="btn btn-primary btn-lg">
                  Попробовать бесплатно
                </Link>
                <Link href="/integrations" className="btn btn-outline btn-lg">
                  Все интеграции
                </Link>
              </div>
              <div className="trust">
                <span>Пробный тариф без карты</span>
                <span>Запуск за 30 минут</span>
                <span>Данные остаются в вашей 1С</span>
              </div>
            </div>

            <div className="hero-art">
              <div className="hero-win">
                <div className="tabs">
                  <div className="tab active">● 1С:УТ 11.5</div>
                  <div className="tab">CoreBridge.epf</div>
                </div>
                <div className="flow">
                  <div className="flow-box">
                    <b>Ваша 1С</b>
                    Остатки, цены, заказы
                  </div>
                  <div className="flow-arrow">→</div>
                  <div className="flow-box">
                    <b>CoreBridge</b>
                    Маршрутизация
                  </div>
                </div>
                <div className="chips">
                  <div className="chip" style={{ color: '#FFB89A' }}>Ozon</div>
                  <div className="chip" style={{ color: '#F9A8D4' }}>Wildberries</div>
                  <div className="chip" style={{ color: '#FCD34D' }}>Я.Маркет</div>
                  <div className="chip" style={{ color: '#93C5FD' }}>Битрикс24</div>
                </div>
                <div className="stat-row">
                  <div className="s">
                    <b>{services.length}</b>
                    <span>сервиса</span>
                  </div>
                  <div className="s">
                    <b>1</b>
                    <span>файл .epf</span>
                  </div>
                  <div className="s">
                    <b>~30 мин</b>
                    <span>до запуска</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Категории ────────────────────────────────────────────────────── */}
      <section className="cats-section" id="integrations">
        <div className="container">
          <h2 className="sec-title">
            {services.length} сервиса в {CATEGORIES.length} категориях
          </h2>
          <p className="sec-lede" style={{ maxWidth: 580 }}>
            Подключайте нужные сервисы галочкой в файле .epf. Без программистов и сторонних
            серверов.
          </p>
          <div className="cats-grid">
            {CATEGORIES.map((cat) => {
              const items = services.filter(([, a]) => a.cat === cat);
              const shown = items.slice(0, 5);
              const rest = items.length - shown.length;
              return (
                <Link
                  key={cat}
                  href={`/integrations#${encodeURIComponent(cat)}`}
                  className="cat"
                >
                  <div className="ic-bar">
                    {shown.map(([code, a]) => (
                      <div
                        className="cb-ic"
                        key={code}
                        style={{ background: a.color, color: a.fg ?? '#fff' }}
                      >
                        {a.glyph}
                      </div>
                    ))}
                    {rest > 0 && (
                      <div
                        className="cb-ic"
                        style={{
                          background: 'var(--bg-alt)',
                          color: 'var(--text-muted)',
                          boxShadow: 'inset 0 0 0 1px var(--border)',
                        }}
                      >
                        +{rest}
                      </div>
                    )}
                  </div>
                  <h4>{cat}</h4>
                  <p>{CATEGORY_DESCRIPTIONS[cat] ?? ''}</p>
                  <div className="count">
                    {items.length} {plural(items.length, 'сервис', 'сервиса', 'сервисов')}
                  </div>
                </Link>
              );
            })}
          </div>
          <div className="text-center mt-40">
            <Link href="/integrations" className="btn btn-outline btn-lg">
              Смотреть все интеграции
            </Link>
          </div>
        </div>
      </section>

      {/* ── Почему мы ────────────────────────────────────────────────────── */}
      <section className="features-section" id="features">
        <div className="container">
          <h2 className="sec-title">Почему CoreBridge</h2>
          <p className="sec-lede" style={{ maxWidth: 560 }}>
            Простое решение для одной из самых сложных задач в бизнесе — связать вашу 1С
            с внешним миром.
          </p>
          <div className="feat-grid">
            {FEATURES.map((f) => (
              <div className="feat" key={f.title}>
                <div className="fi">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    {f.icon}
                  </svg>
                </div>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Как начать ───────────────────────────────────────────────────── */}
      <section className="how-section">
        <div className="container">
          <h2 className="sec-title">Как начать</h2>
          <p className="sec-lede" style={{ maxWidth: 500 }}>
            Четыре шага от регистрации до первого заказа, прилетевшего с маркетплейса в 1С.
          </p>
          <div className="how-grid">
            {STEPS.map((s) => (
              <div className="how-step" key={s.title}>
                <h4>{s.title}</h4>
                <p>{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Тарифы ───────────────────────────────────────────────────────── */}
      <section className="price-section" id="pricing">
        <div className="container">
          <h2 className="sec-title">Тарифы</h2>
          <p className="sec-lede" style={{ maxWidth: 520 }}>
            Пять планов. Платите только за то, что реально нужно.
            {discountLine(plans)}
          </p>

          {plans === null ? (
            <p className="text-center text-muted mt-40">Загружаем тарифы…</p>
          ) : plans.length === 0 ? (
            <p className="text-center text-muted mt-40">
              Не удалось загрузить тарифы. Актуальные цены — на странице{' '}
              <Link href="/pricing">Тарифы</Link>.
            </p>
          ) : (
            <div className="plan-grid">
              {plans.map((p) => (
                <PlanCard key={p.code} plan={p} />
              ))}
            </div>
          )}

          <div className="text-center mt-32">
            <Link href="/pricing" className="text-muted" style={{ fontSize: 14 }}>
              Полное сравнение и годовая оплата →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Призыв ───────────────────────────────────────────────────────── */}
      <section className="cta-section">
        <div className="container">
          <h2>Попробуйте CoreBridge</h2>
          <p>
            Пробный тариф активируется при регистрации автоматически. Без карты, без звонков
            менеджера.
          </p>
          <div className="row gap-12" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/register" className="btn btn-primary btn-lg">
              Попробовать бесплатно
            </Link>
            <Link
              href="/integrations"
              className="btn btn-ghost btn-lg"
              style={{ color: '#fff', borderColor: 'rgba(255,255,255,.3)' }}
            >
              Все интеграции
            </Link>
          </div>
        </div>
      </section>

      {/* ── Основатель ───────────────────────────────────────────────────── */}
      <section className="founder">
        <div className="founder-wrap">
          <div className="founder-ava">ДК</div>
          <div>
            <p>
              Я делал интеграции 1С на заказ и каждый раз видел одно и то же: работающий обмен
              стоит как небольшой проект, а поддерживать его потом некому. CoreBridge — попытка
              собрать это один раз и нормально, чтобы подключение сервиса занимало вечер,
              а не квартал.
            </p>
            <div className="sig">
              <b>Дмитрий Королёв</b>
              <br />
              основатель CoreBridge
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

/**
 * Карточка тарифа. Всё содержимое — из каталога сервера: цена, лимиты, промо.
 * ⚠️ В макете описание пробного тарифа гласило «до 5 операций в сутки, 30 дней».
 * На сервере он бессрочный и с месячным лимитом — пишем по факту.
 */
function PlanCard({ plan }: { plan: Plan }) {
  const highlight = plan.promo != null;
  const l = plan.limits;

  return (
    <div className={`plan${highlight ? ' highlight' : ''}`}>
      {highlight && <div className="tag">Популярный</div>}
      <h4>{plan.title}</h4>
      <div className={`pr${plan.is_custom_price ? ' pr-text' : ''}`}>
        {plan.is_custom_price ? (
          'По запросу'
        ) : (
          <>
            {(plan.price.monthly ?? 0).toLocaleString('ru-RU')} ₽
            {plan.price.monthly ? <small>/мес</small> : null}
          </>
        )}
      </div>
      <div className="pd">{planDescription(plan)}</div>
      <ul>
        {plan.is_custom_price ? (
          <>
            <li>Без лимитов</li>
            <li>Установка на своём сервере</li>
            <li>SLA и выделенная поддержка</li>
            <li>Персональный менеджер</li>
          </>
        ) : (
          <>
            <li>
              {l.projects === 1 ? '1 интеграция' : `До ${l.projects} интеграций`}
            </li>
            <li>{l.monthly_operations.toLocaleString('ru-RU')} операций в месяц</li>
            <li>
              {l.users_per_company === 1
                ? '1 пользователь'
                : `До ${l.users_per_company} пользователей`}
            </li>
            {plan.marketing_features.telegram_support && <li>Поддержка в Telegram</li>}
            {plan.features.n8n_ui && (
              <li>
                <b>Прямой доступ к n8n UI</b>
              </li>
            )}
          </>
        )}
      </ul>
      {plan.is_custom_price ? (
        <a
          href={`mailto:${plan.contact_email ?? 'info@corebridge.ru'}?subject=${encodeURIComponent('Тариф «Энтерпрайз»')}`}
          className="btn btn-outline btn-block"
        >
          Обсудить
        </a>
      ) : (
        <Link href="/register" className={`btn btn-block ${highlight ? 'btn-primary' : 'btn-outline'}`}>
          {plan.promo?.cta_label || 'Выбрать'}
        </Link>
      )}
    </div>
  );
}

/** Описание тарифа: промо и бессрочность — из каталога, а не из макета */
function planDescription(p: Plan): string {
  if (p.is_trial) {
    return p.is_perpetual
      ? 'Без карты. Активируется при регистрации, срок не ограничен.'
      : 'Без карты. Активируется при регистрации.';
  }
  if (p.promo) return `${p.promo.label}. Собственные сценарии и автоматическая обработка данных.`;
  if (p.is_custom_price) return 'Для сетей, крупного бизнеса, установки на своём сервере.';
  if (p.limits.projects <= 3) return 'Для одного сервиса. Подходит к большинству интеграций.';
  return 'Универсальный тариф под ваши бизнес-процессы.';
}

/** Скидка за год — из каталога. Если её нет, фразу не пишем вовсе */
function discountLine(plans: Plan[] | null): string {
  const d = plans?.find((p) => p.price.discount_percent)?.price.discount_percent;
  return d ? ` При годовой оплате — скидка ${d} %.` : '';
}

function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

/** Подписи категорий из скрипта эталона (index.html, объект `descs`) */
const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  'Маркетплейсы': 'Ozon, Wildberries, Яндекс Маркет и произвольные площадки.',
  'Сайт': 'Свой сайт по REST, 1С-Битрикс, WordPress, Tilda, InSales и др.',
  'CRM': 'Битрикс24, AmoCRM, Мегаплан, СБИС, Neaktor.',
  'Доставка': 'СДЭК, Почта России, Яндекс Доставка.',
  'Оплата': 'ЮKassa, СБП, Т-Банк, Сбер.',
  'CDP / Маркетинг': 'MindBox, SendPulse, МойСклад.',
  'Соцсети': 'Telegram, WhatsApp, Viber, ВКонтакте, Одноклассники.',
  'Аналитика': 'Google Sheets, Power BI, Roistat.',
};

const FEATURES: { title: string; text: string; icon: React.ReactNode }[] = [
  {
    title: 'Не требует программистов',
    text: 'Всё настраивается галочками и полями в одном окне. Интеграция запускается без 1С-разработчика и без администратора сервера.',
    icon: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6M9 13h6M9 17h6" />
      </>
    ),
  },
  {
    title: 'Данные остаются у вас',
    text: 'Ваша 1С не публикуется в интернет. Файл .epf сам отправляет нам только нужные бизнес-события. Не нужны белые IP, статика и пробросы портов у провайдера.',
    icon: (
      <>
        <rect x="3" y="11" width="18" height="11" rx="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </>
    ),
  },
  {
    title: 'Запуск примерно за 30 минут',
    text: 'Скачали .epf, вставили токен, отметили сервисы галочками. Первая синхронизация заказов и остатков идёт в тот же день.',
    icon: (
      <>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </>
    ),
  },
  {
    // ⚠️ в макете было «1С:УТ, 1С:УНФ, 1С:КА и 1С:ERP» — ERP не существует, есть БП 3.0
    title: 'Один файл для 4 конфигураций',
    text: 'Мы поддерживаем 1С:УТ 11, 1С:УНФ, 1С:КА и 1С:Бухгалтерию предприятия 3.0. Для каждой конфигурации — своя сборка .epf. Обновления выходят одновременно для всех.',
    icon: <path d="M12 2 2 7l10 5 10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />,
  },
  {
    title: 'Всё в одном окне',
    text: 'Один личный кабинет: тариф, скачивание .epf, JWT-токен, статус всех интеграций, журнал ошибок. Не нужно держать таблицы с настройками в голове.',
    icon: <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />,
  },
  {
    // ⚠️ в макете «до 5 операций в сутки, 30 дней» — на сервере бессрочный, 500 операций в месяц
    title: 'Бесплатный пробный тариф',
    text: 'Пробный тариф активируется при регистрации автоматически. Одна интеграция, 500 операций в месяц, срок не ограничен. Карта не нужна.',
    icon: (
      <>
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <path d="m22 4-10 10-3-3" />
      </>
    ),
  },
];

const STEPS = [
  {
    title: 'Регистрация',
    text: 'Указываете email, получаете пробный тариф. Без карты и звонков менеджера.',
  },
  {
    title: 'Скачиваете .epf',
    text: 'Выбираете свою конфигурацию 1С (УТ, УНФ, КА или БП) и копируете токен для файла.',
  },
  {
    title: 'Включаете сервисы',
    text: 'Отмечаете галочками нужные сервисы и вставляете API-ключи в полях внутри .epf.',
  },
  {
    title: 'Работаете',
    text: 'Заказы из маркетплейсов приходят в 1С, остатки и цены уходят обратно. Вы смотрите отчёты.',
  },
];
