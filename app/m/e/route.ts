import { NextRequest, NextResponse } from 'next/server';
import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Приём событий своего счётчика (`public/assets/mkt.js`).
 *
 * Путь `/m/e`, а не `/api/...`: префикс `/api/v1/` на этом домене nginx отдаёт
 * бэкенду (bridge и license-service), и роут Next.js там просто не получил бы
 * запрос. `/m/*` не занят ничем и уходит в `location /` на 3005.
 *
 * Пишем в файл, а не в базу. У сайта своей БД нет, а класть маркетинговый учёт
 * в продуктовый Postgres нельзя: он принадлежит бэкенду, который выкатывается
 * автодеплоем с чужого ПК. Строки складываются в JSONL по суткам, и раз в день
 * `marketing/scripts/ingest_tracker.py` сводит их в свою базу. Отказ записи
 * не должен ломать страницу, поэтому ответ всегда 204 — счётчик не спорит
 * с сайтом за право работать.
 *
 * Персональные данные сюда не попадают: клиент шлёт только обезличенный
 * идентификатор из своей cookie, путь страницы, источник и разметку utm.
 * IP не сохраняется вовсе — в отличие от лога nginx, где он и так есть.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DIR = join(process.cwd(), 'marketing', 'data', 'tracker');

/** Грубый ограничитель: 60 событий в минуту с адреса. Чтобы эндпоинт нельзя
 *  было засыпать, не заводя ради этого Redis. Память процесса переживает
 *  перезапуск как надо — обнуляется. */
const seen = new Map<string, { count: number; until: number }>();

function tooMany(ip: string): boolean {
  const now = Date.now();
  const rec = seen.get(ip);
  if (!rec || rec.until < now) {
    seen.set(ip, { count: 1, until: now + 60_000 });
    if (seen.size > 5_000) seen.clear(); // защита от роста на ровном месте
    return false;
  }
  rec.count += 1;
  return rec.count > 60;
}

const EVENTS = new Set(['pageview', 'cta_click', 'form_submit']);

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (tooMany(ip)) return new NextResponse(null, { status: 204 });

  try {
    const raw = await req.text();
    if (raw.length > 4_000) return new NextResponse(null, { status: 204 });

    const body = JSON.parse(raw) as Record<string, unknown>;
    const event = String(body.event ?? '');
    if (!EVENTS.has(event)) return new NextResponse(null, { status: 204 });

    const str = (v: unknown, max: number) =>
      typeof v === 'string' ? v.slice(0, max) : null;

    const row = {
      ts: new Date().toISOString(),
      event,
      visitor_id: str(body.visitor_id, 32),
      session_id: str(body.session_id, 32),
      url: str(body.url, 500),
      referrer: str(body.referrer, 300),
      first_touch: str(body.first_touch, 200),
      utm: typeof body.utm === 'object' ? body.utm : {},
      meta: typeof body.meta === 'object' ? body.meta : {},
      screen: str(body.screen, 20),
      ua: str(req.headers.get('user-agent'), 200),
    };

    await mkdir(DIR, { recursive: true });
    const day = row.ts.slice(0, 10);
    await appendFile(join(DIR, `${day}.jsonl`), JSON.stringify(row) + '\n', 'utf8');
  } catch {
    // молча: счётчик не имеет права влиять на работу сайта
  }

  return new NextResponse(null, { status: 204 });
}

/** GET сюда приходит только от роботов и любопытных — отвечаем коротко. */
export function GET() {
  return new NextResponse(null, { status: 405 });
}
