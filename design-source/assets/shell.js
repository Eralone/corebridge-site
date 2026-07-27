// Shared UI for app pages and public pages (authorized + anonymous + admin)
window.CB_USER = window.CB_USER || { name:'Дмитрий Королев', org:'Пробный тариф', initials:'КД', role:'user' };

window.renderSidebar = function(active) {
  const user = window.CB_USER;
  const items = [
    { id: 'dashboard', label: 'Дашборд', href: 'dashboard.html' },
    { id: 'integrations-app', label: 'Мои интеграции', href: 'integrations-app.html' },
    { id: 'epf', label: 'Файл .epf', href: 'epf.html' },
    { id: 'n8n', label: 'n8n-воркфлоу', href: 'n8n.html' },
    { id: 'billing', label: 'Биллинг и тариф', href: 'billing.html' },
    { id: 'support', label: 'Поддержка', href: 'support.html' },
    { id: 'settings', label: 'Настройки', href: 'settings.html' },
  ];
  const icons = {
    dashboard: 'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z',
    'integrations-app': 'M10 13a5 5 0 0 0 7 0l4-4a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-4 4a5 5 0 0 0 7 7l1-1',
    epf: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
    n8n: 'M5 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM19 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM5 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM19 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 5l3 6M17 5l-3 6M7 19l3-6M17 19l-3-6',
    billing: 'M2 5h20v14H2z M2 10h20',
    support: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
    settings: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M19 12a7 7 0 0 0-.1-1l2-1.6-2-3.4-2.4.9A7 7 0 0 0 15 5l-.4-2.5h-4L10 5a7 7 0 0 0-2.4 1.4l-2.4-.9-2 3.4 2 1.6A7 7 0 0 0 5 12a7 7 0 0 0 .1 1l-2 1.6 2 3.4 2.4-.9A7 7 0 0 0 10 19l.4 2.5h4L15 19a7 7 0 0 0 2.4-1.4l2.4.9 2-3.4-2-1.6',
  };
  const itemsHtml = items.map(it =>
    `<a href="${it.href}" class="${active===it.id?'active':''}">
      <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${icons[it.id]}"/></svg>
      <span>${it.label}</span>
    </a>`).join('');
  const adminLink = user.role === 'admin' ? `<a href="admin.html"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2 2 7l10 5 10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg><span>Админ-панель</span></a>` : '';
  return `
  <aside class="sidebar" aria-label="Главная навигация">
    <a class="brand" href="dashboard.html">
      <span class="logo" aria-hidden="true"></span>
      <span>CoreBridge</span>
    </a>
    <nav class="sidebar-nav">
      <div class="sidebar-section">Рабочее пространство</div>
      ${itemsHtml}
      ${adminLink ? `<div class="sidebar-section" style="margin-top:18px">Администратор</div>${adminLink}` : ''}
      <div class="sidebar-section" style="margin-top:18px">Прочее</div>
      <a href="index.html"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 12l9-9 9 9M5 10v10h14V10"/></svg><span>Главная сайта</span></a>
      <a href="login.html"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M16 17l5-5-5-5M21 12H9M12 3H5v18h7"/></svg><span>Выйти</span></a>
    </nav>
    <div class="sidebar-user">
      <div class="avatar">${user.initials}</div>
      <div>
        <div class="name">${user.name}</div>
        <div class="sub">${user.org}</div>
      </div>
    </div>
  </aside>`;
};

window.renderAdminSidebar = function(active) {
  const user = window.CB_USER;
  const items = [
    { id: 'admin', label: 'Обзор', href: 'admin.html' },
    { id: 'admin-users', label: 'Пользователи', href: 'admin-users.html' },
    { id: 'admin-integrations', label: 'Интеграции n8n', href: 'admin-integrations.html' },
    { id: 'admin-support', label: 'Поддержка', href: 'admin-support.html', badge: '12' },
  ];
  const icons = {
    'admin': 'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z',
    'admin-users': 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
    'admin-integrations': 'M5 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM19 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM5 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM19 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 5l3 6M17 5l-3 6M7 19l3-6M17 19l-3-6',
    'admin-support': 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  };
  const itemsHtml = items.map(it =>
    `<a href="${it.href}" class="${active===it.id?'active':''}">
      <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${icons[it.id]}"/></svg>
      <span style="flex:1">${it.label}</span>
      ${it.badge ? `<span class="side-badge">${it.badge}</span>` : ''}
    </a>`).join('');
  return `
  <aside class="sidebar" aria-label="Админ-навигация">
    <a class="brand" href="admin.html">
      <span class="logo" aria-hidden="true"></span>
      <span>CoreBridge</span>
    </a>
    <span class="admin-badge">● ADMIN PANEL</span>
    <nav class="sidebar-nav">
      <div class="sidebar-section">Управление</div>
      ${itemsHtml}
      <div class="sidebar-section" style="margin-top:18px">Выход из admin</div>
      <a href="dashboard.html"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg><span>В личный кабинет</span></a>
      <a href="login.html"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M16 17l5-5-5-5M21 12H9M12 3H5v18h7"/></svg><span>Выйти</span></a>
    </nav>
    <div class="sidebar-user">
      <div class="avatar" style="background:var(--admin)">${user.initials}</div>
      <div>
        <div class="name">${user.name}</div>
        <div class="sub">role: admin</div>
      </div>
    </div>
  </aside>`;
};

