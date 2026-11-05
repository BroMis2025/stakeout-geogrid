import { db } from '@stakeout/db';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1 FROM "User" LIMIT 1`;
    return Response.json({ ok: true, service: 'postgres' });
  } catch {
    return Response.json({ ok: false, service: 'postgres' }, { status: 503 });
  }
}
