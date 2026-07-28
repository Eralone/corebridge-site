import { NextResponse, type NextRequest } from 'next/server';

/**
 * Разводка субдоменов и guard Личного кабинета.
 *
 * ── Почему это нужно ────────────────────────────────────────────────────────
 * Префиксы /lk/* и /admin/* принадлежат бэкенду: nginx проксирует их в
 * lk-api:3000 и admin:3003 и до Next.js они не доходят. Поэтому:
 *
 *  · экраны ЛК живут в корне — /dashboard, /epf, /billing, а не /lk/dashboard;
 *  · на admin.corebridge.ru интерфейс тоже живёт в корне, а внутренние роуты
 *    Next.js лежат под app/(admin)/admin/. Без переписывания путей экран
 *    админки недостижим: /admin редиректит на /admin/, а его забирает nginx
 *    и отправляет в API (проверено — отдавал 403 от IP-whitelist).
 */

/** Экраны ЛК: доступны только с валидной сессией */
const LK_ROUTES = [
  '/dashboard',
  '/epf',
  '/my-integrations',
  '/workflows',
  '/billing',
  '/settings',
  '/support',
];

/** Пути админ-субдомена → внутренние роуты Next.js */
const ADMIN_MAP: Record<string, string> = {
  '/': '/admin',
  '/users': '/admin/users',
  '/integrations': '/admin/integrations',
};

function isAdminHost(host: string) {
  return host.split(':')[0].startsWith('admin.');
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const host = req.headers.get('host') ?? '';

  // ── Админ-субдомен ────────────────────────────────────────────────────────
  if (isAdminHost(host)) {
    // /admin/* — это API, его забирает nginx. Сюда запрос попасть не должен,
    // но если попал (прямое обращение к 3005) — не переписываем и не мешаем.
    if (pathname.startsWith('/admin')) return NextResponse.next();

    const target = ADMIN_MAP[pathname];
    if (target) {
      return NextResponse.rewrite(new URL(target, req.url));
    }
    // Остальное на админ-субдомене не обслуживаем: экраны сайта туда не пускаем,
    // чтобы /pricing и /login не открывались с админского хоста.
    return NextResponse.rewrite(new URL('/admin', req.url));
  }

  // ── Приглашение в команду ─────────────────────────────────────────────────
  // Сервер шлёт в письме ссылку ${LK_BASE_URL}/lk/invite/accept?token=…, а весь
  // /lk/* забирает API — ссылка приводила в 404. В vhost заведено точное
  // совпадение location = /lk/invite/accept на Next.js, здесь путь приводим
  // к нашей странице. Бэкенд менять не понадобилось.
  if (pathname === '/lk/invite/accept') {
    const url = new URL('/invite/accept', req.url);
    url.search = req.nextUrl.search;
    return NextResponse.rewrite(url);
  }

  // ── Основной домен: админские роуты закрыты ───────────────────────────────
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    return new NextResponse(null, { status: 404 });
  }

  // ── Guard ЛК ──────────────────────────────────────────────────────────────
  const needsAuth = LK_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`));
  if (!needsAuth) return NextResponse.next();

  // Без cookie сессии не тратим запрос к API — сразу на вход.
  if (!req.cookies.has('lk_session')) {
    return redirectToLogin(req);
  }

  try {
    // single-origin: nginx на этом же хосте проксирует /lk/* в lk-api
    const res = await fetch(new URL('/lk/auth/session', req.url), {
      headers: { cookie: req.headers.get('cookie') ?? '' },
      cache: 'no-store',
    });

    if (res.ok) return NextResponse.next();

    if (res.status === 403) {
      // Сервер различает два состояния (S8 §3.3): заблокирован админом и
      // помечен на удаление. Экраны разные, поэтому код пробрасываем в URL.
      let code = 'TENANT_BLOCKED';
      try {
        const body = (await res.json()) as { error?: string };
        if (body?.error) code = body.error;
      } catch {
        // тело не JSON — остаётся значение по умолчанию
      }
      const url = new URL('/login', req.url);
      url.searchParams.set('error', code);
      return NextResponse.redirect(url);
    }

    return redirectToLogin(req);
  } catch {
    // API недоступен — не пускаем в ЛК, но и не показываем пустой экран.
    // Пользователь увидит форму входа, а не сломанный дашборд.
    return redirectToLogin(req);
  }
}

function redirectToLogin(req: NextRequest) {
  const url = new URL('/login', req.url);
  // Куда вернуть после входа. Сервер после своего редиректа ведёт на /dashboard,
  // здесь — на страницу, которую человек пытался открыть.
  url.searchParams.set('next', req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.redirect(url);
}

export const config = {
  // Статику, служебные пути Next.js и favicon не трогаем
  matcher: ['/((?!_next/static|_next/image|assets/|favicon.ico|robots.txt|sitemap.xml).*)'],
};
