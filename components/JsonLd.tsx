/**
 * Структурированные данные Schema.org.
 *
 * Зачем: поисковику иначе приходится догадываться, что за организация стоит за
 * сайтом, что за продукт он описывает и где в иерархии лежит открытая страница.
 * Разметка отвечает на это прямо и попадает в сниппет — хлебными крошками
 * вместо голого URL.
 *
 * ⚠️ **Только то, что видно на странице.** Разметка, обещающая больше самой
 * страницы, — повод для санкций, а не для трафика. Поэтому здесь нет ни цен
 * (они приходят из `GET /lk/plans` и меняются), ни рейтингов и отзывов
 * (их у нас нет вовсе), ни FAQPage: ответы в тарифах собираются в браузере
 * из ответа API, и разметка разошлась бы с текстом при первом же изменении.
 */

const SITE = 'https://corebridge.ru';

type Json = Record<string, unknown>;

function Script({ data }: { data: Json }) {
  return (
    <script
      type="application/ld+json"
      // содержимое своё, не пользовательское; `<` экранируем на случай,
      // если в описании когда-нибудь окажется угловая скобка
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  );
}

/** Организация и сайт. Ставится один раз — на главной. */
export function OrganizationLd() {
  return (
    <>
      <Script
        data={{
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: 'CoreBridge',
          url: SITE,
          logo: `${SITE}/og.png`,
          email: 'info@corebridge.ru',
          description:
            'Платформа интеграции 1С с маркетплейсами, сайтами, CRM, службами доставки, ' +
            'приёмом оплаты и аналитикой.',
        }}
      />
      <Script
        data={{
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: 'CoreBridge',
          url: SITE,
          inLanguage: 'ru-RU',
        }}
      />
      <Script
        data={{
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: 'CoreBridge',
          applicationCategory: 'BusinessApplication',
          operatingSystem: '1С:Предприятие 8.3.18 и новее',
          url: SITE,
          inLanguage: 'ru-RU',
          softwareRequirements:
            '1С:Управление торговлей 11, 1С:Управление нашей фирмой, ' +
            '1С:Комплексная автоматизация 2 / ERP или 1С:Бухгалтерия предприятия 3.0',
          description:
            'Внешняя обработка .epf связывает 1С с маркетплейсами Ozon, Wildberries ' +
            'и Яндекс.Маркет, интернет-магазинами, CRM, доставкой, оплатой и аналитикой.',
        }}
      />
    </>
  );
}

/**
 * Хлебные крошки. Порядок тот же, что в видимой строке над заголовком —
 * иначе разметка спорит со страницей.
 */
export function BreadcrumbLd({ items }: { items: { name: string; path: string }[] }) {
  return (
    <Script
      data={{
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: items.map((item, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: item.name,
          item: `${SITE}${item.path}`,
        })),
      }}
    />
  );
}

/** Страница инструкции. */
export function TechArticleLd({
  headline,
  description,
  path,
}: {
  headline: string;
  description: string;
  path: string;
}) {
  return (
    <Script
      data={{
        '@context': 'https://schema.org',
        '@type': 'TechArticle',
        headline,
        description,
        inLanguage: 'ru-RU',
        mainEntityOfPage: { '@type': 'WebPage', '@id': `${SITE}${path}` },
        publisher: { '@type': 'Organization', name: 'CoreBridge', url: SITE },
      }}
    />
  );
}
