import Link from 'next/link';

/**
 * Временная заглушка экрана на этапе Э0. Каждая страница заменяется переносом
 * вёрстки 1:1 из design-source/ на своём этапе (Э1–Э8), см. README.
 */
export function Stub({
  title,
  source,
  stage,
}: {
  title: string;
  source: string;
  stage: string;
}) {
  return (
    <main className="container" style={{ padding: '80px 24px', maxWidth: 760 }}>
      <div className="badge badge-neutral">Этап {stage}</div>
      <h1 className="mt-16">{title}</h1>
      <p className="text-muted">
        Каркас страницы поднят. Вёрстка переносится 1:1 из эталона{' '}
        <code style={{ fontFamily: 'var(--mono)', fontSize: 13 }}>design-source/{source}</code>.
      </p>
      <div className="card mt-24">
        <h4>Что уже работает</h4>
        <p className="text-muted" style={{ margin: 0, fontSize: 14 }}>
          Дизайн-система <code>site.css</code> подключена, шрифты загружены, маршрут отвечает.
          Расхождения дизайна с API по этому экрану разобраны в{' '}
          <code style={{ fontSize: 13 }}>Documents/design_findings.md</code>.
        </p>
      </div>
      <p className="mt-24">
        <Link href="/">← На главную</Link>
      </p>
    </main>
  );
}
