import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PROTECTED = ['/feed', '/friends', '/settings', '/notifications', '/messenger', '/discover', '/blog/new', '/blog/edit', '/bulletins', '/communities/new', '/memories', '/mod', '/themes/mine'];

// Pre-launch: LAUNCH_MODE=soon shows the coming-soon page everywhere, except for people holding the preview key.
const SOON_OPEN = ['/soon', '/privacy', '/rules', '/terms', '/preview', '/copyright', '/report-content', '/api/sentinel'];

export async function middleware(request: NextRequest) {
  const path0 = request.nextUrl.pathname;
  if (process.env.LAUNCH_MODE === 'soon') {
    const key = process.env.PREVIEW_KEY;
    const previewing = !!key && key.length >= 12 && request.cookies.get('ln_preview')?.value === key;
    const open = SOON_OPEN.some((p) => path0 === p || path0.startsWith(p + '/'));
    if (!previewing && !open) {
      if (path0.startsWith('/api/') || path0.startsWith('/auth/')) return new NextResponse('Not open yet', { status: 404 });
      const url = request.nextUrl.clone(); url.pathname = '/soon'; url.search = '';
      return NextResponse.rewrite(url);
    }
    if (!previewing) return NextResponse.next();
  }
  let response = NextResponse.next({ request });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  if (!user && PROTECTED.some((p) => path === p || path.startsWith(p + '/'))) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '?next=' + encodeURIComponent(path + request.nextUrl.search);
    return NextResponse.redirect(url);
  }
  if (user && (path === '/login' || path === '/signup')) {
    const url = request.nextUrl.clone(); url.pathname = '/feed'; url.search = '';
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?)$).*)'] };
