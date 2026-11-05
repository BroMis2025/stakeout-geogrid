import { NextResponse } from 'next/server';
import { db, Prisma } from '@stakeout/db';
import {
  hashPassword,
  verifyPassword,
  signSessionToken,
  SESSION_COOKIE_NAME,
} from '@/lib/auth';
import { limit, clientKey } from '@/lib/limits';
import { errorResponse } from '@/lib/api';
import { InputError } from '@stakeout/core/grid';
export async function POST(req: Request) {
  try {
    const body = await req.json(),
      email = String(body.email ?? '')
        .trim()
        .toLowerCase(),
      pass = String(body.password ?? '');
    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      email.length > 254 ||
      pass.length < 6 ||
      pass.length > 256
    )
      throw new InputError(
        'Enter a valid email and password (6–256 characters).',
      );
    await limit('login', clientKey(req), 60, 900);
    let user;
    if (body.mode === 'register') {
      if (email.endsWith('@internal.invalid'))
        throw new InputError('Use your agency email address.');
      await limit('register', clientKey(req), 5, 86400);
      const passwordHash = await hashPassword(pass);
      user = await db.user.create({
        data: {
          email,
          passwordHash,
          name:
            String(body.name ?? '')
              .trim()
              .slice(0, 100) || null,
          role: 'AGENCY',
          creditBalance: 150,
          ledger: { create: { reason: 'WELCOME_GRANT', amount: 150 } },
        },
      });
    } else {
      user = await db.user.findUnique({ where: { email } });
      if (
        !user?.passwordHash ||
        !(await verifyPassword(pass, user.passwordHash))
      )
        throw new InputError('Invalid email or password.', 401);
    }
    const res = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        creditBalance: user.creditBalance,
      },
    });
    res.cookies.set(SESSION_COOKIE_NAME, signSessionToken(user.id), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 2592000,
    });
    return res;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')
      return NextResponse.json(
        { error: 'That address is already registered.' },
        { status: 409 },
      );
    return errorResponse(e);
  }
}
