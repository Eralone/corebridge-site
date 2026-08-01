import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PublicHeader } from '@/components/PublicHeader';
import { PublicFooter } from '@/components/PublicFooter';
import { DocsNav } from '@/components/DocsNav';
import { BreadcrumbLd, TechArticleLd } from '@/components/JsonLd';
import { docOrder, getDoc, getDocHtml, getNeighbours, getSection } from '@/lib/docs';

/**
 * Одна инструкция по .epf.
 *
 * Тело статьи — готовый HTML из `content/docs/epf/<slug>.html`, собранный
 * `tools/build-docs.mjs` из markdown команды модуля. Разметку правим не здесь,
 * а в исходнике или в сборщике: иначе правка потеряется на следующей сборке.
 */
export function generateStaticParams() {
  return docOrder.map((slug) => ({ slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const doc = getDoc(params.slug);
  if (!doc) return {};
  /**
   * Заголовок инструкции написан для того, кто уже в разделе («Как настроить
   * выгрузку остатков»), а в выдаче нужен ответ на запрос. У страниц, которые
   * на такой запрос отвечают, есть свой заголовок — карта SEO в build-docs.mjs.
   */
  const url = `https://corebridge.ru/docs/epf/${doc.slug}`;
  const title = doc.seo ? `${doc.seo.title} — CoreBridge` : `${doc.title} — CoreBridge`;
  const description = doc.seo?.description ?? doc.lead;

  return {
    title,
    description,
    alternates: { canonical: url },
    /**
     * ⚠️ Картинку и siteName приходится повторять. Next не сливает `openGraph`
     * с родительским вглубь: страница, задавшая свой блок, теряет всё, чего
     * в нём нет, — включая og:image из корневого layout.
     */
    openGraph: {
      title,
      description,
      url,
      type: 'article',
      siteName: 'CoreBridge',
      locale: 'ru_RU',
      images: [{ url: '/og.png', width: 1200, height: 630, alt: 'CoreBridge — интеграция 1С' }],
    },
  };
}

export default function Page({ params }: { params: { slug: string } }) {
  const doc = getDoc(params.slug);
  if (!doc) notFound();

  const html = getDocHtml(doc.slug);
  const section = getSection(doc.section);
  const { prev, next } = getNeighbours(doc.slug);

  return (
    <>
      <BreadcrumbLd
        items={[
          { name: 'Главная', path: '/' },
          { name: 'Документация', path: '/docs' },
          { name: 'Инструкции по .epf', path: '/docs/epf' },
          { name: doc.nav, path: `/docs/epf/${doc.slug}` },
        ]}
      />
      <TechArticleLd
        headline={doc.seo?.title ?? doc.title}
        description={doc.seo?.description ?? doc.lead}
        path={`/docs/epf/${doc.slug}`}
      />
      <PublicHeader active="docs" />

      <div className="docs-layout docs-layout-article">
        <DocsNav active={doc.slug} />

        <main className="docs-content">
          <div className="p-crumbs">
            <Link href="/">Главная</Link> / <Link href="/docs">Документация</Link> /{' '}
            <Link href="/docs/epf">Инструкции по .epf</Link>
            {section ? ` / ${section.title}` : null}
          </div>

          <h1>{doc.title}</h1>

          <article className="doc-body" dangerouslySetInnerHTML={{ __html: html }} />

          <nav className="docs-prevnext">
            {prev ? (
              <Link href={`/docs/epf/${prev.slug}`} className="docs-prevnext-item">
                <span>← Предыдущая</span>
                <b>{prev.nav}</b>
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link href={`/docs/epf/${next.slug}`} className="docs-prevnext-item next">
                <span>Следующая →</span>
                <b>{next.nav}</b>
              </Link>
            ) : (
              <span />
            )}
          </nav>

          <p className="text-muted" style={{ marginTop: 28 }}>
            Не нашли ответ? Напишите на <a href="mailto:info@corebridge.ru">info@corebridge.ru</a> —
            отвечаем в течение рабочего дня.
          </p>
        </main>

        <aside className="docs-toc">
          <h5>На этой странице</h5>
          {doc.toc.map((t) => (
            <a key={t.id} href={`#${t.id}`}>
              {t.text}
            </a>
          ))}
        </aside>
      </div>

      <PublicFooter />
    </>
  );
}
