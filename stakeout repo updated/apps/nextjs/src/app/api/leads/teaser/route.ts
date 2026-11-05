import { randomUUID } from 'node:crypto';
import { db } from '@stakeout/db';
import { parseSpec, InputError } from '@stakeout/core/grid';
import { createScan } from '@stakeout/core/scans';
import { limit, clientKey } from '@/lib/limits';
import { errorResponse } from '@/lib/api';
export async function POST(req: Request) {
  try {
    const b = await req.json(),
      email = String(b.email ?? '')
        .trim()
        .toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
      throw new InputError('A valid work email is required.');
    const s = parseSpec({
      keyword: b.keyword,
      targetBusiness: b.targetBusiness,
      centerLat: b.lat,
      centerLng: b.lng,
      gridSize: 3,
    });
    await limit('teaser-ip', clientKey(req), 3, 86400);
    await limit('teaser-email', email, 1, 86400);
    await limit(
      'teaser-global',
      'all',
      Number(process.env.TEASER_DAILY_LIMIT ?? 25),
      86400,
    );
    const owner = await db.user.upsert({
      where: { email: 'teasers@internal.invalid' },
      update: {},
      create: {
        email: 'teasers@internal.invalid',
        role: 'SYSTEM',
        creditBalance: 0,
      },
    });
    const scan = await createScan(owner.id, s, 'teaser:' + randomUUID(), {
      email,
    });
    return Response.json(
      { reportPath: '/share/' + scan.shareToken },
      { status: 202 },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