window.renderAdminTopbar = function(title, opts={}) {
  const user = window.CB_USER;
  const crumbs = opts.crumbs || [{label:'Admin', href:'admin.html'}, {label:title}];
  const crumbsHtml = crumbs.map((c,i) => {
    const isLast = i === crumbs.length-1;
    return isLast
      ? `<span style="color:var(--text)">${c.label}</span>`
      : `<a href="${c.href}" style="color:var(--text-muted)">${c.label}</a> <span style="color:var(--text-faint)">/</span>`;
  }).join(' ');
  return `
  <header class="topbar">
    <div>
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:2px">${crumbsHtml}</div>
      <h1>${title}</h1>
    </div>
    <div class="topbar-right">
      <span class="badge badge-success badge-dot" style="margin-right:8px">Системы в норме</span>
      <div style="text-align:right;line-height:1.25">
        <div style="font-size:13px;font-weight:600">${user.name}</div>
        <div style="font-size:11px;color:var(--text-faint)">${opts.email || 'd.korolev@corebridge.ru'}</div>
      </div>
      <a href="login.html" class="btn btn-outline btn-sm">Выйти</a>
    </div>
  </header>`;
};

window.renderTopbar = function(title, opts={}) {
  const user = window.CB_USER;
  return `
  <header class="topbar">
    <div>
      <h1>${title}</h1>
      ${opts.subtitle ? `<div class="text-muted" style="font-size:13px">${opts.subtitle}</div>` : ''}
    </div>
    <div class="topbar-right">
      <button class="icon-btn" aria-label="Поддержка" onclick="location.href='support.html'">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      </button>
      <a href="mailto:info@corebridge.ru" class="icon-btn" aria-label="Написать нам">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="m3 8 9 6 9-6"/></svg>
      </a>
      <div class="avatar">${user.initials}</div>
    </div>
  </header>`;
};

window.renderPublicHeader = function(active) {
  const items = [
    { id: 'features', label: 'Возможности', href: 'index.html#features' },
    { id: 'integrations', label: 'Интеграции', href: 'integrations.html' },
    { id: 'pricing', label: 'Тарифы', href: 'pricing.html' },
    { id: 'docs', label: 'Документация', href: 'docs.html' },
    { id: 'about', label: 'О нас', href: 'about.html' },
  ];
  return `
  <header class="site-header">
    <div class="container row" style="justify-content:space-between;align-items:center">
      <a href="index.html" class="logo-mark"><span class="logo-glyph"></span>CoreBridge</a>
      <nav class="nav-links">
        ${items.map(it => `<a href="${it.href}" ${active===it.id?'class="active"':''}>${it.label}</a>`).join('')}
      </nav>
      <div class="row gap-12">
        <a href="login.html" class="btn btn-ghost">Войти</a>
        <a href="register.html" class="btn btn-primary">Попробовать бесплатно</a>
      </div>
    </div>
  </header>`;
};

window.renderPublicFooter = function() {
  return `
  <footer class="site-footer">
    <div class="container">
      <div class="footer-grid">
        <div>
          <a href="index.html" class="logo-mark"><span class="logo-glyph"></span>CoreBridge</a>
          <p class="text-muted mt-16" style="max-width:300px;font-size:13px">No-code сервисная интеграция 1С с маркетплейсами, сайтами, CRM и сервисами.</p>
        </div>
        <div><h5>Продукт</h5><a href="integrations.html">Интеграции</a><a href="pricing.html">Тарифы</a><a href="docs.html">Документация</a></div>
        <div><h5>Компания</h5><a href="about.html">О проекте</a><a href="for-business.html">Для бизнеса</a><a href="contacts.html">Контакты</a></div>
        <div><h5>Связь</h5><a href="mailto:info@corebridge.ru">info@corebridge.ru</a><a href="support.html">Поддержка</a></div>
        <div><h5>Правовое</h5><a href="oferta.html">Оферта</a><a href="privacy.html">Конфиденциальность</a><a href="terms.html">Условия использования</a></div>
      </div>
      <div class="footer-bottom">© 2026 CoreBridge<br>ИП Королев Дмитрий Павлович · ИНН 120704119287</div>
    </div>
  </footer>`;
};
