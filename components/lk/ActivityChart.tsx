import type { ActivityPoint } from '@/lib/contracts/lk';

/**
 * График активности. В макете это статичный path с придуманными точками —
 * здесь он строится из `GET /lk/dashboard/activity`. Размеры холста, сетка,
 * градиент и толщина линии оставлены как в макете.
 */

const W = 640;
const H = 220;
const TOP = 20; // сверху оставляем воздух, иначе пик упирается в край
const BOTTOM = 200;

export function ActivityChart({ points }: { points: ActivityPoint[] }) {
  const max = Math.max(1, ...points.map((p) => p.total));
  const step = points.length > 1 ? W / (points.length - 1) : W;

  const xy = points.map((p, i) => {
    const x = Math.round(i * step);
    const y = Math.round(BOTTOM - (p.total / max) * (BOTTOM - TOP));
    return `${x},${y}`;
  });

  const line = xy.length ? `M${xy.join(' L')}` : '';
  const area = xy.length ? `${line} L${W},${H} L0,${H} Z` : '';

  return (
    <svg className="chart-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-label="График активности">
      <defs>
        <linearGradient id="g1" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#3E92CC" stopOpacity=".35" />
          <stop offset="100%" stopColor="#3E92CC" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g stroke="#EEF2F9" strokeWidth="1">
        <line x1="0" y1="40" x2={W} y2="40" />
        <line x1="0" y1="90" x2={W} y2="90" />
        <line x1="0" y1="140" x2={W} y2="140" />
        <line x1="0" y1="190" x2={W} y2="190" />
      </g>
      {area && <path d={area} fill="url(#g1)" />}
      {line && <path d={line} fill="none" stroke="#3E92CC" strokeWidth="2.5" />}
    </svg>
  );
}

/** Подписи под графиком: в макете были зашиты, здесь считаются по точкам */
export function ActivityLegend({ points }: { points: ActivityPoint[] }) {
  const total = points.reduce((s, p) => s + p.total, 0);
  const ok = points.reduce((s, p) => s + p.ok, 0);
  const err = points.reduce((s, p) => s + p.error, 0);
  const n = (v: number) => v.toLocaleString('ru-RU');

  return (
    <div className="row mt-16" style={{ gap: 20, fontSize: 13, color: 'var(--text-muted)' }}>
      <span>
        <Dot color="var(--blue-500)" />
        Синхронизации: {n(total)}
      </span>
      <span>
        <Dot color="var(--success)" />
        Успешно: {n(ok)}
      </span>
      <span>
        <Dot color="var(--danger)" />
        Ошибок: {n(err)}
      </span>
    </div>
  );
}

function Dot({ color }: { color: string }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 10,
        height: 10,
        background: color,
        borderRadius: '50%',
        marginRight: 6,
      }}
    />
  );
}
