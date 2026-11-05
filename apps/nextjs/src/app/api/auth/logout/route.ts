// apps/nextjs/src/app/api/auth/logout/route.ts
import { NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME } from '@/lib/auth';
export async function POST() {
  const res = NextResponse.json({ success: true });
  res.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    path: '/',
    maxAge: 0,
  });
  return res;
}
