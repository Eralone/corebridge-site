import type { MetadataRoute } from 'next';
import { execFileSync } from 'node:child_process';
import { docOrder, docsBySlug } from '@/lib/docs';

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
const PAGES: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency']; source: string }[] = [
  { path: '/', priority: 1, changeFrequency: 'weekly', source: 'app/(site)/(public)/page.tsx' },
  { path: '/pricing', priority: 0.9, changeFrequency: 'weekly', source: 'app/(site)/(public)/pricing/PricingBody.tsx' },
  { path: '/integrations', priority: 0.9, changeFrequency: 'weekly', source: 'app/(site)/(public)/integrations/page.tsx' },
  { path: '/docs', priority: 0.8, changeFrequency: 'monthly', source: 'app/(site)/(public)/docs/page.tsx' },
  { path: '/docs/epf', priority: 0.8, changeFrequency: 'monthly', source: 'content/docs/epf/manifest.json' },
  { path: '/n8n', priority: 0.7, changeFrequency: 'monthly', source: 'app/(site)/(public)/n8n/page.tsx' },
  { path: '/for-business', priority: 0.7, changeFrequency: 'monthly', source: 'app/(site)/(public)/for-business/page.tsx' },
  { path: '/contacts', priority: 0.6, changeFrequency: 'monthly', source: 'app/(site)/(public)/contacts/page.tsx' },
  { path: '/oferta', priority: 0.3, changeFrequency: 'yearly', source: 'content/legal/oferta.html' },
  { path: '/privacy', priority: 0.3, changeFrequency: 'yearly', source: 'content/legal/privacy.html' },
  { path: '/terms', priority: 0.3, changeFrequency: 'yearly', source: 'content/legal/terms.html' },
];

/**
 * Дата последнего изменения — из истории git по конкретному файлу, а не
 * «сейчас». Раньше карта на каждой выкладке объявляла все страницы
 * изменившимися: обход тратится впустую, а сигнал «эта страница правда
 * обновилась» обесценивается.
 *
 * Если git недоступен (сборка из архива), молча падаем на дату сборки — карта
 * без дат хуже, чем карта с приблизительной.
 */
const built = new Date();

function lastModified(source: string): Date {
  try {
    const iso = execFileSync('git', ['log', '-1', '--format=%cI', '--', source], {
      encoding: 'utf8',
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return iso ? new Date(iso) : built;
  } catch {
    return built;
  }
}

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    ...PAGES.map(({ path, priority, changeFrequency, source }) => ({
      url: `${HOST}${path}`,
      lastModified: lastModified(source),
      changeFrequency,
      priority,
    })),
    // Инструкции по .epf: список берём из манифеста сборки, чтобы карта не
    // расходилась с разделом при добавлении новой инструкции. Дата — по
    // markdown-исходнику: он и есть содержимое страницы
    ...docOrder.map((slug) => ({
      url: `${HOST}/docs/epf/${slug}`,
      lastModified: lastModified(`content/epf-docs/${docsBySlug[slug].source}`),
      changeFrequency: 'monthly' as const,
      // страницы установки отвечают на самые частые запросы — им вес выше
      priority: docsBySlug[slug].section === 'install' ? 0.7 : 0.6,
    })),
  ];
}
