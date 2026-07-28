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
 * Шрифты: Inter 400–800 и JetBrains Mono 400/500 — те же, что в макетах.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap"
        />
        <link rel="stylesheet" href="/assets/site.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
