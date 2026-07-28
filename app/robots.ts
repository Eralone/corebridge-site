import type { MetadataRoute } from 'next';

/**
 * Экраны кабинета закрыты сессией и всё равно отдали бы роботу форму входа —
 * убираем их из обхода, чтобы не плодить в индексе дубли `/login`.
 * `/lk/*` и `/api/*` принадлежат бэкенду, `/admin/*` на основном домене отдаёт 404.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/dashboard',
        '/epf',
        '/my-integrations',
        '/workflows',
        '/billing',
        '/settings',
        '/support',
        '/invite/',
        '/reset-password',
        '/verify-email',
        '/lk/',
        '/admin',
        '/api/',
      ],
    },
    sitemap: 'https://corebridge.ru/sitemap.xml',
    host: 'https://corebridge.ru',
  };
}
