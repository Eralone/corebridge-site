import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PublicHeader } from '@/components/PublicHeader';
import { PublicFooter } from '@/components/PublicFooter';
import { BreadcrumbLd, TechArticleLd } from '@/components/JsonLd';
import {
  articleOrder, formatDate, getArticle, getArticleHtml, getNeighbours,
} from '@/lib/articles';

/**
 * Один разбор.
 *
 * Тело — готовый HTML из `content/articles-built/<slug>.html`, собранный
 * `tools/build-articles.mjs`. Правки вносятся в `content/articles/<slug>.md`,
 * иначе они потеряются на следующей сборке.
 */
export function generateStaticParams() {
  return articleOrder.map((slug) => ({ slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const a = getArticle(params.slug);
  if (!a) return {};

  /**
   * Заголовок статьи написан для человека («Заказ в 1С есть, отгрузки нет»),
   * а в выдаче нужен ответ на запрос. Поэтому в title идёт seoTitle из шапки
   * исходника — он собран по данным Вебмастера о том, как реально спрашивают.
   */
  const url = `https://corebridge.ru/razbory/${a.slug}`;
  const title = `${a.seoTitle} — CoreBridge`;

  return {
    title,
    description: a.seoDescription,
    alternates: { canonical: url },
    // openGraph не наследуется вглубь: всё, чего здесь нет, страница потеряет
    openGraph: {
      title,
      description: a.seoDescription,
      url,
      type: 'article',
      siteName: 'CoreBridge',
      locale: 'ru_RU',
      publishedTime: a.date,
      images: [{ url: a.cover, width: 1200, height: 630, alt: a.title }],
    },
  };
}

export default function Page({ params }: { params: { slug: string } }) {
  const a = getArticle(params.slug);
  if (!a) notFound();

  const html = getArticleHtml(a.slug);
  const { prev, next } = getNeighbours(a.slug);

  return (
    <>
      <BreadcrumbLd
        items={[
          { name: 'Главная', path: '/' },
          { name: 'Разборы', path: '/razbory' },
          { name: a.title, path: `/razbory/${a.slug}` },
        ]}
      />
      <TechArticleLd
        headline={a.seoTitle}
        description={a.seoDescription}
        path={`/razbory/${a.slug}`}
      />
      <PublicHeader active="razbory" />

      <main className="razbory-article">
        <div className="p-crumbs">
          <Link href="/">Главная</Link> / <Link href="/razbory">Разборы</Link>
        </div>

        <div className="razbory-card-meta">
          <span className="razbory-tag">{a.format}</span>
          <time dateTime={a.date}>{formatDate(a.date)}</time>
        </div>

        <h1>{a.title}</h1>

        <img
          className="razbory-cover"
          src={a.cover}
          alt=""
          width={1200}
          height={630}
          fetchPriority="high"
        />

        <article className="doc-body" dangerouslySetInnerHTML={{ __html: html }} />

        <nav className="docs-prevnext">
          {prev ? (
            <Link href={`/razbory/${prev.slug}`} className="docs-prevnext-item">
              <span>← Предыдущий</span>
              <b>{prev.title}</b>
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link href={`/razbory/${next.slug}`} className="docs-prevnext-item next">
              <span>Следующий →</span>
              <b>{next.title}</b>
            </Link>
          ) : (
            <span />
          )}
        </nav>

        <p className="text-muted" style={{ marginTop: 28 }}>
          Остались вопросы? Напишите на <a href="mailto:info@corebridge.ru">info@corebridge.ru</a> —
          отвечаем в течение рабочего дня.
        </p>
      </main>

      <PublicFooter />
    </>
  );
}
