export function StubBody({ source, stage }: { source: string; stage: string }) {
  return (
    <>
      <div className="badge badge-neutral">Этап {stage}</div>
      <div className="card mt-16">
        <h4>Экран в работе</h4>
        <p className="text-muted" style={{ margin: 0, fontSize: 14 }}>
          Оболочка подключена: сайдбар, топбар и дизайн-система на месте. Содержимое
          переносится 1:1 из эталона{' '}
          <code style={{ fontFamily: 'var(--mono)', fontSize: 13 }}>design-source/{source}</code>.
          Расхождения с API по этому экрану — в{' '}
          <code style={{ fontSize: 13 }}>Documents/design_findings.md</code>.
        </p>
      </div>
    </>
  );
}
