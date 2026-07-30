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
  /** Короткое описание для публичного каталога — из того же integrations-data.js */
  desc?: string;
}

export const ADAPTERS: Record<string, AdapterInfo> = {
  'ozon': { name: 'Ozon', cat: 'Маркетплейсы', color: '#005BFF', glyph: 'OZ', desc: 'Заказы FBO/FBS, остатки, цены, возвраты.' },
  'wb': { name: 'Wildberries', cat: 'Маркетплейсы', color: '#CB11AB', glyph: 'WB', desc: 'Заказы, остатки, цены, маркировка.' },
  'ym': { name: 'Яндекс Маркет', cat: 'Маркетплейсы', color: '#FFCC00', glyph: 'Я', fg: '#000', desc: 'Заказы DBS/FBY, прайс‑лист.' },
  'mp-other': { name: 'Иное', cat: 'Маркетплейсы', color: '#64748B', glyph: '+', desc: 'Конструктор произвольных интеграций.' },
  'rest': { name: 'Свой сайт (REST)', cat: 'Сайт', color: '#0F172A', glyph: '{}', desc: 'Универсальный REST‑обмен с вашим сайтом.' },
  'bitrix': { name: '1С‑Битрикс', cat: 'Сайт', color: '#1B94DC', glyph: 'Б', desc: 'Каталог, заказы, клиенты.' },
  'wordpress': { name: 'WordPress', cat: 'Сайт', color: '#21759B', glyph: 'W', desc: 'WooCommerce: товары и заказы.' },
  'opencart': { name: 'OpenCart', cat: 'Сайт', color: '#4BB8F0', glyph: 'OC', desc: 'Обмен заказами и товарами.' },
  'tilda': { name: 'Tilda', cat: 'Сайт', color: '#FFD422', glyph: 'T', fg: '#000', desc: 'Формы и заказы Tilda.' },
  'insales': { name: 'InSales', cat: 'Сайт', color: '#2E86DE', glyph: 'iS', desc: 'Магазин InSales: товары, заказы.' },
  'ecwid': { name: 'Ecwid', cat: 'Сайт', color: '#F6891F', glyph: 'E', desc: 'Интернет‑магазин на Ecwid.' },
  'b24': { name: 'Битрикс24', cat: 'CRM', color: '#2FC6F6', glyph: 'Б24', desc: 'Сделки, лиды, контакты.' },
  'amo': { name: 'AmoCRM', cat: 'CRM', color: '#339CCC', glyph: 'a', desc: 'Воронка, сделки, контакты.' },
  'megaplan': { name: 'Мегаплан', cat: 'CRM', color: '#00AEEF', glyph: 'М', desc: 'Сделки и задачи.' },
  'sbis': { name: 'СБИС CRM', cat: 'CRM', color: '#EE1C25', glyph: 'С', desc: 'Сделки, документы, контрагенты.' },
  'neaktor': { name: 'Neaktor', cat: 'CRM', color: '#E84E4E', glyph: 'N', desc: 'Задачи и сделки.' },
  'cdek': { name: 'СДЭК', cat: 'Доставка', color: '#00B33C', glyph: 'СД', desc: 'Расчёт, оформление, отслеживание.' },
  'russian-post': { name: 'Почта России', cat: 'Доставка', color: '#00529B', glyph: 'ПР', desc: 'Отправления и трек‑номера.' },
  'ym-delivery': { name: 'Яндекс Доставка', cat: 'Доставка', color: '#FC3F1D', glyph: 'ЯД', desc: 'Курьер и экспресс‑доставка.' },
  'yookassa': { name: 'ЮKassa', cat: 'Оплата', color: '#5B3F99', glyph: 'Ю', desc: 'Онлайн‑оплата, чеки 54‑ФЗ.' },
  'sbp': { name: 'СБП', cat: 'Оплата', color: '#00A3FF', glyph: 'СБП', desc: 'Оплата по QR‑коду.' },
  'tinkoff': { name: 'Т‑Банк', cat: 'Оплата', color: '#FFDD2D', glyph: 'Т', fg: '#000', desc: 'Эквайринг, рассрочка.' },
  'sber': { name: 'Сбер', cat: 'Оплата', color: '#21A038', glyph: 'С', desc: 'Эквайринг Сбера.' },
  'mindbox': { name: 'MindBox', cat: 'CDP / Маркетинг', color: '#1652F0', glyph: 'M', desc: 'CDP и рассылки.' },
  'sendpulse': { name: 'SendPulse', cat: 'CDP / Маркетинг', color: '#FF6533', glyph: 'SP', desc: 'Email, SMS, push.' },
  'moysklad': { name: 'МойСклад', cat: 'CDP / Маркетинг', color: '#1F8FE0', glyph: 'МС', desc: 'Товарный учёт.' },
  'tg': { name: 'Telegram', cat: 'Соцсети', color: '#229ED9', glyph: 'TG', desc: 'Уведомления и боты.' },
  'wa': { name: 'WhatsApp', cat: 'Соцсети', color: '#25D366', glyph: 'WA', desc: 'Сообщения клиентам.' },
  'viber': { name: 'Viber', cat: 'Соцсети', color: '#7360F2', glyph: 'V', desc: 'Рассылки и уведомления.' },
  'vk': { name: 'ВКонтакте', cat: 'Соцсети', color: '#0077FF', glyph: 'VK', desc: 'Сообщения и магазин.' },
  'ok': { name: 'Одноклассники', cat: 'Соцсети', color: '#EE8208', glyph: 'OK', desc: 'Магазин и сообщения.' },
  'gsheets': { name: 'Google Sheets', cat: 'Аналитика', color: '#0F9D58', glyph: 'GS', desc: 'Выгрузка отчётов в таблицы.' },
  'powerbi': { name: 'Power BI', cat: 'Аналитика', color: '#F2C811', glyph: 'PB', fg: '#000', desc: 'Дашборды и отчёты.' },
  'roistat': { name: 'Roistat', cat: 'Аналитика', color: '#FF4D4D', glyph: 'R', desc: 'Сквозная аналитика.' },
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
