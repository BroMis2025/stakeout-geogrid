// apps/nextjs/src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
const PROTECTED_PREFIXES = ['/new-scan', '/scans', '/admin'];
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  // Allow public client share links (/share/[scanId]) & public APIs
  if (
    pathname.startsWith('/share') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next')
  ) {
    return NextResponse.next();
  }
  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix),
  );
  if (isProtected) {
    const sessionCookie = req.cookies.get('stakeout_uid')?.value;
    if (!sessionCookie || !sessionCookie.includes('.')) {
      const loginUrl = new URL('/login', req.url);
      loginUrl.searchParams.set('next', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }
  return NextResponse.next();
}
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
