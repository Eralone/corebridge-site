/* Свой счётчик посещений. 1,5 КБ, без зависимостей, ничего не грузит со стороны.
 *
 * Зачем он, если визиты и так видны в логах nginx: лог не отличает одного
 * человека, зашедшего трижды за неделю, от трёх разных — там только IP, а он
 * меняется. Здесь визит помечается своей cookie, и появляется то, чего в логе
 * нет: повторные заходы, источник ПЕРВОГО визита (по нему считается, какой
 * канал реально привёл клиента) и нажатия кнопок.
 *
 * Чего он не делает намеренно:
 *   — не собирает персональные данные: ни email, ни телефон, ни содержимое форм;
 *   — не ходит на чужие домены, поэтому не нарушает CSP и не зависит от Google;
 *   — не мешает странице: отправка через sendBeacon в фоне, ошибки молча гасятся.
 *
 * Уважает Do Not Track: при dnt=1 счётчик не ставит cookie и ничего не шлёт.
 */
(function () {
  'use strict';

  try {
    if (navigator.doNotTrack === '1' || window.doNotTrack === '1') return;

    var YEAR = 31536000;
    var SESSION = 1800; // 30 минут неактивности — новая сессия

    function cookie(name) {
      var m = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)');
      return m ? decodeURIComponent(m[2]) : null;
    }

    function setCookie(name, value, maxAge) {
      document.cookie =
        name + '=' + encodeURIComponent(value) +
        ';path=/;max-age=' + maxAge + ';SameSite=Lax' +
        (location.protocol === 'https:' ? ';Secure' : '');
    }

    function id() {
      // crypto.randomUUID есть не везде (Safari до 15.4) — отсюда запасной путь
      if (window.crypto && crypto.randomUUID) return crypto.randomUUID().replace(/-/g, '').slice(0, 16);
      return (Date.now().toString(36) + Math.random().toString(36).slice(2, 10)).slice(0, 16);
    }

    var visitor = cookie('cb_v');
    if (!visitor) { visitor = id(); }
    setCookie('cb_v', visitor, YEAR);

    var session = cookie('cb_s');
    if (!session) { session = id(); }
    setCookie('cb_s', session, SESSION); // продлевается каждым просмотром

    var params = new URLSearchParams(location.search);
    var utm = {};
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(function (k) {
      var v = params.get(k);
      if (v) utm[k] = v.slice(0, 120);
    });

    // Источник первого визита — фиксируется один раз и больше не меняется:
    // клиент, пришедший из Telegram и вернувшийся через месяц напрямую,
    // должен остаться заслугой Telegram.
    var first = cookie('cb_ft');
    if (!first) {
      first = utm.utm_source || (document.referrer ? document.referrer.slice(0, 200) : 'direct');
      setCookie('cb_ft', first, YEAR);
    }

    function send(event, meta) {
      var payload = {
        event: event,
        visitor_id: visitor,
        session_id: session,
        url: location.pathname + location.search,
        referrer: document.referrer || '',
        first_touch: first,
        utm: utm,
        meta: meta || {},
        screen: window.innerWidth + 'x' + window.innerHeight
      };
      var body = JSON.stringify(payload);
      try {
        if (navigator.sendBeacon) {
          navigator.sendBeacon('/m/e', new Blob([body], { type: 'application/json' }));
        } else {
          var xhr = new XMLHttpRequest();
          xhr.open('POST', '/m/e', true);
          xhr.setRequestHeader('Content-Type', 'application/json');
          xhr.send(body);
        }
      } catch (e) { /* счётчик не имеет права ломать страницу */ }
    }

    send('pageview');

    // Нажатия на то, что ведёт к деньгам: кнопки тарифов, регистрация, оплата.
    // Размечается атрибутом data-mkt="имя" — без него ничего не считается,
    // чтобы отчёт не забивался случайными ссылками.
    document.addEventListener('click', function (e) {
      var el = e.target && e.target.closest ? e.target.closest('[data-mkt]') : null;
      if (!el) return;
      send('cta_click', {
        name: el.getAttribute('data-mkt').slice(0, 60),
        text: (el.textContent || '').trim().slice(0, 60),
        href: el.getAttribute('href') || ''
      });
    }, true);
  } catch (e) { /* то же самое: молча */ }
})();
