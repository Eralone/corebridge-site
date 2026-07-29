/**
 * Справочник адаптеров: имя, категория, фирменный цвет и буквы на плашке.
 *
 * Источник — design-source/assets/integrations-data.js (34 записи). Оттуда же
 * берёт данные публичный каталог. Одна запись — «Иное» (`mp-other`) — не сервис,
 * а пункт «нужен другой»: в счётчике «33 сервиса» её не считаем.
 *
 * ⚠️ Коды здесь из макета. Сервер использует свои `adapter_type` (`ozon`, `wb`,
 * `ym`, `bitrix24`, `amocrm`, `cdek`, `yukassa`, `telegram`, `google_sheets`…) —
 * пересекаются, но не обязаны совпадать полностью, поэтому неизвестный код
 * не ломает экран: показываем сам код и нейтральную плашку.
 */
export interface AdapterInfo {
  name: string;
  cat: string;
  color: string;
  glyph: string;
  fg?: string;
}

export const ADAPTERS: Record<string, AdapterInfo> = {
  'ozon': { name: 'Ozon', cat: 'Маркетплейсы', color: '#005BFF', glyph: 'OZ' },
  'wb': { name: 'Wildberries', cat: 'Маркетплейсы', color: '#CB11AB', glyph: 'WB' },
  'ym': { name: 'Яндекс Маркет', cat: 'Маркетплейсы', color: '#FFCC00', glyph: 'Я', fg: '#000' },
  'mp-other': { name: 'Иное', cat: 'Маркетплейсы', color: '#64748B', glyph: '+' },
  'rest': { name: 'Свой сайт (REST)', cat: 'Сайт', color: '#0F172A', glyph: '{}' },
  'bitrix': { name: '1С‑Битрикс', cat: 'Сайт', color: '#1B94DC', glyph: 'Б' },
  'wordpress': { name: 'WordPress', cat: 'Сайт', color: '#21759B', glyph: 'W' },
  'opencart': { name: 'OpenCart', cat: 'Сайт', color: '#4BB8F0', glyph: 'OC' },
  'tilda': { name: 'Tilda', cat: 'Сайт', color: '#FFD422', glyph: 'T', fg: '#000' },
  'insales': { name: 'InSales', cat: 'Сайт', color: '#2E86DE', glyph: 'iS' },
  'ecwid': { name: 'Ecwid', cat: 'Сайт', color: '#F6891F', glyph: 'E' },
  'b24': { name: 'Битрикс24', cat: 'CRM', color: '#2FC6F6', glyph: 'Б24' },
  'amo': { name: 'AmoCRM', cat: 'CRM', color: '#339CCC', glyph: 'a' },
  'megaplan': { name: 'Мегаплан', cat: 'CRM', color: '#00AEEF', glyph: 'М' },
  'sbis': { name: 'СБИС CRM', cat: 'CRM', color: '#EE1C25', glyph: 'С' },
  'neaktor': { name: 'Neaktor', cat: 'CRM', color: '#E84E4E', glyph: 'N' },
  'cdek': { name: 'СДЭК', cat: 'Доставка', color: '#00B33C', glyph: 'СД' },
  'russian-post': { name: 'Почта России', cat: 'Доставка', color: '#00529B', glyph: 'ПР' },
  'ym-delivery': { name: 'Яндекс Доставка', cat: 'Доставка', color: '#FC3F1D', glyph: 'ЯД' },
  'yookassa': { name: 'ЮKassa', cat: 'Оплата', color: '#5B3F99', glyph: 'Ю' },
  'sbp': { name: 'СБП', cat: 'Оплата', color: '#00A3FF', glyph: 'СБП' },
  'tinkoff': { name: 'Т‑Банк', cat: 'Оплата', color: '#FFDD2D', glyph: 'Т', fg: '#000' },
  'sber': { name: 'Сбер', cat: 'Оплата', color: '#21A038', glyph: 'С' },
  'mindbox': { name: 'MindBox', cat: 'CDP / Маркетинг', color: '#1652F0', glyph: 'M' },
  'sendpulse': { name: 'SendPulse', cat: 'CDP / Маркетинг', color: '#FF6533', glyph: 'SP' },
  'moysklad': { name: 'МойСклад', cat: 'CDP / Маркетинг', color: '#1F8FE0', glyph: 'МС' },
  'tg': { name: 'Telegram', cat: 'Соцсети', color: '#229ED9', glyph: 'TG' },
  'wa': { name: 'WhatsApp', cat: 'Соцсети', color: '#25D366', glyph: 'WA' },
  'viber': { name: 'Viber', cat: 'Соцсети', color: '#7360F2', glyph: 'V' },
  'vk': { name: 'ВКонтакте', cat: 'Соцсети', color: '#0077FF', glyph: 'VK' },
  'ok': { name: 'Одноклассники', cat: 'Соцсети', color: '#EE8208', glyph: 'OK' },
  'gsheets': { name: 'Google Sheets', cat: 'Аналитика', color: '#0F9D58', glyph: 'GS' },
  'powerbi': { name: 'Power BI', cat: 'Аналитика', color: '#F2C811', glyph: 'PB', fg: '#000' },
  'roistat': { name: 'Roistat', cat: 'Аналитика', color: '#FF4D4D', glyph: 'R' },
};

/** «Иное» — не сервис, а пункт «нужен другой». В счётчике сервисов не участвует */
export const NOT_A_SERVICE = new Set(['mp-other', 'site-other', 'crm-other', 'svc-other']);

export function adapterInfo(type: string): AdapterInfo {
  return (
    ADAPTERS[type] ?? {
      name: type,
      cat: 'Прочее',
      color: 'var(--navy-700)',
      glyph: type.slice(0, 2).toUpperCase(),
    }
  );
}

/** Категории в том порядке, в каком они идут в каталоге дизайна */
export const CATEGORIES = [
  'Маркетплейсы',
  'Сайт',
  'CRM',
  'Доставка',
  'Оплата',
  'CDP / Маркетинг',
  'Соцсети',
  'Аналитика',
];
