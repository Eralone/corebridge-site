'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ApiError } from '@/lib/api/client';
import { sendContact } from '@/lib/api/lk';

/**
 * Для бизнеса. Перенос design-source/for-business.html — **сильно сокращённый**,
 * и это осознанное решение, а не недоделка.
 *
 * Из эталона убрано:
 *
 * · **раздел «Клиенты, с которыми мы работаем»** — три кейса с названиями компаний,
 *   метриками («−82 % времени», «99.98 % uptime») и отзывами от имени названных
 *   людей с должностями. Клиентов нет, значит это фальсификация отзывов: обман
 *   потребителя и риск по ст. 5 ФЗ «О рекламе». Подробности — `design_findings.md`,
 *   БЛОКЕР 2;
 * · **раздел «Дополнительные услуги» с прайсом** (внедрение от 35 000 ₽, коннектор
 *   от 80 000 ₽, on-premise от 250 000 ₽ …) — публичная цена обязывает, а этот
 *   прайс не подтверждён;
 * · **«SLA 99.95 %», «24/7 поддержка», «реагирование за 15 минут»** — обязательства
 *   по времени, которые сейчас нечем исполнять: поддержка вне MVP;
 * · **«Наши инженеры подключат вашу 1С за 2–6 недель»** — обещание срока и наличия
 *   команды внедрения;
 * · **агентская программа со скидкой 25 %, white-label, «CoreBridge Partner»,
 *   поддержка интеграторов 8×5** — ни одного из этих механизмов не существует.
 *
 * Осталось то, что описывает продукт, а не обещает несуществующее: чем платформа
 * полезна разным типам бизнеса, и форма заявки. Все кнопки «Подробнее →» из
 * эталона вели в `href="#"` — ведём их на форму.
 */
export function ForBusinessBody() {
  return (
    <>
      <section className="b-hero" id="lead">
        <div className="container">
          <div>
            <h1>
              Корпоративные интеграции 1С
              <br />
              под задачу
            </h1>
            {/* ⚠️ в эталоне: «Наши инженеры подключат вашу 1С к любому внешнему
                сервису за 2–6 недель» — срок и команда внедрения не подтверждены */}
            <p>
              Для компаний с собственной инфраструктурой, выделенным контуром и нестандартными
              процессами. Обсудим вашу задачу, оценим объём работ и скажем прямо, решается ли
              она платформой или нужна доработка.
            </p>
            <div className="row gap-12" style={{ flexWrap: 'wrap' }}>
              {/* on-premise и SLA есть в каталоге тарифов как признаки «Энтерпрайза».
                  Конкретную цифру 99.95 % из эталона не пишем — её нечем подтвердить */}
              <span className="badge badge-success badge-dot" style={{ color: '#C9D5F2', background: 'rgba(31,157,85,.2)' }}>
                Установка на своём сервере
              </span>
              <span className="badge badge-success badge-dot" style={{ color: '#C9D5F2', background: 'rgba(31,157,85,.2)' }}>
                SLA по договору
              </span>
              <span className="badge badge-success badge-dot" style={{ color: '#C9D5F2', background: 'rgba(31,157,85,.2)' }}>
                Все 33 сервиса каталога
              </span>
            </div>
          </div>
          <LeadForm />
        </div>
      </section>

      <section className="segments">
        <h2>Чем платформа полезна разным типам бизнеса</h2>
        <div className="seg-grid">
          {SEGMENTS.map((s) => (
            <div className="seg-card" key={s.title}>
              <div className="ic" style={s.iconStyle}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  {s.icon}
                </svg>
              </div>
              <h3>{s.title}</h3>
              <div className="fit">{s.fit}</div>
              <ul>
                {s.items.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
              {/* в эталоне здесь были href="#" — ведём на форму заявки выше */}
              <a href="#lead" className="btn btn-outline">
                Обсудить задачу →
              </a>
            </div>
          ))}
        </div>

        <p className="text-muted" style={{ textAlign: 'center', marginTop: 32, fontSize: 14 }}>
          Не нашли свой случай? Тарифы и лимиты — на странице{' '}
          <Link href="/pricing">Тарифы</Link>, список сервисов — в{' '}
          <Link href="/integrations">каталоге интеграций</Link>.
        </p>
      </section>
    </>
  );
}

const TASKS = [
  'Интеграция с новым каналом',
  'Миграция с другого решения',
  'Нестандартный коннектор',
  'Установка на своём сервере',
  'Другое',
];

function LeadForm() {
  const [company, setCompany] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [task, setTask] = useState(TASKS[0]);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      /* «Компания» и «Задача» в контракте сервера отсутствуют — в текст сообщения */
      const message = [
        `Задача: ${task}`,
        `Компания: ${company.trim() || 'не указана'}`,
        '',
        details.trim() || 'Подробностей не указано.',
      ].join('\n');

      const r = await sendContact({
        name: name.trim(),
        email: email.trim(),
        message,
        source: 'for_business',
      });
      setDone(r.ref);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 429
          ? 'Слишком много заявок с этого адреса. Попробуйте через час или напишите на info@corebridge.ru.'
          : 'Не удалось отправить заявку. Напишите на info@corebridge.ru — так точно дойдёт.',
      );
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="lead-form">
        <h3>Заявка принята</h3>
        <p className="sub" style={{ marginBottom: 0 }}>
          Номер <b>{done}</b>. Ответим на {email} в течение рабочего дня. Если ответ не придёт,
          напишите на <a href="mailto:info@corebridge.ru">info@corebridge.ru</a> и назовите
          этот номер.
        </p>
      </div>
    );
  }

  return (
    <form className="lead-form" onSubmit={submit}>
      <h3>Запросить внедрение</h3>
      <p className="sub">Ответим в течение 1 рабочего дня</p>

      {error && <div className="lk-error">{error}</div>}

      <div className="field">
        <label htmlFor="b-company">Компания</label>
        <input
          id="b-company"
          className="input"
          placeholder="ООО «Пример»"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="b-name">Имя, должность</label>
        <input
          id="b-name"
          className="input"
          placeholder="Иван Иванов, ИТ-директор"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>
      <div className="field">
        <label htmlFor="b-email">Рабочий email</label>
        <input
          id="b-email"
          className="input"
          type="email"
          placeholder="ivan@company.ru"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div className="field">
        <label htmlFor="b-task">Задача</label>
        <select id="b-task" className="select" value={task} onChange={(e) => setTask(e.target.value)}>
          {TASKS.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </div>
      {/* поля не было в эталоне: без описания задачи заявка бесполезна обеим сторонам */}
      <div className="field">
        <label htmlFor="b-details">Коротко о задаче</label>
        <textarea
          id="b-details"
          className="textarea"
          rows={3}
          placeholder="Какая конфигурация 1С, какие сервисы нужно связать"
          value={details}
          onChange={(e) => setDetails(e.target.value)}
        />
      </div>

      <button
        type="submit"
        className="btn btn-primary btn-block btn-lg mt-8"
        disabled={busy || !name.trim() || !email.trim()}
      >
        {busy ? 'Отправляем…' : 'Отправить заявку'}
      </button>
      <p className="text-muted" style={{ fontSize: 12, margin: '12px 0 0' }}>
        Отправляя заявку, вы соглашаетесь с <Link href="/privacy">обработкой персональных данных</Link>.
      </p>
    </form>
  );
}

