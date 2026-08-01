'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ApiError } from '@/lib/api/client';
import { sendContact } from '@/lib/api/lk';

/**
 * Контакты. Перенос design-source/contacts.html — **с изъятиями**, и это главное,
 * что нужно знать про этот файл.
 *
 * В эталоне здесь реквизиты несуществующего юрлица: ООО «КорБридж», ИНН 7714456789,
 * гендиректор «Кузнецов Алексей Николаевич», офис «в БЦ Skyline, 7 этаж», карта
 * проезда и Telegram «@corebridge_support» с обещанием «ответ ~4 мин».
 * Публиковать это нельзя: клиент заключает договор с ИП Королёвым, а страница
 * называет другое лицо — прямое противоречие с офертой, которую он же акцептует.
 * Подробности — `design_findings.md`, БЛОКЕР 1.
 *
 * Что убрано целиком: карточка Telegram, карточка «Офис в Москве», карта,
 * схема проезда, банковские реквизиты, КПП, ОГРН юрлица, гендиректор.
 * Что осталось: почта и три поля для идентификации Исполнителя —
 * наименование, ИНН, ОГРНИП. Полные банковские реквизиты — в оферте §11,
 * где они действительно нужны.
 *
 * ⚠️ **Телефона на сайте нет** (решение Дмитрия 2026-08-01): обращения
 * принимаются только по email. Убран отсюда и из реквизитов в оферте
 * и условиях — правилом в `tools/build-legal.mjs`, иначе следующая сборка
 * юридических страниц из эталона вернула бы его обратно.
 *
 * Карточка осталась одна, и заполнять освободившееся место нечем: срок ответа
 * уже сказан и в подзаголовке страницы, и в форме — третий раз подряд это
 * выглядело бы как попытка занять пустоту. Из четырёх карточек эталона
 * (email, телефон, Telegram, офис) правдива ровно одна.
 *
 * Форма подключена к `POST /lk/contact`. Полей «Компания» и «Тема» в контракте
 * сервера нет — дописываем их в текст сообщения, отдельный запрос к бэкенду
 * ради двух полей не стоит.
 */
export function ContactsBody() {
  return (
    <>
      <section className="c-hero">
        <h1>Свяжитесь с нами</h1>
        {/* ⚠️ в эталоне «скорее через Telegram» — для обращений его нет */}
        <p>Отвечаем на письма в течение рабочего дня.</p>
      </section>

      <section className="contact-grid">
        <div>
          <div className="contact-cards">
            <div className="c-card">
              <div className="ic" style={{ background: 'var(--blue-100)', color: 'var(--blue-500)' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="6" width="18" height="12" rx="2" />
                  <path d="m3 8 9 6 9-6" />
                </svg>
              </div>
              <h4>Email для всех вопросов</h4>
              <div className="val">
                <a href="mailto:info@corebridge.ru">info@corebridge.ru</a>
              </div>
              <div className="hint">Продажи, поддержка, партнёрство</div>
            </div>

          </div>

          <p className="text-muted" style={{ fontSize: 13, marginTop: 20 }}>
            Работаем удалённо, приёмного офиса нет — все вопросы решаем письмом.
            Договор и счёт присылаем на почту, подписанные сканы принимаем так же.
          </p>
        </div>

        <ContactForm />
      </section>

      <section className="req-strip">
        <div className="container">
          <h2>Реквизиты</h2>
          <div className="req-grid">
            <div>
              <div className="lbl">Наименование</div>
              <b>ИП Королёв Дмитрий Павлович</b>
            </div>
            <div>
              <div className="lbl">ИНН</div>
              <b>120704119287</b>
            </div>
            <div>
              <div className="lbl">ОГРНИП</div>
              <b>314121813300025</b>
            </div>
          </div>
          <p className="text-muted" style={{ fontSize: 13, marginTop: 20, marginBottom: 0 }}>
            Банковские реквизиты для оплаты по счёту — в <Link href="/oferta">публичной оферте</Link>,
            раздел «Реквизиты Исполнителя».
          </p>
        </div>
      </section>
    </>
  );
}

const TOPICS = [
  'Вопрос о продукте',
  'Корпоративное внедрение',
  'Техническая поддержка',
  'Партнёрство / агентская программа',
  'Пресса, интервью',
];

function ContactForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [topic, setTopic] = useState(TOPICS[0]);
  const [message, setMessage] = useState('');
  const [agree, setAgree] = useState(true);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      /* «Тема» и «Компания» в контракте сервера отсутствуют — дописываем в текст */
      const body = [
        `Тема: ${topic}`,
        company.trim() ? `Компания: ${company.trim()}` : null,
        '',
        message.trim(),
      ]
        .filter((x) => x !== null)
        .join('\n');

      const r = await sendContact({
        name: name.trim(),
        email: email.trim(),
        message: body,
        source: 'contacts',
      });
      setDone(r.ref);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 429
          ? 'Слишком много обращений с этого адреса. Попробуйте через час или напишите на info@corebridge.ru.'
          : err instanceof ApiError && err.code === 'INVALID_EMAIL'
            ? 'Проверьте адрес почты — на него придёт ответ.'
            : 'Не удалось отправить. Напишите напрямую на info@corebridge.ru — так точно дойдёт.',
      );
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div>
        <div className="form-card">
          <h3>Обращение принято</h3>
          <p className="sub" style={{ marginBottom: 0 }}>
            Номер обращения <b>{done}</b>. Ответим на {email} в течение рабочего дня. Если ответ
            не придёт, напишите на <a href="mailto:info@corebridge.ru">info@corebridge.ru</a> и
            назовите этот номер.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <form className="form-card" onSubmit={submit}>
        <h3>Написать нам</h3>
        <p className="sub">Ответим на рабочий email в течение 1 рабочего дня</p>

        {error && <div className="lk-error">{error}</div>}

        <div className="field">
          <label htmlFor="c-name">Имя</label>
          <input
            id="c-name"
            className="input"
            placeholder="Как к вам обращаться"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="c-email">Email</label>
          <input
            id="c-email"
            className="input"
            type="email"
            placeholder="you@company.ru"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="c-company">Компания</label>
          <input
            id="c-company"
            className="input"
            placeholder="Необязательно"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="c-topic">Тема</label>
          <select
            id="c-topic"
            className="select"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
          >
            {TOPICS.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="c-message">Сообщение</label>
          <textarea
            id="c-message"
            className="textarea"
            rows={5}
            placeholder="Расскажите, чем можем помочь"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
          />
        </div>

        <label className="cb" style={{ margin: '8px 0 16px' }}>
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
          {/* в эталоне ссылка вела в href="#" */}
          <span>
            Соглашаюсь с <Link href="/privacy">обработкой персональных данных</Link>
          </span>
        </label>

        <button
          type="submit"
          className="btn btn-primary btn-block btn-lg"
          disabled={busy || !agree || !name.trim() || !email.trim() || !message.trim()}
        >
          {busy ? 'Отправляем…' : 'Отправить'}
        </button>
      </form>
    </div>
  );
}
