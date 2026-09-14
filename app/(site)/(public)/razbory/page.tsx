import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicHeader } from '@/components/PublicHeader';
import { PublicFooter } from '@/components/PublicFooter';
import { BreadcrumbLd } from '@/components/JsonLd';
import { articleOrder, articlesBySlug, formatDate } from '@/lib/articles';

/**
 * Оглавление раздела «Разборы».
 *
 * Раздел собирает тексты о том, почему обмен ведёт себя не так, как ожидают:
 * расходятся остатки, теряется отгрузка, задваивается оплата. Инструкции
 * «как настроить» живут отдельно, в /docs/epf.
 */
export const metadata: Metadata = {
  title: 'Разборы: интеграция 1С с маркетплейсами на практике — CoreBridge',
  description:
    'Почему остатки 1С и маркетплейса не сходятся, куда вносить оплату по СБП, ' +
    'где теряется отгрузка, что делать с кодами маркировки. Разборы механик обмена.',
  alternates: { canonical: 'https://corebridge.ru/razbory' },
  openGraph: {
    title: 'Разборы: интеграция 1С с маркетплейсами на практике',
    description: 'Разборы механик обмена 1С с маркетплейсами, CRM и платёжными сервисами.',
    url: 'https://corebridge.ru/razbory',
    type: 'website',
    siteName: 'CoreBridge',
    locale: 'ru_RU',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'CoreBridge — интеграция 1С' }],
  },
};

export default function Page() {
  return (
    <>
      <BreadcrumbLd
        items={[
          { name: 'Главная', path: '/' },
          { name: 'Разборы', path: '/razbory' },
        ]}
      />
      <PublicHeader active="razbory" />

      <main className="wrap" style={{ paddingTop: 40, paddingBottom: 64 }}>
        <div className="p-crumbs">
          <Link href="/">Главная</Link> / Разборы
        </div>

        <h1>Разборы</h1>
        <p className="text-muted" style={{ maxWidth: 680, marginBottom: 32 }}>
          Почему обмен ведёт себя не так, как ожидают: расходятся остатки, теряется
          отгрузка, задваивается оплата. Пошаговые инструкции по настройке —
          в разделе <Link href="/docs/epf">Инструкции по .epf</Link>.
        </p>

        <div className="razbory-grid">
          {articleOrder.map((slug) => {
            const a = articlesBySlug[slug];
            return (
              <Link key={slug} href={`/razbory/${slug}`} className="razbory-card">
                <img src={a.cover} alt="" width={1200} height={630} loading="lazy" decoding="async" />
                <div className="razbory-card-body">
                  <div className="razbory-card-meta">
                    <span className="razbory-tag">{a.format}</span>
                    <time dateTime={a.date}>{formatDate(a.date)}</time>
                  </div>
                  <h3>{a.title}</h3>
                  <p>{a.lead}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </main>

      <PublicFooter />
    </>
  );
}