const SEGMENTS: {
  title: string;
  fit: string;
  items: string[];
  icon: React.ReactNode;
  iconStyle?: React.CSSProperties;
}[] = [
  {
    title: 'Ритейл и e-commerce',
    fit: 'Сети магазинов, D2C-бренды, продавцы на маркетплейсах',
    items: [
      'Синхронизация остатков по всем складам и магазинам',
      'FBO и FBS на нескольких маркетплейсах одновременно',
      'Маркировка, ГТД, возвраты',
      'Обмен с сайтом и кассовым софтом',
    ],
    icon: (
      <>
        <path d="m3 9 3-6h12l3 6M3 9h18M3 9v11a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V9" />
        <path d="M9 14h6" />
      </>
    ),
  },
  {
    title: 'Оптовая торговля',
    fit: 'B2B-дистрибьюторы, площадки с большим каталогом',
    items: [
      'Массовая выгрузка прайс-листов и каталогов',
      'B2B-порталы и личные кабинеты клиентов',
      'Документы из 1С в электронном виде',
      'Обмен с CRM и торговыми площадками',
    ],
    icon: (
      <>
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
      </>
    ),
    iconStyle: { background: 'rgba(255,107,53,.1)', color: 'var(--orange-500)' },
  },
  {
    title: 'Производство',
    fit: 'Производители FMCG и B2B-продукции, свой e-commerce',
    items: [
      'Синхронизация номенклатуры и состава изделий',
      'Серии, партии, сроки годности',
      'Сложные конфигурации 1С, включая КА',
      'Маркировка и обмен с производственным контуром',
    ],
    icon: <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5" />,
    iconStyle: { background: 'rgba(31,157,85,.1)', color: 'var(--success)' },
  },
  {
    // ⚠️ в эталоне карточка обещала агентскую программу со скидкой 25 %, white-label,
    // обучающую программу «CoreBridge Partner» и поддержку 8×5. Ни того, ни другого
    // не существует. Оставляю карточку — интеграторы действительно наша аудитория, —
    // но без обещаний: условия обсуждаются, а не заявляются как готовая программа.
    title: 'ИТ-интеграторы и франчайзи 1С',
    fit: 'ИТ-компании и агентства автоматизации, которые ведут чужие внедрения',
    items: [
      'Один файл .epf вместо своей обвязки под каждый сервис',
      'Отдельный тенант на каждого клиента, данные не пересекаются',
      'Журнал обменов и ошибок — видно, что и когда не доехало',
      'Условия сотрудничества обсуждаем индивидуально',
    ],
    icon: (
      <>
        <path d="M12 2v20M2 12h20" />
        <circle cx="12" cy="12" r="10" />
      </>
    ),
    iconStyle: { background: 'rgba(142,68,173,.1)', color: '#8E44AD' },
  },
];
