import type { Metadata } from 'next';
import type { ReactNode } from 'react';

/**
 * Общие метаданные. Заголовок и описание страницы задают сами, здесь — то,
 * что одинаково везде: карточка для соцсетей и правила для роботов.
 *
 * `openGraph` без него ссылка на сайт в Telegram, ВКонтакте и мессенджерах
 * выглядит голой строкой: клиент подставляет под превью первое попавшееся
 * изображение страницы. Картинку рисует `tools/make-og.mjs` — теми же шрифтом
 * и цветами, что и сайт.
 *
 * `googleBot: max-snippet/max-image-preview` — разрешение показывать длинный
 * сниппет и крупное превью. По умолчанию поисковик осторожничает и режет.
 */
export const metadata: Metadata = {
  title: 'Интеграция 1С с маркетплейсами, CRM и сайтами — CoreBridge',
  description:
    'Интеграция 1С с Ozon, Wildberries, Яндекс.Маркетом, Битрикс24, СДЭК и ещё 30 сервисами. ' +
    'Один файл .epf для УТ 11, УНФ, КА 2 / ERP и Бухгалтерии 3.0 — без программистов.',
  metadataBase: new URL('https://corebridge.ru'),
  applicationName: 'CoreBridge',
  openGraph: {
    type: 'website',
    siteName: 'CoreBridge',
    locale: 'ru_RU',
    url: 'https://corebridge.ru',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'CoreBridge — интеграция 1С' }],
  },
  twitter: { card: 'summary_large_image', images: ['/og.png'] },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-snippet': -1, 'max-image-preview': 'large' },
  },
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
