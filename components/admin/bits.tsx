'use client';

import type { PlanCode } from '@/lib/contracts/lk';

/**
 * Мелочи, общие для админ-экранов: форматирование и честное сообщение о том,
 * что источник данных недоступен.
 */

/**
 * Канонические названия тарифов. В макете админки были «Корпоративный»,
 * «Профессиональный», «Старт» — расходятся с каталогом (`GET /lk/plans`).
 * Здесь их держим локально по одной причине: админ-субдомен ходит только
 * в `/admin/*`, каталог тарифов живёт на другом хосте (`corebridge.ru/lk/plans`),
 * и тянуть его кросс-доменно ради четырёх подписей — лишняя связность.
 * Коды — из `VALID_PLANS` сервера, менять их без миграции нельзя.
 */
const PLAN_TITLES: Record<string, string> = {
  trial: 'Пробный',
  starter: 'Старт',
  business: 'Бизнес',
  professional: 'Профессионал',
  enterprise: 'Энтерпрайз',
};

export const PLAN_CODES: PlanCode[] = ['trial', 'starter', 'business', 'professional', 'enterprise'];

export function planTitle(code: string | null | undefined): string {
  if (!code) return '—';
  return PLAN_TITLES[code] ?? code;
}

/** `07584704-9800-…-30bbeb513007` → `tnt_07584704…13007`, как в макете */
export function shortId(id: string | null | undefined): string {
  if (!id) return '—';
  const flat = id.replace(/-/g, '');
  if (flat.length <= 13) return id;
  return `tnt_${flat.slice(0, 8)}…${flat.slice(-5)}`;
}

/** Дата и время в один короткий блок: «29.07, 16:42» */
export function ts(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  const d = typeof value === 'number' ? new Date(value * 1000) : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}, ${d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
}

/** Только дата: «29.07.2026» */
export function dt(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('ru-RU');
}

/**
 * Часть админского API отвечает 500 из-за расхождения SQL со схемой БД
 * (`Documents/prompts/backend_S13_admin.md`). Пустая таблица в этом случае
 * соврала бы: «данных нет» вместо «данные не пришли». Показываем прямо.
 */
export function Blocked({ what, endpoint }: { what: string; endpoint?: string }) {
  return (
    <div className="adm-blocked">
      <b>Не загрузилось: {what}.</b> Остальные блоки на странице работают.
      {endpoint && (
        <>
          {' '}
          Источник — <code>{endpoint}</code>.
        </>
      )}{' '}
      Если это повторяется, причина и порядок починки описаны в промте S13 для бэкенда.
    </div>
  );
}

/** Статус тенанта: четыре значения, интерфейс не должен падать на незнакомом */
export function TenantStatus({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    active: { cls: 'badge-success', label: 'активен' },
    blocked: { cls: 'badge-danger', label: 'заблокирован' },
    pending_deletion: { cls: 'badge-warning', label: 'на удалении' },
    purged: { cls: 'badge-neutral', label: 'вычищен' },
  };
  const m = map[status] ?? { cls: 'badge-neutral', label: status };
  return <span className={`badge ${m.cls}`}>{m.label}</span>;
}
