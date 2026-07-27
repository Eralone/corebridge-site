// Каталог интеграций CoreBridge. Иконки - SVG-заглушки/brand-mark.
window.CB_INTEGRATIONS = [
  // Маркетплейсы
  {id:'ozon', name:'Ozon', cat:'Маркетплейсы', color:'#005BFF', glyph:'OZ', desc:'Заказы FBO/FBS, остатки, цены, возвраты.'},
  {id:'wb', name:'Wildberries', cat:'Маркетплейсы', color:'#CB11AB', glyph:'WB', desc:'Заказы, остатки, цены, маркировка.'},
  {id:'ym', name:'Яндекс Маркет', cat:'Маркетплейсы', color:'#FFCC00', fg:'#000', glyph:'Я', desc:'Заказы DBS/FBY, прайс‑лист.'},
  {id:'mp-other', name:'Иное', cat:'Маркетплейсы', color:'#64748B', glyph:'+', desc:'Конструктор произвольных интеграций.'},

  // Сайт
  {id:'rest', name:'Свой сайт (REST)', cat:'Сайт', color:'#0F172A', glyph:'{}', desc:'Универсальный REST‑обмен с вашим сайтом.'},
  {id:'bitrix', name:'1С‑Битрикс', cat:'Сайт', color:'#1B94DC', glyph:'Б', desc:'Каталог, заказы, клиенты.'},
  {id:'wordpress', name:'WordPress', cat:'Сайт', color:'#21759B', glyph:'W', desc:'WooCommerce: товары и заказы.'},
  {id:'opencart', name:'OpenCart', cat:'Сайт', color:'#4BB8F0', glyph:'OC', desc:'Обмен заказами и товарами.'},
  {id:'tilda', name:'Tilda', cat:'Сайт', color:'#FFD422', fg:'#000', glyph:'T', desc:'Формы и заказы Tilda.'},
  {id:'insales', name:'InSales', cat:'Сайт', color:'#2E86DE', glyph:'iS', desc:'Магазин InSales: товары, заказы.'},
  {id:'ecwid', name:'Ecwid', cat:'Сайт', color:'#F6891F', glyph:'E', desc:'Интернет‑магазин на Ecwid.'},

  // CRM
  {id:'b24', name:'Битрикс24', cat:'CRM', color:'#2FC6F6', glyph:'Б24', desc:'Сделки, лиды, контакты.'},
  {id:'amo', name:'AmoCRM', cat:'CRM', color:'#339CCC', glyph:'a', desc:'Воронка, сделки, контакты.'},
  {id:'megaplan', name:'Мегаплан', cat:'CRM', color:'#00AEEF', glyph:'М', desc:'Сделки и задачи.'},
  {id:'sbis', name:'СБИС CRM', cat:'CRM', color:'#EE1C25', glyph:'С', desc:'Сделки, документы, контрагенты.'},
  {id:'neaktor', name:'Neaktor', cat:'CRM', color:'#E84E4E', glyph:'N', desc:'Задачи и сделки.'},

  // Доставка
  {id:'cdek', name:'СДЭК', cat:'Доставка', color:'#00B33C', glyph:'СД', desc:'Расчёт, оформление, отслеживание.'},
  {id:'russian-post', name:'Почта России', cat:'Доставка', color:'#00529B', glyph:'ПР', desc:'Отправления и трек‑номера.'},
  {id:'ym-delivery', name:'Яндекс Доставка', cat:'Доставка', color:'#FC3F1D', glyph:'ЯД', desc:'Курьер и экспресс‑доставка.'},

  // Оплата
  {id:'yookassa', name:'ЮKassa', cat:'Оплата', color:'#5B3F99', glyph:'Ю', desc:'Онлайн‑оплата, чеки 54‑ФЗ.'},
  {id:'sbp', name:'СБП', cat:'Оплата', color:'#00A3FF', glyph:'СБП', desc:'Оплата по QR‑коду.'},
  {id:'tinkoff', name:'Т‑Банк', cat:'Оплата', color:'#FFDD2D', fg:'#000', glyph:'Т', desc:'Эквайринг, рассрочка.'},
  {id:'sber', name:'Сбер', cat:'Оплата', color:'#21A038', glyph:'С', desc:'Эквайринг Сбера.'},

  // CDP / Маркетинг
  {id:'mindbox', name:'MindBox', cat:'CDP / Маркетинг', color:'#1652F0', glyph:'M', desc:'CDP и рассылки.'},
  {id:'sendpulse', name:'SendPulse', cat:'CDP / Маркетинг', color:'#FF6533', glyph:'SP', desc:'Email, SMS, push.'},
  {id:'moysklad', name:'МойСклад', cat:'CDP / Маркетинг', color:'#1F8FE0', glyph:'МС', desc:'Товарный учёт.'},

  // Соцсети
  {id:'tg', name:'Telegram', cat:'Соцсети', color:'#229ED9', glyph:'TG', desc:'Уведомления и боты.'},
  {id:'wa', name:'WhatsApp', cat:'Соцсети', color:'#25D366', glyph:'WA', desc:'Сообщения клиентам.'},
  {id:'viber', name:'Viber', cat:'Соцсети', color:'#7360F2', glyph:'V', desc:'Рассылки и уведомления.'},
  {id:'vk', name:'ВКонтакте', cat:'Соцсети', color:'#0077FF', glyph:'VK', desc:'Сообщения и магазин.'},
  {id:'ok', name:'Одноклассники', cat:'Соцсети', color:'#EE8208', glyph:'OK', desc:'Магазин и сообщения.'},

  // Аналитика
  {id:'gsheets', name:'Google Sheets', cat:'Аналитика', color:'#0F9D58', glyph:'GS', desc:'Выгрузка отчётов в таблицы.'},
  {id:'powerbi', name:'Power BI', cat:'Аналитика', color:'#F2C811', fg:'#000', glyph:'PB', desc:'Дашборды и отчёты.'},
  {id:'roistat', name:'Roistat', cat:'Аналитика', color:'#FF4D4D', glyph:'R', desc:'Сквозная аналитика.'},
];

window.CB_CATEGORIES = ['Маркетплейсы','Сайт','CRM','Доставка','Оплата','CDP / Маркетинг','Соцсети','Аналитика'];

window.CB_ICON = function(it, size=40){
  const fg = it.fg || '#fff';
  return `<div class="cb-ic" style="width:${size}px;height:${size}px;background:${it.color};color:${fg};">${it.glyph}</div>`;
};
