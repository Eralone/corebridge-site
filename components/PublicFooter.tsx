import Link from 'next/link';

/**
 * Перенос window.renderPublicFooter из shell.js.
 * ⚠️ «О проекте» вёл на about.html (нет такой страницы) → /for-business.
 * Почта: единый ящик info@corebridge.ru (приём настроен, MX добавлен).
 */
export function PublicFooter() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <Link href="/" className="logo-mark">
              <span className="logo-glyph" />
              CoreBridge
            </Link>
            {/* ⚠️ в эталоне здесь стоял class="text-muted" — это светлая тема,
                на тёмном фоне подвала текст получался почти нечитаемым.
                Цвет берём из палитры подвала (#C9D5F2, как у .site-footer). */}
            <p className="mt-16" style={{ maxWidth: 300, fontSize: 13, color: '#A8BCE0' }}>
              No-code сервисная интеграция 1С с маркетплейсами, сайтами, CRM и сервисами.
            </p>
          </div>
          <div>
            <h5>Продукт</h5>
            <Link href="/integrations">Интеграции</Link>
            <Link href="/pricing">Тарифы</Link>
            <Link href="/docs">Документация</Link>
          </div>
          <div>
            <h5>Компания</h5>
            <Link href="/for-business">О проекте</Link>
            <Link href="/for-business">Для бизнеса</Link>
            <Link href="/contacts">Контакты</Link>
          </div>
          <div>
            <h5>Связь</h5>
            <a href="mailto:info@corebridge.ru">info@corebridge.ru</a>
            <Link href="/support">Поддержка</Link>
          </div>
          <div>
            <h5>Правовое</h5>
            <Link href="/oferta">Оферта</Link>
            <Link href="/privacy">Конфиденциальность</Link>
            <Link href="/terms">Условия использования</Link>
          </div>
        </div>
        <div className="footer-bottom">
          © 2026 CoreBridge
          <br />
          ИП Королев Дмитрий Павлович · ИНН 120704119287
        </div>
      </div>
    </footer>
  );
}
