'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ApiError } from '@/lib/api/client';
import { getProfile, sendContact } from '@/lib/api/lk';
import type { Profile } from '@/lib/contracts/lk';

/**
 * Поддержка. Перенос design-source/support.html — **сознательно урезанный**.
 *
 * Решение продукта: тикет-системы в MVP нет. В макете были «Мои тикеты» с
 * историей обращений, статусами и перепиской — на сервере такого механизма
 * не существует вовсе, а рисовать пустой список «тикетов» значит обещать
 * систему, которой нет. Раздел «База знаний» тоже убран: базы знаний нет,
 * ссылки вели бы в никуда. Есть документация — на неё и ведём.
 *
 * Что осталось: понятное объяснение, как получить помощь, и форма, которая
 * действительно отправляет обращение через `POST /lk/contact`. Обращение
 * приходит на info@corebridge.ru и получает номер — по нему потом можно
 * сослаться в переписке.
 *
 * ⚠️ У `POST /lk/contact` нет источника `support` — контракт знает
 * `landing|pricing|contacts|for_business|billing|epf`. Отправляем как `contacts`:
 * добавлять значение в контракт ради ярлыка не стоит, а в тексте обращения
 * и так видно, что оно из кабинета.
 */
export function SupportBody() {
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    getProfile()
      .then(setProfile)
      .catch(() => setProfile(null));
  }, []);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Поддержка</h1>
          <p className="text-muted">
            Отвечаем на письма в течение рабочего дня. Отдельной системы тикетов пока нет —
            переписка идёт по почте.
          </p>
        </div>
      </div>

      <div className="grid-dash">
        <SupportForm profile={profile} />

        <div>
          <div className="chart-card">
            <div className="chart-head">
              <h3>Прежде чем писать</h3>
            </div>
            <p className="text-muted" style={{ fontSize: 13.5, lineHeight: 1.7, marginTop: 0 }}>
              Половина вопросов решается быстрее самостоятельно:
            </p>
            <ul className="text-muted" style={{ fontSize: 13.5, lineHeight: 1.9, paddingLeft: 20 }}>
              <li>
                <Link href="/docs">Документация</Link> — установка .epf, токен, справочник API
              </li>
              <li>
                <Link href="/epf">Файл .epf</Link> — свежая сборка и ваш токен
              </li>
              <li>
                <Link href="/my-integrations">Мои интеграции</Link> — статус обмена и ошибки
                по каждому сервису
              </li>
              <li>
                <Link href="/billing">Биллинг</Link> — тариф, лимиты, счёт для юрлица
              </li>
            </ul>
          </div>

          <div className="chart-card mt-24">
            <div className="chart-head">
              <h3>Что приложить к обращению</h3>
            </div>
            <p className="text-muted" style={{ fontSize: 13.5, lineHeight: 1.7, marginTop: 0 }}>
              Чтобы разобраться с первого письма, полезно указать: конфигурацию 1С, название
              сервиса, время когда проблема воспроизвелась, и текст ошибки из журнала.
              Токен доступа присылать не нужно — он у нас и так есть.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

function SupportForm({ profile }: { profile: Profile | null }) {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const email = profile?.user.email ?? '';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = [
        `Обращение из личного кабинета. Тема: ${subject.trim() || 'без темы'}`,
        profile?.company.company_name ? `Компания: ${profile.company.company_name}` : null,
        '',
        message.trim(),
      ]
        .filter((x) => x !== null)
        .join('\n');

      const r = await sendContact({
        name: profile?.user.name || email || 'Клиент',
        email,
        message: body,
        source: 'contacts',
      });
      setDone(r.ref);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 429
          ? 'Слишком много обращений подряд. Попробуйте через час или напишите прямо на info@corebridge.ru.'
          : 'Не удалось отправить. Напишите на info@corebridge.ru — так точно дойдёт.',
      );
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="chart-card">
        <div className="chart-head">
          <h3>Обращение отправлено</h3>
        </div>
        <p style={{ marginTop: 0 }}>
          Номер обращения <b>{done}</b>. Ответим на {email || 'вашу почту'} в течение рабочего
          дня. Если ответа не будет, напишите на{' '}
          <a href="mailto:info@corebridge.ru">info@corebridge.ru</a> и назовите этот номер.
        </p>
        <button className="btn btn-outline btn-sm" onClick={() => { setDone(null); setSubject(''); setMessage(''); }}>
          Написать ещё
        </button>
      </div>
    );
  }

  return (
    <div className="chart-card">
      <div className="chart-head">
        <h3>Написать в поддержку</h3>
      </div>
      <form onSubmit={submit}>
        {error && <div className="lk-error">{error}</div>}

        <div className="field">
          <label htmlFor="s-email">Ответ придёт на</label>
          {/* адрес не редактируем: ответ должен уйти на подтверждённую почту аккаунта */}
          <input id="s-email" className="input" value={email} readOnly disabled />
          <span className="hint">
            Почта аккаунта. Поменять её можно в <Link href="/settings">настройках</Link>.
          </span>
        </div>

        <div className="field">
          <label htmlFor="s-subject">Тема</label>
          <input
            id="s-subject"
            className="input"
            placeholder="Например: Ozon не подтягивает заказы с утра"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="s-message">Что случилось</label>
          <textarea
            id="s-message"
            className="textarea"
            rows={7}
            placeholder="Конфигурация 1С, сервис, время, текст ошибки из журнала"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
          />
        </div>

        <button
          className="btn btn-primary"
          disabled={busy || !subject.trim() || !message.trim() || !email}
        >
          {busy ? 'Отправляем…' : 'Отправить обращение'}
        </button>
      </form>
    </div>
  );
}
