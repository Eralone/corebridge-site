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

/**
 * Куда middleware ходит проверять сессию.
 *
 * ⚠️ Ловушка, на которой guard молча не работал: внутри middleware `req.url`
 * равен `https://localhost:3005/...` — Next подставляет свой внутренний хост,
 * но со схемой https, хотя на 3005 слушает обычный http. Любой
 * `fetch(new URL('/lk/auth/session', req.url))` падал на рукопожатии TLS,
 * управление уходило в catch, и человека с валидной сессией всё равно
 * уводило на форму входа. Пока сессий не существовало, это было незаметно.
 *
 * Поэтому адрес задаём явно и ходим прямо в lk-api: порт 3000 слушает только
 * 127.0.0.1, лишний круг через nginx и TLS тут не нужен.
 */
const LK_API = process.env.LK_API_INTERNAL ?? 'http://127.0.0.1:3000';

/** Пути админ-субдомена → внутренние роуты Next.js */
const ADMIN_MAP: Record<string, string> = {
  '/': '/admin',
  '/users': '/admin/users',
  '/integrations': '/admin/integrations',
  '/payments': '/admin/payments',
  '/epf': '/admin/epf',
  '/queues': '/admin/queues',
  '/privacy': '/admin/privacy',
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

  // ── Возврат с формы Robokassa ─────────────────────────────────────────────
  // ⚠️ Запасной путь. В кабинете Robokassa с 2026-08-06 стоят канонические
  // /billing/success и /billing/fail, и сюда запрос приходить не должен.
  // Но старый адрес мог где-то остаться, а /lk/ целиком принадлежит API:
  // без подмены пути возврат клиента после оплаты ушёл бы в lk-api.
  // Та же природа, что у ссылки из письма-приглашения выше.
  //
  // Совпадение с серверным GET /lk/billing/:public_id закрыто на стороне
  // сервера: параметр ограничен префиксом `pay_`. До этого развязка держалась
  // только на порядке location в нашем nginx.
  //
  // Дальше по коду работает обычный guard ЛК: страницы возврата закрытые,
  // без сессии их показывать нечему — статус платежа спрашивается от имени
  // владельца. Поэтому здесь только подмена пути, без раннего возврата.
  const ROBOKASSA_RETURN: Record<string, string> = {
    '/lk/billing/success': '/billing/success',
    '/lk/billing/fail': '/billing/fail',
  };
  const returnPath = ROBOKASSA_RETURN[pathname];

  // ── Основной домен: админские роуты закрыты ───────────────────────────────
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    return new NextResponse(null, { status: 404 });
  }

  // ── Guard ЛК ──────────────────────────────────────────────────────────────
  // Путь, по которому решаем всё дальнейшее: для возврата с Robokassa это уже
  // наш /billing/*, а не /lk/billing/*, — иначе guard не узнал бы закрытый экран
  // и пустил бы на страницу платежа кого угодно.
  const routed = returnPath ?? pathname;

  /** Пропустить дальше: обычный next или подмена пути для возврата с Robokassa */
  const pass = () =>
    returnPath
      ? NextResponse.rewrite(new URL(returnPath + req.nextUrl.search, req.url))
      : NextResponse.next();

  const needsAuth = LK_ROUTES.some((r) => routed === r || routed.startsWith(`${r}/`));
  if (!needsAuth) return pass();

  // Без cookie сессии не тратим запрос к API — сразу на вход.
  if (!req.cookies.has('lk_session')) {
    return redirectToLogin(req, routed);
  }

  try {
    const res = await fetch(`${LK_API}/lk/auth/session`, {
      headers: {
        cookie: req.headers.get('cookie') ?? '',
        // ходим в обход nginx, поэтому имя домена сообщаем сами
        host: req.headers.get('host') ?? 'corebridge.ru',
      },
      cache: 'no-store',
    });

    if (res.ok) return pass();

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

    return redirectToLogin(req, routed);
  } catch {
    // API недоступен — не пускаем в ЛК, но и не показываем пустой экран.
    // Пользователь увидит форму входа, а не сломанный дашборд.
    return redirectToLogin(req, routed);
  }
}

function redirectToLogin(req: NextRequest, path?: string) {
  const url = new URL('/login', req.url);
  // Куда вернуть после входа. Сервер после своего редиректа ведёт на /dashboard,
  // здесь — на страницу, которую человек пытался открыть. Для возврата
  // с Robokassa возвращаем на наш путь, а не на /lk/... — второй раз через
  // nginx он прошёл бы, но в адресной строке остался бы префикс API.
  url.searchParams.set('next', (path ?? req.nextUrl.pathname) + req.nextUrl.search);
  return NextResponse.redirect(url);
}

export const config = {
  // Статику, служебные пути Next.js и favicon не трогаем
  matcher: ['/((?!_next/static|_next/image|assets/|favicon.ico|robots.txt|sitemap.xml).*)'],
};
