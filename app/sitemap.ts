import type { MetadataRoute } from 'next';

/**
 * Карта сайта. Только публичные страницы: экраны ЛК закрыты guard'ом из
 * middleware.ts, админка живёт на своём субдомене — ни то, ни другое в индекс
 * не идёт. Формы входа и регистрации тоже не включаем: содержания у них нет,
 * а в выдаче они мешают попасть на нужную страницу.
 *
 * ⚠️ design-source/sitemap.html — это оглавление дизайн-поставки, а не страница
 * сайта. К этому файлу отношения не имеет и в карту не попадает.
 */

const HOST = 'https://corebridge.ru';

/** priority — относительный вес внутри сайта, а не обещание поисковику */
const PAGES: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'] }[] = [
  { path: '/', priority: 1, changeFrequency: 'weekly' },
  { path: '/pricing', priority: 0.9, changeFrequency: 'weekly' },
  { path: '/integrations', priority: 0.9, changeFrequency: 'weekly' },
  { path: '/docs', priority: 0.8, changeFrequency: 'weekly' },
  { path: '/n8n', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/for-business', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/contacts', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/oferta', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/privacy', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/terms', priority: 0.3, changeFrequency: 'yearly' },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return PAGES.map(({ path, priority, changeFrequency }) => ({
    url: `${HOST}${path}`,
    lastModified,
    changeFrequency,
    priority,
  }));
}
