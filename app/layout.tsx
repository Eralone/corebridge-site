import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'CoreBridge — no-code сервисная интеграция 1С',
  description:
    'CoreBridge — no-code сервисная интеграция 1С с маркетплейсами, сайтами, CRM, ' +
    'доставкой, оплатой и аналитикой. Один файл, 33 сервиса, без программистов.',
  metadataBase: new URL('https://corebridge.ru'),
};

/**
 * Дизайн-система — готовый design-source/assets/site.css, скопированный в
 * public/assets БЕЗ ИЗМЕНЕНИЙ. Tailwind и shadcn сознательно не используются:
 * их preflight переопределяет базовые стили site.css и ломает совпадение с макетом
 * (implementation_strategy.md §3).
 *
 * Шрифты: Inter 400–800 и JetBrains Mono 400/500 — те же, что в макетах, но
 * выложенные у себя (public/assets/fonts.css). В макете они подключались с
 * fonts.googleapis.com, и на живом сайте это молча не работало: CSP из nginx
 * разрешает стили и шрифты только со своего origin, браузер блокировал запрос,
 * и весь сайт рисовался системным шрифтом. Нашёл обход `node tools/inspect.mjs`.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <head>
        {/* шрифты первыми: site.css сразу ссылается на семейство Inter */}
        <link rel="stylesheet" href="/assets/fonts.css" />
        <link
          rel="preload"
          as="font"
          type="font/woff2"
          href="/assets/fonts/inter-cyrillic.woff2"
          crossOrigin="anonymous"
        />
        <link rel="stylesheet" href="/assets/site.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
