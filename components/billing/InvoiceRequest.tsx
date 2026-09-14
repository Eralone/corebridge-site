'use client';

import { useState } from 'react';
import { sendContact } from '@/lib/api/lk';
import type { Profile } from '@/lib/contracts/lk';
import { Popup } from '@/components/Popup';

/**
 * Заявка на счёт для юрлица и на тариф «Энтерпрайз».
 *
 * В макете (`billing.html`) это был попап-заглушка. Здесь настоящая заявка через
 * `POST /lk/contact` с `source: "billing"` — тот же путь, что у формы контактов,
 * с номером обращения в ответе.
 *
 * Сюда же приводит `400 CUSTOM_PRICE_PLAN`: «Энтерпрайз» оплатить нельзя,
 * цена по запросу, и человека надо привести к форме, а не к сообщению об ошибке
 * (F20 §7.6). Вынесено из BillingBody, чтобы страница оплаты не заводила вторую
 * копию той же формы.
 */
export function InvoiceRequest({
  profile,
  title = 'Счёт для юрлица',
  intro,
  subject,
  onClose,
  onDone,
}: {
  profile: Profile | null;
  title?: string;
  intro?: string;
  /** Что именно просят — уходит в текст обращения */
  subject?: string;
  onClose: () => void;
  onDone: (s: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [company, setCompany] = useState(profile?.company.company_name ?? '');
  const [inn, setInn] = useState(profile?.company.company_inn ?? '');

  return (
    <Popup open title={title} onClose={onClose} actions={[]}>
      <p className="text-muted" style={{ fontSize: 13.5, marginTop: 0 }}>
        {intro ??
          `Заявка уйдёт на info@corebridge.ru. Счёт и договор вышлем на ${profile?.user.email ?? 'вашу почту'}.`}
      </p>
      {error && <div className="lk-error">{error}</div>}
      <div className="field">
        <label htmlFor="inv-company">Организация</label>
        <input
          id="inv-company"
          className="input"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
        />
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
                message:
                  `${subject ?? 'Запрос счёта для юрлица'}. ` +
                  `Организация: ${company}. ИНН: ${inn}.`,
                source: 'billing',
              });
              onDone(`Заявка принята, номер ${r.ref}. Ответим в течение рабочего дня.`);
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
